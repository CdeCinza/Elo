<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Ingredient;
use App\Models\Product;
use App\Models\RestaurantTable;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;

class RestaurantSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Criar Papéis (Roles)
        $ownerRole = Role::create(['name' => 'owner', 'label' => 'Dono da Rede']);
        $managerRole = Role::create(['name' => 'manager', 'label' => 'Gerente de Loja']);
        $waiterRole = Role::create(['name' => 'waiter', 'label' => 'Garçom']);
        $chefRole = Role::create(['name' => 'chef', 'label' => 'Cozinheiro']);
        $cashierRole = Role::create(['name' => 'cashier', 'label' => 'Caixa']);

        // 2. Criar Usuários Padrões
        User::factory()->create([
            'name' => 'Dono do Restaurante',
            'email' => 'owner@elo.com',
            'role_id' => $ownerRole->id,
        ]);

        User::factory()->create([
            'name' => 'Gerente da Loja',
            'email' => 'manager@elo.com',
            'role_id' => $managerRole->id,
        ]);

        User::factory()->create([
            'name' => 'Garçom Principal',
            'email' => 'waiter@elo.com',
            'role_id' => $waiterRole->id,
        ]);

        User::factory()->create([
            'name' => 'Chef de Cozinha',
            'email' => 'chef@elo.com',
            'role_id' => $chefRole->id,
        ]);

        User::factory()->create([
            'name' => 'Operador de Caixa',
            'email' => 'cashier@elo.com',
            'role_id' => $cashierRole->id,
        ]);

        // 3. Criar Mesas do Salão
        foreach (range(1, 10) as $number) {
            RestaurantTable::create([
                'number' => "Mesa {$number}",
                'capacity' => $number <= 4 ? 2 : ($number <= 8 ? 4 : 6),
                'status' => 'free',
            ]);
        }

        // 4. Criar Insumos/Ingredientes para Ficha Técnica
        $bun = Ingredient::create(['name' => 'Pão de Hambúrguer (un)', 'stock_qty' => 100, 'unit' => 'unidade', 'min_stock_alert' => 10]);
        $meat = Ingredient::create(['name' => 'Carne Bovina 180g (kg)', 'stock_qty' => 25.500, 'unit' => 'kg', 'min_stock_alert' => 5.000]);
        $cheese = Ingredient::create(['name' => 'Queijo Cheddar (kg)', 'stock_qty' => 10.000, 'unit' => 'kg', 'min_stock_alert' => 2.000]);
        $fries = Ingredient::create(['name' => 'Batata Pré-Frita (kg)', 'stock_qty' => 50.000, 'unit' => 'kg', 'min_stock_alert' => 10.000]);
        $coke = Ingredient::create(['name' => 'Lata Coca-Cola 350ml (un)', 'stock_qty' => 120, 'unit' => 'unidade', 'min_stock_alert' => 24]);

        // 5. Criar Categorias & Produtos com Ficha Técnica
        $catBurgers = Category::create(['name' => 'Hambúrgueres Artesanais', 'description' => 'Hambúrgueres feitos na grelha']);
        $catSides = Category::create(['name' => 'Acompanhamentos', 'description' => 'Porções deliciosas']);
        $catDrinks = Category::create(['name' => 'Bebidas', 'description' => 'Refrigerantes e sucos']);

        $burger = Product::create([
            'category_id' => $catBurgers->id,
            'name' => 'Cheeseburger Duplo',
            'description' => 'Pão artesanal, 2x carnes 180g e queijo cheddar fatiado.',
            'price' => 38.90,
            'available' => true,
        ]);

        // Vincular Ficha Técnica do Cheeseburger
        $burger->ingredients()->attach([
            $bun->id => ['qty_used' => 1.000],
            $meat->id => ['qty_used' => 0.360], // 360g de carne
            $cheese->id => ['qty_used' => 0.050], // 50g de queijo
        ]);

        $portion = Product::create([
            'category_id' => $catSides->id,
            'name' => 'Batata Frita Rustica',
            'description' => 'Batata frita crocante com alecrim e maionese da casa.',
            'price' => 22.00,
            'available' => true,
        ]);

        $portion->ingredients()->attach([
            $fries->id => ['qty_used' => 0.300], // 300g de batata
        ]);

        $drink = Product::create([
            'category_id' => $catDrinks->id,
            'name' => 'Coca-Cola Zero 350ml',
            'description' => 'Lata trincando de gelada',
            'price' => 7.50,
            'available' => true,
        ]);

        $drink->ingredients()->attach([
            $coke->id => ['qty_used' => 1.000],
        ]);
    }
}
