<?php

namespace Database\Factories;

use App\Models\Restaurant;
use App\Models\RestaurantTable;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<RestaurantTable>
 */
class RestaurantTableFactory extends Factory
{
    protected $model = RestaurantTable::class;

    public function definition(): array
    {
        return [
            'restaurant_id' => Restaurant::first()?->id ?? Restaurant::factory(),
            'number' => 'Mesa '.$this->faker->unique()->numberBetween(1, 100),
            'capacity' => $this->faker->randomElement([2, 4, 6, 8]),
            'status' => 'free',
        ];
    }
}
