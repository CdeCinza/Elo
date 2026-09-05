<?php

namespace Tests\Feature;

use App\Events\OrderStatusChanged;
use App\Models\Ingredient;
use App\Models\Order;
use App\Models\Product;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class StockRecipeTest extends TestCase
{
    use RefreshDatabase;

    protected User $chef;

    protected User $waiter;

    protected Ingredient $meat;

    protected Ingredient $bun;

    protected Product $burger;

    protected function setUp(): void
    {
        parent::setUp();

        Event::fake([OrderStatusChanged::class]);

        $chefRole = Role::create(['name' => 'chef', 'label' => 'Cozinheiro']);
        $waiterRole = Role::create(['name' => 'waiter', 'label' => 'Garçom']);

        $this->chef = User::factory()->create(['role_id' => $chefRole->id]);
        $this->waiter = User::factory()->create(['role_id' => $waiterRole->id]);

        $this->meat = Ingredient::create(['name' => 'Carne 180g', 'stock_qty' => 1.000, 'unit' => 'kg', 'min_stock_alert' => 0.500]);
        $this->bun = Ingredient::create(['name' => 'Pão de Hambúrguer', 'stock_qty' => 10, 'unit' => 'unidade', 'min_stock_alert' => 2]);

        $this->burger = Product::factory()->create(['name' => 'Cheeseburger', 'price' => 25.00, 'available' => true]);
        $this->burger->ingredients()->attach([
            $this->meat->id => ['qty_used' => 0.180],
            $this->bun->id => ['qty_used' => 1.000],
        ]);
    }

    public function test_automatic_stock_deduction_when_order_is_confirmed(): void
    {
        $order = Order::factory()->create([
            'user_id' => $this->waiter->id,
            'status' => 'pending',
        ]);

        $order->items()->create([
            'product_id' => $this->burger->id,
            'unit_price' => 25.00,
            'quantity' => 2,
            'subtotal' => 50.00,
        ]);

        $response = $this->actingAs($this->chef, 'sanctum')
            ->patchJson("/api/v1/orders/{$order->id}/status", ['status' => 'confirmed']);

        $response->assertStatus(200);

        $this->assertEquals(0.640, (float) $this->meat->fresh()->stock_qty);
        $this->assertEquals(8, (float) $this->bun->fresh()->stock_qty);

        $this->assertDatabaseHas('activity_logs', ['action' => 'stock_deducted']);
    }

    public function test_order_creation_blocked_when_ingredient_stock_is_insufficient(): void
    {
        $this->bun->update(['stock_qty' => 0]);

        $response = $this->actingAs($this->waiter, 'sanctum')
            ->postJson('/api/v1/orders', [
                'type' => 'takeout',
                'items' => [
                    [
                        'product_id' => $this->burger->id,
                        'quantity' => 1,
                    ],
                ],
            ]);

        $response->assertStatus(422)
            ->assertJsonPath('message', "Estoque insuficiente do insumo 'Pão de Hambúrguer'. Necessário: 1unidade, disponível: 0unidade.");
    }
}
