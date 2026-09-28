<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Restaurant;
use App\Models\RestaurantTable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class StripePaymentTest extends TestCase
{
    use RefreshDatabase;

    private Restaurant $restaurant;

    private RestaurantTable $table;

    private Product $product;

    private Order $order;

    protected function setUp(): void
    {
        parent::setUp();

        $this->restaurant = Restaurant::create([
            'name' => 'Restaurante Stripe Teste',
            'slug' => 'restaurante-stripe-teste',
            'status' => 'active',
        ]);

        $this->table = RestaurantTable::create([
            'restaurant_id' => $this->restaurant->id,
            'number' => '01',
            'capacity' => 4,
            'status' => 'occupied',
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
            'price' => 50.00,
            'available' => true,
        ]);

        $this->order = Order::create([
            'restaurant_id' => $this->restaurant->id,
            'table_id' => $this->table->id,
            'status' => 'pending',
            'subtotal' => 100.00,
            'total' => 100.00,
        ]);

        OrderItem::create([
            'order_id' => $this->order->id,
            'product_id' => $this->product->id,
            'quantity' => 2,
            'unit_price' => 50.00,
            'subtotal' => 100.00,
            'status' => 'pending',
        ]);

        Config::set('services.stripe.secret', 'sk_test_fake_secret_key');
        Config::set('services.stripe.webhook_secret', 'whsec_test_secret');
    }

    public function test_create_intent_requires_table_number_or_order_id(): void
    {
        $response = $this->postJson('/api/v1/payments/stripe/create-intent', []);

        $response->assertStatus(422);
    }

    public function test_creates_payment_intent_calculates_server_amount_without_service(): void
    {
        Http::fake([
            'https://api.stripe.com/v1/payment_intents' => Http::response([
                'id' => 'pi_test_123',
                'client_secret' => 'pi_test_123_secret_abc',
                'amount' => 10000,
                'currency' => 'brl',
            ], 200),
        ]);

        $response = $this->postJson('/api/v1/payments/stripe/create-intent', [
            'table_number' => '01',
            'include_service' => false,
        ]);

        $response->assertOk()
            ->assertJsonPath('client_secret', 'pi_test_123_secret_abc')
            ->assertJsonPath('payment_intent_id', 'pi_test_123')
            ->assertJsonPath('currency', 'BRL');
        $this->assertEquals(100.00, (float) $response->json('amount'));

        Http::assertSent(function ($request) {
            return $request->url() === 'https://api.stripe.com/v1/payment_intents' &&
                   $request['amount'] == 10000;
        });
    }

    public function test_create_intent_by_table_number_only_charges_the_requesting_restaurant(): void
    {
        $otherRestaurant = Restaurant::create([
            'name' => 'Outro Restaurante',
            'slug' => 'outro-restaurante',
            'status' => 'active',
        ]);
        $otherTable = RestaurantTable::create([
            'restaurant_id' => $otherRestaurant->id,
            'number' => 'Mesa 1',
            'capacity' => 4,
            'status' => 'occupied',
        ]);
        $otherOrder = Order::create([
            'restaurant_id' => $otherRestaurant->id,
            'table_id' => $otherTable->id,
            'status' => 'pending',
            'subtotal' => 30.00,
            'total' => 30.00,
        ]);
        OrderItem::create([
            'order_id' => $otherOrder->id,
            'product_id' => $this->product->id,
            'quantity' => 1,
            'unit_price' => 30.00,
            'subtotal' => 30.00,
        ]);

        Http::fake([
            'https://api.stripe.com/v1/payment_intents' => Http::response([
                'id' => 'pi_test_other_restaurant',
                'client_secret' => 'pi_test_other_restaurant_secret',
            ], 200),
        ]);

        $this->postJson('/api/v1/payments/stripe/create-intent', ['table_number' => '01'], [
            'X-Restaurant-Id' => (string) $otherRestaurant->id,
        ])->assertOk()
            ->assertJsonPath('order_id', $otherOrder->id);

        $this->postJson('/api/v1/payments/stripe/create-intent', ['order_id' => $this->order->id], [
            'X-Restaurant-Id' => (string) $otherRestaurant->id,
        ])->assertUnprocessable();
    }

    public function test_create_intent_rejects_canceled_orders(): void
    {
        $this->order->update(['status' => 'canceled']);

        $this->postJson('/api/v1/payments/stripe/create-intent', ['order_id' => $this->order->id])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Este pedido foi cancelado e não pode ser cobrado.');
    }

    public function test_create_intent_does_not_leak_internal_errors(): void
    {
        Config::set('services.stripe.secret', '');

        $this->postJson('/api/v1/payments/stripe/create-intent', ['table_number' => '01'])
            ->assertStatus(500)
            ->assertJsonPath('message', 'Não foi possível inicializar o pagamento no Stripe. Tente novamente em instantes.');
    }

    public function test_creates_payment_intent_calculates_server_amount_with_service_fee(): void
    {
        Http::fake([
            'https://api.stripe.com/v1/payment_intents' => Http::response([
                'id' => 'pi_test_456',
                'client_secret' => 'pi_test_456_secret_def',
                'amount' => 11000,
                'currency' => 'brl',
            ], 200),
        ]);

        $response = $this->postJson('/api/v1/payments/stripe/create-intent', [
            'table_number' => '01',
            'include_service' => true,
        ]);

        $response->assertOk()
            ->assertJsonPath('client_secret', 'pi_test_456_secret_def')
            ->assertJsonPath('payment_intent_id', 'pi_test_456');
        $this->assertEquals(110.00, (float) $response->json('amount'));

        Http::assertSent(function ($request) {
            return $request->url() === 'https://api.stripe.com/v1/payment_intents' &&
                   $request['amount'] == 11000;
        });
    }

    public function test_confirms_payment_and_frees_table_when_intent_succeeded(): void
    {
        Http::fake([
            'https://api.stripe.com/v1/payment_intents/pi_test_789' => Http::response([
                'id' => 'pi_test_789',
                'status' => 'succeeded',
                'amount' => 11000,
                'amount_received' => 11000,
                'metadata' => [
                    'order_id' => (string) $this->order->id,
                ],
            ], 200),
        ]);

        $response = $this->postJson('/api/v1/payments/stripe/confirm', [
            'payment_intent_id' => 'pi_test_789',
            'order_id' => $this->order->id,
        ]);

        $response->assertOk()
            ->assertJsonPath('payment.transaction_id', 'pi_test_789')
            ->assertJsonPath('payment.status', 'paid');
        $this->assertEquals(110.00, (float) $response->json('payment.amount'));

        $this->assertDatabaseHas('payments', [
            'transaction_id' => 'pi_test_789',
            'order_id' => $this->order->id,
            'method' => 'credit_card',
            'status' => 'paid',
            'amount' => 110.00,
        ]);

        $this->assertEquals('free', $this->table->fresh()->status);
    }

    public function test_confirm_payment_is_idempotent(): void
    {
        Http::fake([
            'https://api.stripe.com/v1/payment_intents/pi_test_idempotent' => Http::response([
                'id' => 'pi_test_idempotent',
                'status' => 'succeeded',
                'amount' => 10000,
                'amount_received' => 10000,
                'metadata' => [
                    'order_id' => (string) $this->order->id,
                ],
            ], 200),
        ]);

        // Primeira confirmação
        $response1 = $this->postJson('/api/v1/payments/stripe/confirm', [
            'payment_intent_id' => 'pi_test_idempotent',
            'order_id' => $this->order->id,
        ]);
        $response1->assertOk();

        // Segunda chamada idêntica (retry / duplo clique)
        $response2 = $this->postJson('/api/v1/payments/stripe/confirm', [
            'payment_intent_id' => 'pi_test_idempotent',
            'order_id' => $this->order->id,
        ]);
        $response2->assertOk();

        // Garante que só existe 1 registro no banco de dados
        $this->assertEquals(1, Payment::where('transaction_id', 'pi_test_idempotent')->count());
    }

    public function test_confirm_payment_cannot_apply_an_intent_to_another_order(): void
    {
        $otherOrder = Order::create([
            'restaurant_id' => $this->restaurant->id,
            'table_id' => $this->table->id,
            'status' => 'pending',
            'subtotal' => 100.00,
            'total' => 100.00,
        ]);

        Http::fake([
            'https://api.stripe.com/v1/payment_intents/pi_test_other_order' => Http::response([
                'id' => 'pi_test_other_order',
                'status' => 'succeeded',
                'amount_received' => 10000,
                'metadata' => ['order_id' => (string) $this->order->id],
            ], 200),
        ]);

        $this->postJson('/api/v1/payments/stripe/confirm', [
            'payment_intent_id' => 'pi_test_other_order',
            'order_id' => $otherOrder->id,
        ])->assertUnprocessable();

        $this->assertDatabaseMissing('payments', ['transaction_id' => 'pi_test_other_order']);
        $this->assertSame('pending', $otherOrder->fresh()->status);
    }

    public function test_cannot_confirm_payment_if_intent_is_not_succeeded(): void
    {
        Http::fake([
            'https://api.stripe.com/v1/payment_intents/pi_test_incomplete' => Http::response([
                'id' => 'pi_test_incomplete',
                'status' => 'requires_payment_method',
            ], 200),
        ]);

        $response = $this->postJson('/api/v1/payments/stripe/confirm', [
            'payment_intent_id' => 'pi_test_incomplete',
            'order_id' => $this->order->id,
        ]);

        $response->assertStatus(400);

        $this->assertDatabaseMissing('payments', [
            'transaction_id' => 'pi_test_incomplete',
        ]);

        $this->assertEquals('occupied', $this->table->fresh()->status);
    }

    public function test_webhook_rejects_invalid_or_missing_signature(): void
    {
        $response = $this->postJson('/api/v1/payments/stripe/webhook', [
            'type' => 'payment_intent.succeeded',
        ], [
            'Stripe-Signature' => 'invalid_sig',
        ]);

        $response->assertStatus(400);
    }

    public function test_webhook_processes_valid_signature_and_fulfills_order(): void
    {
        $timestamp = time();
        $payload = json_encode([
            'type' => 'payment_intent.succeeded',
            'data' => [
                'object' => [
                    'id' => 'pi_test_webhook_valid',
                    'amount' => 10000,
                    'amount_received' => 10000,
                    'metadata' => [
                        'order_id' => (string) $this->order->id,
                    ],
                ],
            ],
        ]);

        $signature = hash_hmac('sha256', "{$timestamp}.{$payload}", 'whsec_test_secret');
        $header = "t={$timestamp},v1={$signature}";

        $response = $this->call(
            'POST',
            '/api/v1/payments/stripe/webhook',
            [],
            [],
            [],
            [
                'HTTP_STRIPE_SIGNATURE' => $header,
                'CONTENT_TYPE' => 'application/json',
            ],
            $payload
        );

        $response->assertOk()
            ->assertJson(['received' => true]);

        $this->assertDatabaseHas('payments', [
            'transaction_id' => 'pi_test_webhook_valid',
            'order_id' => $this->order->id,
            'method' => 'credit_card',
            'status' => 'paid',
            'amount' => 100.00,
        ]);

        $this->assertEquals('free', $this->table->fresh()->status);
    }
}
