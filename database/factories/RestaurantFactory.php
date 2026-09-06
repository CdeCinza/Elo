<?php

namespace Database\Factories;

use App\Models\Restaurant;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Restaurant>
 */
class RestaurantFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $name = $this->faker->company().' Gastronomia';

        return [
            'name' => $name,
            'slug' => Str::slug($name).'-'.$this->faker->unique()->numberBetween(1, 9999),
            'document' => $this->faker->numerify('##.###.###/0001-##'),
            'phone' => $this->faker->phoneNumber(),
            'address' => $this->faker->address(),
            'status' => 'active',
            'settings' => [
                'service_tax_percent' => 10,
                'currency' => 'BRL',
            ],
        ];
    }
}
