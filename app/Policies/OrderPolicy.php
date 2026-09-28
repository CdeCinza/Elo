<?php

namespace App\Policies;

use App\Models\Order;
use App\Models\User;

class OrderPolicy
{
    public function viewAny(User $user): bool
    {
        return in_array($user->role?->name, ['owner', 'restaurant_admin', 'manager', 'waiter', 'chef', 'cashier', 'super_admin']);
    }

    public function view(User $user, Order $order): bool
    {
        if (! $user->isSuperAdmin() && ($user->restaurant_id === null || $user->restaurant_id !== $order->restaurant_id)) {
            return false;
        }

        if (in_array($user->role?->name, ['owner', 'restaurant_admin', 'manager', 'chef', 'cashier', 'super_admin'])) {
            return true;
        }

        if ($user->role?->name === 'waiter') {
            return $order->user_id === $user->id || $order->table_id !== null;
        }

        return false;
    }

    public function create(User $user): bool
    {
        return in_array($user->role?->name, ['owner', 'restaurant_admin', 'manager', 'waiter', 'cashier', 'super_admin']);
    }

    public function update(User $user, Order $order): bool
    {
        if (! $user->isSuperAdmin() && ($user->restaurant_id === null || $user->restaurant_id !== $order->restaurant_id)) {
            return false;
        }

        if (in_array($user->role?->name, ['owner', 'restaurant_admin', 'manager', 'super_admin'])) {
            return true;
        }

        // cozinha confirma ou atualiza enquanto ta no fluxo de preparo
        if ($user->role?->name === 'chef') {
            return in_array($order->status, ['pending', 'confirmed', 'preparing']);
        }

        if ($user->role?->name === 'waiter') {
            return $order->user_id === $user->id && ! in_array($order->status, ['delivered', 'canceled']);
        }

        return false;
    }

    public function delete(User $user, Order $order): bool
    {
        if (! $user->isSuperAdmin() && ($user->restaurant_id === null || $user->restaurant_id !== $order->restaurant_id)) {
            return false;
        }

        return in_array($user->role?->name, ['owner', 'restaurant_admin', 'manager', 'super_admin']);
    }
}
