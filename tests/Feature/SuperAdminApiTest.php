<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Restaurant;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SuperAdminApiTest extends TestCase
{
    use RefreshDatabase;

    private User $superAdmin;

    protected function setUp(): void
    {
        parent::setUp();

        $role = Role::create(['name' => 'super_admin', 'label' => 'Super Admin']);
        $this->superAdmin = User::factory()->create([
            'role_id' => $role->id,
            'restaurant_id' => null,
            'email' => 'admin@elo.com',
        ]);
    }

    public function test_super_admin_can_list_restaurants_and_metrics(): void
    {
        Restaurant::factory()->count(3)->create();

        $metricsResponse = $this->actingAs($this->superAdmin)->getJson('/api/v1/superadmin/metrics');
        $metricsResponse->assertOk()
            ->assertJsonStructure([
                'metrics' => [
                    'total_restaurants',
                    'active_restaurants',
                    'total_orders',
                    'total_revenue',
                    'total_users',
                ],
            ])
            ->assertJsonPath('metrics.total_restaurants', 3);

        $restaurantsResponse = $this->actingAs($this->superAdmin)->getJson('/api/v1/superadmin/restaurants');
        $restaurantsResponse->assertOk()
            ->assertJsonStructure(['restaurants'])
            ->assertJsonCount(3, 'restaurants');
    }

    public function test_super_admin_routes_reject_unauthenticated_and_regular_users(): void
    {
        $this->getJson('/api/v1/superadmin/restaurants')->assertUnauthorized();

        $restaurant = Restaurant::factory()->create();
        $managerRole = Role::create(['name' => 'manager', 'label' => 'Gerente']);
        $manager = User::factory()->create([
            'restaurant_id' => $restaurant->id,
            'role_id' => $managerRole->id,
        ]);

        $this->actingAs($manager, 'sanctum')
            ->getJson('/api/v1/superadmin/restaurants')
            ->assertForbidden();
    }

    public function test_revenue_counts_only_paid_amounts(): void
    {
        $restaurant = Restaurant::factory()->create();
        $order = Order::factory()->create([
            'restaurant_id' => $restaurant->id,
            'total' => 80.00,
            'status' => 'pending',
        ]);

        $this->actingAs($this->superAdmin, 'sanctum')
            ->getJson('/api/v1/superadmin/metrics')
            ->assertJsonPath('metrics.total_revenue', 0);

        Payment::create([
            'order_id' => $order->id,
            'transaction_id' => 'POS-REVENUE-TEST',
            'method' => 'cash',
            'status' => 'paid',
            'amount' => 80.00,
            'paid_at' => now(),
        ]);

        $this->getJson('/api/v1/superadmin/metrics')
            ->assertJsonPath('metrics.total_revenue', 80);
    }

    public function test_super_admin_can_create_restaurant_with_owner_and_initial_tables(): void
    {
        $payload = [
            'name' => 'Bistrô Paris 6',
            'slug' => 'bistro-paris-6',
            'document' => '99.888.777/0001-66',
            'phone' => '(11) 97777-6666',
            'address' => 'Rua Augusta, 500',
            'initial_tables' => 8,
            'owner_name' => 'Carlos Chef',
            'owner_email' => 'carlos@paris6.com',
            'owner_password' => 'secret123',
        ];

        $response = $this->actingAs($this->superAdmin)->postJson('/api/v1/superadmin/restaurants', $payload);

        $response->assertCreated()
            ->assertJsonPath('restaurant.name', 'Bistrô Paris 6')
            ->assertJsonPath('restaurant.slug', 'bistro-paris-6');

        $restaurant = Restaurant::where('slug', 'bistro-paris-6')->first();
        $this->assertNotNull($restaurant);

        // Verifica criação do Dono (Sub-Admin)
        $this->assertDatabaseHas('users', [
            'restaurant_id' => $restaurant->id,
            'email' => 'carlos@paris6.com',
            'name' => 'Carlos Chef',
        ]);

        // Verifica criação das 8 mesas do salão
        $this->assertEquals(8, $restaurant->tables()->count());
    }

    public function test_super_admin_can_update_status_and_delete_restaurant(): void
    {
        $restaurant = Restaurant::factory()->create(['status' => 'active']);

        // Suspender
        $updateResponse = $this->actingAs($this->superAdmin)->putJson("/api/v1/superadmin/restaurants/{$restaurant->id}", [
            'status' => 'suspended',
        ]);
        $updateResponse->assertOk()
            ->assertJsonPath('restaurant.status', 'suspended');

        $this->assertEquals('suspended', $restaurant->fresh()->status);

        // Excluir
        $deleteResponse = $this->actingAs($this->superAdmin)->deleteJson("/api/v1/superadmin/restaurants/{$restaurant->id}");
        $deleteResponse->assertOk();

        $this->assertDatabaseMissing('restaurants', ['id' => $restaurant->id]);
    }

    public function test_super_admin_can_delete_restaurant_with_order_history(): void
    {
        $restaurant = Restaurant::factory()->create();
        $product = Product::factory()->create(['restaurant_id' => $restaurant->id]);
        $order = Order::factory()->create(['restaurant_id' => $restaurant->id]);
        OrderItem::factory()->create(['order_id' => $order->id, 'product_id' => $product->id]);
        Payment::factory()->create(['order_id' => $order->id]);

        $this->actingAs($this->superAdmin)
            ->deleteJson("/api/v1/superadmin/restaurants/{$restaurant->id}")
            ->assertOk();

        $this->assertDatabaseMissing('restaurants', ['id' => $restaurant->id]);
        $this->assertDatabaseMissing('orders', ['id' => $order->id]);
        $this->assertDatabaseMissing('products', ['id' => $product->id]);
    }

    public function test_non_numeric_restaurant_id_returns_not_found(): void
    {
        $this->actingAs($this->superAdmin)
            ->putJson('/api/v1/superadmin/restaurants/abc', ['status' => 'active'])
            ->assertNotFound();

        $this->actingAs($this->superAdmin)
            ->deleteJson('/api/v1/superadmin/restaurants/abc')
            ->assertNotFound();
    }

    public function test_suspending_restaurant_revokes_staff_tokens(): void
    {
        $restaurant = Restaurant::factory()->create(['status' => 'active']);
        $staff = User::factory()->create(['restaurant_id' => $restaurant->id]);
        $staff->createToken('pos');

        $this->actingAs($this->superAdmin)
            ->putJson("/api/v1/superadmin/restaurants/{$restaurant->id}", ['status' => 'suspended'])
            ->assertOk();

        $this->assertCount(0, $staff->fresh()->tokens);
    }
}
