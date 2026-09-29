<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\ResolvesRestaurantContext;
use App\Http\Controllers\Controller;
use App\Http\Requests\Product\StoreProductRequest;
use App\Http\Requests\Product\UpdateProductRequest;
use App\Http\Resources\ProductResource;
use App\Models\Category;
use App\Models\Ingredient;
use App\Models\Product;
use App\Models\Restaurant;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ProductController extends Controller
{
    use AuthorizesRequests;
    use ResolvesRestaurantContext;

    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Product::with(['category', 'ingredients']);

        $query->where('restaurant_id', $this->resolveRestaurantId($request));

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        if ($request->filled('category_id')) {
            $query->where('category_id', $request->category_id);
        }

        if ($request->has('available')) {
            $query->where('available', filter_var($request->available, FILTER_VALIDATE_BOOLEAN));
        }

        $products = $query->orderBy('name')->paginate($this->perPage($request, 200));

        return ProductResource::collection($products);
    }

    public function store(StoreProductRequest $request): JsonResponse
    {
        $restaurantId = $request->user()->isSuperAdmin()
            ? (int) $request->header('X-Restaurant-Id')
            : $request->user()->restaurant_id;

        if (! $restaurantId || ! Restaurant::whereKey($restaurantId)->exists()) {
            return response()->json(['message' => 'Selecione um restaurante válido.'], 422);
        }

        if (! Category::where('restaurant_id', $restaurantId)->whereKey($request->category_id)->exists()) {
            return response()->json(['message' => 'Categoria não pertence ao restaurante.'], 422);
        }

        if (! $this->ingredientsBelongToRestaurant($request->input('ingredients', []), $restaurantId)) {
            return response()->json(['message' => 'Ingrediente não pertence ao restaurante.'], 422);
        }

        $productData = $request->safe()->except('ingredients');
        $productData['restaurant_id'] = $restaurantId;
        $product = Product::create($productData);

        if ($request->has('ingredients')) {
            $syncData = [];
            foreach ($request->ingredients as $item) {
                $syncData[$item['id']] = ['qty_used' => $item['qty_used']];
            }
            $product->ingredients()->sync($syncData);
        }

        return response()->json([
            'message' => 'Produto criado com sucesso.',
            'product' => new ProductResource($product->load(['category', 'ingredients'])),
        ], 201);
    }

    public function show(Request $request, Product $product): JsonResponse
    {
        abort_unless($product->restaurant_id === $this->resolveRestaurantId($request), 404);

        return response()->json([
            'product' => new ProductResource($product->load(['category', 'ingredients'])),
        ]);
    }

    public function update(UpdateProductRequest $request, Product $product): JsonResponse
    {
        if ($request->has('category_id') && ! Category::where('restaurant_id', $product->restaurant_id)->whereKey($request->category_id)->exists()) {
            return response()->json(['message' => 'Categoria não pertence ao restaurante.'], 422);
        }

        if (! $this->ingredientsBelongToRestaurant($request->input('ingredients', []), $product->restaurant_id)) {
            return response()->json(['message' => 'Ingrediente não pertence ao restaurante.'], 422);
        }

        $productData = $request->safe()->except('ingredients');
        $product->update($productData);

        if ($request->has('ingredients')) {
            $syncData = [];
            foreach ($request->ingredients as $item) {
                $syncData[$item['id']] = ['qty_used' => $item['qty_used']];
            }
            $product->ingredients()->sync($syncData);
        }

        return response()->json([
            'message' => 'Produto atualizado com sucesso.',
            'product' => new ProductResource($product->load(['category', 'ingredients'])),
        ]);
    }

    public function destroy(Product $product): JsonResponse
    {
        $this->authorize('delete', $product);

        if ($product->orderItems()->exists()) {
            return response()->json([
                'message' => 'Este produto já possui pedidos registrados. Marque-o como indisponível em vez de excluir.',
            ], 422);
        }

        $product->delete();

        return response()->json([
            'message' => 'Produto removido com sucesso.',
        ]);
    }

    private function ingredientsBelongToRestaurant(array $ingredients, ?int $restaurantId): bool
    {
        $ingredientIds = array_unique(array_column($ingredients, 'id'));

        if ($ingredientIds === []) {
            return true;
        }

        if ($restaurantId === null) {
            return false;
        }

        return Ingredient::where('restaurant_id', $restaurantId)
            ->whereIn('id', $ingredientIds)
            ->count() === count($ingredientIds);
    }
}
