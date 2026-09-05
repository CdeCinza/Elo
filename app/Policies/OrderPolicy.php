<?php

namespace App\Policies;

use App\Models\Order;
use App\Models\User;

class OrderPolicy
{
    public function viewAny(User $user): bool
    {
        return in_array($user->role?->name, ['owner', 'manager', 'waiter', 'chef', 'cashier']);
    }

    public function view(User $user, Order $order): bool
    {
        if (in_array($user->role?->name, ['owner', 'manager', 'chef', 'cashier'])) {
            return true;
        }

        if ($user->role?->name === 'waiter') {
            return $order->user_id === $user->id || $order->table_id !== null;
        }

        return false;
    }

    public function create(User $user): bool
    {
        return in_array($user->role?->name, ['owner', 'manager', 'waiter', 'cashier']);
    }

    public function update(User $user, Order $order): bool
    {
        if (in_array($user->role?->name, ['owner', 'manager'])) {
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
        return in_array($user->role?->name, ['owner', 'manager']);
    }
}
