<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\Restaurant;
use App\Models\RestaurantTable;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PosKdsApiTest extends TestCase
{
    use RefreshDatabase;

    private Restaurant $restaurant;

    private RestaurantTable $table;

    private Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        $this->restaurant = Restaurant::create([
            'name' => 'Restaurante Teste',
            'slug' => 'restaurante-teste',
            'status' => 'active',
        ]);

        $role = Role::create(['name' => 'waiter', 'label' => 'Garçom']);
        User::factory()->create([
            'restaurant_id' => $this->restaurant->id,
            'role_id' => $role->id,
        ]);

        $this->table = RestaurantTable::create([
            'restaurant_id' => $this->restaurant->id,
            'number' => 'Mesa 1',
            'capacity' => 4,
            'status' => 'free',
        ]);

        $category = Category::create([
            'restaurant_id' => $this->restaurant->id,
            'name' => 'Burgers',
            'description' => 'Hambúrgueres',
        ]);

        $this->product = Product::create([
            'restaurant_id' => $this->restaurant->id,
            'category_id' => $category->id,
            'name' => 'Smash ELO Bacon',
            'description' => 'Burger artesanal',
            'price' => 36.90,
            'available' => true,
        ]);
    }

    public function test_customer_can_checkin_and_table_becomes_occupied(): void
    {
        $response = $this->postJson('/api/v1/customer/table/01/check-in');

        $response->assertOk()
            ->assertJsonPath('table.status', 'occupied');

        $this->assertEquals('occupied', $this->table->fresh()->status);
    }

    public function test_customer_can_call_waiter_and_request_bill(): void
    {
        $callResponse = $this->postJson('/api/v1/customer/table/01/call-waiter');
        $callResponse->assertOk()
            ->assertJsonPath('table.waiter_called', true);

        $billResponse = $this->postJson('/api/v1/customer/table/01/request-bill');
        $billResponse->assertOk()
            ->assertJsonPath('table.status', 'bill_requested');

        $this->assertEquals('bill_requested', $this->table->fresh()->status);
    }

    public function test_pos_lists_all_tables_with_accurate_status(): void
    {
        $response = $this->getJson('/api/v1/pos/tables');

        $response->assertOk()
            ->assertJsonStructure(['tables'])
            ->assertJsonPath('tables.0.number', '01')
            ->assertJsonPath('tables.0.status', 'free');
    }

    public function test_pos_can_open_table_and_add_item(): void
    {
        $openResponse = $this->postJson('/api/v1/pos/tables/01/open');
        $openResponse->assertOk();
        $this->assertEquals('occupied', $this->table->fresh()->status);

        $itemResponse = $this->postJson('/api/v1/pos/tables/01/items', [
            'product_id' => $this->product->id,
            'quantity' => 2,
            'notes' => 'Ao ponto',
        ]);

        $itemResponse->assertOk()
            ->assertJsonPath('order.items.0.product_id', $this->product->id);

        $order = Order::where('table_id', $this->table->id)->first();
        $this->assertNotNull($order);
        $this->assertEquals(73.80, (float) $order->total);
    }

    public function test_pos_can_close_table_with_payment(): void
    {
        // Abre e lança item
        $this->postJson('/api/v1/pos/tables/01/open');
        $this->postJson('/api/v1/pos/tables/01/items', [
            'product_id' => $this->product->id,
            'quantity' => 1,
        ]);

        // Fecha mesa
        $closeResponse = $this->postJson('/api/v1/pos/tables/01/close', [
            'payment_method' => 'pix',
        ]);

        $closeResponse->assertOk()
            ->assertJsonPath('table.status', 'free');

        $this->assertEquals('free', $this->table->fresh()->status);
        $this->assertDatabaseHas('payments', [
            'method' => 'pix',
            'status' => 'paid',
        ]);
    }

    public function test_kds_lists_orders_and_can_advance_status(): void
    {
        // Cria pedido com item
        $order = Order::create([
            'restaurant_id' => $this->restaurant->id,
            'table_id' => $this->table->id,
            'type' => 'dine_in',
            'status' => 'pending',
            'subtotal' => 36.90,
            'total' => 36.90,
        ]);

        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $this->product->id,
            'unit_price' => 36.90,
            'quantity' => 1,
            'subtotal' => 36.90,
        ]);

        $kdsResponse = $this->getJson('/api/v1/kds/orders');
        $kdsResponse->assertOk()
            ->assertJsonPath('orders.0.tableNumber', '01')
            ->assertJsonPath('orders.0.status', 'pending');

        // Avança status para preparing
        $advanceResponse = $this->patchJson("/api/v1/kds/orders/{$order->id}/status", [
            'status' => 'preparing',
        ]);

        $advanceResponse->assertOk()
            ->assertJsonPath('order.status', 'preparing');

        $this->assertEquals('preparing', $order->fresh()->status);
    }

    public function test_pos_can_create_update_and_delete_table(): void
    {
        // 1. Cria nova mesa
        $createResponse = $this->postJson('/api/v1/pos/tables', [
            'number' => '15',
            'capacity' => 6,
        ]);

        $createResponse->assertCreated()
            ->assertJsonPath('table.capacity', 6)
            ->assertJsonPath('table.status', 'free');

        $this->assertDatabaseHas('restaurant_tables', [
            'number' => 'Mesa 15',
            'capacity' => 6,
        ]);

        // 2. Atualiza capacidade
        $updateResponse = $this->putJson('/api/v1/pos/tables/15', [
            'capacity' => 8,
        ]);

        $updateResponse->assertOk()
            ->assertJsonPath('table.capacity', 8);

        // 3. Exclui mesa
        $deleteResponse = $this->deleteJson('/api/v1/pos/tables/15');
        $deleteResponse->assertOk();

        $this->assertDatabaseMissing('restaurant_tables', [
            'number' => 'Mesa 15',
        ]);
    }

    public function test_pos_can_clear_waiter_call_and_reset_table(): void
    {
        // Chama garçom
        $this->postJson('/api/v1/customer/table/01/call-waiter');

        // Limpa chamado via POS
        $clearResponse = $this->postJson('/api/v1/pos/tables/01/clear-waiter');
        $clearResponse->assertOk();

        // Reseta mesa para livre
        $resetResponse = $this->postJson('/api/v1/pos/tables/01/reset');
        $resetResponse->assertOk();
        $this->assertEquals('free', $this->table->fresh()->status);
    }
}
