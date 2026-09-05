<?php

namespace App\Http\Requests\Order;

use Illuminate\Foundation\Http\FormRequest;

class UpdateOrderStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('update', $this->route('order')) ?? false;
    }

    public function rules(): array
    {
        return [
            'status' => ['required', 'in:pending,confirmed,preparing,ready,delivered,canceled'],
        ];
    }
}
