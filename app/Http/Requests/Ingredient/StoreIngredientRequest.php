<?php

namespace App\Http\Requests\Ingredient;

use App\Models\Ingredient;
use Illuminate\Foundation\Http\FormRequest;

class StoreIngredientRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('create', Ingredient::class) ?? false;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255', 'unique:ingredients,name'],
            'stock_qty' => ['required', 'numeric', 'min:0'],
            'unit' => ['required', 'string', 'max:50'],
            'min_stock_alert' => ['nullable', 'numeric', 'min:0'],
        ];
    }
}
