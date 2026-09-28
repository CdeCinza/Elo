<?php

namespace App\Policies;

use App\Models\RestaurantTable;
use App\Models\User;

class RestaurantTablePolicy
{
    public function viewAny(User $user): bool
    {
        // qualquer funcionário autenticado visualiza o mapa de mesas
        return in_array($user->role?->name, ['owner', 'restaurant_admin', 'manager', 'waiter', 'chef', 'cashier', 'super_admin']);
    }

    public function view(User $user, RestaurantTable $table): bool
    {
        if (! $user->isSuperAdmin() && ($user->restaurant_id === null || $user->restaurant_id !== $table->restaurant_id)) {
            return false;
        }

        return in_array($user->role?->name, ['owner', 'restaurant_admin', 'manager', 'waiter', 'chef', 'cashier', 'super_admin']);
    }

    public function create(User $user): bool
    {
        // cadastrar mesa física é só com a gerência/dono
        return in_array($user->role?->name, ['owner', 'restaurant_admin', 'manager', 'super_admin']);
    }

    public function update(User $user, RestaurantTable $table): bool
    {
        if (! $user->isSuperAdmin() && ($user->restaurant_id === null || $user->restaurant_id !== $table->restaurant_id)) {
            return false;
        }

        // garçom e caixa podem alterar status/abrir comanda, gerência faz tudo
        return in_array($user->role?->name, ['owner', 'restaurant_admin', 'manager', 'waiter', 'cashier', 'super_admin']);
    }

    public function delete(User $user, RestaurantTable $table): bool
    {
        if (! $user->isSuperAdmin() && ($user->restaurant_id === null || $user->restaurant_id !== $table->restaurant_id)) {
            return false;
        }

        return in_array($user->role?->name, ['owner', 'restaurant_admin', 'manager', 'super_admin']);
    }
}
