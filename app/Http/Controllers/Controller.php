<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

abstract class Controller
{
    /**
     * Tamanho de página seguro: valores inválidos voltam ao padrão e há um teto por requisição.
     */
    protected function perPage(Request $request, int $max = 100, int $default = 15): int
    {
        $perPage = filter_var($request->input('per_page'), FILTER_VALIDATE_INT);

        return $perPage === false || $perPage < 1 ? $default : min($perPage, $max);
    }
}
