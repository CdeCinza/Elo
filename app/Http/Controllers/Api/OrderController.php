<?php

namespace App\Http\Controllers\Api;

use App\Events\OrderStatusChanged;
use App\Http\Controllers\Controller;
use App\Http\Requests\Order\AddItemToOrderRequest;
use App\Http\Requests\Order\StoreOrderRequest;
use App\Http\Requests\Order\UpdateOrderStatusRequest;
use App\Http\Resources\OrderResource;
use App\Models\ActivityLog;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\RestaurantTable;
use App\Services\KitchenFlowService;
use App\Services\StockService;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

class OrderController extends Controller
{
    use AuthorizesRequests;

    protected array $allowedTransitions = [
        'pending' => ['confirmed', 'canceled'],
        'confirmed' => ['preparing', 'canceled'],
        'preparing' => ['ready', 'canceled'],
        'ready' => ['delivered', 'canceled'],
        'delivered' => [],
        'canceled' => [],
    ];

    public function __construct(
        protected KitchenFlowService $kitchenFlow,
        protected StockService $stockService,
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Order::class);

        $query = Order::with(['table', 'user', 'items.product', 'payment']);

        if (! $request->user()->isSuperAdmin()) {
            $query->where('restaurant_id', $request->user()->restaurant_id);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        if ($request->filled('table_id')) {
            $query->where('table_id', $request->table_id);
        }

        $orders = $query->latest()->paginate($this->perPage($request));

        return OrderResource::collection($orders);
    }

