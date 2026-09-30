<?php

namespace App\Http\Controllers\Api;

use App\Events\OrderStatusChanged;
use App\Http\Controllers\Concerns\ResolvesRestaurantContext;
use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\Product;
use App\Models\RestaurantTable;
use App\Services\KitchenFlowService;
use App\Services\StockService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class PosKdsController extends Controller
{
    use ResolvesRestaurantContext;

    public function __construct(
        protected KitchenFlowService $kitchenFlow,
        protected StockService $stockService,
    ) {}

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
        $restId = $this->resolveRestaurantId($request);
        $table = $this->findTableByNumber($tableNumber, $restId);

        if ($table->status === 'free') {
            $table->update(['status' => 'occupied']);
        }

        ActivityLog::create([
            'restaurant_id' => $restId,
            'user_id' => null,
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
        $restId = $this->resolveRestaurantId($request);
        $table = $this->findTableByNumber($tableNumber, $restId);

        if ($table->status === 'free') {
            $table->update(['status' => 'occupied']);
        }

        ActivityLog::create([
            'restaurant_id' => $restId,
            'user_id' => null,
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
        $restId = $this->resolveRestaurantId($request);
        $table = $this->findTableByNumber($tableNumber, $restId);

        if (! $table->activeOrder?->items()->exists()) {
            return response()->json([
                'message' => 'Não há consumo registrado nesta mesa para solicitar a conta.',
            ], 422);
        }

        $table->update(['status' => 'bill_requested']);

        ActivityLog::create([
            'restaurant_id' => $restId,
            'user_id' => null,
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
        $restId = $this->resolveRestaurantId($request);

        $tables = RestaurantTable::where('restaurant_id', $restId)
            ->with([
                'activeOrder.items.product',
                'activeOrder.user',
            ])
            ->orderBy('id')
            ->get();

        // Identifica chamados de garçom recentes (últimos 15 minutos)
        $recentWaiterCalls = ActivityLog::where('restaurant_id', $restId)
            ->where('action', 'waiter_called')
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
                'waiter' => $activeOrder?->user?->name ?? 'Autoatendimento (tablet)',
                'opened_at' => $activeOrder?->created_at?->format('H:i') ?? $table->updated_at?->format('H:i'),
                'total' => (float) ($activeOrder?->total ?? 0),
                'subtotal' => (float) ($activeOrder?->subtotal ?? 0),
                'items_count' => $items->count(),
                'items' => $items->map(function ($item) {
                    return [
                        'id' => $item->id,
                        'name' => $item->product?->name ?? 'Item',
                        'quantity' => (int) $item->quantity,
                        'price' => (float) $item->unit_price,
                        'subtotal' => (float) $item->subtotal,
                        'status' => $item->status ?? 'pending',
                        'notes' => $item->notes,
                        'created_at' => $item->created_at?->toIso8601String(),
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
        $restId = $this->resolveRestaurantId($request);
        $table = $this->findTableByNumber($tableNumber, $restId);

        $table = DB::transaction(function () use ($request, $restId, $table) {
            $lockedTable = RestaurantTable::query()->whereKey($table->id)->lockForUpdate()->firstOrFail();
            $lockedTable->update(['status' => 'occupied']);

            if (! $lockedTable->activeOrder) {
                Order::create([
                    'restaurant_id' => $restId,
                    'table_id' => $lockedTable->id,
                    'user_id' => $request->user()->id,
                    'type' => 'dine_in',
                    'status' => 'pending',
                    'subtotal' => 0.00,
                    'total' => 0.00,
                ]);
            }

            return $lockedTable;
        });

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
            'quantity' => 'required|integer|min:1|max:999',
            'notes' => 'nullable|string|max:255',
        ]);

        $restId = $this->resolveRestaurantId($request);
        $table = $this->findTableByNumber($tableNumber, $restId);

        $product = Product::where('restaurant_id', $restId)->findOrFail($request->product_id);
        $quantity = (int) $request->quantity;

        if (! $product->available) {
            return response()->json([
                'message' => "O produto '{$product->name}' está indisponível no momento.",
            ], 422);
        }

        try {
            $this->stockService->ensureAvailable([['product' => $product, 'quantity' => $quantity]]);
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $order = DB::transaction(function () use ($request, $restId, $table, $product, $quantity) {
            $lockedTable = RestaurantTable::query()->whereKey($table->id)->lockForUpdate()->firstOrFail();

            $order = $lockedTable->activeOrder ?? Order::create([
                'restaurant_id' => $restId,
                'table_id' => $lockedTable->id,
                'user_id' => $request->user()->id,
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
                'subtotal' => round((float) $product->price * $quantity, 2),
                'notes' => $request->notes,
            ]);

            $newSubtotal = (float) $order->items()->sum('subtotal');
            $order->update([
                'subtotal' => $newSubtotal,
                'total' => max(round($newSubtotal + (float) $order->delivery_fee - (float) $order->discount, 2), 0.00),
            ]);
            $this->kitchenFlow->syncOrderStatus($order);

            if ($lockedTable->status !== 'bill_requested') {
                $lockedTable->update(['status' => 'occupied']);
            }

            return $order;
        });

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
        $validated = $request->validate([
            'payment_method' => 'required|in:cash,pix',
            'include_service' => 'nullable|boolean',
        ]);

        $restId = $this->resolveRestaurantId($request);
        $table = $this->findTableByNumber($tableNumber, $restId);

        DB::transaction(function () use ($table, $validated, $restId): void {
            $lockedTable = RestaurantTable::whereKey($table->id)->lockForUpdate()->firstOrFail();
            $activeOrder = $lockedTable->activeOrder()->lockForUpdate()->first();
            $subtotal = $activeOrder ? (float) $activeOrder->items()->sum('subtotal') : 0.0;

            if ($activeOrder && $subtotal <= 0) {
                $activeOrder->update(['status' => 'canceled']);
            } elseif ($activeOrder) {
                $serviceFee = ($validated['include_service'] ?? false) ? round($subtotal * 0.10, 2) : 0.00;

                Payment::create([
                    'order_id' => $activeOrder->id,
                    'transaction_id' => 'POS-'.strtoupper(uniqid()),
                    'method' => $validated['payment_method'],
                    'status' => 'paid',
                    'amount' => max(round($subtotal + (float) $activeOrder->delivery_fee - (float) $activeOrder->discount + $serviceFee, 2), 0.00),
                    'paid_at' => now(),
                ]);

                $activeOrder->update(['status' => 'delivered']);
            }

            $lockedTable->update(['status' => 'free']);

            ActivityLog::where('restaurant_id', $restId)
                ->where('action', 'waiter_called')
                ->where('subject_type', RestaurantTable::class)
                ->where('subject_id', $lockedTable->id)
                ->delete();
        });

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
        $restId = $this->resolveRestaurantId($request);

        $orders = Order::where('restaurant_id', $restId)
            ->with([
                'table',
                'items' => fn ($query) => $query->where('status', '!=', 'delivered')->orderBy('id'),
                'items.product.category',
            ])
            ->whereIn('status', ['pending', 'confirmed', 'preparing', 'ready'])
            ->whereHas('items', fn ($query) => $query->where('status', '!=', 'delivered'))
            ->get();

        $mappedOrders = $orders->map(function ($order) {
            $tableNumber = $order->table ? $this->normalizeNumber($order->table->number) : 'Balcão';

            // Espera contada a partir do item mais antigo que ainda não ficou pronto
            $waitingItems = $order->items->whereIn('status', ['pending', 'preparing']);
            $waitingSince = ($waitingItems->isNotEmpty() ? $waitingItems : $order->items)->min('created_at') ?? $order->created_at;
            $minutesAgo = max(0, (int) $waitingSince?->diffInMinutes(now()));

            return [
                'id' => $order->id,
                'tableNumber' => $tableNumber,
                'raw_table_number' => $order->table?->number ?? 'Balcão',
                'openedAt' => $order->created_at?->format('H:i') ?? 'Agora',
                'waitingSince' => $waitingSince?->toIso8601String(),
                'minutesAgo' => $minutesAgo,
                'status' => $this->kitchenFlow->aggregateStage($order->items) ?? 'pending',
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
                        'status' => $item->status,
                        'created_at' => $item->created_at?->toIso8601String(),
                    ];
                })->values()->all(),
            ];
        })->sortBy('waitingSince')->values();

        return response()->json([
            'orders' => $mappedOrders,
        ]);
    }

    /**
     * 9. Transiciona status de pedido no KDS (pending -> preparing -> ready -> delivered)
     */
    public function updateOrderStatus(Request $request, Order $order): JsonResponse
    {
        if ($order->restaurant_id !== $this->resolveRestaurantId($request)) {
            abort(404);
        }

        $request->validate([
            'status' => 'required|in:preparing,ready,delivered',
            'from' => 'nullable|in:pending,preparing,ready',
        ]);

        $newStatus = $request->status;

        try {
            DB::transaction(fn () => $this->kitchenFlow->advance($order, $newStatus, $request->user()?->id, $request->input('from')));
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $order->refresh()->load('items');

        broadcast(new OrderStatusChanged($order))->toOthers();

        return response()->json([
            'message' => "Status do pedido alterado para '{$newStatus}' com sucesso.",
            'order' => [
                'id' => $order->id,
                'status' => $order->status,
                'items' => $order->items->map(fn (OrderItem $item): array => [
                    'id' => $item->id,
                    'status' => $item->status,
                ])->values()->all(),
            ],
        ]);
    }

    /**
     * 10. Cadastra uma nova mesa no salão via Frente de Caixa / Admin
     */
    public function storeTable(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'number' => 'required|string|max:50',
            'capacity' => 'nullable|integer|min:1|max:50',
        ]);

        $restId = $this->resolveRestaurantId($request);
        $cleanNumber = preg_replace('/[^0-9]/', '', $validated['number']);

        if ($cleanNumber !== '') {
            $intNumber = (int) $cleanNumber;
            $formattedTwoDigits = sprintf('%02d', $intNumber);
            $formattedName = "Mesa {$cleanNumber}";

            $alreadyExists = RestaurantTable::where('restaurant_id', $restId)
                ->where(function ($q) use ($formattedName, $intNumber, $formattedTwoDigits, $validated) {
                    $q->where('number', $formattedName)
                        ->orWhere('number', "Mesa {$intNumber}")
                        ->orWhere('number', "Mesa {$formattedTwoDigits}")
                        ->orWhere('number', (string) $intNumber)
                        ->orWhere('number', $formattedTwoDigits)
                        ->orWhere('number', $validated['number']);
                })
                ->exists();
        } else {
            $formattedName = trim($validated['number']);
            $alreadyExists = RestaurantTable::where('restaurant_id', $restId)
                ->where('number', $formattedName)
                ->exists();
        }

        if ($alreadyExists) {
            return response()->json([
                'message' => "Já existe uma mesa cadastrada com a numeração '{$formattedName}'.",
            ], 422);
        }

        $table = RestaurantTable::create([
            'restaurant_id' => $restId,
            'number' => $formattedName,
            'capacity' => $validated['capacity'] ?? 4,
            'status' => 'free',
        ]);

        return response()->json([
            'message' => "{$table->number} cadastrada com sucesso!",
            'table' => [
                'id' => $table->id,
                'number' => $this->normalizeNumber($table->number),
                'raw_number' => $table->number,
                'capacity' => (int) $table->capacity,
                'status' => $table->status,
                'waiter_called' => false,
                'waiter' => 'Garçom Principal',
                'opened_at' => null,
                'total' => 0.0,
                'subtotal' => 0.0,
                'items_count' => 0,
                'items' => [],
            ],
        ], 201);
    }

    /**
     * 11. Atualiza dados de uma mesa (capacidade ou numeração)
     */
    public function updateTable(Request $request, string $tableNumber): JsonResponse
    {
        $restId = $this->resolveRestaurantId($request);
        $table = $this->findTableByNumber($tableNumber, $restId);

        $validated = $request->validate([
            'number' => 'nullable|string|max:50',
            'capacity' => 'nullable|integer|min:1|max:50',
        ]);

        if (! empty($validated['number'])) {
            $cleanNumber = preg_replace('/[^0-9]/', '', $validated['number']);
            $formattedName = $cleanNumber !== '' ? "Mesa {$cleanNumber}" : trim($validated['number']);

            $alreadyExists = $this->tableNumberQuery($validated['number'], $restId)->whereKeyNot($table->id)->exists()
                || RestaurantTable::where('restaurant_id', $restId)->where('number', $formattedName)->whereKeyNot($table->id)->exists();

            if ($alreadyExists) {
                return response()->json([
                    'message' => "Já existe uma mesa cadastrada com a numeração '{$formattedName}'.",
                ], 422);
            }

            $table->number = $formattedName;
        }

        if (isset($validated['capacity'])) {
            $table->capacity = (int) $validated['capacity'];
        }

        $table->save();

        return response()->json([
            'message' => "Mesa {$this->normalizeNumber($table->number)} atualizada com sucesso.",
            'table' => [
                'id' => $table->id,
                'number' => $this->normalizeNumber($table->number),
                'raw_number' => $table->number,
                'capacity' => $table->capacity,
                'status' => $table->status,
            ],
        ]);
    }

    /**
     * 12. Exclui uma mesa livre do salão
     */
    public function deleteTable(Request $request, string $tableNumber): JsonResponse
    {
        $restId = $this->resolveRestaurantId($request);
        $table = $this->findTableByNumber($tableNumber, $restId);

        if ($table->status !== 'free') {
            return response()->json([
                'message' => 'Não é possível excluir uma mesa em atendimento ou com conta em aberto.',
            ], 422);
        }

        if ($table->activeOrder()->exists()) {
            return response()->json([
                'message' => 'Esta mesa possui um pedido ativo em aberto.',
            ], 422);
        }

        $tableNumberFormatted = $this->normalizeNumber($table->number);
        $table->delete();

        return response()->json([
            'message' => "Mesa {$tableNumberFormatted} excluída com sucesso do salão.",
        ]);
    }

    /**
     * 13. Limpa notificação de chamado de garçom atendido
     */
    public function clearWaiterCall(Request $request, string $tableNumber): JsonResponse
    {
        $restId = $this->resolveRestaurantId($request);
        $table = $this->findTableByNumber($tableNumber, $restId);

        ActivityLog::where('restaurant_id', $restId)
            ->where('action', 'waiter_called')
            ->where('subject_type', RestaurantTable::class)
            ->where('subject_id', $table->id)
            ->delete();

        return response()->json([
            'message' => "Chamado do garçom para a Mesa {$this->normalizeNumber($table->number)} atendido.",
        ]);
    }

    /**
     * 14. Força a liberação e limpeza de uma mesa pelo administrador
     */
    public function resetTable(Request $request, string $tableNumber): JsonResponse
    {
        $restId = $this->resolveRestaurantId($request);
        $table = $this->findTableByNumber($tableNumber, $restId);

        if ($table->activeOrder) {
            $table->activeOrder->update(['status' => 'canceled']);
        }

        $table->update(['status' => 'free']);

        ActivityLog::where('restaurant_id', $restId)
            ->where('subject_type', RestaurantTable::class)
            ->where('subject_id', $table->id)
            ->delete();

        return response()->json([
            'message' => "Mesa {$this->normalizeNumber($table->number)} liberada com sucesso pelo operador.",
        ]);
    }

    /**
     * 15. Cria mesas padrão (01 a 10) caso o restaurante não possua mesas
     */
    public function seedDefaultTables(Request $request): JsonResponse
    {
        $restId = $this->resolveRestaurantId($request);

        if (RestaurantTable::where('restaurant_id', $restId)->count() === 0) {
            for ($i = 1; $i <= 10; $i++) {
                $capacity = $i <= 4 ? 2 : ($i <= 8 ? 4 : 6);
                RestaurantTable::create([
                    'restaurant_id' => $restId,
                    'number' => "Mesa {$i}",
                    'capacity' => $capacity,
                    'status' => 'free',
                ]);
            }
        }

        return $this->getTables($request);
    }
}
