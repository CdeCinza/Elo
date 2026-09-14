<?php

namespace App\Http\Controllers\Api;

use App\Events\OrderStatusChanged;
use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Order;
use App\Models\Payment;
use App\Models\RestaurantTable;
use App\Services\StripePaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class StripePaymentController extends Controller
{
    public function __construct(
        protected StripePaymentService $stripeService
    ) {}

    /**
     * 1. Cria PaymentIntent no Stripe com valor calculado pelo servidor
     */
    public function createPaymentIntent(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'table_number' => 'nullable|string',
            'order_id' => 'nullable|integer|exists:orders,id',
            'include_service' => 'nullable|boolean',
        ]);

        $order = null;
        $table = null;

        if (! empty($validated['order_id'])) {
            $order = Order::with('items')->find($validated['order_id']);
            $table = $order?->table;
        } elseif (! empty($validated['table_number'])) {
            $cleanNumber = preg_replace('/[^0-9]/', '', $validated['table_number']);
            $intNumber = (int) $cleanNumber;

            $table = RestaurantTable::where('number', $validated['table_number'])
                ->orWhere('number', "Mesa {$cleanNumber}")
                ->orWhere('number', "Mesa {$intNumber}")
                ->orWhere('number', sprintf('%02d', $intNumber))
                ->first();

            if (! $table) {
                return response()->json(['message' => "Mesa '{$validated['table_number']}' no encontrada."], 404);
            }

            $order = $table->activeOrder;
        }

        if (! $order || $order->items()->count() === 0) {
            return response()->json([
                'message' => 'Nenhum pedido ativo ou itens encontrados para cobrana nesta mesa.',
            ], 422);
        }

        $subtotal = (float) $order->items()->sum('subtotal');
        $includeService = $validated['include_service'] ?? false;
        $serviceFee = $includeService ? round($subtotal * 0.10, 2) : 0.00;
        $totalAmount = round($subtotal + $serviceFee, 2);

        if ($totalAmount <= 0) {
            return response()->json([
                'message' => 'O total da comanda deve ser maior que zero para efetuar o pagamento.',
            ], 422);
        }

        try {
            $metadata = [
                'order_id' => (string) $order->id,
                'table_id' => (string) ($table?->id ?? ''),
                'table_number' => (string) ($table?->number ?? ''),
                'service_fee' => (string) $serviceFee,
            ];

            $intent = $this->stripeService->createPaymentIntent($totalAmount, 'brl', $metadata);

            return response()->json([
                'client_secret' => $intent['client_secret'],
                'payment_intent_id' => $intent['id'],
                'amount' => $totalAmount,
                'currency' => 'BRL',
                'order_id' => $order->id,
                'table_number' => $table?->number,
            ]);
        } catch (\Throwable $e) {
            Log::error('[StripePaymentController] Falha ao criar PaymentIntent', [
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'No foi possvel inicializar o pagamento no Stripe: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * 2. Confirmao do pagamento aps finalizao no Stripe Elements
     */
    public function confirmPayment(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'payment_intent_id' => 'required|string',
            'table_number' => 'nullable|string',
            'order_id' => 'nullable|integer',
        ]);

        try {
            $intent = $this->stripeService->retrievePaymentIntent($validated['payment_intent_id']);

            if (($intent['status'] ?? '') !== 'succeeded') {
                return response()->json([
                    'message' => 'O pagamento ainda no foi concludo no Stripe. Status atual: '.($intent['status'] ?? 'desconhecido'),
                ], 400);
            }

            $orderId = $validated['order_id'] ?? ($intent['metadata']['order_id'] ?? null);
            $order = $orderId ? Order::find($orderId) : null;

            if (! $order && ! empty($validated['table_number'])) {
                $table = RestaurantTable::where('number', $validated['table_number'])
                    ->orWhere('number', 'like', "%{$validated['table_number']}%")
                    ->first();
                $order = $table?->activeOrder;
            }

            if (! $order) {
                return response()->json(['message' => 'Pedido correspondente no encontrado.'], 404);
            }

            $table = $order->table;
            $amountInCents = $intent['amount_received'] ?? $intent['amount'] ?? 0;
            $paidAmount = round($amountInCents / 100, 2);

            DB::transaction(function () use ($order, $table, $intent, $paidAmount) {
                // Registro de pagamento idempotente
                Payment::firstOrCreate(
                    ['transaction_id' => $intent['id']],
                    [
                        'order_id' => $order->id,
                        'method' => 'credit_card',
                        'status' => 'paid',
                        'amount' => $paidAmount,
                        'paid_at' => now(),
                    ]
                );

                $order->update(['status' => 'delivered']);

                if ($table) {
                    $table->update(['status' => 'free']);

                    ActivityLog::where('subject_type', RestaurantTable::class)
                        ->where('subject_id', $table->id)
                        ->delete();
                }
            });

            broadcast(new OrderStatusChanged($order))->toOthers();

            return response()->json([
                'message' => 'Pagamento aprovado e mesa liberada com sucesso!',
                'payment' => [
                    'transaction_id' => $intent['id'],
                    'status' => 'paid',
                    'amount' => $paidAmount,
                ],
                'table_number' => $table?->number,
            ]);
        } catch (\Throwable $e) {
            Log::error('[StripePaymentController] Erro ao confirmar pagamento', [
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'Erro ao processar confirmao de pagamento: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * 3. Webhook oficial com verificao de assinatura HMAC SHA-256
     */
    public function handleWebhook(Request $request): JsonResponse
    {
        $payload = $request->getContent();
        $sigHeader = $request->header('Stripe-Signature');

        if (! $sigHeader || ! $this->stripeService->verifyWebhookSignature($payload, $sigHeader)) {
            Log::warning('[StripeWebhook] Tentativa de webhook com assinatura invlida.');

            return response()->json(['error' => 'Assinatura invlida.'], 400);
        }

        $event = json_decode($payload, true);
        $eventType = $event['type'] ?? '';

        if ($eventType === 'payment_intent.succeeded') {
            $intent = $event['data']['object'] ?? [];
            $piId = $intent['id'] ?? null;
            $orderId = $intent['metadata']['order_id'] ?? null;

            if ($piId && $orderId) {
                $order = Order::find($orderId);
                if ($order) {
                    $amountInCents = $intent['amount_received'] ?? $intent['amount'] ?? 0;
                    $paidAmount = round($amountInCents / 100, 2);
                    $table = $order->table;

                    DB::transaction(function () use ($order, $table, $piId, $paidAmount) {
                        Payment::firstOrCreate(
                            ['transaction_id' => $piId],
                            [
                                'order_id' => $order->id,
                                'method' => 'credit_card',
                                'status' => 'paid',
                                'amount' => $paidAmount,
                                'paid_at' => now(),
                            ]
                        );

                        $order->update(['status' => 'delivered']);

                        if ($table) {
                            $table->update(['status' => 'free']);
                        }
                    });

                    Log::info("[StripeWebhook] Pagamento do PaymentIntent {$piId} processado para o Pedido #{$order->id}.");
                }
            }
        }

        return response()->json(['received' => true]);
    }
}
