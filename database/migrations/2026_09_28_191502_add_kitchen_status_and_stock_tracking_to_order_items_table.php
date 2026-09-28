<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Adiciona o status de preparo por item (KDS) e o controle de baixa de estoque por item.
     */
    public function up(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->enum('status', ['pending', 'preparing', 'ready', 'delivered'])->default('pending')->after('subtotal');
            $table->timestamp('stock_deducted_at')->nullable()->after('status');
        });

        foreach (['preparing', 'ready', 'delivered'] as $status) {
            DB::table('order_items')
                ->whereIn('order_id', DB::table('orders')->select('id')->where('status', $status))
                ->update(['status' => $status]);
        }

        // Pedidos que já passaram da fila não devem sofrer baixa retroativa de estoque
        DB::table('order_items')
            ->whereIn('order_id', DB::table('orders')->select('id')->whereNotIn('status', ['pending', 'canceled']))
            ->update(['stock_deducted_at' => DB::raw('COALESCE(updated_at, CURRENT_TIMESTAMP)')]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropColumn(['status', 'stock_deducted_at']);
        });
    }
};
