<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\ResolvesRestaurantContext;
use App\Http\Controllers\Controller;
use App\Http\Requests\Category\StoreCategoryRequest;
use App\Http\Requests\Category\UpdateCategoryRequest;
use App\Http\Resources\CategoryResource;
use App\Models\Category;
use App\Models\OrderItem;
use App\Models\Restaurant;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class CategoryController extends Controller
{
    use AuthorizesRequests;
    use ResolvesRestaurantContext;

    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Category::query();

        $query->where('restaurant_id', $this->resolveRestaurantId($request));

        if ($request->has('active')) {
            $query->where('is_active', filter_var($request->active, FILTER_VALIDATE_BOOLEAN));
        }

        $categories = $query->withCount('products')->orderBy('name')->get();

        return CategoryResource::collection($categories);
    }

    public function store(StoreCategoryRequest $request): JsonResponse
    {
        $restaurantId = $request->user()->isSuperAdmin()
            ? (int) $request->header('X-Restaurant-Id')
            : $request->user()->restaurant_id;

        if (! $restaurantId || ! Restaurant::whereKey($restaurantId)->exists()) {
            return response()->json(['message' => 'Selecione um restaurante válido.'], 422);
        }

        $category = Category::create([
            ...$request->validated(),
            'restaurant_id' => $restaurantId,
        ]);

        return response()->json([
            'message' => 'Categoria criada com sucesso.',
            'category' => new CategoryResource($category),
        ], 201);
    }

    public function show(Request $request, Category $category): JsonResponse
    {
        abort_unless($category->restaurant_id === $this->resolveRestaurantId($request), 404);

        return response()->json([
            'category' => new CategoryResource($category->load('products')),
        ]);
    }

    public function update(UpdateCategoryRequest $request, Category $category): JsonResponse
    {
        $category->update($request->validated());

        return response()->json([
            'message' => 'Categoria atualizada com sucesso.',
            'category' => new CategoryResource($category),
        ]);
    }

    public function destroy(Category $category): JsonResponse
    {
        $this->authorize('delete', $category);

        if (OrderItem::whereIn('product_id', $category->products()->select('id'))->exists()) {
            return response()->json([
                'message' => 'Esta categoria possui produtos com pedidos registrados. Desative-a em vez de excluir.',
            ], 422);
        }

        $category->delete();

        return response()->json([
            'message' => 'Categoria removida com sucesso.',
        ]);
    }
}
