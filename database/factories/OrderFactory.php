<?php

namespace Database\Factories;

use App\Models\Order;
use App\Models\Restaurant;
use App\Models\RestaurantTable;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Order>
 */
class OrderFactory extends Factory
{
    protected $model = Order::class;

    public function definition(): array
    {
        return [
            'restaurant_id' => Restaurant::first()?->id ?? Restaurant::factory(),
            'table_id' => RestaurantTable::factory(),
            'user_id' => User::factory(),
            'type' => 'dine_in',
            'status' => 'pending',
            'subtotal' => 50.00,
            'delivery_fee' => 0.00,
            'discount' => 0.00,
            'total' => 50.00,
        ];
    }
}
