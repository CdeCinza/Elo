<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'role' => $this->whenLoaded('role', fn () => [
                'id' => $this->role->id,
                'name' => $this->role->name,
                'label' => $this->role->label,
            ], $this->role ? [
                'id' => $this->role->id,
                'name' => $this->role->name,
                'label' => $this->role->label,
            ] : null),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
