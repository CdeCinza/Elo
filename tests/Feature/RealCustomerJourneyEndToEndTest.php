<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Restaurant;
use App\Models\RestaurantTable;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RealCustomerJourneyEndToEndTest extends TestCase
{
    use RefreshDatabase;

    private User $superAdmin;

    private Role $superAdminRole;

    private Role $ownerRole;

    private Role $waiterRole;

    private Role $chefRole;

    private Role $cashierRole;

    protected function setUp(): void
    {
        parent::setUp();

        $this->superAdminRole = Role::create(['name' => 'super_admin', 'label' => 'Super Admin']);
        $this->ownerRole = Role::create(['name' => 'owner', 'label' => 'Proprietário']);
        $this->waiterRole = Role::create(['name' => 'waiter', 'label' => 'Garçom']);
        $this->chefRole = Role::create(['name' => 'chef', 'label' => 'Cozinheiro']);
        $this->cashierRole = Role::create(['name' => 'cashier', 'label' => 'Caixa']);

        $this->superAdmin = User::factory()->create([
            'role_id' => $this->superAdminRole->id,
            'restaurant_id' => null,
            'email' => 'superadmin@elo.com',
            'name' => 'Super Administrador Elo',
        ]);
    }

    /**
     * CENÁRIO 1: O Ciclo de Vida Dourado Completo
     * 1. SuperAdmin cria o Restaurante e o Dono
     * 2. Dono loga e cadastra categorias, produtos e mesas
     * 3. Dispositivo tablet é configurado para a Mesa 01
     * 4. Cliente senta, faz check-in, chama garçom
     * 5. Garçom atende e limpa o chamado no caixa
     * 6. Cliente pede no tablet com observações
     * 7. Cozinha recebe no KDS, prepara e avança status
     * 8. Cliente pede mais itens na mesma comanda
     * 9. Cliente pede a conta pelo tablet
     * 10. Caixa fecha a mesa com pagamento (cartão) e libera a mesa
     */
    public function test_full_golden_flow_from_superadmin_to_owner_to_customer_and_payment(): void
    {
        // ---------------------------------------------------------------------
        // ETAPA 1: SuperAdmin cria o novo Restaurante & Dono
        // ---------------------------------------------------------------------
        $restaurantPayload = [
            'name' => 'Cantina Bella Italia',
            'slug' => 'cantina-bella-italia',
            'document' => '12.345.678/0001-90',
            'phone' => '(11) 98888-7777',
            'address' => 'Rua das Oliveiras, 100 - Jardins, SP',
            'initial_tables' => 6,
            'owner_name' => 'Enzo Ferrari',
            'owner_email' => 'enzo@bellaitalia.com',
            'owner_password' => 'bella2026',
        ];

        $resCreate = $this->actingAs($this->superAdmin, 'sanctum')
            ->postJson('/api/v1/superadmin/restaurants', $restaurantPayload);

        $resCreate->assertCreated()
            ->assertJsonPath('restaurant.name', 'Cantina Bella Italia')
            ->assertJsonPath('restaurant.slug', 'cantina-bella-italia');

        $restaurant = Restaurant::where('slug', 'cantina-bella-italia')->first();
        $this->assertNotNull($restaurant);
        $this->assertEquals(6, $restaurant->tables()->count());

        $owner = User::where('email', 'enzo@bellaitalia.com')->first();
        $this->assertNotNull($owner);
        $this->assertEquals($restaurant->id, $owner->restaurant_id);

        // ---------------------------------------------------------------------
        // ETAPA 2: Dono realiza Login e configura o Cardápio
        // ---------------------------------------------------------------------
        $loginRes = $this->postJson('/api/v1/auth/login', [
            'email' => 'enzo@bellaitalia.com',
            'password' => 'bella2026',
        ]);

        $loginRes->assertOk()
            ->assertJsonStructure(['access_token', 'user' => ['id', 'name', 'email', 'role']]);

        $token = $loginRes->json('access_token');
        $authHeader = ['Authorization' => "Bearer {$token}", 'X-Restaurant-Id' => (string) $restaurant->id];

        // Dono cria Categorias
        $catPratosRes = $this->withHeaders($authHeader)->postJson('/api/v1/categories', [
            'name' => 'Pratos Principais',
            'description' => 'Massas e risotos autorais',
        ]);
        $catPratosRes->assertCreated();
        $catPratosId = $catPratosRes->json('category.id');

        $catBebidasRes = $this->withHeaders($authHeader)->postJson('/api/v1/categories', [
            'name' => 'Bebidas & Vinhos',
            'description' => 'Vinhos italianos e sodas',
        ]);
        $catBebidasRes->assertCreated();
        $catBebidasId = $catBebidasRes->json('category.id');

        $catSobremesasRes = $this->withHeaders($authHeader)->postJson('/api/v1/categories', [
            'name' => 'Sobremesas',
            'description' => 'Dolci italiani feitos na casa',
        ]);
        $catSobremesasRes->assertCreated();
        $catSobremesasId = $catSobremesasRes->json('category.id');

        // Dono cria Produtos
        $fettuccineRes = $this->withHeaders($authHeader)->postJson('/api/v1/products', [
            'category_id' => $catPratosId,
            'name' => 'Fettuccine Alfredo Trufado',
            'description' => 'Massa fresca, manteiga da serra, queijo grana padano e azeite trufado',
            'price' => 58.00,
            'available' => true,
        ]);
        $fettuccineRes->assertCreated();
        $fettuccineId = $fettuccineRes->json('product.id');

        $vinhoRes = $this->withHeaders($authHeader)->postJson('/api/v1/products', [
            'category_id' => $catBebidasId,
            'name' => 'Taça Vinho Chianti Clássico',
            'description' => 'Tinto toscano encorpado safra 2021',
            'price' => 32.00,
            'available' => true,
        ]);
        $vinhoRes->assertCreated();
        $vinhoId = $vinhoRes->json('product.id');

        $tiramisuRes = $this->withHeaders($authHeader)->postJson('/api/v1/products', [
            'category_id' => $catSobremesasId,
            'name' => 'Tiramisù Tradizionale',
            'description' => 'Biscoito savoiardi embebido em café espresso e creme mascarpone',
            'price' => 24.00,
            'available' => true,
        ]);
        $tiramisuRes->assertCreated();
        $tiramisuId = $tiramisuRes->json('product.id');

        // ---------------------------------------------------------------------
        // ETAPA 3 & 4: Cliente chega na Mesa 01 e faz Check-in
        // ---------------------------------------------------------------------
        $headersClient = ['X-Restaurant-Id' => (string) $restaurant->id];

        // Verifica estado inicial da mesa (livre)
        $tableInfo = $this->withHeaders($headersClient)->getJson('/api/v1/customer/table/01');
        $tableInfo->assertOk()
            ->assertJsonPath('table.status', 'free');

        // Check-in do cliente na mesa
        $checkinRes = $this->withHeaders($headersClient)->postJson('/api/v1/customer/table/01/check-in');
        $checkinRes->assertOk()
            ->assertJsonPath('table.status', 'occupied')
            ->assertJsonPath('table.number', '01');

        // ---------------------------------------------------------------------
        // ETAPA 5: Cliente chama o garçom
        // ---------------------------------------------------------------------
        $callWaiterRes = $this->withHeaders($headersClient)->postJson('/api/v1/customer/table/01/call-waiter');
        $callWaiterRes->assertOk()
            ->assertJsonPath('table.waiter_called', true);

        // Caixa/Garçom visualiza o chamado no POS
        $posTablesRes = $this->withHeaders($headersClient)->getJson('/api/v1/pos/tables');
        $posTablesRes->assertOk();
        $mesa01Pos = collect($posTablesRes->json('tables'))->firstWhere('number', '01');
        $this->assertNotNull($mesa01Pos);
        $this->assertTrue($mesa01Pos['waiter_called']);

        // Garçom atende a mesa e limpa o chamado via POS
        $clearWaiterRes = $this->withHeaders($headersClient)->postJson('/api/v1/pos/tables/01/clear-waiter');
        $clearWaiterRes->assertOk();

        // ---------------------------------------------------------------------
        // ETAPA 6: Cliente faz o 1º Pedido no Tablet (Fettuccine + Vinho)
        // ---------------------------------------------------------------------
        $orderPayload1 = [
            'items' => [
                [
                    'product_id' => $fettuccineId,
                    'quantity' => 1,
                    'notes' => 'Sem pimenta preta e queijo extra ralado',
                ],
                [
                    'product_id' => $vinhoId,
                    'quantity' => 1,
                    'notes' => 'Servir taça bem fresca',
                ],
            ],
        ];

        $placeOrderRes1 = $this->withHeaders($headersClient)
            ->postJson('/api/v1/customer/table/01/order', $orderPayload1);

        $placeOrderRes1->assertCreated()
            ->assertJsonPath('order.status', 'pending');

        $this->assertEquals(90.00, (float) $placeOrderRes1->json('order.total'));

        $orderId = $placeOrderRes1->json('order.id');

        // ---------------------------------------------------------------------
        // ETAPA 7: Cozinha (KDS) recebe em tempo real e avança o status
        // ---------------------------------------------------------------------
        $kdsRes1 = $this->withHeaders($headersClient)->getJson('/api/v1/kds/orders');
        $kdsRes1->assertOk()
            ->assertJsonPath('orders.0.id', $orderId)
            ->assertJsonPath('orders.0.tableNumber', '01')
            ->assertJsonPath('orders.0.status', 'pending');

        $this->assertCount(2, $kdsRes1->json('orders.0.items'));

        // Cozinha avança para 'preparing'
        $advRes1 = $this->withHeaders($headersClient)->patchJson("/api/v1/kds/orders/{$orderId}/status", [
            'status' => 'preparing',
        ]);
        $advRes1->assertOk()
            ->assertJsonPath('order.status', 'preparing');

        // Cozinha conclui o prato: avança para 'ready' (bancada de expedição)
        $advRes2 = $this->withHeaders($headersClient)->patchJson("/api/v1/kds/orders/{$orderId}/status", [
            'status' => 'ready',
        ]);
        $advRes2->assertOk()
            ->assertJsonPath('order.status', 'ready');

        // ---------------------------------------------------------------------
        // ETAPA 8: Cliente faz um 2º Pedido Adicional (Sobremesa Tiramisù)
        // ---------------------------------------------------------------------
        $orderPayload2 = [
            'items' => [
                [
                    'product_id' => $tiramisuId,
                    'quantity' => 1,
                    'notes' => 'Com calda de café extra',
                ],
            ],
        ];

        $placeOrderRes2 = $this->withHeaders($headersClient)
            ->postJson('/api/v1/customer/table/01/order', $orderPayload2);

        $placeOrderRes2->assertCreated();

        // Verifica que a comanda acumulou os itens (90 + 24 = 114.00)
        $orderFresh = Order::find($orderId);
        $this->assertEquals(114.00, (float) $orderFresh->total);
        $this->assertEquals(3, $orderFresh->items()->count());

        // ---------------------------------------------------------------------
        // ETAPA 9: Cliente solicita a conta pelo tablet
        // ---------------------------------------------------------------------
        $reqBillRes = $this->withHeaders($headersClient)->postJson('/api/v1/customer/table/01/request-bill');
        $reqBillRes->assertOk()
            ->assertJsonPath('table.status', 'bill_requested');

        // O caixa visualiza a mesa com status 'bill_requested'
        $posTablesBill = $this->withHeaders($headersClient)->getJson('/api/v1/pos/tables');
        $posMesa01Bill = collect($posTablesBill->json('tables'))->firstWhere('number', '01');
        $this->assertEquals('bill_requested', $posMesa01Bill['status']);
        $this->assertEquals(114.00, (float) $posMesa01Bill['total']);

        // ---------------------------------------------------------------------
        // ETAPA 10: Caixa fecha a comanda com Pagamento (Cartão) e libera mesa
        // ---------------------------------------------------------------------
        $closeTableRes = $this->withHeaders($headersClient)->postJson('/api/v1/pos/tables/01/close', [
            'payment_method' => 'credit_card',
        ]);

        $closeTableRes->assertOk()
            ->assertJsonPath('table.status', 'free');

        // Verifica consistência no banco de dados
        $tableDb = RestaurantTable::where('restaurant_id', $restaurant->id)
            ->where('number', 'like', '%1%')
            ->first();
        $this->assertEquals('free', $tableDb->status);

        $paymentDb = Payment::where('order_id', $orderId)->first();
        $this->assertNotNull($paymentDb);
        $this->assertEquals('credit_card', $paymentDb->method);
        $this->assertEquals('paid', $paymentDb->status);
        $this->assertEquals(114.00, (float) $paymentDb->amount);

        // O pedido finalizou com status 'delivered'
        $this->assertEquals('delivered', $orderFresh->fresh()->status);
    }

    /**
     * CENÁRIO 2: Concorrência de Múltiplas Mesas (02, 03, 04) & Fila FIFO da Cozinha
     * - Garante que mesas diferentes que pedem em momentos diferentes aparecem
     *   ordenadas estritamente por horário de chegada no KDS.
     * - Garante que uma mesa pode fechar antes de outra sem interferir nas demais.
     */
    public function test_concurrent_tables_and_fifo_order_queue_in_kitchen(): void
    {
        $restaurant = Restaurant::create([
            'name' => 'Trattoria del Sole',
            'slug' => 'trattoria-del-sole',
            'status' => 'active',
        ]);

        $category = Category::create([
            'restaurant_id' => $restaurant->id,
            'name' => 'Massas',
        ]);

        $pasta = Product::create([
            'restaurant_id' => $restaurant->id,
            'category_id' => $category->id,
            'name' => 'Gnocchi ao Pesto',
            'price' => 45.00,
            'available' => true,
        ]);

        $headers = ['X-Restaurant-Id' => (string) $restaurant->id];

        // 3 mesas diferentes
        $table2 = RestaurantTable::create(['restaurant_id' => $restaurant->id, 'number' => 'Mesa 02', 'capacity' => 2, 'status' => 'free']);
        $table3 = RestaurantTable::create(['restaurant_id' => $restaurant->id, 'number' => 'Mesa 03', 'capacity' => 4, 'status' => 'free']);
        $table4 = RestaurantTable::create(['restaurant_id' => $restaurant->id, 'number' => 'Mesa 04', 'capacity' => 6, 'status' => 'free']);

        // Mesa 02 pede primeiro (T0)
        $this->withHeaders($headers)->postJson('/api/v1/customer/table/02/check-in');
        $resOrder2 = $this->withHeaders($headers)->postJson('/api/v1/customer/table/02/order', [
            'items' => [['product_id' => $pasta->id, 'quantity' => 1, 'notes' => 'Mesa 2 - Gnocchi']],
        ]);
        $order2Id = $resOrder2->json('order.id');

        // Simula pequena passagem de tempo para Mesa 03 (T+1)
        sleep(1);
        $this->withHeaders($headers)->postJson('/api/v1/customer/table/03/check-in');
        $resOrder3 = $this->withHeaders($headers)->postJson('/api/v1/customer/table/03/order', [
            'items' => [['product_id' => $pasta->id, 'quantity' => 2, 'notes' => 'Mesa 3 - 2x Gnocchi']],
        ]);
        $order3Id = $resOrder3->json('order.id');

        // Simula passagem de tempo para Mesa 04 (T+2)
        sleep(1);
        $this->withHeaders($headers)->postJson('/api/v1/customer/table/04/check-in');
        $resOrder4 = $this->withHeaders($headers)->postJson('/api/v1/customer/table/04/order', [
            'items' => [['product_id' => $pasta->id, 'quantity' => 3, 'notes' => 'Mesa 4 - 3x Gnocchi']],
        ]);
        $order4Id = $resOrder4->json('order.id');

        // 1. Validação de Fila FIFO no KDS: Mesa 02 primeiro, Mesa 03 segundo, Mesa 04 terceiro
        $kdsRes = $this->withHeaders($headers)->getJson('/api/v1/kds/orders');
        $kdsRes->assertOk();
        $ordersList = $kdsRes->json('orders');

        $this->assertCount(3, $ordersList);
        $this->assertEquals('02', $ordersList[0]['tableNumber']);
        $this->assertEquals($order2Id, $ordersList[0]['id']);

        $this->assertEquals('03', $ordersList[1]['tableNumber']);
        $this->assertEquals($order3Id, $ordersList[1]['id']);

        $this->assertEquals('04', $ordersList[2]['tableNumber']);
        $this->assertEquals($order4Id, $ordersList[2]['id']);

        // 2. Mesa 03 pede a conta e fecha ANTES da Mesa 02
        $this->withHeaders($headers)->postJson('/api/v1/pos/tables/03/close', ['payment_method' => 'pix']);

        // Valida que Mesa 03 ficou livre
        $this->assertEquals('free', $table3->fresh()->status);

        // Valida que Mesa 02 e Mesa 04 continuam perfeitamente intactas e ocupadas
        $this->assertEquals('occupied', $table2->fresh()->status);
        $this->assertEquals('occupied', $table4->fresh()->status);

        // KDS agora só tem 2 pedidos ativos (Mesa 02 e Mesa 04)
        $kdsResAfter = $this->withHeaders($headers)->getJson('/api/v1/kds/orders');
        $ordersAfter = $kdsResAfter->json('orders');
        $this->assertCount(2, $ordersAfter);
        $this->assertEquals('02', $ordersAfter[0]['tableNumber']);
        $this->assertEquals('04', $ordersAfter[1]['tableNumber']);
    }

    /**
     * CENÁRIO 3: Validações, Exceções e Resiliência
     * - Produto indisponível não pode ser pedido (retorna 422 claro)
     * - Quantidade inválida é barrada (422)
     * - Mesa ocupada não pode ser excluída pelo POS (422)
     * - Mesa livre pode ser excluída (200)
     * - Reset emergencial de mesa cancela pedido e libera mesa (200)
     */
    public function test_exception_flows_and_business_rules_validation(): void
    {
        $restaurant = Restaurant::create([
            'name' => 'Bistrô Seguranca',
            'slug' => 'bistro-seguranca',
            'status' => 'active',
        ]);

        $category = Category::create(['restaurant_id' => $restaurant->id, 'name' => 'Especiais']);

        $availableProduct = Product::create([
            'restaurant_id' => $restaurant->id,
            'category_id' => $category->id,
            'name' => 'Risoto de Funghi',
            'price' => 50.00,
            'available' => true,
        ]);

        $soldOutProduct = Product::create([
            'restaurant_id' => $restaurant->id,
            'category_id' => $category->id,
            'name' => 'Lagosta Gratinada',
            'price' => 120.00,
            'available' => false, // ESGOTADO
        ]);

        $headers = ['X-Restaurant-Id' => (string) $restaurant->id];

        // 1. Tentar pedir produto esgotado
        $soldOutRes = $this->withHeaders($headers)->postJson('/api/v1/customer/table/01/order', [
            'items' => [['product_id' => $soldOutProduct->id, 'quantity' => 1]],
        ]);

        $soldOutRes->assertStatus(422)
            ->assertJsonPath('message', "O produto 'Lagosta Gratinada' não está disponível.");

        // 2. Tentar pedir com quantidade zero
        $invalidQtyRes = $this->withHeaders($headers)->postJson('/api/v1/customer/table/01/order', [
            'items' => [['product_id' => $availableProduct->id, 'quantity' => 0]],
        ]);
        $invalidQtyRes->assertStatus(422);

        // 3. Tentar pedir com array de itens vazio
        $emptyItemsRes = $this->withHeaders($headers)->postJson('/api/v1/customer/table/01/order', [
            'items' => [],
        ]);
        $emptyItemsRes->assertStatus(422);

        // 4. Cria pedido válido na Mesa 05
        $table5 = RestaurantTable::create([
            'restaurant_id' => $restaurant->id,
            'number' => 'Mesa 05',
            'capacity' => 4,
            'status' => 'occupied',
        ]);

        $this->withHeaders($headers)->postJson('/api/v1/customer/table/05/order', [
            'items' => [['product_id' => $availableProduct->id, 'quantity' => 1]],
        ]);

        // Tentar excluir mesa ocupada pelo POS
        $deleteOccupiedRes = $this->withHeaders($headers)->deleteJson('/api/v1/pos/tables/05');
        $deleteOccupiedRes->assertStatus(422)
            ->assertJsonPath('message', 'Não é possível excluir uma mesa em atendimento ou com conta em aberto.');

        // 5. Excluir mesa livre funciona perfeitamente
        $table6 = RestaurantTable::create([
            'restaurant_id' => $restaurant->id,
            'number' => 'Mesa 06',
            'capacity' => 2,
            'status' => 'free',
        ]);

        $deleteFreeRes = $this->withHeaders($headers)->deleteJson('/api/v1/pos/tables/06');
        $deleteFreeRes->assertOk();
        $this->assertDatabaseMissing('restaurant_tables', ['id' => $table6->id]);

        // 6. Reset emergencial de mesa pelo operador
        $resetRes = $this->withHeaders($headers)->postJson('/api/v1/pos/tables/05/reset');
        $resetRes->assertOk();
        $this->assertEquals('free', $table5->fresh()->status);
    }

    /**
     * CENÁRIO 4: Isolamento Multi-Tenancy (Segurança entre Lojas Diferentes)
     * - Restaurante A e Restaurante B possuem a "Mesa 01".
     * - O pedido da Mesa 01 do Restaurante A não vaza nem aparece no KDS ou POS do Restaurante B.
     */
    public function test_multi_tenancy_data_isolation_between_different_restaurants(): void
    {
        // Restaurante A
        $restA = Restaurant::create(['name' => 'Pizzaria Da Vinci', 'slug' => 'pizzaria-da-vinci', 'status' => 'active']);
        $catA = Category::create(['restaurant_id' => $restA->id, 'name' => 'Pizzas']);
        $pizza = Product::create(['restaurant_id' => $restA->id, 'category_id' => $catA->id, 'name' => 'Pizza Margherita', 'price' => 60.00, 'available' => true]);
        $tableA = RestaurantTable::create(['restaurant_id' => $restA->id, 'number' => 'Mesa 01', 'capacity' => 4, 'status' => 'free']);

        // Restaurante B
        $restB = Restaurant::create(['name' => 'Burger Republic', 'slug' => 'burger-republic', 'status' => 'active']);
        $catB = Category::create(['restaurant_id' => $restB->id, 'name' => 'Hambúrgueres']);
        $burger = Product::create(['restaurant_id' => $restB->id, 'category_id' => $catB->id, 'name' => 'Monster Burger', 'price' => 40.00, 'available' => true]);
        $tableB = RestaurantTable::create(['restaurant_id' => $restB->id, 'number' => 'Mesa 01', 'capacity' => 4, 'status' => 'free']);

        $headerA = ['X-Restaurant-Id' => (string) $restA->id];
        $headerB = ['X-Restaurant-Id' => (string) $restB->id];

        // Mesa 01 do Restaurante A pede Pizza
        $this->withHeaders($headerA)->postJson('/api/v1/customer/table/01/order', [
            'items' => [['product_id' => $pizza->id, 'quantity' => 1]],
        ]);

        // Mesa 01 do Restaurante B pede Burger
        $this->withHeaders($headerB)->postJson('/api/v1/customer/table/01/order', [
            'items' => [['product_id' => $burger->id, 'quantity' => 1]],
        ]);

        // 1. POS do Restaurante A só enxerga a Pizza (total R$ 60,00)
        $posResA = $this->withHeaders($headerA)->getJson('/api/v1/pos/tables');
        $mesaA = collect($posResA->json('tables'))->firstWhere('number', '01');
        $this->assertEquals(60.00, (float) $mesaA['total']);
        $this->assertEquals('Pizza Margherita', $mesaA['items'][0]['name']);

        // 2. POS do Restaurante B só enxerga o Burger (total R$ 40,00)
        $posResB = $this->withHeaders($headerB)->getJson('/api/v1/pos/tables');
        $mesaB = collect($posResB->json('tables'))->firstWhere('number', '01');
        $this->assertEquals(40.00, (float) $mesaB['total']);
        $this->assertEquals('Monster Burger', $mesaB['items'][0]['name']);

        // 3. KDS do Restaurante A só tem 1 pedido (Pizza Margherita)
        $kdsResA = $this->withHeaders($headerA)->getJson('/api/v1/kds/orders');
        $this->assertCount(1, $kdsResA->json('orders'));
        $this->assertEquals('Pizza Margherita', $kdsResA->json('orders.0.items.0.name'));

        // 4. KDS do Restaurante B só tem 1 pedido (Monster Burger)
        $kdsResB = $this->withHeaders($headerB)->getJson('/api/v1/kds/orders');
        $this->assertCount(1, $kdsResB->json('orders'));
        $this->assertEquals('Monster Burger', $kdsResB->json('orders.0.items.0.name'));
    }
}
