<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Restaurant;
use App\Models\RestaurantTable;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TableApiTest extends TestCase
{
    use RefreshDatabase;

    protected User $manager;

    protected User $waiter;

    protected function setUp(): void
    {
        parent::setUp();

        $managerRole = Role::create(['name' => 'manager', 'label' => 'Gerente']);
        $waiterRole = Role::create(['name' => 'waiter', 'label' => 'Garçom']);
        $restaurant = Restaurant::factory()->create();

        $this->manager = User::factory()->create(['role_id' => $managerRole->id, 'restaurant_id' => $restaurant->id]);
        $this->waiter = User::factory()->create(['role_id' => $waiterRole->id, 'restaurant_id' => $restaurant->id]);
    }

    public function test_authenticated_staff_can_list_tables(): void
    {
        RestaurantTable::factory(3)->create();

        $response = $this->actingAs($this->waiter, 'sanctum')
            ->getJson('/api/v1/tables');

        $response->assertStatus(200)
            ->assertJsonCount(3, 'data');
    }

    public function test_manager_can_create_new_table(): void
    {
        $response = $this->actingAs($this->manager, 'sanctum')
            ->postJson('/api/v1/tables', [
                'number' => 'Mesa VIP 01',
                'capacity' => 6,
                'status' => 'free',
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('table.number', 'Mesa VIP 01');

        $this->assertDatabaseHas('restaurant_tables', ['number' => 'Mesa VIP 01']);
    }

    public function test_same_table_number_is_allowed_in_another_restaurant_and_is_not_visible(): void
    {
        $otherRestaurant = Restaurant::factory()->create();
        $otherTable = RestaurantTable::factory()->create([
            'restaurant_id' => $otherRestaurant->id,
            'number' => 'Mesa VIP 01',
        ]);

        $this->actingAs($this->manager, 'sanctum')
            ->postJson('/api/v1/tables', [
                'number' => 'Mesa VIP 01',
                'capacity' => 4,
            ])
            ->assertCreated();

        $this->getJson('/api/v1/tables')->assertJsonCount(1, 'data');
        $this->getJson("/api/v1/tables/{$otherTable->id}")->assertForbidden();
    }

    public function test_waiter_can_open_tab_for_free_table(): void
    {
        $table = RestaurantTable::factory()->create([
            'number' => 'Mesa 05',
            'status' => 'free',
        ]);

        $response = $this->actingAs($this->waiter, 'sanctum')
            ->postJson("/api/v1/tables/{$table->id}/open-tab");

        $response->assertStatus(201)
            ->assertJsonPath('order.table_id', $table->id)
            ->assertJsonPath('order.status', 'pending');

        $this->assertDatabaseHas('restaurant_tables', [
            'id' => $table->id,
            'status' => 'occupied',
        ]);

        $this->assertDatabaseHas('orders', [
            'table_id' => $table->id,
            'user_id' => $this->waiter->id,
            'status' => 'pending',
        ]);
    }

    public function test_cannot_open_tab_on_already_occupied_table(): void
    {
        $table = RestaurantTable::factory()->create([
            'status' => 'occupied',
        ]);

        $response = $this->actingAs($this->waiter, 'sanctum')
            ->postJson("/api/v1/tables/{$table->id}/open-tab");

        $response->assertStatus(422)
            ->assertJson(['message' => 'Esta mesa já possui uma comanda/pedido em andamento.']);
    }

    public function test_table_with_an_open_order_cannot_be_deleted(): void
    {
        $table = RestaurantTable::factory()->create([
            'restaurant_id' => $this->manager->restaurant_id,
            'status' => 'free',
        ]);
        $order = Order::factory()->create([
            'restaurant_id' => $this->manager->restaurant_id,
            'table_id' => $table->id,
            'status' => 'preparing',
        ]);

        $this->actingAs($this->manager, 'sanctum')
            ->deleteJson("/api/v1/tables/{$table->id}")
            ->assertStatus(422)
            ->assertJsonPath('message', 'Esta mesa possui um pedido ativo em aberto.');

        $this->assertDatabaseHas('restaurant_tables', ['id' => $table->id]);
        $this->assertSame($table->id, $order->fresh()->table_id);
    }
}
