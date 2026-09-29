<?php

namespace App\Http\Controllers\Api;

use App\Events\OrderStatusChanged;
use App\Http\Controllers\Concerns\ResolvesRestaurantContext;
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
    use ResolvesRestaurantContext;

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
        $restaurantId = $this->resolveRestaurantId($request);

        if (! empty($validated['order_id'])) {
            $order = Order::with('items')->where('restaurant_id', $restaurantId)->find($validated['order_id']);
            $table = $order?->table;
        } elseif (! empty($validated['table_number'])) {
            $table = $this->tableNumberQuery($validated['table_number'], $restaurantId)->first();

            if (! $table) {
                return response()->json(['message' => "Mesa '{$validated['table_number']}' não encontrada."], 404);
            }

            $order = $table->activeOrder;
        }

        if (! $order || $order->items()->count() === 0) {
            return response()->json([
                'message' => 'Nenhum pedido ativo ou itens encontrados para cobrança nesta mesa.',
            ], 422);
        }

        if ($order->status === 'canceled') {
            return response()->json(['message' => 'Este pedido foi cancelado e não pode ser cobrado.'], 422);
        }

        if ($order->payment()->where('status', 'paid')->exists()) {
            return response()->json(['message' => 'Este pedido já foi pago.'], 422);
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
                'message' => 'Não foi possível inicializar o pagamento no Stripe. Tente novamente em instantes.',
            ], 500);
        }
    }

    /**
     * 2. Confirmação do pagamento após finalização no Stripe Elements
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
                    'message' => 'O pagamento ainda não foi concluído no Stripe. Status atual: '.($intent['status'] ?? 'desconhecido'),
                ], 400);
            }

            $orderId = $intent['metadata']['order_id'] ?? null;
            if (! $orderId || (isset($validated['order_id']) && (string) $validated['order_id'] !== (string) $orderId)) {
                return response()->json(['message' => 'O pagamento não corresponde ao pedido informado.'], 422);
            }

            $order = Order::find($orderId);

            if (! $order) {
                return response()->json(['message' => 'Pedido correspondente não encontrado.'], 404);
            }

            $table = $order->table;
            $amountInCents = $intent['amount_received'] ?? $intent['amount'] ?? 0;
            $paidAmount = round($amountInCents / 100, 2);
            if (! $this->matchesOrderAmount($order, $intent, $paidAmount)) {
                return response()->json(['message' => 'O valor pago não corresponde ao valor atual do pedido.'], 422);
            }

            $existingPayment = Payment::where('transaction_id', $intent['id'])->first();
            if ($existingPayment && $existingPayment->order_id !== $order->id) {
                return response()->json(['message' => 'Pagamento já vinculado a outro pedido.'], 422);
            }
            if ($order->payment()->where('status', 'paid')->where('transaction_id', '!=', $intent['id'])->exists()) {
                return response()->json(['message' => 'Este pedido já foi pago.'], 422);
            }

            DB::transaction(function () use ($order, $table, $intent, $paidAmount) {
                $currentTable = $this->tableServingOrder($table, $order);

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

                if ($currentTable) {
                    $currentTable->update(['status' => 'free']);

                    ActivityLog::where('subject_type', RestaurantTable::class)
                        ->where('subject_id', $currentTable->id)
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
                'message' => 'Não foi possível confirmar o pagamento agora. Tente novamente em instantes.',
            ], 500);
        }
    }

    /**
     * 3. Webhook oficial com verificação de assinatura HMAC SHA-256
     */
    public function handleWebhook(Request $request): JsonResponse
    {
        $payload = $request->getContent();
        $sigHeader = $request->header('Stripe-Signature');

        if (! $sigHeader || ! $this->stripeService->verifyWebhookSignature($payload, $sigHeader)) {
            Log::warning('[StripeWebhook] Tentativa de webhook com assinatura inválida.');

            return response()->json(['error' => 'Assinatura inválida.'], 400);
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
                    $existingPayment = Payment::where('transaction_id', $piId)->first();
                    if ($existingPayment && $existingPayment->order_id !== $order->id) {
                        Log::warning('[StripeWebhook] Pagamento vinculado a outro pedido.', ['payment_intent_id' => $piId]);

                        return response()->json(['error' => 'Pagamento vinculado a outro pedido.'], 422);
                    }
                    if ($order->payment()->where('status', 'paid')->where('transaction_id', '!=', $piId)->exists()) {
                        Log::warning('[StripeWebhook] Pedido já pago por outra transação.', ['order_id' => $order->id]);

                        return response()->json(['error' => 'Pedido já pago.'], 422);
                    }

                    $amountInCents = $intent['amount_received'] ?? $intent['amount'] ?? 0;
                    $paidAmount = round($amountInCents / 100, 2);
                    if (! $this->matchesOrderAmount($order, $intent, $paidAmount)) {
                        Log::warning('[StripeWebhook] Valor pago diverge do pedido.', ['order_id' => $order->id]);

                        return response()->json(['error' => 'Valor divergente.'], 422);
                    }
                    $table = $order->table;

                    DB::transaction(function () use ($order, $table, $piId, $paidAmount) {
                        $currentTable = $this->tableServingOrder($table, $order);

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

                        if ($currentTable) {
                            $currentTable->update(['status' => 'free']);
                        }
                    });

                    Log::info("[StripeWebhook] Pagamento do PaymentIntent {$piId} processado para o Pedido #{$order->id}.");
                }
            }
        }

        return response()->json(['received' => true]);
    }

    private function matchesOrderAmount(Order $order, array $intent, float $paidAmount): bool
    {
        if (! isset($intent['metadata']['service_fee'])) {
            return true;
        }

        $subtotal = (float) $order->items()->sum('subtotal');
        $serviceFee = (float) $intent['metadata']['service_fee'];

        return round($subtotal + $serviceFee, 2) === $paidAmount;
    }

    private function tableServingOrder(?RestaurantTable $table, Order $order): ?RestaurantTable
    {
        if (! $table) {
            return null;
        }

        $currentTable = RestaurantTable::query()->lockForUpdate()->find($table->id);

        if (! $currentTable || ! in_array($currentTable->status, ['occupied', 'bill_requested'], true)) {
            return null;
        }

        return $currentTable->activeOrder?->id === $order->id ? $currentTable : null;
    }
}
