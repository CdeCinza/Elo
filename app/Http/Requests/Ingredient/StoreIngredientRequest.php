<?php

namespace App\Http\Requests\Ingredient;

use App\Models\Ingredient;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreIngredientRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('create', Ingredient::class) ?? false;
    }

    public function rules(): array
    {
        $restaurantId = $this->user()->isSuperAdmin()
            ? (int) $this->header('X-Restaurant-Id')
            : $this->user()->restaurant_id;

        return [
            'name' => ['required', 'string', 'max:255', Rule::unique('ingredients', 'name')->where('restaurant_id', $restaurantId)],
            'stock_qty' => ['required', 'numeric', 'min:0', 'max:9999999.999'],
            'unit' => ['required', 'string', 'max:50'],
            'min_stock_alert' => ['nullable', 'numeric', 'min:0', 'max:9999999.999'],
        ];
    }
}
