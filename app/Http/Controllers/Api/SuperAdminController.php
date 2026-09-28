<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Restaurant;
use App\Models\RestaurantTable;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\PersonalAccessToken;

class SuperAdminController extends Controller
{
    /**
     * 1. Lista todos os restaurantes cadastrados com estatísticas
     */
    public function index(Request $request): JsonResponse
    {
        $restaurants = Restaurant::with([
            'users' => function ($query) {
                $query->whereHas('role', function ($q) {
                    $q->whereIn('name', ['restaurant_admin', 'owner']);
                })->with('role');
            },
        ])
            ->withCount(['tables', 'products', 'orders', 'users'])
            ->orderByDesc('id')
            ->get();

        $formatted = $restaurants->map(function ($rest) {
            $owner = $rest->users->first();
            $totalRevenue = (float) Payment::where('status', 'paid')
                ->whereHas('order', fn ($query) => $query->where('restaurant_id', $rest->id))
                ->sum('amount');

            return [
                'id' => $rest->id,
                'name' => $rest->name,
                'slug' => $rest->slug,
                'document' => $rest->document,
                'phone' => $rest->phone,
                'address' => $rest->address,
                'logo_url' => $rest->logo_url,
                'status' => $rest->status,
                'created_at' => $rest->created_at?->format('d/m/Y H:i'),
                'tables_count' => $rest->tables_count,
                'products_count' => $rest->products_count,
                'orders_count' => $rest->orders_count,
                'users_count' => $rest->users_count,
                'total_revenue' => $totalRevenue,
                'owner' => $owner ? [
                    'id' => $owner->id,
                    'name' => $owner->name,
                    'email' => $owner->email,
                    'role_label' => $owner->role?->label ?? 'Dono',
                ] : null,
            ];
        });

        return response()->json([
            'restaurants' => $formatted,
        ]);
    }

    /**
     * 2. Cadastra um novo Restaurante + Sub-Admin (Dono)
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:120',
            'slug' => 'nullable|string|max:80|unique:restaurants,slug',
            'document' => 'nullable|string|max:30',
            'phone' => 'nullable|string|max:30',
            'address' => 'nullable|string|max:255',
            'owner_name' => 'required|string|max:120',
            'owner_email' => 'required|email|max:120|unique:users,email',
            'owner_password' => 'required|string|min:6',
            'initial_tables' => 'nullable|integer|min:0|max:50',
        ]);

        $slug = ! empty($validated['slug'])
            ? Str::slug($validated['slug'])
            : Str::slug($validated['name']);

        // Garante slug único
        $baseSlug = $slug;
        $counter = 1;
        while (Restaurant::where('slug', $slug)->exists()) {
            $slug = "{$baseSlug}-{$counter}";
            $counter++;
        }

        $ownerRole = Role::firstOrCreate(
            ['name' => 'restaurant_admin'],
            ['label' => 'Dono do Restaurante']
        );

        $restaurant = DB::transaction(function () use ($validated, $slug, $ownerRole) {
            $restaurant = Restaurant::create([
                'name' => $validated['name'],
                'slug' => $slug,
                'document' => $validated['document'] ?? null,
                'phone' => $validated['phone'] ?? null,
                'address' => $validated['address'] ?? null,
                'status' => 'active',
                'settings' => [
                    'service_tax_percent' => 10,
                    'currency' => 'BRL',
                    'primary_color' => '#C84E1F',
                ],
            ]);

            // Cria o usuário Dono (Sub-Admin)
            User::create([
                'restaurant_id' => $restaurant->id,
                'role_id' => $ownerRole->id,
                'name' => $validated['owner_name'],
                'email' => $validated['owner_email'],
                'password' => Hash::make($validated['owner_password']),
            ]);

            // Cria mesas iniciais padrão se solicitado (default 10)
            $tableCount = $validated['initial_tables'] ?? 10;
            if ($tableCount > 0) {
                for ($i = 1; $i <= $tableCount; $i++) {
                    RestaurantTable::create([
                        'restaurant_id' => $restaurant->id,
                        'number' => "Mesa {$i}",
                        'capacity' => $i <= 4 ? 2 : ($i <= 8 ? 4 : 6),
                        'status' => 'free',
                    ]);
                }
            }

            return $restaurant;
        });

        return response()->json([
            'message' => "Restaurante '{$restaurant->name}' e Administrador cadastrados com sucesso!",
            'restaurant' => $restaurant->load('users'),
        ], 201);
    }

    /**
     * 3. Atualiza dados ou status de um restaurante
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $restaurant = Restaurant::findOrFail($id);

        $validated = $request->validate([
            'name' => 'nullable|string|max:120',
            'document' => 'nullable|string|max:30',
            'phone' => 'nullable|string|max:30',
            'address' => 'nullable|string|max:255',
            'status' => 'nullable|string|in:active,suspended,pending',
        ]);

        $restaurant->update(array_filter($validated, fn ($val) => ! is_null($val)));

        // Suspensão encerra imediatamente as sessões da equipe do restaurante
        if ($restaurant->status === 'suspended') {
            PersonalAccessToken::where('tokenable_type', User::class)
                ->whereIn('tokenable_id', $restaurant->users()->select('id'))
                ->delete();
        }

        return response()->json([
            'message' => "Restaurante '{$restaurant->name}' atualizado com sucesso.",
            'restaurant' => $restaurant,
        ]);
    }

    /**
     * 4. Exclui ou desativa restaurante
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $restaurant = Restaurant::findOrFail($id);
        $name = $restaurant->name;

        DB::transaction(function () use ($restaurant) {
            // Itens de pedido referenciam produtos sem cascade: remove os pedidos antes do restaurante
            Order::where('restaurant_id', $restaurant->id)->delete();
            PersonalAccessToken::where('tokenable_type', User::class)
                ->whereIn('tokenable_id', $restaurant->users()->select('id'))
                ->delete();
            $restaurant->delete();
        });

        return response()->json([
            'message' => "Restaurante '{$name}' removido com sucesso.",
        ]);
    }

    /**
     * 5. Métricas consolidadas para o Super Admin
     */
    public function metrics(Request $request): JsonResponse
    {
        $totalRestaurants = Restaurant::count();
        $activeRestaurants = Restaurant::where('status', 'active')->count();
        $totalOrders = Order::count();
        $totalRevenue = (float) Payment::where('status', 'paid')->sum('amount');
        $totalUsers = User::count();

        return response()->json([
            'metrics' => [
                'total_restaurants' => $totalRestaurants,
                'active_restaurants' => $activeRestaurants,
                'total_orders' => $totalOrders,
                'total_revenue' => $totalRevenue,
                'total_users' => $totalUsers,
            ],
        ]);
    }
}
