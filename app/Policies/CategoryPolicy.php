<?php

namespace App\Policies;

use App\Models\Category;
use App\Models\User;

class CategoryPolicy
{
    public function viewAny(?User $user): bool
    {
        // qualquer um ou visitante pode ver o cardápio
        return true;
    }

    public function view(?User $user, Category $category): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        // só dono, admin do restaurante e gerente alteram estrutura do cardápio
        return in_array($user->role?->name, ['owner', 'restaurant_admin', 'manager', 'super_admin']);
    }

    public function update(User $user, Category $category): bool
    {
        return in_array($user->role?->name, ['owner', 'restaurant_admin', 'manager', 'super_admin']);
    }

    public function delete(User $user, Category $category): bool
    {
        return in_array($user->role?->name, ['owner', 'restaurant_admin', 'manager', 'super_admin']);
    }
}
