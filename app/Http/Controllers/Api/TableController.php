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

class TableController extends Controller
{
    use AuthorizesRequests;

    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', RestaurantTable::class);

        $query = RestaurantTable::with(['activeOrder.items.product', 'activeOrder.user']);

        // filtra por status se informado (free, occupied, reserved)
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $tables = $query->orderBy('number')->get();

        return TableResource::collection($tables);
    }

    public function store(StoreTableRequest $request): JsonResponse
    {
        $table = RestaurantTable::create($request->validated());

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

        $table->delete();

        return response()->json([
            'message' => 'Mesa removida com sucesso.',
        ]);
    }

    public function openTab(OpenTabRequest $request, RestaurantTable $table): JsonResponse
    {
        if ($table->status === 'occupied' || $table->activeOrder()->exists()) {
            return response()->json([
                'message' => 'Esta mesa já possui uma comanda/pedido em andamento.',
            ], 422);
        }

        $order = Order::create([
            'table_id' => $table->id,
            'user_id' => $request->user()->id,
            'type' => 'dine_in',
            'status' => 'pending',
            'subtotal' => 0.00,
            'total' => 0.00,
        ]);

        $table->update(['status' => 'occupied']);

        return response()->json([
            'message' => 'Comanda aberta com sucesso para a '.$table->number,
            'order' => new OrderResource($order->load(['table', 'user'])),
        ], 201);
    }
}
