<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Ingredient\StoreIngredientRequest;
use App\Http\Requests\Ingredient\UpdateIngredientRequest;
use App\Http\Resources\IngredientResource;
use App\Models\Ingredient;
use App\Models\Restaurant;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class IngredientController extends Controller
{
    use AuthorizesRequests;

    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Ingredient::class);

        $query = Ingredient::query();

        if (! $request->user()->isSuperAdmin()) {
            $query->where('restaurant_id', $request->user()->restaurant_id);
        }

        if ($request->filled('search')) {
            $query->where('name', 'like', "%{$request->search}%");
        }

        // filtra insumos com estoque crítico
        if ($request->boolean('low_stock')) {
            $query->whereColumn('stock_qty', '<=', 'min_stock_alert');
        }

        $ingredients = $query->orderBy('name')->paginate($this->perPage($request));

        return IngredientResource::collection($ingredients);
    }

    public function store(StoreIngredientRequest $request): JsonResponse
    {
        $restaurantId = $request->user()->isSuperAdmin()
            ? (int) $request->header('X-Restaurant-Id')
            : $request->user()->restaurant_id;

        if (! $restaurantId || ! Restaurant::whereKey($restaurantId)->exists()) {
            return response()->json(['message' => 'Selecione um restaurante válido.'], 422);
        }

        $ingredient = Ingredient::create([
            ...$request->validated(),
            'restaurant_id' => $restaurantId,
        ]);

        return response()->json([
            'message' => 'Ingrediente cadastrado no estoque com sucesso.',
            'ingredient' => new IngredientResource($ingredient),
        ], 201);
    }

    public function show(Ingredient $ingredient): JsonResponse
    {
        $this->authorize('view', $ingredient);

        return response()->json([
            'ingredient' => new IngredientResource($ingredient),
        ]);
    }

    public function update(UpdateIngredientRequest $request, Ingredient $ingredient): JsonResponse
    {
        $ingredient->update($request->validated());

        return response()->json([
            'message' => 'Estoque do ingrediente atualizado com sucesso.',
            'ingredient' => new IngredientResource($ingredient),
        ]);
    }

    public function destroy(Ingredient $ingredient): JsonResponse
    {
        $this->authorize('delete', $ingredient);

        $ingredient->delete();

        return response()->json([
            'message' => 'Ingrediente removido com sucesso.',
        ]);
    }
}
