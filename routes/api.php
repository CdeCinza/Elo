<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\CustomerSessionController;
use App\Http\Controllers\Api\IngredientController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\PosKdsController;
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

// Rotas Públicas do Cliente na Mesa (QR Code Salão)
Route::get('/v1/customer/table/{tableNumber}', [CustomerSessionController::class, 'getTable']);
Route::post('/v1/customer/table/{tableNumber}/check-in', [PosKdsController::class, 'checkInTable']);
Route::post('/v1/customer/table/{tableNumber}/call-waiter', [PosKdsController::class, 'callWaiter']);
Route::post('/v1/customer/table/{tableNumber}/request-bill', [PosKdsController::class, 'requestBill']);
Route::post('/v1/customer/table/{tableNumber}/order', [CustomerSessionController::class, 'placeOrder']);

// Rotas Operacionais de Frente de Caixa (POS)
Route::get('/v1/pos/tables', [PosKdsController::class, 'getTables']);
Route::post('/v1/pos/tables', [PosKdsController::class, 'storeTable']);
Route::put('/v1/pos/tables/{tableNumber}', [PosKdsController::class, 'updateTable']);
Route::delete('/v1/pos/tables/{tableNumber}', [PosKdsController::class, 'deleteTable']);
Route::post('/v1/pos/tables/seed-defaults', [PosKdsController::class, 'seedDefaultTables']);
Route::post('/v1/pos/tables/{tableNumber}/open', [PosKdsController::class, 'openTable']);
Route::post('/v1/pos/tables/{tableNumber}/items', [PosKdsController::class, 'addItemToTable']);
Route::post('/v1/pos/tables/{tableNumber}/close', [PosKdsController::class, 'closeTable']);
Route::post('/v1/pos/tables/{tableNumber}/clear-waiter', [PosKdsController::class, 'clearWaiterCall']);
Route::post('/v1/pos/tables/{tableNumber}/reset', [PosKdsController::class, 'resetTable']);

// Rotas Operacionais da Cozinha (KDS)
Route::get('/v1/kds/orders', [PosKdsController::class, 'getKitchenOrders']);
Route::patch('/v1/kds/orders/{order}/status', [PosKdsController::class, 'updateOrderStatus']);

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

    // Pedidos & Máquina de Estados (Salão, Delivery, Balcão)
    Route::post('/orders/{order}/items', [OrderController::class, 'addItem']);
    Route::patch('/orders/{order}/status', [OrderController::class, 'updateStatus']);
    Route::apiResource('/orders', OrderController::class)->except(['destroy']);

    // Gestão de Insumos & Estoque
    Route::apiResource('/ingredients', IngredientController::class);
});
