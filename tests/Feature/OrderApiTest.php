<?php

namespace Tests\Feature;

use App\Events\OrderStatusChanged;
use App\Models\Order;
use App\Models\Product;
use App\Models\RestaurantTable;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class OrderApiTest extends TestCase
{
    use RefreshDatabase;

    protected User $waiter;

    protected User $chef;

    protected RestaurantTable $table;

    protected Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        Event::fake([OrderStatusChanged::class]);

        $waiterRole = Role::create(['name' => 'waiter', 'label' => 'Garçom']);
        $chefRole = Role::create(['name' => 'chef', 'label' => 'Cozinheiro']);

        $this->waiter = User::factory()->create(['role_id' => $waiterRole->id]);
        $this->chef = User::factory()->create(['role_id' => $chefRole->id]);

        $this->table = RestaurantTable::factory()->create(['number' => 'Mesa 10', 'status' => 'free']);
        $this->product = Product::factory()->create(['name' => 'X-Burger', 'price' => 30.00, 'available' => true]);
    }

    public function test_waiter_can_create_order_with_items_and_occupy_table(): void
    {
        $response = $this->actingAs($this->waiter, 'sanctum')
            ->postJson('/api/v1/orders', [
                'table_id' => $this->table->id,
                'type' => 'dine_in',
                'items' => [
                    [
                        'product_id' => $this->product->id,
                        'quantity' => 2,
                        'notes' => 'Sem picles',
                    ],
                ],
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('order.status', 'pending')
            ->assertJsonPath('order.total', 60);

        $this->assertDatabaseHas('orders', ['table_id' => $this->table->id, 'total' => 60.00]);
        $this->assertDatabaseHas('restaurant_tables', ['id' => $this->table->id, 'status' => 'occupied']);
        $this->assertDatabaseHas('activity_logs', ['action' => 'order_created']);
    }

    public function test_can_add_item_to_open_order(): void
    {
        $order = Order::factory()->create([
            'table_id' => $this->table->id,
            'user_id' => $this->waiter->id,
            'status' => 'pending',
            'subtotal' => 0.00,
            'total' => 0.00,
        ]);

        $response = $this->actingAs($this->waiter, 'sanctum')
            ->postJson("/api/v1/orders/{$order->id}/items", [
                'product_id' => $this->product->id,
                'quantity' => 1,
            ]);

        $response->assertStatus(200)
            ->assertJsonPath('order.total', 30);
    }

    public function test_state_machine_validates_transitions(): void
    {
        $order = Order::factory()->create([
            'table_id' => $this->table->id,
            'user_id' => $this->waiter->id,
            'status' => 'pending',
        ]);

        // transição válida: pending -> confirmed
        $response = $this->actingAs($this->waiter, 'sanctum')
            ->patchJson("/api/v1/orders/{$order->id}/status", ['status' => 'confirmed']);

        $response->assertStatus(200)
            ->assertJsonPath('order.status', 'confirmed');

        // transição inválida: confirmed -> delivered (precisa passar por preparing -> ready)
        $invalidResponse = $this->actingAs($this->waiter, 'sanctum')
            ->patchJson("/api/v1/orders/{$order->id}/status", ['status' => 'delivered']);

        $invalidResponse->assertStatus(422)
            ->assertJson(['message' => "Transição de status inválida: de 'confirmed' para 'delivered'."]);
    }

    public function test_delivering_order_frees_the_table(): void
    {
        $order = Order::factory()->create([
            'table_id' => $this->table->id,
            'user_id' => $this->waiter->id,
            'status' => 'ready',
        ]);
        $this->table->update(['status' => 'occupied']);

        $response = $this->actingAs($this->waiter, 'sanctum')
            ->patchJson("/api/v1/orders/{$order->id}/status", ['status' => 'delivered']);

        $response->assertStatus(200)
            ->assertJsonPath('order.status', 'delivered');

        $this->assertDatabaseHas('restaurant_tables', ['id' => $this->table->id, 'status' => 'free']);
    }
}
