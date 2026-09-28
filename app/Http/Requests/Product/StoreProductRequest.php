<?php

namespace App\Http\Requests\Product;

use App\Models\Product;
use Illuminate\Foundation\Http\FormRequest;

class StoreProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('create', Product::class) ?? false;
    }

    public function rules(): array
    {
        return [
            'category_id' => ['required', 'exists:categories,id'],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'price' => ['required', 'numeric', 'min:0', 'max:99999.99'],
            'available' => ['boolean'],
            'image_url' => ['nullable', 'url', 'max:500'],
            'ingredients' => ['nullable', 'array'],
            'ingredients.*.id' => ['required_with:ingredients', 'exists:ingredients,id'],
            'ingredients.*.qty_used' => ['required_with:ingredients', 'numeric', 'min:0.001', 'max:9999.999'],
        ];
    }
}
