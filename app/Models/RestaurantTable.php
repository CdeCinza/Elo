<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class RestaurantTable extends Model
{
    use HasFactory;

    protected $fillable = [
        'number',
        'capacity',
        'status',
    ];

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class, 'table_id');
    }

    public function activeOrder(): HasOne
    {
        return $this->hasOne(Order::class, 'table_id')
            ->whereNotIn('status', ['delivered', 'canceled'])
            ->latestOfMany();
    }
}
