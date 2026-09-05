<?php

namespace Tests\Feature;

use App\Models\Category;
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

        $this->manager = User::factory()->create(['role_id' => $managerRole->id]);
        $this->waiter = User::factory()->create(['role_id' => $waiterRole->id]);
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
}
