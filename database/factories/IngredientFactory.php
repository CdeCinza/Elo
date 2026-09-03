<?php

namespace Database\Factories;

use App\Models\Ingredient;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Ingredient>
 */
class IngredientFactory extends Factory
{
    protected $model = Ingredient::class;

    public function definition(): array
    {
        return [
            'name' => $this->faker->unique()->word(),
            'stock_qty' => $this->faker->randomFloat(3, 10, 100),
            'unit' => $this->faker->randomElement(['kg', 'g', 'unidade', 'litro']),
            'min_stock_alert' => 5.000,
        ];
    }
}
