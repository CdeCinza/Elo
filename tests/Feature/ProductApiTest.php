<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Ingredient;
use App\Models\Product;
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
        $this->manager = User::factory()->create(['role_id' => $managerRole->id]);

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
}
