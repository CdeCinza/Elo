<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Ingredient;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\Restaurant;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductApiTest extends TestCase
{
    use RefreshDatabase;

    protected User $manager;

    protected Category $category;

    protected function setUp(): void
    {
        parent::setUp();

        $managerRole = Role::create(['name' => 'manager', 'label' => 'Gerente']);
        $restaurant = Restaurant::factory()->create();
        $this->manager = User::factory()->create(['role_id' => $managerRole->id, 'restaurant_id' => $restaurant->id]);

        $this->category = Category::factory()->create(['name' => 'Lanches']);
    }

    public function test_can_list_and_filter_products_with_pagination(): void
    {
        Product::factory()->create([
            'category_id' => $this->category->id,
            'name' => 'Hambúrguer Gourmet',
            'available' => true,
        ]);

        Product::factory()->create([
            'category_id' => $this->category->id,
            'name' => 'Suco de Laranja',
            'available' => false,
        ]);

        $response = $this->getJson('/api/v1/products?search=Gourmet');

        $response->assertStatus(200)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Hambúrguer Gourmet');
    }

    public function test_manager_can_create_product_with_recipe_ingredients(): void
    {
        $ingredient = Ingredient::factory()->create(['name' => 'Carne 180g']);

        $response = $this->actingAs($this->manager, 'sanctum')
            ->postJson('/api/v1/products', [
                'category_id' => $this->category->id,
                'name' => 'X-Salada Especial',
                'description' => 'Acompanha maionese',
                'price' => 29.90,
                'available' => true,
                'ingredients' => [
                    [
                        'id' => $ingredient->id,
                        'qty_used' => 0.180,
                    ],
                ],
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('product.name', 'X-Salada Especial')
            ->assertJsonCount(1, 'product.ingredients');

        $this->assertDatabaseHas('products', ['name' => 'X-Salada Especial']);
        $this->assertDatabaseHas('product_ingredients', [
            'ingredient_id' => $ingredient->id,
            'qty_used' => 0.180,
        ]);
    }

    public function test_manager_cannot_change_another_restaurants_product(): void
    {
        $otherRestaurant = Restaurant::factory()->create();
        $otherProduct = Product::factory()->create(['restaurant_id' => $otherRestaurant->id]);

        $this->actingAs($this->manager, 'sanctum')
            ->putJson("/api/v1/products/{$otherProduct->id}", ['name' => 'Nome indevido'])
            ->assertForbidden();

        $this->assertNotSame('Nome indevido', $otherProduct->fresh()->name);
    }

    public function test_product_with_order_history_cannot_be_deleted(): void
    {
        $product = Product::factory()->create([
            'restaurant_id' => $this->manager->restaurant_id,
            'category_id' => $this->category->id,
        ]);
        OrderItem::factory()->create(['product_id' => $product->id]);

        $this->actingAs($this->manager, 'sanctum')
            ->deleteJson("/api/v1/products/{$product->id}")
            ->assertStatus(422)
            ->assertJsonPath('message', 'Este produto já possui pedidos registrados. Marque-o como indisponível em vez de excluir.');

        $this->assertDatabaseHas('products', ['id' => $product->id]);
    }

    public function test_out_of_range_price_is_a_validation_error(): void
    {
        $this->actingAs($this->manager, 'sanctum')
            ->postJson('/api/v1/products', [
                'category_id' => $this->category->id,
                'name' => 'Produto Caro',
                'price' => 1000000000000,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('price');
    }

    public function test_invalid_per_page_falls_back_to_default_pagination(): void
    {
        Product::factory()->create(['category_id' => $this->category->id]);

        $this->getJson('/api/v1/products?per_page=abc')
            ->assertOk()
            ->assertJsonPath('meta.per_page', 15);

        $this->getJson('/api/v1/products?per_page=100000')
            ->assertOk()
            ->assertJsonPath('meta.per_page', 200);

        Product::factory()->create(['category_id' => $this->category->id, 'available' => false]);

        $this->getJson('/api/v1/products?available=1&per_page=200')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }
}
