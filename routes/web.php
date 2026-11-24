<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes — Tuntas Platform
|--------------------------------------------------------------------------
|
| Laravel serves strictly as the backend API for the Next.js frontend.
| Web requests hitting the root are gracefully redirected to the Next.js
| frontend application, or return JSON metadata if requesting API info.
|
*/

Route::get('/', function (Request $request) {
    if ($request->expectsJson() || $request->is('api/*')) {
        return response()->json([
            'status' => 'ok',
            'system' => 'Tuntas API',
            'version' => '2.0.0',
            'frontend_url' => config('app.frontend_url', 'http://localhost:3000'),
            'timestamp' => now()->toIso8601String(),
        ]);
    }

    return redirect(config('app.frontend_url', 'http://localhost:3000'));
});

// Fallback login route to safely handle framework auth redirects to the Next.js frontend
Route::get('/login', function () {
    return redirect(config('app.frontend_url', 'http://localhost:3000') . '/login');
})->name('login');
