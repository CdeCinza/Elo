<?php

namespace App\Services;

use App\Models\Order;
use App\Models\OrderItem;
use Illuminate\Support\Collection;
use InvalidArgumentException;

class KitchenFlowService
{
    /**
     * Estágios de preparo de um item, na ordem em que avançam.
     *
     * @var list<string>
     */
    public const STAGES = ['pending', 'preparing', 'ready', 'delivered'];

    public function __construct(protected StockService $stockService) {}

    /**
     * Estágio agregado de um conjunto de itens: o menor estágio entre os itens ainda não entregues.
     *
     * @param  Collection<int, OrderItem>  $items
     */
    public function aggregateStage(Collection $items): ?string
    {
        if ($items->isEmpty()) {
            return null;
        }

        $openStages = $items->pluck('status')->reject(fn (?string $status): bool => $status === 'delivered');

        if ($openStages->isEmpty()) {
            return 'delivered';
        }

        return $openStages
            ->sortBy(fn (?string $status): int => $this->stageIndex($status))
            ->first();
    }

    /**
     * Recalcula o status do pedido a partir dos itens. Um pedido "confirmed" cuja fila ainda não começou
     * permanece confirmado.
     */
    public function syncOrderStatus(Order $order): void
    {
        $stage = $this->aggregateStage($order->items()->get(['id', 'status']));

        if ($stage === null || ($stage === 'pending' && $order->status === 'confirmed')) {
            return;
        }

        if ($order->status !== $stage) {
            $order->update(['status' => $stage]);
        }
    }

    /**
     * Avança para $targetStatus os itens que estão em $fromStage (ou, sem ele, no estágio atual do pedido).
     * Itens que entram em preparo têm o estoque baixado sem bloquear a cozinha.
     *
     * @param  list<int>|null  $itemIds
     *
     * @throws InvalidArgumentException
     */
    public function advance(Order $order, string $targetStatus, ?int $userId, ?string $fromStage = null, ?array $itemIds = null): void
    {
        if (in_array($order->status, ['delivered', 'canceled'], true)) {
            throw new InvalidArgumentException('Transição de status inválida.');
        }

        $items = $order->items()->get();
        if ($itemIds !== null) {
            $items = $items->whereIn('id', $itemIds)->values();
            if ($items->count() !== count($itemIds)) {
                throw new InvalidArgumentException('Os itens selecionados não pertencem a esta comanda.');
            }
        }
        $currentStage = $fromStage ?? $this->aggregateStage($items);
        $nextStage = self::STAGES[$this->stageIndex($currentStage) + 1] ?? null;

        if ($currentStage === null || $nextStage !== $targetStatus || $items->where('status', $currentStage)->isEmpty()) {
            throw new InvalidArgumentException('Transição de status inválida.');
        }

        $advancingItems = $items->where('status', $currentStage)->values();
        if ($itemIds !== null && $advancingItems->count() !== count($itemIds)) {
            throw new InvalidArgumentException('Os itens selecionados mudaram de etapa. Atualize a fila e tente novamente.');
        }

        if ($targetStatus === 'preparing') {
            $this->stockService->deductForItems($advancingItems, $userId, enforceAvailability: false);
        }

        OrderItem::whereKey($advancingItems->modelKeys())->update(['status' => $targetStatus]);

        $this->syncOrderStatus($order);
    }

    /**
     * Leva ao estágio $status todos os itens do pedido que estão em um estágio anterior
     * (usado quando o pedido inteiro muda de status).
     */
    public function promoteItemsTo(Order $order, string $status): void
    {
        $index = array_search($status, self::STAGES, true);

        if ($index === false || $index === 0) {
            return;
        }

        $order->items()
            ->whereIn('status', array_slice(self::STAGES, 0, $index))
            ->update(['status' => $status]);
    }

    private function stageIndex(?string $status): int
    {
        $index = array_search($status, self::STAGES, true);

        return $index === false ? 0 : $index;
    }
}
