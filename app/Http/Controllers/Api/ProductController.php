<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Product\StoreProductRequest;
use App\Http\Requests\Product\UpdateProductRequest;
use App\Http\Resources\ProductResource;
use App\Models\Product;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ProductController extends Controller
{
    use AuthorizesRequests;

    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Product::with(['category', 'ingredients']);

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

        $products = $query->orderBy('name')->paginate($request->input('per_page', 15));

        return ProductResource::collection($products);
    }

    public function store(StoreProductRequest $request): JsonResponse
    {
        $productData = $request->safe()->except('ingredients');
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

    public function show(Product $product): JsonResponse
    {
        return response()->json([
            'product' => new ProductResource($product->load(['category', 'ingredients'])),
        ]);
    }

    public function update(UpdateProductRequest $request, Product $product): JsonResponse
    {
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

        $product->delete();

        return response()->json([
            'message' => 'Produto removido com sucesso.',
        ]);
    }
}
