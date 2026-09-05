<?php

namespace App\Http\Requests\Table;

use Illuminate\Foundation\Http\FormRequest;

class OpenTabRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('update', $this->route('table')) ?? false;
    }

    public function rules(): array
    {
        return [
            'notes' => ['nullable', 'string', 'max:500'],
        ];
    }
}
