<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'category_id' => $this->category_id,
            'category_name' => $this->whenLoaded('category', fn () => $this->category->name),
            'name' => $this->name,
            'description' => $this->description,
            'price' => (float) $this->price,
            'available' => (bool) $this->available,
            'image_url' => $this->image_url,
            'ingredients' => $this->whenLoaded('ingredients', fn () => $this->ingredients->map(fn ($ing) => [
                'id' => $ing->id,
                'name' => $ing->name,
                'unit' => $ing->unit,
                'qty_used' => (float) $ing->pivot->qty_used,
            ])),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
