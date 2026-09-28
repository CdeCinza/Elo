<?php

namespace App\Http\Requests\Table;

use App\Models\RestaurantTable;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreTableRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('create', RestaurantTable::class) ?? false;
    }

    public function rules(): array
    {
        return [
            'number' => ['required', 'string', 'max:50', Rule::unique('restaurant_tables', 'number')->where('restaurant_id', $this->user()->restaurant_id)],
            'capacity' => ['required', 'integer', 'min:1', 'max:50'],
            'status' => ['nullable', 'in:free,occupied,reserved'],
        ];
    }
}
