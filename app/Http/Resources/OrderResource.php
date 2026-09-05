<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'table_id' => $this->table_id,
            'table_number' => $this->whenLoaded('table', fn () => $this->table?->number),
            'user' => new UserResource($this->whenLoaded('user')),
            'type' => $this->type,
            'status' => $this->status,
            'subtotal' => (float) $this->subtotal,
            'delivery_fee' => (float) $this->delivery_fee,
            'discount' => (float) $this->discount,
            'total' => (float) $this->total,
            'items' => OrderItemResource::collection($this->whenLoaded('items')),
            'payment' => $this->whenLoaded('payment', fn () => [
                'id' => $this->payment->id,
                'method' => $this->payment->method,
                'status' => $this->payment->status,
                'amount' => (float) $this->payment->amount,
                'paid_at' => $this->payment->paid_at?->toIso8601String(),
            ]),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
