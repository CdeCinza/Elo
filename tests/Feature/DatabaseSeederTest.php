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

        $this->assertDatabaseHas('roles', ['name' => 'owner']);
        $this->assertDatabaseHas('roles', ['name' => 'manager']);
        $this->assertDatabaseHas('roles', ['name' => 'waiter']);
        $this->assertDatabaseHas('roles', ['name' => 'chef']);
        $this->assertDatabaseHas('roles', ['name' => 'cashier']);

        $this->assertDatabaseHas('users', ['email' => 'owner@elo.com']);
        $this->assertDatabaseHas('users', ['email' => 'manager@elo.com']);
        $this->assertDatabaseHas('users', ['email' => 'waiter@elo.com']);
        $this->assertDatabaseHas('users', ['email' => 'chef@elo.com']);
        $this->assertDatabaseHas('users', ['email' => 'cashier@elo.com']);

        $this->assertEquals(5, Role::count());
        $this->assertEquals(5, User::count());
        $this->assertEquals(10, RestaurantTable::count());
        $this->assertEquals(3, Category::count());
        $this->assertEquals(3, Product::count());
        $this->assertEquals(5, Ingredient::count());

        $burger = Product::where('name', 'Cheeseburger Duplo')->first();
        $this->assertNotNull($burger);
        $this->assertCount(3, $burger->ingredients);
    }
}
