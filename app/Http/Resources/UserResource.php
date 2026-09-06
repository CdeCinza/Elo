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
            'restaurant_id' => $this->restaurant_id,
            'restaurant' => $this->restaurant ? [
                'id' => $this->restaurant->id,
                'name' => $this->restaurant->name,
                'slug' => $this->restaurant->slug,
                'logo_url' => $this->restaurant->logo_url,
                'status' => $this->restaurant->status,
            ] : null,
            'role' => $this->role ? [
                'id' => $this->role->id,
                'name' => $this->role->name,
                'label' => $this->role->label,
            ] : null,
            'is_super_admin' => $this->role?->name === 'super_admin',
            'is_restaurant_admin' => in_array($this->role?->name, ['restaurant_admin', 'owner']),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
