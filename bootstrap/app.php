<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withKernels()
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Integrate TRUSTED_PROXIES with Laravel 11/12 trustProxies mechanism
        $trustedProxies = env('TRUSTED_PROXIES');
        if ($trustedProxies) {
            $proxies = $trustedProxies === '*'
                ? '*'
                : array_map('trim', explode(',', $trustedProxies));
            $middleware->trustProxies(at: $proxies);
        }

        // Attach security headers to all responses
        $middleware->append(\App\Http\Middleware\SecurityHeadersMiddleware::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (\Illuminate\Auth\AuthenticationException $e, $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthenticated or session expired.',
                ], 401);
            }
        });

        $exceptions->render(function (\Illuminate\Database\Eloquent\ModelNotFoundException $e, $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Resource not found or unauthorized access.',
                ], 404);
            }
        });

        $exceptions->render(function (\Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException $e, $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => $e->getMessage() ?: 'Unauthorized access.',
                ], 403);
            }
        });

        $exceptions->render(function (\Throwable $e, $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                if ($e instanceof \Illuminate\Validation\ValidationException) {
                    return null;
                }
                if ($e instanceof \Symfony\Component\HttpKernel\Exception\HttpExceptionInterface) {
                    return response()->json([
                        'success' => false,
                        'message' => $e->getMessage() ?: 'An error occurred.',
                    ], $e->getStatusCode());
                }
                if (!config('app.debug')) {
                    return response()->json([
                        'success' => false,
                        'message' => 'An internal server error occurred.',
                    ], 500);
                }
            }
        });
    })->create();
