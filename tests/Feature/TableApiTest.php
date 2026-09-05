<?php

namespace Tests\Feature;

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

        $this->manager = User::factory()->create(['role_id' => $managerRole->id]);
        $this->waiter = User::factory()->create(['role_id' => $waiterRole->id]);
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
}
