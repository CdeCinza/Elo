<?php

namespace App\Http\Controllers\Api;

use App\Events\OrderStatusChanged;
use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\Product;
use App\Models\RestaurantTable;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PosKdsController extends Controller
{
    /**
     * Auxiliar para localizar mesa por número ("01", "1", "Mesa 01", "Mesa 1")
     */
    private function findTable(string $tableNumber): RestaurantTable
    {
        $cleanNumber = preg_replace('/[^0-9]/', '', $tableNumber);
        $intNumber = (int) $cleanNumber;
        $formattedTwoDigits = sprintf('%02d', $intNumber);

        $table = RestaurantTable::where('number', $tableNumber)
            ->orWhere('number', "Mesa {$cleanNumber}")
            ->orWhere('number', "Mesa {$formattedTwoDigits}")
            ->orWhere('number', "Mesa {$intNumber}")
            ->orWhere('id', $tableNumber)
            ->first();

        if (! $table) {
            $table = RestaurantTable::firstOrCreate(
                ['number' => "Mesa {$cleanNumber}"],
                ['capacity' => 4, 'status' => 'free']
            );
        }

        return $table;
    }

    /**
     * Normaliza número da mesa para formato de dois dígitos ("01", "08")
     */
    private function normalizeNumber(string $tableNumber): string
    {
        $clean = preg_replace('/[^0-9]/', '', $tableNumber);

        return $clean !== '' ? sprintf('%02d', (int) $clean) : $tableNumber;
    }

    /**
     * 1. Check-in: Cliente avisa no tablet que sentou na mesa
     */
    public function checkInTable(Request $request, string $tableNumber): JsonResponse
    {
        $table = $this->findTable($tableNumber);

        if ($table->status === 'free') {
            $table->update(['status' => 'occupied']);
        }

        $defaultUser = User::first() ?? User::factory()->create();

        ActivityLog::create([
            'user_id' => $defaultUser->id,
            'subject_type' => RestaurantTable::class,
            'subject_id' => $table->id,
            'action' => 'customer_checked_in',
            'payload' => ['table' => $table->number, 'timestamp' => now()->toIso8601String()],
        ]);

        return response()->json([
            'message' => 'Atendimento iniciado com sucesso na mesa.',
            'table' => [
                'id' => $table->id,
                'number' => $this->normalizeNumber($table->number),
                'status' => $table->status,
            ],
        ]);
    }

    /**
     * 2. Chamar garçom na mesa
     */
    public function callWaiter(Request $request, string $tableNumber): JsonResponse
    {
        $table = $this->findTable($tableNumber);

        if ($table->status === 'free') {
            $table->update(['status' => 'occupied']);
        }

        $defaultUser = User::first() ?? User::factory()->create();

        ActivityLog::create([
            'user_id' => $defaultUser->id,
            'subject_type' => RestaurantTable::class,
            'subject_id' => $table->id,
            'action' => 'waiter_called',
            'payload' => ['table' => $table->number, 'timestamp' => now()->toIso8601String()],
        ]);

        return response()->json([
            'message' => 'Garçom chamado com sucesso. A equipe já foi notificada!',
            'table' => [
                'id' => $table->id,
                'number' => $this->normalizeNumber($table->number),
                'status' => $table->status,
                'waiter_called' => true,
            ],
        ]);
    }

    /**
     * 3. Cliente pede a conta pelo tablet
     */
    public function requestBill(Request $request, string $tableNumber): JsonResponse
    {
        $table = $this->findTable($tableNumber);
        $table->update(['status' => 'bill_requested']);

        $defaultUser = User::first() ?? User::factory()->create();

        ActivityLog::create([
            'user_id' => $defaultUser->id,
            'subject_type' => RestaurantTable::class,
            'subject_id' => $table->id,
            'action' => 'bill_requested',
            'payload' => ['table' => $table->number, 'timestamp' => now()->toIso8601String()],
        ]);

        return response()->json([
            'message' => 'Conta solicitada. O caixa já foi sinalizado.',
            'table' => [
                'id' => $table->id,
                'number' => $this->normalizeNumber($table->number),
                'status' => $table->status,
            ],
        ]);
    }

    /**
     * 4. Retorna todas as mesas para o painel do Caixa (POS)
     */
    public function getTables(Request $request): JsonResponse
    {
        $tables = RestaurantTable::with([
            'activeOrder.items.product',
            'activeOrder.user',
        ])
            ->orderBy('id')
            ->get();

        // Identifica chamados de garçom recentes (últimos 15 minutos)
        $recentWaiterCalls = ActivityLog::where('action', 'waiter_called')
            ->where('created_at', '>=', now()->subMinutes(15))
            ->pluck('subject_id')
            ->toArray();

        $formatted = $tables->map(function ($table) use ($recentWaiterCalls) {
            $activeOrder = $table->activeOrder;
            $items = $activeOrder?->items ?? collect();
            $waiterCalled = in_array($table->id, $recentWaiterCalls) && $table->status !== 'free';

            return [
                'id' => $table->id,
                'number' => $this->normalizeNumber($table->number),
                'raw_number' => $table->number,
                'capacity' => (int) $table->capacity,
                'status' => $table->status,
                'waiter_called' => $waiterCalled,
                'waiter' => $activeOrder?->user?->name ?? 'Garçom Principal',
                'opened_at' => $activeOrder?->created_at?->format('H:i') ?? $table->updated_at?->format('H:i'),
                'total' => (float) ($activeOrder?->total ?? 0),
                'subtotal' => (float) ($activeOrder?->subtotal ?? 0),
                'items_count' => $items->count(),
                'items' => $items->map(function ($item) use ($activeOrder) {
                    return [
                        'id' => $item->id,
                        'name' => $item->product?->name ?? 'Item',
                        'quantity' => (int) $item->quantity,
                        'price' => (float) $item->unit_price,
                        'subtotal' => (float) $item->subtotal,
                        'status' => $activeOrder?->status ?? 'pending',
                        'notes' => $item->notes,
                    ];
                })->values()->all(),
            ];
        });

        return response()->json([
            'tables' => $formatted,
        ]);
    }

    /**
     * 5. Abrir mesa manualmente pelo Caixa
     */
    public function openTable(Request $request, string $tableNumber): JsonResponse
    {
        $table = $this->findTable($tableNumber);
        $table->update(['status' => 'occupied']);

        $defaultUser = User::first() ?? User::factory()->create();

        if (! $table->activeOrder) {
            Order::create([
                'table_id' => $table->id,
                'user_id' => $defaultUser->id,
                'type' => 'dine_in',
                'status' => 'pending',
                'subtotal' => 0.00,
                'total' => 0.00,
            ]);
        }

        return response()->json([
            'message' => "Mesa {$this->normalizeNumber($table->number)} aberta com sucesso.",
            'table' => $table->fresh(['activeOrder.items.product']),
        ]);
    }

    /**
     * 6. Lançar item na mesa pelo Caixa
     */
    public function addItemToTable(Request $request, string $tableNumber): JsonResponse
    {
        $request->validate([
            'product_id' => 'required|exists:products,id',
            'quantity' => 'required|integer|min:1',
            'notes' => 'nullable|string|max:255',
        ]);

        $table = $this->findTable($tableNumber);
        $defaultUser = User::first() ?? User::factory()->create();

        $product = Product::findOrFail($request->product_id);
        $quantity = (int) $request->quantity;
        $itemSubtotal = (float) ($product->price * $quantity);

        $order = $table->activeOrder ?? Order::create([
            'table_id' => $table->id,
            'user_id' => $defaultUser->id,
            'type' => 'dine_in',
            'status' => 'pending',
            'subtotal' => 0.00,
            'total' => 0.00,
        ]);

        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'unit_price' => $product->price,
            'quantity' => $quantity,
            'subtotal' => $itemSubtotal,
            'notes' => $request->notes,
        ]);

        $newSubtotal = (float) $order->items()->sum('subtotal');
        $order->update([
            'subtotal' => $newSubtotal,
            'total' => $newSubtotal,
        ]);

        $table->update(['status' => 'occupied']);

        return response()->json([
            'message' => "Item '{$product->name}' lançado com sucesso na Mesa {$this->normalizeNumber($table->number)}.",
            'order' => $order->fresh(['items.product']),
        ]);
    }

    /**
     * 7. Fechar comanda e liberar mesa no Caixa
     */
    public function closeTable(Request $request, string $tableNumber): JsonResponse
    {
        $table = $this->findTable($tableNumber);
        $activeOrder = $table->activeOrder;

        if ($activeOrder) {
            $paymentMethod = $request->input('payment_method', 'credit_card');

            Payment::create([
                'order_id' => $activeOrder->id,
                'transaction_id' => 'POS-'.strtoupper(uniqid()),
                'method' => $paymentMethod,
                'status' => 'paid',
                'amount' => $activeOrder->total,
                'paid_at' => now(),
            ]);

            $activeOrder->update(['status' => 'delivered']);
        }

        $table->update(['status' => 'free']);

        // Limpa registros de garçom chamado desta mesa
        ActivityLog::where('action', 'waiter_called')
            ->where('subject_id', $table->id)
            ->delete();

        return response()->json([
            'message' => "Mesa {$this->normalizeNumber($table->number)} finalizada e liberada com sucesso!",
            'table' => [
                'id' => $table->id,
                'number' => $this->normalizeNumber($table->number),
                'status' => 'free',
            ],
        ]);
    }

    /**
     * 8. Retorna pedidos em andamento para o painel da Cozinha (KDS)
     */
    public function getKitchenOrders(Request $request): JsonResponse
    {
        $orders = Order::with(['table', 'items.product.category'])
            ->whereIn('status', ['pending', 'confirmed', 'preparing', 'ready'])
            ->whereHas('items')
            ->orderBy('created_at', 'asc')
            ->get();

        $mappedOrders = $orders->map(function ($order) {
            $tableNumber = $order->table ? $this->normalizeNumber($order->table->number) : 'Balcão';
            $minutesAgo = max(0, (int) $order->created_at?->diffInMinutes(now()));

            return [
                'id' => $order->id,
                'tableNumber' => $tableNumber,
                'raw_table_number' => $order->table?->number ?? 'Balcão',
                'openedAt' => $order->created_at?->format('H:i') ?? 'Agora',
                'minutesAgo' => $minutesAgo,
                'status' => $order->status === 'confirmed' ? 'pending' : $order->status,
                'items' => $order->items->map(function ($item) {
                    $categoryName = strtolower($item->product?->category?->name ?? '');
                    $productName = strtolower($item->product?->name ?? '');

                    $station = 'grill';
                    if (str_contains($categoryName, 'entrada') || str_contains($productName, 'batata') || str_contains($productName, 'croquete')) {
                        $station = 'fryer';
                    } elseif (str_contains($categoryName, 'sobremesa') || str_contains($productName, 'pudim') || str_contains($productName, 'doce')) {
                        $station = 'dessert';
                    }

                    return [
                        'id' => $item->id,
                        'quantity' => (int) $item->quantity,
                        'name' => $item->product?->name ?? 'Item',
                        'station' => $station,
                        'notes' => $item->notes,
                        'completed' => false,
                    ];
                })->values()->all(),
            ];
        });

        return response()->json([
            'orders' => $mappedOrders,
        ]);
    }

    /**
     * 9. Transiciona status de pedido no KDS (pending -> preparing -> ready -> delivered)
     */
    public function updateOrderStatus(Request $request, Order $order): JsonResponse
    {
        $request->validate([
            'status' => 'required|in:pending,confirmed,preparing,ready,delivered,canceled',
        ]);

        $newStatus = $request->status;
        $order->update(['status' => $newStatus]);

        broadcast(new OrderStatusChanged($order))->toOthers();

        return response()->json([
            'message' => "Status do pedido alterado para '{$newStatus}' com sucesso.",
            'order' => [
                'id' => $order->id,
                'status' => $order->status,
            ],
        ]);
    }
}
