<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\TableController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes - Elo Restaurant System
|--------------------------------------------------------------------------
*/

// Rotas Públicas de Autenticação e Cardápio
Route::post('/v1/auth/register', [AuthController::class, 'register']);
Route::post('/v1/auth/login', [AuthController::class, 'login']);

Route::get('/v1/categories', [CategoryController::class, 'index']);
Route::get('/v1/categories/{category}', [CategoryController::class, 'show']);

Route::get('/v1/products', [ProductController::class, 'index']);
Route::get('/v1/products/{product}', [ProductController::class, 'show']);

// Rotas Protegidas por Autenticação (Sanctum)
Route::middleware('auth:sanctum')->prefix('v1')->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    // CRUD de Cardápio (Escrita/Alteração)
    Route::apiResource('/categories', CategoryController::class)->except(['index', 'show']);
    Route::apiResource('/products', ProductController::class)->except(['index', 'show']);

    // Gestão de Mesas e Abertura de Comandas do Salão
    Route::post('/tables/{table}/open-tab', [TableController::class, 'openTab']);
    Route::apiResource('/tables', TableController::class);
});
