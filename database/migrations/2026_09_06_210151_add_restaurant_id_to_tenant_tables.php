<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $tables = [
            'users',
            'restaurant_tables',
            'categories',
            'products',
            'ingredients',
            'orders',
            'activity_logs',
        ];

        foreach ($tables as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->foreignId('restaurant_id')
                    ->nullable()
                    ->after('id')
                    ->constrained('restaurants')
                    ->cascadeOnDelete();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $tables = [
            'activity_logs',
            'orders',
            'ingredients',
            'products',
            'categories',
            'restaurant_tables',
            'users',
        ];

        foreach ($tables as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->dropForeign(['restaurant_id']);
                $table->dropColumn('restaurant_id');
            });
        }
    }
};
