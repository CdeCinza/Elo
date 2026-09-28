<?php

namespace App\Policies;

use App\Models\Product;
use App\Models\User;

class ProductPolicy
{
    public function viewAny(?User $user): bool
    {
        return true;
    }

    public function view(?User $user, Product $product): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return in_array($user->role?->name, ['owner', 'restaurant_admin', 'manager', 'super_admin']);
    }

    public function update(User $user, Product $product): bool
    {
        return ($user->isSuperAdmin() || ($user->restaurant_id !== null && $user->restaurant_id === $product->restaurant_id))
            && in_array($user->role?->name, ['owner', 'restaurant_admin', 'manager', 'super_admin']);
    }

    public function delete(User $user, Product $product): bool
    {
        return ($user->isSuperAdmin() || ($user->restaurant_id !== null && $user->restaurant_id === $product->restaurant_id))
            && in_array($user->role?->name, ['owner', 'restaurant_admin', 'manager', 'super_admin']);
    }
}
