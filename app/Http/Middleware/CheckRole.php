<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        // barra quem não tem o papel liberado pra essa rota
        if (! $user || ! $user->role || (! in_array($user->role->name, $roles) && ! in_array('*', $roles))) {
            return response()->json([
                'message' => 'Acesso negado. Permissão insuficiente para este recurso.',
            ], 403);
        }

        return $next($request);
    }
}
