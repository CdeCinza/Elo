<?php

namespace App\Http\Requests\Table;

use App\Models\RestaurantTable;
use Illuminate\Foundation\Http\FormRequest;

class StoreTableRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('create', RestaurantTable::class) ?? false;
    }

    public function rules(): array
    {
        return [
            'number' => ['required', 'string', 'max:50', 'unique:restaurant_tables,number'],
            'capacity' => ['required', 'integer', 'min:1', 'max:50'],
            'status' => ['nullable', 'in:free,occupied,reserved'],
        ];
    }
}
