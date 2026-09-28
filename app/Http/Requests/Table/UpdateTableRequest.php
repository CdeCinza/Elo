<?php

namespace App\Http\Requests\Table;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateTableRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('update', $this->route('table')) ?? false;
    }

    public function rules(): array
    {
        $tableId = $this->route('table')?->id ?? $this->route('table');

        return [
            'number' => ['sometimes', 'required', 'string', 'max:50', Rule::unique('restaurant_tables', 'number')->where('restaurant_id', $this->route('table')->restaurant_id)->ignore($tableId)],
            'capacity' => ['sometimes', 'required', 'integer', 'min:1', 'max:50'],
            'status' => ['sometimes', 'required', 'in:free,occupied,reserved'],
        ];
    }
}
