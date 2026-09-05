<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Seed das roles para testes de autenticação e autorização
        Role::create(['name' => 'owner', 'label' => 'Dono da Rede']);
        Role::create(['name' => 'manager', 'label' => 'Gerente de Loja']);
        Role::create(['name' => 'waiter', 'label' => 'Garçom']);
        Role::create(['name' => 'chef', 'label' => 'Cozinheiro']);
        Role::create(['name' => 'cashier', 'label' => 'Caixa']);
    }

    public function test_user_can_register_via_api(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Garçom Teste',
            'email' => 'garcom@elo.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'role' => 'waiter',
        ]);

        $response->assertStatus(201)
            ->assertJsonStructure([
                'message',
                'user' => ['id', 'name', 'email', 'role'],
                'access_token',
                'token_type',
            ]);

        $this->assertDatabaseHas('users', ['email' => 'garcom@elo.com']);
    }

    public function test_user_can_login_and_receive_token(): void
    {
        $role = Role::where('name', 'manager')->first();
        $user = User::factory()->create([
            'email' => 'gerente@elo.com',
            'password' => bcrypt('password123'),
            'role_id' => $role->id,
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'gerente@elo.com',
            'password' => 'password123',
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'message',
                'user' => ['id', 'name', 'email', 'role' => ['name']],
                'access_token',
                'token_type',
            ]);
    }

    public function test_login_fails_with_invalid_credentials(): void
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'inexistente@elo.com',
            'password' => 'wrongpass',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    public function test_authenticated_user_can_get_profile(): void
    {
        $role = Role::where('name', 'owner')->first();
        $user = User::factory()->create(['role_id' => $role->id]);

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/auth/me');

        $response->assertStatus(200)
            ->assertJsonPath('user.email', $user->email)
            ->assertJsonPath('user.role.name', 'owner');
    }

    public function test_authenticated_user_can_logout(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('test_token')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/auth/logout');

        $response->assertStatus(200)
            ->assertJson(['message' => 'Logout realizado e token revogado com sucesso.']);

        $this->assertCount(0, $user->tokens);
    }
}
