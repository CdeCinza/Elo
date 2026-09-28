<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(RegisterRequest $request): JsonResponse
    {
        $actor = $request->user();
        $roleName = $request->input('role', 'waiter');
        $role = Role::where('name', $roleName)->firstOrFail();
        $restaurantId = $actor->isSuperAdmin()
            ? $request->integer('restaurant_id')
            : $actor->restaurant_id;

        if (! $restaurantId) {
            return response()->json(['message' => 'Selecione um restaurante para o novo usuário.'], 422);
        }

        if ($roleName === 'manager' && ! ($actor->isSuperAdmin() || $actor->isRestaurantAdmin())) {
            return response()->json(['message' => 'Permissão insuficiente para criar gerentes.'], 403);
        }

        $user = User::create([
            'restaurant_id' => $restaurantId,
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'role_id' => $role?->id,
        ]);

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'message' => 'Usuário cadastrado com sucesso.',
            'user' => new UserResource($user->load(['role', 'restaurant'])),
            'access_token' => $token,
            'token_type' => 'Bearer',
        ], 201);
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $user = User::where('email', $request->email)->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['As credenciais fornecidas são inválidas.'],
            ]);
        }

        if ($user->restaurant?->status === 'suspended') {
            return response()->json([
                'message' => 'Este restaurante está suspenso. Entre em contato com o suporte da plataforma.',
            ], 403);
        }

        $deviceName = $request->input('device_name', 'api_token');
        $token = $user->createToken($deviceName)->plainTextToken;

        return response()->json([
            'message' => 'Login realizado com sucesso.',
            'user' => new UserResource($user->load(['role', 'restaurant'])),
            'access_token' => $token,
            'token_type' => 'Bearer',
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'user' => new UserResource($request->user()->load(['role', 'restaurant'])),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Logout realizado e token revogado com sucesso.',
        ]);
    }
}
