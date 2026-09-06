<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Ingredient;
use App\Models\Product;
use App\Models\RestaurantTable;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DatabaseSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_database_seeds_roles_users_tables_and_products_correctly(): void
    {
        $this->seed();

        $this->assertDatabaseHas('roles', ['name' => 'super_admin']);
        $this->assertDatabaseHas('roles', ['name' => 'restaurant_admin']);
        $this->assertDatabaseHas('roles', ['name' => 'manager']);
        $this->assertDatabaseHas('roles', ['name' => 'waiter']);
        $this->assertDatabaseHas('roles', ['name' => 'chef']);
        $this->assertDatabaseHas('roles', ['name' => 'cashier']);

        $superAdminEmail = env('SUPERADMIN_EMAIL', 'matheusneru@gmail.com');
        $this->assertDatabaseHas('users', ['email' => $superAdminEmail]);
        $this->assertDatabaseHas('users', ['email' => 'dono@elo.com']);
        $this->assertDatabaseHas('users', ['email' => 'gerente@elo.com']);
        $this->assertDatabaseHas('users', ['email' => 'garcom@elo.com']);
        $this->assertDatabaseHas('users', ['email' => 'chef@elo.com']);
        $this->assertDatabaseHas('users', ['email' => 'caixa@elo.com']);

        $this->assertEquals(6, Role::count());
        $this->assertEquals(6, User::count());
        $this->assertEquals(10, RestaurantTable::count());
        $this->assertEquals(4, Category::count());
        $this->assertEquals(5, Product::count());
        $this->assertEquals(5, Ingredient::count());

        $burger = Product::where('name', 'Smash ELO Bacon Duplo')->first();
        $this->assertNotNull($burger);
        $this->assertCount(3, $burger->ingredients);
    }
}
