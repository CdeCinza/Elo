<?php

namespace App\Http\Requests\Category;

use App\Models\Category;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCategoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('create', Category::class) ?? false;
    }

    public function rules(): array
    {
        $restaurantId = $this->user()->isSuperAdmin()
            ? (int) $this->header('X-Restaurant-Id')
            : $this->user()->restaurant_id;

        return [
            'name' => ['required', 'string', 'max:255', Rule::unique('categories', 'name')->where('restaurant_id', $restaurantId)],
            'description' => ['nullable', 'string'],
            'is_active' => ['boolean'],
        ];
    }
}
