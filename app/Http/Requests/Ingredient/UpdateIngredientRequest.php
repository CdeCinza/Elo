<?php

namespace App\Http\Requests\Ingredient;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateIngredientRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('update', $this->route('ingredient')) ?? false;
    }

    public function rules(): array
    {
        $ingredientId = $this->route('ingredient')?->id ?? $this->route('ingredient');

        return [
            'name' => ['sometimes', 'required', 'string', 'max:255', Rule::unique('ingredients', 'name')->ignore($ingredientId)],
            'stock_qty' => ['sometimes', 'required', 'numeric', 'min:0'],
            'unit' => ['sometimes', 'required', 'string', 'max:50'],
            'min_stock_alert' => ['nullable', 'numeric', 'min:0'],
        ];
    }
}
