<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Table\OpenTabRequest;
use App\Http\Requests\Table\StoreTableRequest;
use App\Http\Requests\Table\UpdateTableRequest;
use App\Http\Resources\OrderResource;
use App\Http\Resources\TableResource;
use App\Models\Order;
use App\Models\RestaurantTable;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

class TableController extends Controller
{
    use AuthorizesRequests;

    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', RestaurantTable::class);

        $query = RestaurantTable::with(['activeOrder.items.product', 'activeOrder.user']);

        if (! $request->user()->isSuperAdmin()) {
            $query->where('restaurant_id', $request->user()->restaurant_id);
        }

        // filtra por status se informado (free, occupied, reserved)
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $tables = $query->orderBy('number')->get();

        return TableResource::collection($tables);
    }

    public function store(StoreTableRequest $request): JsonResponse
    {
        if (! $request->user()->restaurant_id) {
            return response()->json(['message' => 'Selecione um restaurante para cadastrar a mesa.'], 422);
        }

        $table = RestaurantTable::create([
            ...$request->validated(),
            'restaurant_id' => $request->user()->restaurant_id,
        ]);

        return response()->json([
            'message' => 'Mesa cadastrada com sucesso.',
            'table' => new TableResource($table),
        ], 201);
    }

    public function show(RestaurantTable $table): JsonResponse
    {
        $this->authorize('view', $table);

        return response()->json([
            'table' => new TableResource($table->load(['activeOrder.items.product', 'activeOrder.user'])),
        ]);
    }

    public function update(UpdateTableRequest $request, RestaurantTable $table): JsonResponse
    {
        $table->update($request->validated());

        return response()->json([
            'message' => 'Mesa atualizada com sucesso.',
            'table' => new TableResource($table),
        ]);
    }

    public function destroy(RestaurantTable $table): JsonResponse
    {
        $this->authorize('delete', $table);

        if ($table->activeOrder()->exists()) {
            return response()->json([
                'message' => 'Esta mesa possui um pedido ativo em aberto.',
            ], 422);
        }

        $table->delete();

        return response()->json([
            'message' => 'Mesa removida com sucesso.',
        ]);
    }

    public function openTab(OpenTabRequest $request, RestaurantTable $table): JsonResponse
    {
        $order = DB::transaction(function () use ($request, $table): ?Order {
            $lockedTable = RestaurantTable::query()->whereKey($table->id)->lockForUpdate()->firstOrFail();

            if ($lockedTable->status === 'occupied' || $lockedTable->activeOrder()->exists()) {
                return null;
            }

            $order = Order::create([
                'restaurant_id' => $lockedTable->restaurant_id,
                'table_id' => $lockedTable->id,
                'user_id' => $request->user()->id,
                'type' => 'dine_in',
                'status' => 'pending',
                'subtotal' => 0.00,
                'total' => 0.00,
            ]);

            $lockedTable->update(['status' => 'occupied']);

            return $order;
        });

        if ($order === null) {
            return response()->json([
                'message' => 'Esta mesa já possui uma comanda/pedido em andamento.',
            ], 422);
        }

        return response()->json([
            'message' => 'Comanda aberta com sucesso para a '.$table->number,
            'order' => new OrderResource($order->load(['table', 'user'])),
        ], 201);
    }
}
