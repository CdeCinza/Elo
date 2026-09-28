<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\CustomerSessionController;
use App\Http\Controllers\Api\IngredientController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\PosKdsController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\StripePaymentController;
use App\Http\Controllers\Api\SuperAdminController;
use App\Http\Controllers\Api\TableController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes - Elo Restaurant System
|--------------------------------------------------------------------------
*/

// Rotas Públicas de Autenticação e Cardápio
Route::post('/v1/auth/login', [AuthController::class, 'login']);

Route::get('/v1/categories', [CategoryController::class, 'index']);
Route::get('/v1/categories/{category}', [CategoryController::class, 'show']);

Route::get('/v1/products', [ProductController::class, 'index']);
Route::get('/v1/products/{product}', [ProductController::class, 'show']);

// Rotas Públicas do Cliente na Mesa (QR Code Salão)
Route::get('/v1/customer/tables', [CustomerSessionController::class, 'getTables']);
Route::get('/v1/customer/table/{tableNumber}', [CustomerSessionController::class, 'getTable']);
Route::post('/v1/customer/table/{tableNumber}/check-in', [PosKdsController::class, 'checkInTable']);
Route::post('/v1/customer/table/{tableNumber}/call-waiter', [PosKdsController::class, 'callWaiter']);
Route::post('/v1/customer/table/{tableNumber}/request-bill', [PosKdsController::class, 'requestBill']);
Route::post('/v1/customer/table/{tableNumber}/order', [CustomerSessionController::class, 'placeOrder']);

// Rotas Operacionais de Frente de Caixa (POS)
Route::middleware(['auth:sanctum', 'role:owner,restaurant_admin,manager,waiter,cashier,super_admin'])->group(function () {
    Route::get('/v1/pos/tables', [PosKdsController::class, 'getTables']);
    Route::post('/v1/pos/tables/{tableNumber}/open', [PosKdsController::class, 'openTable']);
    Route::post('/v1/pos/tables/{tableNumber}/items', [PosKdsController::class, 'addItemToTable']);
    Route::post('/v1/pos/tables/{tableNumber}/close', [PosKdsController::class, 'closeTable']);
    Route::post('/v1/pos/tables/{tableNumber}/clear-waiter', [PosKdsController::class, 'clearWaiterCall']);
});

// Gestão estrutural do salão pelo Caixa (somente gerência)
Route::middleware(['auth:sanctum', 'role:owner,restaurant_admin,manager,super_admin'])->group(function () {
    Route::post('/v1/pos/tables', [PosKdsController::class, 'storeTable']);
    Route::post('/v1/pos/tables/seed-defaults', [PosKdsController::class, 'seedDefaultTables']);
    Route::put('/v1/pos/tables/{tableNumber}', [PosKdsController::class, 'updateTable']);
    Route::delete('/v1/pos/tables/{tableNumber}', [PosKdsController::class, 'deleteTable']);
    Route::post('/v1/pos/tables/{tableNumber}/reset', [PosKdsController::class, 'resetTable']);
});

// Rotas de Pagamento Stripe (Online & Balcão)
Route::post('/v1/payments/stripe/create-intent', [StripePaymentController::class, 'createPaymentIntent']);
Route::post('/v1/payments/stripe/confirm', [StripePaymentController::class, 'confirmPayment']);
Route::post('/v1/payments/stripe/webhook', [StripePaymentController::class, 'handleWebhook']);

// Rotas Operacionais da Cozinha (KDS)
Route::middleware(['auth:sanctum', 'role:owner,restaurant_admin,manager,chef,super_admin'])->group(function () {
    Route::get('/v1/kds/orders', [PosKdsController::class, 'getKitchenOrders']);
    Route::patch('/v1/kds/orders/{order}/status', [PosKdsController::class, 'updateOrderStatus']);
});

// Rotas Protegidas por Autenticação (Sanctum)
Route::middleware('auth:sanctum')->prefix('v1')->group(function () {
    Route::post('/auth/register', [AuthController::class, 'register'])->middleware('role:owner,restaurant_admin,manager,super_admin');
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

    // Gestão de Restaurantes e Plataforma (Super Admin)
    Route::middleware('role:super_admin')->prefix('superadmin')->group(function () {
        Route::get('/metrics', [SuperAdminController::class, 'metrics']);
        Route::get('/restaurants', [SuperAdminController::class, 'index']);
        Route::post('/restaurants', [SuperAdminController::class, 'store']);
        Route::put('/restaurants/{id}', [SuperAdminController::class, 'update'])->whereNumber('id');
        Route::delete('/restaurants/{id}', [SuperAdminController::class, 'destroy'])->whereNumber('id');
    });
});
