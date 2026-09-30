<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Ingredient;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\Restaurant;
use App\Models\RestaurantTable;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
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

        $role = Role::create(['name' => 'manager', 'label' => 'Gerente']);
        $operator = User::factory()->create([
            'restaurant_id' => $this->restaurant->id,
            'role_id' => $role->id,
        ]);
        $this->actingAs($operator, 'sanctum');

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

    public function test_customer_and_pos_additions_preserve_order_discount_and_delivery_fee(): void
    {
        $this->postJson('/api/v1/pos/tables/01/items', [
            'product_id' => $this->product->id, 'quantity' => 1,
        ])->assertOk();
        $order = Order::firstOrFail();
        $order->update(['discount' => 10, 'delivery_fee' => 5, 'total' => 31.90]);

        $this->postJson('/api/v1/customer/table/01/order', [
            'items' => [['product_id' => $this->product->id, 'quantity' => 1]],
        ])->assertCreated()->assertJsonPath('order.total', 68.8);

        $this->postJson('/api/v1/pos/tables/01/items', [
            'product_id' => $this->product->id, 'quantity' => 1,
        ])->assertOk();

        $this->assertEquals(105.70, (float) $order->fresh()->total);
        $this->postJson('/api/v1/pos/tables/01/close', ['payment_method' => 'cash'])->assertOk();
        $this->assertDatabaseHas('payments', ['order_id' => $order->id, 'amount' => 105.70]);
    }

    public function test_customer_can_call_waiter_and_request_bill(): void
    {
        $callResponse = $this->postJson('/api/v1/customer/table/01/call-waiter');
        $callResponse->assertOk()
            ->assertJsonPath('table.waiter_called', true);

        $this->postJson('/api/v1/customer/table/01/order', [
            'items' => [['product_id' => $this->product->id, 'quantity' => 1]],
        ])->assertCreated();

        $billResponse = $this->postJson('/api/v1/customer/table/01/request-bill');
        $billResponse->assertOk()
            ->assertJsonPath('table.status', 'bill_requested');

        $this->assertEquals('bill_requested', $this->table->fresh()->status);
    }

    public function test_bill_cannot_be_requested_for_a_table_without_consumption(): void
    {
        $this->postJson('/api/v1/customer/table/01/request-bill')
            ->assertStatus(422)
            ->assertJsonPath('message', 'Não há consumo registrado nesta mesa para solicitar a conta.');

        $this->assertEquals('free', $this->table->fresh()->status);
    }

    public function test_ordering_after_requesting_the_bill_keeps_the_bill_request_visible(): void
    {
        $this->postJson('/api/v1/customer/table/01/order', [
            'items' => [['product_id' => $this->product->id, 'quantity' => 1]],
        ])->assertCreated();
        $this->postJson('/api/v1/customer/table/01/request-bill')->assertOk();

        $this->postJson('/api/v1/customer/table/01/order', [
            'items' => [['product_id' => $this->product->id, 'quantity' => 1]],
        ])->assertCreated();
        $this->postJson('/api/v1/pos/tables/01/items', [
            'product_id' => $this->product->id,
            'quantity' => 1,
        ])->assertOk();

        $this->assertEquals('bill_requested', $this->table->fresh()->status);
    }

    public function test_validation_messages_are_in_portuguese(): void
    {
        $this->postJson('/api/v1/pos/tables/01/close', ['payment_method' => 'bitcoin'])
            ->assertStatus(422)
            ->assertJsonPath('errors.payment_method.0', 'O valor selecionado para forma de pagamento é inválido.');

        $this->postJson('/api/v1/pos/tables/01/items', [])
            ->assertStatus(422)
            ->assertJsonPath('errors.quantity.0', 'O campo quantidade é obrigatório.');
    }

    public function test_pos_rejects_unavailable_products(): void
    {
        $this->product->update(['available' => false]);

        $this->postJson('/api/v1/pos/tables/01/items', [
            'product_id' => $this->product->id,
            'quantity' => 1,
        ])->assertStatus(422)
            ->assertJsonPath('message', "O produto 'Smash ELO Bacon' está indisponível no momento.");

        $this->assertDatabaseCount('order_items', 0);
    }

    public function test_customer_endpoints_of_a_suspended_restaurant_are_blocked(): void
    {
        $this->restaurant->update(['status' => 'suspended']);
        auth()->forgetGuards();

        $headers = ['X-Restaurant-Id' => (string) $this->restaurant->id];

        $this->getJson('/api/v1/customer/tables', $headers)
            ->assertForbidden()
            ->assertJsonPath('message', 'Este restaurante está suspenso no momento. Entre em contato com o responsável.');
        $this->getJson('/api/v1/customer/table/01', $headers)->assertForbidden();
        $this->postJson('/api/v1/customer/table/01/check-in', [], $headers)->assertForbidden();
        $this->postJson('/api/v1/customer/table/01/order', [
            'items' => [['product_id' => $this->product->id, 'quantity' => 1]],
        ], $headers)->assertForbidden();

        $this->assertDatabaseCount('orders', 0);
    }

    public function test_kitchen_tracks_each_round_by_item_status(): void
    {
        $this->travelTo(now()->subMinutes(30));
        $this->postJson('/api/v1/customer/table/01/order', [
            'items' => [['product_id' => $this->product->id, 'quantity' => 1]],
        ])->assertCreated();
        $this->travelBack();

        $order = Order::firstOrFail();
        $firstItem = $order->items()->firstOrFail();

        $this->patchJson("/api/v1/kds/orders/{$order->id}/status", ['status' => 'preparing'])->assertOk();
        $this->patchJson("/api/v1/kds/orders/{$order->id}/status", ['status' => 'ready'])->assertOk();
        $this->patchJson("/api/v1/kds/orders/{$order->id}/status", ['status' => 'delivered'])
            ->assertOk()
            ->assertJsonPath('order.status', 'delivered');

        $this->getJson('/api/v1/kds/orders')->assertOk()->assertJsonCount(0, 'orders');

        // Segunda rodada: só o item novo aparece na cozinha e o tempo de espera conta a partir dele
        $this->travelTo(now()->subMinutes(5));
        $this->postJson('/api/v1/customer/table/01/order', [
            'items' => [['product_id' => $this->product->id, 'quantity' => 2, 'notes' => 'Sem cebola']],
        ])->assertCreated();
        $this->travelBack();

        $secondItem = $order->items()->whereKeyNot($firstItem->id)->firstOrFail();

        $kds = $this->getJson('/api/v1/kds/orders')->assertOk();
        $kds->assertJsonCount(1, 'orders')
            ->assertJsonPath('orders.0.status', 'pending')
            ->assertJsonCount(1, 'orders.0.items')
            ->assertJsonPath('orders.0.items.0.id', $secondItem->id)
            ->assertJsonPath('orders.0.items.0.status', 'pending')
            ->assertJsonPath('orders.0.items.0.quantity', 2);
        $this->assertContains($kds->json('orders.0.minutesAgo'), [5, 6]);
        $this->assertNotNull($kds->json('orders.0.items.0.created_at'));

        $this->patchJson("/api/v1/kds/orders/{$order->id}/status", ['status' => 'preparing'])
            ->assertOk()
            ->assertJsonPath('order.status', 'preparing');

        // Nova rodada enquanto a anterior está no fogo: aparece como pendente, sem mexer no item em preparo
        $this->postJson('/api/v1/customer/table/01/order', [
            'items' => [['product_id' => $this->product->id, 'quantity' => 1]],
        ])->assertCreated();

        $this->getJson('/api/v1/kds/orders')
            ->assertJsonPath('orders.0.status', 'pending')
            ->assertJsonCount(2, 'orders.0.items')
            ->assertJsonPath('orders.0.items.0.status', 'preparing')
            ->assertJsonPath('orders.0.items.1.status', 'pending');

        $this->patchJson("/api/v1/kds/orders/{$order->id}/status", ['status' => 'preparing'])->assertOk();
        $this->assertSame(['delivered', 'preparing', 'preparing'], $order->items()->orderBy('id')->pluck('status')->all());

        $this->getJson('/api/v1/pos/tables')
            ->assertJsonPath('tables.0.items.0.status', 'delivered')
            ->assertJsonPath('tables.0.items.1.status', 'preparing');
    }

    public function test_kitchen_can_advance_one_stage_while_a_newer_round_waits(): void
    {
        $this->postJson('/api/v1/customer/table/01/order', [
            'items' => [['product_id' => $this->product->id, 'quantity' => 1]],
        ])->assertCreated();
        $order = Order::firstOrFail();
        $this->patchJson("/api/v1/kds/orders/{$order->id}/status", ['status' => 'preparing'])->assertOk();

        $this->postJson('/api/v1/customer/table/01/order', [
            'items' => [['product_id' => $this->product->id, 'quantity' => 1]],
        ])->assertCreated();

        $this->patchJson("/api/v1/kds/orders/{$order->id}/status", ['status' => 'ready', 'from' => 'preparing'])
            ->assertOk()
            ->assertJsonPath('order.status', 'pending');
        $this->assertSame(['ready', 'pending'], $order->items()->orderBy('id')->pluck('status')->all());

        $this->patchJson("/api/v1/kds/orders/{$order->id}/status", ['status' => 'delivered', 'from' => 'preparing'])
            ->assertUnprocessable();
    }

    public function test_waiter_and_cashier_cannot_change_the_salon_structure(): void
    {
        $waiterRole = Role::create(['name' => 'waiter', 'label' => 'Garçom']);
        $waiter = User::factory()->create([
            'restaurant_id' => $this->restaurant->id,
            'role_id' => $waiterRole->id,
        ]);
        $this->actingAs($waiter, 'sanctum');

        $this->postJson('/api/v1/pos/tables', ['number' => '20'])->assertForbidden();
        $this->putJson('/api/v1/pos/tables/01', ['capacity' => 2])->assertForbidden();
        $this->deleteJson('/api/v1/pos/tables/01')->assertForbidden();
        $this->postJson('/api/v1/pos/tables/01/reset')->assertForbidden();
        $this->postJson('/api/v1/pos/tables/seed-defaults')->assertForbidden();

        $this->getJson('/api/v1/pos/tables')->assertOk();
        $this->postJson('/api/v1/pos/tables/01/open')->assertOk();
        $this->postJson('/api/v1/pos/tables/01/clear-waiter')->assertOk();
    }

    public function test_pos_lists_all_tables_with_accurate_status(): void
    {
        $response = $this->getJson('/api/v1/pos/tables');

        $response->assertOk()
            ->assertJsonStructure(['tables'])
            ->assertJsonPath('tables.0.number', '01')
            ->assertJsonPath('tables.0.status', 'free');
    }

    public function test_unknown_table_does_not_get_created_by_customer_request(): void
    {
        $this->getJson('/api/v1/customer/table/99')->assertNotFound();

        $this->assertDatabaseMissing('restaurant_tables', [
            'restaurant_id' => $this->restaurant->id,
            'number' => 'Mesa 99',
        ]);
    }

    public function test_table_number_does_not_match_another_tables_internal_id(): void
    {
        RestaurantTable::factory()->create([
            'id' => 99,
            'restaurant_id' => $this->restaurant->id,
            'number' => 'Mesa 77',
        ]);
        RestaurantTable::factory()->create([
            'restaurant_id' => $this->restaurant->id,
            'number' => 'Mesa 99',
        ]);

        $this->getJson('/api/v1/customer/table/99')
            ->assertOk()
            ->assertJsonPath('table.number', 'Mesa 99');

        $this->deleteJson('/api/v1/pos/tables/99')->assertOk();

        $this->assertDatabaseHas('restaurant_tables', ['id' => 99, 'number' => 'Mesa 77']);
        $this->assertDatabaseMissing('restaurant_tables', ['number' => 'Mesa 99']);
    }

    public function test_customer_can_list_existing_tables_for_tablet_setup(): void
    {
        $this->getJson('/api/v1/customer/tables')
            ->assertOk()
            ->assertJsonCount(1, 'tables')
            ->assertJsonPath('tables.0.number', '01');
    }

    public function test_tablet_setup_lists_tables_in_numeric_order(): void
    {
        RestaurantTable::factory()->create(['restaurant_id' => $this->restaurant->id, 'number' => 'Mesa 10']);
        RestaurantTable::factory()->create(['restaurant_id' => $this->restaurant->id, 'number' => 'Mesa 2']);

        $this->getJson('/api/v1/customer/tables')
            ->assertOk()
            ->assertJsonPath('tables.0.number', '01')
            ->assertJsonPath('tables.1.number', '02')
            ->assertJsonPath('tables.2.number', '10');
    }

    public function test_operator_cannot_switch_restaurants_with_a_header(): void
    {
        $otherRestaurant = Restaurant::factory()->create();
        RestaurantTable::factory()->create([
            'restaurant_id' => $otherRestaurant->id,
            'number' => 'Mesa 99',
        ]);

        $this->withHeader('X-Restaurant-Id', (string) $otherRestaurant->id)
            ->getJson('/api/v1/pos/tables')
            ->assertOk()
            ->assertJsonCount(1, 'tables');
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
        $this->assertEquals(auth()->id(), $order->user_id);
    }

    public function test_customer_order_is_not_attributed_to_an_arbitrary_staff_member(): void
    {
        User::factory()->create(['restaurant_id' => null]);

        $this->postJson('/api/v1/customer/table/01/order', [
            'items' => [['product_id' => $this->product->id, 'quantity' => 1]],
        ])->assertCreated();

        $order = Order::where('table_id', $this->table->id)->firstOrFail();
        $this->assertNull($order->user_id);
        $this->assertEquals($this->restaurant->id, $order->restaurant_id);
    }

    public function test_pos_close_records_service_fee_shown_to_the_cashier(): void
    {
        $this->postJson('/api/v1/pos/tables/01/items', [
            'product_id' => $this->product->id,
            'quantity' => 1,
        ])->assertOk();

        $this->postJson('/api/v1/pos/tables/01/close', [
            'payment_method' => 'cash',
            'include_service' => true,
        ])->assertOk();

        $this->assertDatabaseHas('payments', ['method' => 'cash', 'amount' => 40.59]);
    }

    public function test_closing_a_table_without_consumption_does_not_record_a_payment(): void
    {
        $this->postJson('/api/v1/pos/tables/01/open')->assertOk();

        $this->postJson('/api/v1/pos/tables/01/close', ['payment_method' => 'cash'])->assertOk();

        $this->assertDatabaseCount('payments', 0);
        $this->assertEquals('free', $this->table->fresh()->status);
        $this->assertDatabaseHas('orders', ['table_id' => $this->table->id, 'status' => 'canceled']);
    }

    public function test_failed_closing_rolls_back_payment_and_keeps_table_open(): void
    {
        $this->postJson('/api/v1/pos/tables/01/items', [
            'product_id' => $this->product->id, 'quantity' => 1,
        ])->assertOk();

        $eventName = 'eloquent.updating: '.Order::class;
        Event::listen($eventName, function (Order $order): void {
            if ($order->status === 'delivered') {
                throw new \RuntimeException('Falha ao fechar o pedido.');
            }
        });

        try {
            $this->postJson('/api/v1/pos/tables/01/close', ['payment_method' => 'cash'])
                ->assertStatus(500);
        } finally {
            Event::forget($eventName);
        }

        $this->assertDatabaseCount('payments', 0);
        $this->assertEquals('occupied', $this->table->fresh()->status);
        $this->assertDatabaseHas('orders', ['table_id' => $this->table->id, 'status' => 'pending']);
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

    public function test_pos_cannot_mark_a_card_payment_as_paid_without_stripe(): void
    {
        $this->postJson('/api/v1/pos/tables/01/open')->assertOk();

        $this->postJson('/api/v1/pos/tables/01/close', [
            'payment_method' => 'credit_card',
        ])->assertUnprocessable()->assertJsonValidationErrors('payment_method');

        $this->assertDatabaseMissing('payments', ['method' => 'credit_card']);
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

    public function test_pos_cannot_rename_table_to_a_number_already_in_use(): void
    {
        RestaurantTable::create([
            'restaurant_id' => $this->restaurant->id,
            'number' => 'Mesa 2',
            'capacity' => 4,
            'status' => 'free',
        ]);

        $this->putJson('/api/v1/pos/tables/2', ['number' => '1'])
            ->assertStatus(422)
            ->assertJsonPath('message', "Já existe uma mesa cadastrada com a numeração 'Mesa 1'.");

        $this->assertDatabaseHas('restaurant_tables', ['restaurant_id' => $this->restaurant->id, 'number' => 'Mesa 2']);
    }

    public function test_pos_can_keep_the_same_number_when_updating_a_table(): void
    {
        $this->putJson('/api/v1/pos/tables/1', ['number' => '1', 'capacity' => 6])
            ->assertOk()
            ->assertJsonPath('table.capacity', 6);
    }

    public function test_absurd_item_quantities_are_rejected_with_validation_errors(): void
    {
        $this->postJson('/api/v1/pos/tables/01/items', [
            'product_id' => $this->product->id,
            'quantity' => 100000000,
        ])->assertStatus(422)->assertJsonValidationErrors('quantity');

        $this->postJson('/api/v1/customer/table/01/order', [
            'items' => [['product_id' => $this->product->id, 'quantity' => 100000000]],
        ])->assertStatus(422)->assertJsonValidationErrors('items.0.quantity');

        $this->assertDatabaseCount('order_items', 0);
    }

    public function test_customer_and_pos_orders_are_blocked_when_ingredient_stock_is_insufficient(): void
    {
        $bun = Ingredient::create([
            'restaurant_id' => $this->restaurant->id,
            'name' => 'Pão Brioche',
            'stock_qty' => 1,
            'unit' => 'unidade',
            'min_stock_alert' => 0,
        ]);
        $this->product->ingredients()->attach($bun->id, ['qty_used' => 1]);

        $this->postJson('/api/v1/customer/table/01/order', [
            'items' => [['product_id' => $this->product->id, 'quantity' => 2]],
        ])->assertStatus(422)
            ->assertJsonPath('message', "Estoque insuficiente do insumo 'Pão Brioche'. Necessário: 2unidade, disponível: 1unidade.");

        $this->postJson('/api/v1/pos/tables/01/items', [
            'product_id' => $this->product->id,
            'quantity' => 2,
        ])->assertStatus(422);

        $this->assertDatabaseCount('order_items', 0);
    }

    public function test_kitchen_starting_an_order_deducts_recipe_stock_exactly_once(): void
    {
        $bun = Ingredient::create([
            'restaurant_id' => $this->restaurant->id,
            'name' => 'Pão Brioche',
            'stock_qty' => 10,
            'unit' => 'unidade',
            'min_stock_alert' => 0,
        ]);
        $this->product->ingredients()->attach($bun->id, ['qty_used' => 1]);

        $this->postJson('/api/v1/customer/table/01/order', [
            'items' => [['product_id' => $this->product->id, 'quantity' => 2]],
        ])->assertCreated();
        $order = Order::firstOrFail();

        $this->assertEquals(10, (float) $bun->fresh()->stock_qty);

        $this->patchJson("/api/v1/kds/orders/{$order->id}/status", ['status' => 'preparing'])->assertOk();
        $this->assertEquals(8, (float) $bun->fresh()->stock_qty);

        $this->patchJson("/api/v1/kds/orders/{$order->id}/status", ['status' => 'ready'])->assertOk();
        $this->assertEquals(8, (float) $bun->fresh()->stock_qty);

        // Item novo devolve o pedido para a fila: só ele deve ser baixado no próximo preparo
        $this->postJson('/api/v1/customer/table/01/order', [
            'items' => [['product_id' => $this->product->id, 'quantity' => 1]],
        ])->assertCreated();
        $this->assertEquals('pending', $order->fresh()->status);

        $this->patchJson("/api/v1/kds/orders/{$order->id}/status", ['status' => 'preparing'])->assertOk();
        $this->assertEquals(7, (float) $bun->fresh()->stock_qty);
    }
}
