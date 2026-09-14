<?php

namespace App\Http\Controllers\Api;

use App\Events\OrderStatusChanged;
use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Http\Resources\TableResource;
use App\Models\ActivityLog;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\Restaurant;
use App\Models\RestaurantTable;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CustomerSessionController extends Controller
{
    private function getRestaurantId(Request $request): int
    {
        if ($request->header('X-Restaurant-Id')) {
            return (int) $request->header('X-Restaurant-Id');
        }
        if ($request->query('restaurant_id')) {
            return (int) $request->query('restaurant_id');
        }
        if ($request->user()?->restaurant_id) {
            return (int) $request->user()->restaurant_id;
        }

        $restaurant = Restaurant::first();
        if (! $restaurant) {
            $restaurant = Restaurant::create([
                'name' => 'Restaurante Principal',
                'slug' => 'restaurante-principal',
                'status' => 'active',
            ]);
        }

        return (int) $restaurant->id;
    }

    private function findTable(string $tableNumber, ?int $restaurantId = null): RestaurantTable
    {
        $cleanNumber = preg_replace('/[^0-9]/', '', $tableNumber);
        $intNumber = (int) $cleanNumber;
        $formattedTwoDigits = sprintf('%02d', $intNumber);

        $restId = $restaurantId;
        if (! $restId) {
            $restaurant = Restaurant::first() ?? Restaurant::create([
                'name' => 'Restaurante Principal',
                'slug' => 'restaurante-principal',
                'status' => 'active',
            ]);
            $restId = (int) $restaurant->id;
        }

        $query = RestaurantTable::where('restaurant_id', $restId)
            ->where(function ($q) use ($tableNumber, $cleanNumber, $formattedTwoDigits, $intNumber) {
                $q->where('number', $tableNumber)
                    ->orWhere('number', "Mesa {$cleanNumber}")
                    ->orWhere('number', "Mesa {$formattedTwoDigits}")
                    ->orWhere('number', "Mesa {$intNumber}")
                    ->orWhere('number', (string) $intNumber)
                    ->orWhere('number', $formattedTwoDigits)
                    ->orWhere('id', $tableNumber);
            });

        $table = $query->first();

        if (! $table) {
            $table = RestaurantTable::firstOrCreate(
                [
                    'restaurant_id' => $restId,
                    'number' => "Mesa {$intNumber}",
                ],
                ['capacity' => 4, 'status' => 'free']
            );
        }

        return $table;
    }

    /**
     * Retorna os dados da mesa para o cliente no salão (QR Code)
     */
    public function getTable(Request $request, string $tableNumber): JsonResponse
    {
        $restId = $this->getRestaurantId($request);
        $table = $this->findTable($tableNumber, $restId);
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
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.notes' => 'nullable|string|max:255',
        ]);

        $restId = $this->getRestaurantId($request);
        $table = $this->findTable($tableNumber, $restId);

        // Pega o atendente/garçom padrão ou cria um usuário sistema para a comanda
        $defaultUser = User::first() ?? User::factory()->create();

        try {
            $order = DB::transaction(function () use ($table, $defaultUser, $request) {
                // Se a mesa já tiver comanda ativa, anexa a ela; senão cria uma nova
                $order = $table->activeOrder ?? Order::create([
                    'restaurant_id' => $table->restaurant_id ?? $defaultUser->restaurant_id,
                    'table_id' => $table->id,
                    'user_id' => $defaultUser->id,
                    'type' => 'dine_in',
                    'status' => 'pending',
                    'subtotal' => 0.00,
                    'total' => 0.00,
                ]);

                foreach ($request->items as $itemData) {
                    $product = Product::with('ingredients')->findOrFail($itemData['product_id']);

                    if (! $product->available) {
                        throw new \InvalidArgumentException("O produto '{$product->name}' não está disponível.");
                    }

                    $itemSubtotal = $product->price * $itemData['quantity'];

                    OrderItem::create([
                        'order_id' => $order->id,
                        'product_id' => $product->id,
                        'unit_price' => $product->price,
                        'quantity' => $itemData['quantity'],
                        'subtotal' => $itemSubtotal,
                        'notes' => $itemData['notes'] ?? null,
                    ]);
                }

                $newSubtotal = (float) $order->items()->sum('subtotal');
                $orderUpdate = [
                    'subtotal' => $newSubtotal,
                    'total' => $newSubtotal,
                ];
                if ($order->status === 'ready' || $order->status === 'delivered') {
                    $orderUpdate['status'] = 'pending';
                }
                $order->update($orderUpdate);

                $table->update(['status' => 'occupied']);

                ActivityLog::create([
                    'user_id' => $defaultUser->id,
                    'subject_type' => Order::class,
                    'subject_id' => $order->id,
                    'action' => 'customer_placed_order',
                    'payload' => ['table' => $table->number, 'items_count' => count($request->items)],
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
