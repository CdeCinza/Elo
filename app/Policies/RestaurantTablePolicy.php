<?php

namespace App\Policies;

use App\Models\RestaurantTable;
use App\Models\User;

class RestaurantTablePolicy
{
    public function viewAny(User $user): bool
    {
        // qualquer funcionário autenticado visualiza o mapa de mesas
        return in_array($user->role?->name, ['owner', 'manager', 'waiter', 'chef', 'cashier']);
    }

    public function view(User $user, RestaurantTable $table): bool
    {
        return in_array($user->role?->name, ['owner', 'manager', 'waiter', 'chef', 'cashier']);
    }

    public function create(User $user): bool
    {
        // cadastrar mesa física é só com a gerência/dono
        return in_array($user->role?->name, ['owner', 'manager']);
    }

    public function update(User $user, RestaurantTable $table): bool
    {
        // garçom e caixa podem alterar status/abrir comanda, gerência faz tudo
        return in_array($user->role?->name, ['owner', 'manager', 'waiter', 'cashier']);
    }

    public function delete(User $user, RestaurantTable $table): bool
    {
        return in_array($user->role?->name, ['owner', 'manager']);
    }
}
