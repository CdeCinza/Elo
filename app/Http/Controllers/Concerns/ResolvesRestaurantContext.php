<?php

namespace App\Http\Controllers\Concerns;

use App\Models\Restaurant;
use App\Models\RestaurantTable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

trait ResolvesRestaurantContext
{
    /**
     * Identifica o restaurante da requisição: funcionários ficam presos ao próprio restaurante;
     * clientes (rotas públicas) e o Super Admin usam o cabeçalho X-Restaurant-Id.
     * Restaurantes suspensos não atendem clientes nem funcionários.
     */
    protected function resolveRestaurantId(Request $request): int
    {
        $user = $request->user();

        if ($user && ! $user->isSuperAdmin() && $user->restaurant_id) {
            $restaurantId = (int) $user->restaurant_id;
        } elseif ($request->header('X-Restaurant-Id')) {
            $restaurantId = (int) $request->header('X-Restaurant-Id');
        } elseif ($request->query('restaurant_id')) {
            $restaurantId = (int) $request->query('restaurant_id');
        } else {
            $restaurantId = (int) (Restaurant::query()->orderBy('id')->value('id') ?? Restaurant::create([
                'name' => 'Restaurante Principal',
                'slug' => 'restaurante-principal',
                'status' => 'active',
            ])->id);
        }

        if (! $user?->isSuperAdmin() && Restaurant::whereKey($restaurantId)->where('status', 'suspended')->exists()) {
            abort(403, 'Este restaurante está suspenso no momento. Entre em contato com o responsável.');
        }

        return $restaurantId;
    }

    /**
     * Localiza a mesa do restaurante pelo número exibido ("01", "1", "Mesa 01", "Mesa 1").
     */
    protected function findTableByNumber(string $tableNumber, int $restaurantId): RestaurantTable
    {
        $table = $this->tableNumberQuery($tableNumber, $restaurantId)->first();

        if (! $table) {
            abort(404, 'Mesa não encontrada.');
        }

        return $table;
    }

    /**
     * Consulta de mesas do restaurante que correspondem ao número informado em qualquer formato aceito.
     *
     * @return Builder<RestaurantTable>
     */
    protected function tableNumberQuery(string $tableNumber, int $restaurantId): Builder
    {
        $cleanNumber = preg_replace('/[^0-9]/', '', $tableNumber);
        $intNumber = (int) $cleanNumber;
        $formattedTwoDigits = sprintf('%02d', $intNumber);

        return RestaurantTable::where('restaurant_id', $restaurantId)
            ->where(function ($query) use ($tableNumber, $cleanNumber, $formattedTwoDigits, $intNumber) {
                $query->where('number', $tableNumber)
                    ->orWhere('number', "Mesa {$cleanNumber}")
                    ->orWhere('number', "Mesa {$formattedTwoDigits}")
                    ->orWhere('number', "Mesa {$intNumber}");

                if ($cleanNumber !== '') {
                    $query->orWhere('number', (string) $intNumber)
                        ->orWhere('number', $formattedTwoDigits);
                }
            });
    }
}
