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
        $catBurgers = Category::create(['name' => 'Burgers', 'description' => 'Hambúrgueres artesanais feitos na grelha']);
        $catSides = Category::create(['name' => 'Entradas', 'description' => 'Porções e entradas deliciosas']);
        $catDrinks = Category::create(['name' => 'Bebidas', 'description' => 'Sodas, sucos e refrigerantes artesanais']);
        $catDesserts = Category::create(['name' => 'Sobremesas', 'description' => 'Doces e finalizações irresistíveis']);

        // Produto 1: Smash ELO Bacon Duplo
        $burger = Product::create([
            'category_id' => $catBurgers->id,
            'name' => 'Smash ELO Bacon Duplo',
            'description' => 'Dois burgers de 90g, muito cheddar, bacon crocante e molho da casa.',
            'price' => 36.90,
            'available' => true,
            'image_url' => 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=600&q=80',
        ]);
        $burger->ingredients()->attach([
            $bun->id => ['qty_used' => 1.000],
            $meat->id => ['qty_used' => 0.180],
            $cheese->id => ['qty_used' => 0.050],
        ]);

        // Produto 2: Burger Gorgonzola & Mel
        $burgerGorgonzola = Product::create([
            'category_id' => $catBurgers->id,
            'name' => 'Burger Gorgonzola & Mel',
            'description' => 'Blend bovino 180g grelhado na brasa, creme de gorgonzola dolce, fios de mel silvestre e rúcula fresca no brioche.',
            'price' => 42.00,
            'available' => true,
            'image_url' => 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80',
        ]);
        $burgerGorgonzola->ingredients()->attach([
            $bun->id => ['qty_used' => 1.000],
            $meat->id => ['qty_used' => 0.180],
        ]);

        // Produto 3: Batata Rústica com Alecrim
        $portion = Product::create([
            'category_id' => $catSides->id,
            'name' => 'Batata Rústica com Alecrim',
            'description' => 'Batatas crocantes temperadas com alecrim e ervas finas.',
            'price' => 24.50,
            'available' => true,
            'image_url' => 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80',
        ]);
        $portion->ingredients()->attach([
            $fries->id => ['qty_used' => 0.300],
        ]);

        // Produto 4: Soda Italiana de Maracujá
        $drink = Product::create([
            'category_id' => $catDrinks->id,
            'name' => 'Soda Italiana de Maracujá',
            'description' => 'Xarope artesanal de maracujá, água gaseificada e muito sabor.',
            'price' => 16.00,
            'available' => true,
            'image_url' => 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80',
        ]);
        $drink->ingredients()->attach([
            $coke->id => ['qty_used' => 1.000],
        ]);

        // Produto 5: Pudim de Leite na Lata
        Product::create([
            'category_id' => $catDesserts->id,
            'name' => 'Pudim de Leite na Lata',
            'description' => 'Receita tradicional, cremosa sem igual.',
            'price' => 18.00,
            'available' => true,
            'image_url' => 'https://images.unsplash.com/photo-1587314168485-3236d6710814?auto=format&fit=crop&w=600&q=80',
        ]);
    }
}
