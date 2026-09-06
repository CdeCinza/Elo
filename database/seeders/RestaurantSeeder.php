<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Ingredient;
use App\Models\Product;
use App\Models\Restaurant;
use App\Models\RestaurantTable;
use App\Models\Role;
use App\Models\User;
use App\Services\BrevoMailService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class RestaurantSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Criar Papéis (Roles)
        $superAdminRole = Role::firstOrCreate(['name' => 'super_admin'], ['label' => 'Administrador Geral']);
        $ownerRole = Role::firstOrCreate(['name' => 'restaurant_admin'], ['label' => 'Dono do Restaurante']);
        $managerRole = Role::firstOrCreate(['name' => 'manager'], ['label' => 'Gerente de Loja']);
        $waiterRole = Role::firstOrCreate(['name' => 'waiter'], ['label' => 'Garçom']);
        $chefRole = Role::firstOrCreate(['name' => 'chef'], ['label' => 'Cozinheiro']);
        $cashierRole = Role::firstOrCreate(['name' => 'cashier'], ['label' => 'Caixa']);

        // 2. Criar Super Admin Geral da Plataforma
        $superAdminEmail = env('SUPERADMIN_EMAIL', 'matheusneru@gmail.com');
        $randomPassword = Str::password(16);

        $superAdmin = User::updateOrCreate(
            ['email' => $superAdminEmail],
            [
                'name' => 'Matheus Super Admin',
                'password' => bcrypt($randomPassword),
                'role_id' => $superAdminRole->id,
                'restaurant_id' => null,
            ]
        );

        // Disparar e-mail com as credenciais geradas de forma segura via Brevo
        $frontendUrl = env('FRONTEND_URL', 'http://localhost:3000').'/login';
        $brevoService = app(BrevoMailService::class);
        $sent = $brevoService->sendSuperAdminCredentials(
            adminEmail: $superAdminEmail,
            plainPassword: $randomPassword,
            loginUrl: $frontendUrl
        );

        if ($sent) {
            $this->command?->info("Credenciais do Super Admin geradas e enviadas por e-mail (Brevo) para: {$superAdminEmail}");
        } else {
            $this->command?->warn('Aviso: Falha ao enviar por e-mail. Utilize a senha gerada abaixo para acessar:');
            $this->command?->line("E-mail: [{$superAdminEmail}] | Senha: [{$randomPassword}]");
        }

        // 3. Criar Restaurante Padrão (Tenant Inicial)
        $restaurant = Restaurant::firstOrCreate(
            ['slug' => 'elo-jardins'],
            [
                'name' => 'ELO Gastronomia • Jardins',
                'document' => '12.345.678/0001-90',
                'phone' => '(11) 98765-4321',
                'address' => 'Rua Oscar Freire, 1200 - Jardins, São Paulo/SP',
                'status' => 'active',
                'settings' => [
                    'service_tax_percent' => 10,
                    'currency' => 'BRL',
                    'primary_color' => '#C84E1F',
                ],
            ]
        );

        // 4. Criar Dono / Sub-Admin do Restaurante
        User::firstOrCreate(
            ['email' => 'dono@elo.com'],
            [
                'name' => 'Matheus (Dono Jardins)',
                'password' => bcrypt('password'),
                'role_id' => $ownerRole->id,
                'restaurant_id' => $restaurant->id,
            ]
        );

        // Usuários Operacionais do Restaurante
        User::firstOrCreate(
            ['email' => 'gerente@elo.com'],
            [
                'name' => 'Gerente da Loja',
                'password' => bcrypt('password'),
                'role_id' => $managerRole->id,
                'restaurant_id' => $restaurant->id,
            ]
        );

        User::firstOrCreate(
            ['email' => 'garcom@elo.com'],
            [
                'name' => 'Garçom Principal',
                'password' => bcrypt('password'),
                'role_id' => $waiterRole->id,
                'restaurant_id' => $restaurant->id,
            ]
        );

        User::firstOrCreate(
            ['email' => 'chef@elo.com'],
            [
                'name' => 'Chef de Cozinha',
                'password' => bcrypt('password'),
                'role_id' => $chefRole->id,
                'restaurant_id' => $restaurant->id,
            ]
        );

        User::firstOrCreate(
            ['email' => 'caixa@elo.com'],
            [
                'name' => 'Operador de Caixa',
                'password' => bcrypt('password'),
                'role_id' => $cashierRole->id,
                'restaurant_id' => $restaurant->id,
            ]
        );

        // 5. Criar Mesas do Salão para o Restaurante
        foreach (range(1, 10) as $number) {
            RestaurantTable::firstOrCreate(
                [
                    'restaurant_id' => $restaurant->id,
                    'number' => "Mesa {$number}",
                ],
                [
                    'capacity' => $number <= 4 ? 2 : ($number <= 8 ? 4 : 6),
                    'status' => 'free',
                ]
            );
        }

        // 6. Criar Insumos/Ingredientes vinculados ao restaurante
        $bun = Ingredient::firstOrCreate(
            ['restaurant_id' => $restaurant->id, 'name' => 'Pão de Hambúrguer (un)'],
            ['stock_qty' => 100, 'unit' => 'unidade', 'min_stock_alert' => 10]
        );
        $meat = Ingredient::firstOrCreate(
            ['restaurant_id' => $restaurant->id, 'name' => 'Carne Bovina 180g (kg)'],
            ['stock_qty' => 25.500, 'unit' => 'kg', 'min_stock_alert' => 5.000]
        );
        $cheese = Ingredient::firstOrCreate(
            ['restaurant_id' => $restaurant->id, 'name' => 'Queijo Cheddar (kg)'],
            ['stock_qty' => 10.000, 'unit' => 'kg', 'min_stock_alert' => 2.000]
        );
        $fries = Ingredient::firstOrCreate(
            ['restaurant_id' => $restaurant->id, 'name' => 'Batata Pré-Frita (kg)'],
            ['stock_qty' => 50.000, 'unit' => 'kg', 'min_stock_alert' => 10.000]
        );
        $coke = Ingredient::firstOrCreate(
            ['restaurant_id' => $restaurant->id, 'name' => 'Lata Coca-Cola 350ml (un)'],
            ['stock_qty' => 120, 'unit' => 'unidade', 'min_stock_alert' => 24]
        );

        // 7. Criar Categorias & Produtos vinculados ao restaurante
        $catBurgers = Category::firstOrCreate(
            ['restaurant_id' => $restaurant->id, 'name' => 'Burgers'],
            ['description' => 'Hambúrgueres artesanais feitos na grelha']
        );
        $catSides = Category::firstOrCreate(
            ['restaurant_id' => $restaurant->id, 'name' => 'Entradas'],
            ['description' => 'Porções e entradas deliciosas']
        );
        $catDrinks = Category::firstOrCreate(
            ['restaurant_id' => $restaurant->id, 'name' => 'Bebidas'],
            ['description' => 'Sodas, sucos e refrigerantes artesanais']
        );
        $catDesserts = Category::firstOrCreate(
            ['restaurant_id' => $restaurant->id, 'name' => 'Sobremesas'],
            ['description' => 'Doces e finalizações irresistíveis']
        );

        // Produto 1: Smash ELO Bacon Duplo
        $burger = Product::firstOrCreate(
            ['restaurant_id' => $restaurant->id, 'name' => 'Smash ELO Bacon Duplo'],
            [
                'category_id' => $catBurgers->id,
                'description' => 'Dois burgers de 90g, muito cheddar, bacon crocante e molho da casa.',
                'price' => 36.90,
                'available' => true,
                'image_url' => 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=600&q=80',
            ]
        );
        $burger->ingredients()->syncWithoutDetaching([
            $bun->id => ['qty_used' => 1.000],
            $meat->id => ['qty_used' => 0.180],
            $cheese->id => ['qty_used' => 0.050],
        ]);

        // Produto 2: Burger Gorgonzola & Mel
        $burgerGorgonzola = Product::firstOrCreate(
            ['restaurant_id' => $restaurant->id, 'name' => 'Burger Gorgonzola & Mel'],
            [
                'category_id' => $catBurgers->id,
                'description' => 'Blend bovino 180g grelhado na brasa, creme de gorgonzola dolce, fios de mel silvestre e rúcula fresca no brioche.',
                'price' => 42.00,
                'available' => true,
                'image_url' => 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80',
            ]
        );
        $burgerGorgonzola->ingredients()->syncWithoutDetaching([
            $bun->id => ['qty_used' => 1.000],
            $meat->id => ['qty_used' => 0.180],
        ]);

        // Produto 3: Batata Rústica com Alecrim
        $portion = Product::firstOrCreate(
            ['restaurant_id' => $restaurant->id, 'name' => 'Batata Rústica com Alecrim'],
            [
                'category_id' => $catSides->id,
                'description' => 'Batatas crocantes temperadas com alecrim e ervas finas.',
                'price' => 24.50,
                'available' => true,
                'image_url' => 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80',
            ]
        );
        $portion->ingredients()->syncWithoutDetaching([
            $fries->id => ['qty_used' => 0.300],
        ]);

        // Produto 4: Soda Italiana de Maracujá
        $drink = Product::firstOrCreate(
            ['restaurant_id' => $restaurant->id, 'name' => 'Soda Italiana de Maracujá'],
            [
                'category_id' => $catDrinks->id,
                'description' => 'Xarope artesanal de maracujá, água gaseificada e muito sabor.',
                'price' => 16.00,
                'available' => true,
                'image_url' => 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80',
            ]
        );
        $drink->ingredients()->syncWithoutDetaching([
            $coke->id => ['qty_used' => 1.000],
        ]);

        // Produto 5: Pudim de Leite na Lata
        Product::firstOrCreate(
            ['restaurant_id' => $restaurant->id, 'name' => 'Pudim de Leite na Lata'],
            [
                'category_id' => $catDesserts->id,
                'description' => 'Receita tradicional, cremosa sem igual.',
                'price' => 18.00,
                'available' => true,
                'image_url' => 'https://images.unsplash.com/photo-1587314168485-3236d6710814?auto=format&fit=crop&w=600&q=80',
            ]
        );
    }
}
