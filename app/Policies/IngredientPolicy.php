<?php

namespace App\Policies;

use App\Models\Ingredient;
use App\Models\User;

class IngredientPolicy
{
    public function viewAny(User $user): bool
    {
        // Dono, Gerente e Cozinheiro visualizam o estoque de insumos
        return in_array($user->role?->name, ['owner', 'restaurant_admin', 'manager', 'chef', 'super_admin']);
    }

    public function view(User $user, Ingredient $ingredient): bool
    {
        return ($user->isSuperAdmin() || ($user->restaurant_id !== null && $user->restaurant_id === $ingredient->restaurant_id))
            && in_array($user->role?->name, ['owner', 'restaurant_admin', 'manager', 'chef', 'super_admin']);
    }

    public function create(User $user): bool
    {
        // Dono, Gerente e Cozinheiro podem cadastrar insumos
        return in_array($user->role?->name, ['owner', 'restaurant_admin', 'manager', 'chef', 'super_admin']);
    }

    public function update(User $user, Ingredient $ingredient): bool
    {
        // Dono, Gerente e Cozinheiro podem repor/alterar estoque
        return ($user->isSuperAdmin() || ($user->restaurant_id !== null && $user->restaurant_id === $ingredient->restaurant_id))
            && in_array($user->role?->name, ['owner', 'restaurant_admin', 'manager', 'chef', 'super_admin']);
    }

    public function delete(User $user, Ingredient $ingredient): bool
    {
        // Deletar insumo é restrito a Dono e Gerente
        return ($user->isSuperAdmin() || ($user->restaurant_id !== null && $user->restaurant_id === $ingredient->restaurant_id))
            && in_array($user->role?->name, ['owner', 'restaurant_admin', 'manager', 'super_admin']);
    }
}
