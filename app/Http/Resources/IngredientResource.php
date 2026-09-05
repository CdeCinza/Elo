<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class IngredientResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $stockQty = (float) $this->stock_qty;
        $minAlert = (float) $this->min_stock_alert;

        return [
            'id' => $this->id,
            'name' => $this->name,
            'stock_qty' => $stockQty,
            'unit' => $this->unit,
            'min_stock_alert' => $minAlert,
            'is_low_stock' => $stockQty <= $minAlert,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