    public function store(StoreOrderRequest $request): JsonResponse
    {
        if (! $request->user()->restaurant_id) {
            return response()->json(['message' => 'Selecione um restaurante para criar o pedido.'], 422);
        }

        if ($request->table_id && ! RestaurantTable::where('restaurant_id', $request->user()->restaurant_id)->whereKey($request->table_id)->exists()) {
            return response()->json(['message' => 'Mesa não pertence ao restaurante.'], 422);
        }

        try {
            $order = DB::transaction(function () use ($request) {
                $subtotal = 0.00;

                $order = Order::create([
                    'restaurant_id' => $request->user()->restaurant_id,
                    'table_id' => $request->table_id,
                    'user_id' => $request->user()->id,
                    'type' => $request->type,
                    'status' => 'pending',
                    'delivery_fee' => $request->input('delivery_fee', 0.00),
                    'discount' => $request->input('discount', 0.00),
                    'subtotal' => 0.00,
                    'total' => 0.00,
                ]);

                foreach ($request->items as $itemData) {
                    $product = Product::with('ingredients')
                        ->where('restaurant_id', $request->user()->restaurant_id)
                        ->findOrFail($itemData['product_id']);

                    if (! $product->available) {
                        throw new \InvalidArgumentException("O produto '{$product->name}' não está disponível no momento.");
                    }

                    $this->stockService->ensureAvailable([['product' => $product, 'quantity' => (int) $itemData['quantity']]]);

                    $itemSubtotal = round((float) $product->price * $itemData['quantity'], 2);
                    $subtotal += $itemSubtotal;

                    OrderItem::create([
                        'order_id' => $order->id,
                        'product_id' => $product->id,
                        'unit_price' => $product->price,
                        'quantity' => $itemData['quantity'],
                        'subtotal' => $itemSubtotal,
                        'notes' => $itemData['notes'] ?? null,
                    ]);
                }

                $total = $subtotal + $order->delivery_fee - $order->discount;

                $order->update([
                    'subtotal' => $subtotal,
                    'total' => max($total, 0.00),
                ]);

                if ($order->table_id) {
                    RestaurantTable::where('id', $order->table_id)->update(['status' => 'occupied']);
                }

                ActivityLog::create([
                    'user_id' => $request->user()->id,
                    'subject_type' => Order::class,
                    'subject_id' => $order->id,
                    'action' => 'order_created',
                    'payload' => ['status' => 'pending', 'total' => $order->total],
                ]);

                return $order;
            });
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        broadcast(new OrderStatusChanged($order))->toOthers();

        return response()->json([
            'message' => 'Pedido criado com sucesso.',
            'order' => new OrderResource($order->load(['table', 'user', 'items.product'])),
        ], 201);
    }

    public function show(Order $order): JsonResponse
    {
        $this->authorize('view', $order);

        return response()->json([
            'order' => new OrderResource($order->load(['table', 'user', 'items.product', 'payment'])),
        ]);
    }

    public function addItem(AddItemToOrderRequest $request, Order $order): JsonResponse
    {
        if (in_array($order->status, ['delivered', 'canceled'])) {
            return response()->json([
                'message' => 'Não é possível adicionar itens em um pedido entregue ou cancelado.',
            ], 422);
        }

        $product = Product::with('ingredients')
            ->where('restaurant_id', $order->restaurant_id)
            ->findOrFail($request->product_id);

        if (! $product->available) {
            return response()->json([
                'message' => "O produto '{$product->name}' está indisponível.",
            ], 422);
        }

        try {
            $this->stockService->ensureAvailable([['product' => $product, 'quantity' => (int) $request->quantity]]);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        DB::transaction(function () use ($order, $product, $request) {
            $itemSubtotal = round((float) $product->price * $request->quantity, 2);

            OrderItem::create([
                'order_id' => $order->id,
                'product_id' => $product->id,
                'unit_price' => $product->price,
                'quantity' => $request->quantity,
                'subtotal' => $itemSubtotal,
                'notes' => $request->notes,
            ]);

            $newSubtotal = $order->items()->sum('subtotal');
            $newTotal = $newSubtotal + $order->delivery_fee - $order->discount;

            $order->update([
                'subtotal' => $newSubtotal,
                'total' => max($newTotal, 0.00),
            ]);

            $this->kitchenFlow->syncOrderStatus($order);
        });

        return response()->json([
            'message' => 'Item adicionado ao pedido com sucesso.',
            'order' => new OrderResource($order->load(['items.product', 'table'])),
        ]);
    }

    public function updateStatus(UpdateOrderStatusRequest $request, Order $order): JsonResponse
    {
        $newStatus = $request->status;
        $currentStatus = $order->status;

        if ($currentStatus === $newStatus) {
            return response()->json([
                'message' => 'O pedido já está neste status.',
                'order' => new OrderResource($order->load(['items.product', 'table'])),
            ]);
        }

        $allowed = $this->allowedTransitions[$currentStatus] ?? [];
        if (! in_array($newStatus, $allowed)) {
            return response()->json([
                'message' => "Transição de status inválida: de '{$currentStatus}' para '{$newStatus}'.",
            ], 422);
        }

        try {
            DB::transaction(function () use ($order, $newStatus, $currentStatus, $request) {
                if (in_array($newStatus, ['confirmed', 'preparing'], true)) {
                    $this->stockService->deductForItems($order->items()->get(), $request->user()->id);
                }

                $this->kitchenFlow->promoteItemsTo($order, $newStatus);

                $order->update(['status' => $newStatus]);

                if (in_array($newStatus, ['delivered', 'canceled']) && $order->table_id) {
                    RestaurantTable::where('id', $order->table_id)->update(['status' => 'free']);
                }

                ActivityLog::create([
                    'user_id' => $request->user()->id,
                    'subject_type' => Order::class,
                    'subject_id' => $order->id,
                    'action' => 'status_changed',
                    'payload' => ['from' => $currentStatus, 'to' => $newStatus],
                ]);
            });
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        broadcast(new OrderStatusChanged($order))->toOthers();

        return response()->json([
            'message' => "Status do pedido alterado para '{$newStatus}' com sucesso.",
            'order' => new OrderResource($order->load(['items.product', 'table'])),
        ]);
    }
}
