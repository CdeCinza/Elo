<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RolePolicyTest extends TestCase
{
    use RefreshDatabase;

    protected Role $ownerRole;

    protected Role $managerRole;

    protected Role $waiterRole;

    protected Role $chefRole;

    protected function setUp(): void
    {
        parent::setUp();

        $this->ownerRole = Role::create(['name' => 'owner', 'label' => 'Dono da Rede']);
        $this->managerRole = Role::create(['name' => 'manager', 'label' => 'Gerente de Loja']);
        $this->waiterRole = Role::create(['name' => 'waiter', 'label' => 'Garçom']);
        $this->chefRole = Role::create(['name' => 'chef', 'label' => 'Cozinheiro']);
    }

    public function test_owner_and_manager_can_delete_order(): void
    {
        $owner = User::factory()->create(['role_id' => $this->ownerRole->id]);
        $order = Order::factory()->create();

        $this->assertTrue($owner->can('delete', $order));
    }

    public function test_waiter_cannot_delete_order(): void
    {
        $waiter = User::factory()->create(['role_id' => $this->waiterRole->id]);
        $order = Order::factory()->create(['user_id' => $waiter->id]);

        $this->assertFalse($waiter->can('delete', $order));
    }

    public function test_chef_can_only_update_confirmed_or_preparing_orders(): void
    {
        $chef = User::factory()->create(['role_id' => $this->chefRole->id]);
        $preparingOrder = Order::factory()->create(['status' => 'preparing']);
        $deliveredOrder = Order::factory()->create(['status' => 'delivered']);

        $this->assertTrue($chef->can('update', $preparingOrder));
        $this->assertFalse($chef->can('update', $deliveredOrder));
    }
}
