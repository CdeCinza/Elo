<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\Ingredient;
use App\Models\OrderItem;
use App\Models\Product;
use Illuminate\Support\Collection;
use InvalidArgumentException;

class StockService
{
    /**
     * Garante que há insumos suficientes para os itens solicitados, somando o consumo por insumo.
     *
     * @param  array<int, array{product: Product, quantity: int, notes?: string|null}>  $lines
     *
     * @throws InvalidArgumentException
     */
    public function ensureAvailable(array $lines): void
    {
        /** @var array<int, array{ingredient: Ingredient, needed: float}> $needs */
        $needs = [];

        foreach ($lines as $line) {
            $line['product']->loadMissing('ingredients');

            foreach ($line['product']->ingredients as $ingredient) {
                $needs[$ingredient->id] ??= ['ingredient' => $ingredient, 'needed' => 0.0];
                $needs[$ingredient->id]['needed'] += $ingredient->pivot->qty_used * $line['quantity'];
            }
        }

        foreach ($needs as $need) {
            $ingredient = $need['ingredient'];
            $neededQty = $need['needed'];
            $currentStock = (float) $ingredient->stock_qty;

            if ($currentStock < $neededQty) {
                throw new InvalidArgumentException("Estoque insuficiente do insumo '{$ingredient->name}'. Necessário: {$neededQty}{$ingredient->unit}, disponível: {$currentStock}{$ingredient->unit}.");
            }
        }
    }

    /**
     * Baixa do estoque os insumos dos itens que ainda não tiveram baixa (cada item é baixado uma única vez).
     *
     * Deve ser chamado dentro de uma transação. Com $enforceAvailability, estoque insuficiente
     * interrompe a operação; sem ele (cozinha já preparando), a baixa é registrada mesmo assim.
     *
     * @param  Collection<int, OrderItem>  $items
     *
     * @throws InvalidArgumentException
     */
    public function deductForItems(Collection $items, ?int $userId, bool $enforceAvailability = true): void
    {
        foreach ($items as $item) {
            if ($item->stock_deducted_at !== null) {
                continue;
            }

            $item->loadMissing('product.ingredients', 'order');

            foreach ($item->product?->ingredients ?? [] as $recipeIngredient) {
                $ingredient = Ingredient::whereKey($recipeIngredient->id)->lockForUpdate()->first();
                if (! $ingredient) {
                    continue;
                }

                $usedQty = $recipeIngredient->pivot->qty_used * $item->quantity;

                if ($enforceAvailability && (float) $ingredient->stock_qty < $usedQty) {
                    throw new InvalidArgumentException("Estoque insuficiente do insumo '{$ingredient->name}' para confirmar o pedido.");
                }

                $ingredient->decrement('stock_qty', $usedQty);

                ActivityLog::create([
                    'restaurant_id' => $item->order?->restaurant_id,
                    'user_id' => $userId,
                    'subject_type' => Ingredient::class,
                    'subject_id' => $ingredient->id,
                    'action' => 'stock_deducted',
                    'payload' => [
                        'order_id' => $item->order_id,
                        'order_item_id' => $item->id,
                        'deducted_qty' => $usedQty,
                        'remaining_stock' => (float) $ingredient->fresh()->stock_qty,
                    ],
                ]);
            }

            $item->update(['stock_deducted_at' => now()]);
        }
    }
}
