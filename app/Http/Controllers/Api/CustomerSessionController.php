<?php

namespace App\Http\Controllers\Api;

use App\Events\OrderStatusChanged;
use App\Http\Controllers\Concerns\ResolvesRestaurantContext;
use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Http\Resources\TableResource;
use App\Models\ActivityLog;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\RestaurantTable;
use App\Services\KitchenFlowService;
use App\Services\StockService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CustomerSessionController extends Controller
{
    use ResolvesRestaurantContext;

    public function __construct(
        protected KitchenFlowService $kitchenFlow,
        protected StockService $stockService,
    ) {}

    /**
     * Lista as mesas disponíveis para vincular um tablet.
     */
    public function getTables(Request $request): JsonResponse
    {
        $restaurantId = $this->resolveRestaurantId($request);
        $tables = RestaurantTable::where('restaurant_id', $restaurantId)
            ->get(['id', 'number', 'status'])
            ->sortBy('number', SORT_NATURAL)
            ->values()
            ->map(function (RestaurantTable $table): array {
                $digits = preg_replace('/[^0-9]/', '', $table->number);

                return [
                    'id' => $table->id,
                    'number' => $digits === '' ? $table->number : str_pad((string) (int) $digits, 2, '0', STR_PAD_LEFT),
                    'status' => $table->status,
                ];
            });

        return response()->json(['tables' => $tables]);
    }

    /**
     * Retorna os dados da mesa para o cliente no salão (QR Code)
     */
    public function getTable(Request $request, string $tableNumber): JsonResponse
    {
        $restId = $this->resolveRestaurantId($request);
        $table = $this->findTableByNumber($tableNumber, $restId);
        $table->load(['activeOrder.items.product']);

        return response()->json([
            'table' => new TableResource($table),
        ]);
    }

    /**
     * Cliente na mesa cria pedido / comanda sem precisar de login
     */
    public function placeOrder(Request $request, string $tableNumber): JsonResponse
    {
        $request->validate([
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1|max:999',
            'items.*.notes' => 'nullable|string|max:255',
        ]);

        $restId = $this->resolveRestaurantId($request);
        $table = $this->findTableByNumber($tableNumber, $restId);

        try {
            $lines = [];
            foreach ($request->items as $itemData) {
                $product = Product::with('ingredients')
                    ->where('restaurant_id', $table->restaurant_id)
                    ->findOrFail($itemData['product_id']);

                if (! $product->available) {
                    throw new \InvalidArgumentException("O produto '{$product->name}' não está disponível.");
                }

                $lines[] = [
                    'product' => $product,
                    'quantity' => (int) $itemData['quantity'],
                    'notes' => $itemData['notes'] ?? null,
                ];
            }

            $this->stockService->ensureAvailable($lines);

            $order = DB::transaction(function () use ($table, $request, $lines) {
                $lockedTable = RestaurantTable::query()->whereKey($table->id)->lockForUpdate()->firstOrFail();

                // Se a mesa já tiver comanda ativa, anexa a ela; senão cria uma nova
                $order = $lockedTable->activeOrder ?? Order::create([
                    'restaurant_id' => $lockedTable->restaurant_id,
                    'table_id' => $lockedTable->id,
                    'user_id' => null,
                    'type' => 'dine_in',
                    'status' => 'pending',
                    'subtotal' => 0.00,
                    'total' => 0.00,
                ]);

                foreach ($lines as $line) {
                    OrderItem::create([
                        'order_id' => $order->id,
                        'product_id' => $line['product']->id,
                        'unit_price' => $line['product']->price,
                        'quantity' => $line['quantity'],
                        'subtotal' => round((float) $line['product']->price * $line['quantity'], 2),
                        'notes' => $line['notes'],
                    ]);
                }

                $newSubtotal = (float) $order->items()->sum('subtotal');
                $order->update([
                    'subtotal' => $newSubtotal,
                    'total' => $newSubtotal,
                ]);
                $this->kitchenFlow->syncOrderStatus($order);

                if ($lockedTable->status !== 'bill_requested') {
                    $lockedTable->update(['status' => 'occupied']);
                }

                ActivityLog::create([
                    'restaurant_id' => $lockedTable->restaurant_id,
                    'user_id' => null,
                    'subject_type' => Order::class,
                    'subject_id' => $order->id,
                    'action' => 'customer_placed_order',
                    'payload' => ['table' => $lockedTable->number, 'items_count' => count($request->items)],
                ]);

                return $order;
            });
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        broadcast(new OrderStatusChanged($order))->toOthers();

        return response()->json([
            'message' => 'Pedido enviado para a cozinha com sucesso!',
            'order' => new OrderResource($order->load(['table', 'items.product'])),
        ], 201);
    }
}
