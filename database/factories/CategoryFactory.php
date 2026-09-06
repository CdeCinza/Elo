<?php

namespace Database\Factories;

use App\Models\Category;
use App\Models\Restaurant;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Category>
 */
class CategoryFactory extends Factory
{
    protected $model = Category::class;

    public function definition(): array
    {
        return [
            'restaurant_id' => Restaurant::first()?->id ?? Restaurant::factory(),
            'name' => $this->faker->words(2, true),
            'description' => $this->faker->sentence(),
            'is_active' => true,
        ];
    }
}
