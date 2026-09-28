<?php

namespace Tests\Feature;

use App\Models\Ingredient;
use App\Models\Restaurant;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class IngredientApiTest extends TestCase
{
    use RefreshDatabase;

    protected User $manager;

    protected function setUp(): void
    {
        parent::setUp();

        $managerRole = Role::create(['name' => 'manager', 'label' => 'Gerente']);
        $restaurant = Restaurant::factory()->create();

        $this->manager = User::factory()->create(['role_id' => $managerRole->id, 'restaurant_id' => $restaurant->id]);
    }

    public function test_ingredient_name_only_needs_to_be_unique_inside_the_restaurant(): void
    {
        $otherRestaurant = Restaurant::factory()->create();
        Ingredient::factory()->create(['restaurant_id' => $otherRestaurant->id, 'name' => 'Queijo Prato']);

        $this->actingAs($this->manager, 'sanctum')
            ->postJson('/api/v1/ingredients', ['name' => 'Queijo Prato', 'stock_qty' => 5, 'unit' => 'kg'])
            ->assertCreated();

        $this->postJson('/api/v1/ingredients', ['name' => 'Queijo Prato', 'stock_qty' => 5, 'unit' => 'kg'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('name');
    }

    public function test_out_of_range_stock_is_a_validation_error(): void
    {
        $this->actingAs($this->manager, 'sanctum')
            ->postJson('/api/v1/ingredients', ['name' => 'Farinha', 'stock_qty' => 1000000000000, 'unit' => 'kg'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('stock_qty');
    }

    public function test_listing_tolerates_invalid_per_page(): void
    {
        $this->actingAs($this->manager, 'sanctum')
            ->getJson('/api/v1/ingredients?per_page=abc')
            ->assertOk()
            ->assertJsonPath('meta.per_page', 15);
    }
}
