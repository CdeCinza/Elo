<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Restaurant;
use App\Models\RestaurantTable;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RolePolicyTest extends TestCase
{
    use RefreshDatabase;

    protected Role $ownerRole;

    protected Role $managerRole;

    protected Role $waiterRole;

    protected Role $chefRole;

    protected Restaurant $restaurant;

    protected function setUp(): void
    {
        parent::setUp();

        $this->ownerRole = Role::create(['name' => 'owner', 'label' => 'Dono da Rede']);
        $this->managerRole = Role::create(['name' => 'manager', 'label' => 'Gerente de Loja']);
        $this->waiterRole = Role::create(['name' => 'waiter', 'label' => 'Garçom']);
        $this->chefRole = Role::create(['name' => 'chef', 'label' => 'Cozinheiro']);
        $this->restaurant = Restaurant::factory()->create();
    }

    public function test_owner_and_manager_can_delete_order(): void
    {
        $owner = User::factory()->create(['role_id' => $this->ownerRole->id, 'restaurant_id' => $this->restaurant->id]);
        $order = Order::factory()->create();

        $this->assertTrue($owner->can('delete', $order));
    }

    public function test_waiter_cannot_delete_order(): void
    {
        $waiter = User::factory()->create(['role_id' => $this->waiterRole->id, 'restaurant_id' => $this->restaurant->id]);
        $order = Order::factory()->create(['user_id' => $waiter->id]);

        $this->assertFalse($waiter->can('delete', $order));
    }

    public function test_manager_cannot_view_or_change_another_restaurants_order(): void
    {
        $manager = User::factory()->create([
            'role_id' => $this->managerRole->id,
            'restaurant_id' => $this->restaurant->id,
        ]);
        $otherRestaurant = Restaurant::factory()->create();
        $order = Order::factory()->create(['restaurant_id' => $otherRestaurant->id]);

        $this->assertFalse($manager->can('view', $order));
        $this->assertFalse($manager->can('update', $order));
        $this->assertFalse($manager->can('delete', $order));
    }

    public function test_chef_can_only_update_confirmed_or_preparing_orders(): void
    {
        $chef = User::factory()->create(['role_id' => $this->chefRole->id, 'restaurant_id' => $this->restaurant->id]);
        $preparingOrder = Order::factory()->create(['status' => 'preparing']);
        $deliveredOrder = Order::factory()->create(['status' => 'delivered']);

        $this->assertTrue($chef->can('update', $preparingOrder));
        $this->assertFalse($chef->can('update', $deliveredOrder));
    }

    public function test_waiter_can_add_items_to_a_customers_table_order_without_changing_its_status(): void
    {
        $waiter = User::factory()->create(['role_id' => $this->waiterRole->id, 'restaurant_id' => $this->restaurant->id]);
        $order = Order::factory()->create([
            'restaurant_id' => $this->restaurant->id,
            'user_id' => null,
            'table_id' => RestaurantTable::factory()->create(['restaurant_id' => $this->restaurant->id])->id,
            'status' => 'pending',
        ]);

        $this->assertTrue($waiter->can('addItem', $order));
        $this->assertFalse($waiter->can('update', $order));

        $otherRestaurant = Restaurant::factory()->create();
        $otherTable = RestaurantTable::factory()->create(['restaurant_id' => $otherRestaurant->id]);
        $otherOrder = Order::factory()->create(['restaurant_id' => $otherRestaurant->id, 'table_id' => $otherTable->id]);
        $this->assertFalse($waiter->can('addItem', $otherOrder));
    }
}
