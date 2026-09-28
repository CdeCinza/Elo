<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\Restaurant;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CategoryApiTest extends TestCase
{
    use RefreshDatabase;

    protected User $manager;

    protected User $waiter;

    protected function setUp(): void
    {
        parent::setUp();

        $managerRole = Role::create(['name' => 'manager', 'label' => 'Gerente']);
        $waiterRole = Role::create(['name' => 'waiter', 'label' => 'Garçom']);
        $restaurant = Restaurant::factory()->create();

        $this->manager = User::factory()->create(['role_id' => $managerRole->id, 'restaurant_id' => $restaurant->id]);
        $this->waiter = User::factory()->create(['role_id' => $waiterRole->id, 'restaurant_id' => $restaurant->id]);
    }

    public function test_anyone_can_list_categories(): void
    {
        Category::factory(3)->create();

        $response = $this->getJson('/api/v1/categories');

        $response->assertStatus(200)
            ->assertJsonCount(3, 'data');
    }

    public function test_manager_can_create_category(): void
    {
        $response = $this->actingAs($this->manager, 'sanctum')
            ->postJson('/api/v1/categories', [
                'name' => 'Sobremesas Especiais',
                'description' => 'Doces caseiros',
                'is_active' => true,
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('category.name', 'Sobremesas Especiais');

        $this->assertDatabaseHas('categories', ['name' => 'Sobremesas Especiais']);
    }

    public function test_waiter_cannot_create_category(): void
    {
        $response = $this->actingAs($this->waiter, 'sanctum')
            ->postJson('/api/v1/categories', [
                'name' => 'Bebidas Alcoólicas',
            ]);

        $response->assertStatus(403);
    }

    public function test_manager_cannot_change_another_restaurants_category(): void
    {
        $otherRestaurant = Restaurant::factory()->create();
        $category = Category::factory()->create(['restaurant_id' => $otherRestaurant->id]);

        $this->actingAs($this->manager, 'sanctum')
            ->putJson("/api/v1/categories/{$category->id}", ['name' => 'Nome indevido'])
            ->assertForbidden();
    }

    public function test_category_name_only_needs_to_be_unique_inside_the_restaurant(): void
    {
        $otherRestaurant = Restaurant::factory()->create();
        Category::factory()->create(['restaurant_id' => $otherRestaurant->id, 'name' => 'Bebidas']);

        $this->actingAs($this->manager, 'sanctum')
            ->postJson('/api/v1/categories', ['name' => 'Bebidas'])
            ->assertCreated();

        $this->postJson('/api/v1/categories', ['name' => 'Bebidas'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('name');
    }

    public function test_category_with_products_already_ordered_cannot_be_deleted(): void
    {
        $category = Category::factory()->create(['restaurant_id' => $this->manager->restaurant_id]);
        $product = Product::factory()->create([
            'restaurant_id' => $this->manager->restaurant_id,
            'category_id' => $category->id,
        ]);
        OrderItem::factory()->create(['product_id' => $product->id]);

        $this->actingAs($this->manager, 'sanctum')
            ->deleteJson("/api/v1/categories/{$category->id}")
            ->assertStatus(422)
            ->assertJsonPath('message', 'Esta categoria possui produtos com pedidos registrados. Desative-a em vez de excluir.');

        $this->assertDatabaseHas('categories', ['id' => $category->id]);
    }
}
