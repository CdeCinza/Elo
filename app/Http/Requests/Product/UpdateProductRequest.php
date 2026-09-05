<?php

namespace App\Http\Requests\Product;

use Illuminate\Foundation\Http\FormRequest;

class UpdateProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('update', $this->route('product')) ?? false;
    }

    public function rules(): array
    {
        return [
            'category_id' => ['sometimes', 'required', 'exists:categories,id'],
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'price' => ['sometimes', 'required', 'numeric', 'min:0'],
            'available' => ['boolean'],
            'image_url' => ['nullable', 'url', 'max:500'],
            'ingredients' => ['nullable', 'array'],
            'ingredients.*.id' => ['required_with:ingredients', 'exists:ingredients,id'],
            'ingredients.*.qty_used' => ['required_with:ingredients', 'numeric', 'min:0.001'],
        ];
    }
}
