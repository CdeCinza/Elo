<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TableResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'number' => $this->number,
            'capacity' => (int) $this->capacity,
            'status' => $this->status,
            'active_order' => new OrderResource($this->whenLoaded('activeOrder')),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
