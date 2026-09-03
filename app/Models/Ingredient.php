<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Ingredient extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'stock_qty',
        'unit',
        'min_stock_alert',
    ];

    protected $casts = [
        'stock_qty' => 'decimal:3',
        'min_stock_alert' => 'decimal:3',
    ];

    public function products(): BelongsToMany
    {
        return $this->belongsToMany(Product::class, 'product_ingredients')
            ->withPivot('qty_used')
            ->withTimestamps();
    }
}
