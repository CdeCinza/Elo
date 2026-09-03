<?php

namespace Database\Factories;

use App\Models\Order;
use App\Models\Payment;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Payment>
 */
class PaymentFactory extends Factory
{
    protected $model = Payment::class;

    public function definition(): array
    {
        return [
            'order_id' => Order::factory(),
            'transaction_id' => 'TX_'.$this->faker->unique()->uuid(),
            'method' => 'pix',
            'status' => 'paid',
            'amount' => 50.00,
            'paid_at' => now(),
        ];
    }
}
