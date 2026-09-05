<?php

namespace App\Policies;

use App\Models\Ingredient;
use App\Models\User;

class IngredientPolicy
{
    public function viewAny(User $user): bool
    {
        // Dono, Gerente e Cozinheiro visualizam o estoque de insumos
        return in_array($user->role?->name, ['owner', 'manager', 'chef']);
    }

    public function view(User $user, Ingredient $ingredient): bool
    {
        return in_array($user->role?->name, ['owner', 'manager', 'chef']);
    }

    public function create(User $user): bool
    {
        // Dono, Gerente e Cozinheiro podem cadastrar insumos
        return in_array($user->role?->name, ['owner', 'manager', 'chef']);
    }

    public function update(User $user, Ingredient $ingredient): bool
    {
        // Dono, Gerente e Cozinheiro podem repor/alterar estoque
        return in_array($user->role?->name, ['owner', 'manager', 'chef']);
    }

    public function delete(User $user, Ingredient $ingredient): bool
    {
        // Deletar insumo é restrito a Dono e Gerente
        return in_array($user->role?->name, ['owner', 'manager']);
    }
}
