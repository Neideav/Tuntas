<?php

$envOrigins = env('CORS_ALLOWED_ORIGINS');
$configuredOrigins = $envOrigins
    ? array_map('trim', explode(',', $envOrigins))
    : [
        env('FRONTEND_URL'),
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:3001',
    ];

// Wildcard '*' is strictly prohibited by browser security specifications when supports_credentials is true
$allowedOrigins = array_values(array_unique(array_filter($configuredOrigins, function ($origin) {
    return !empty($origin) && $origin !== '*';
})));

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => $allowedOrigins,

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 86400,

    'supports_credentials' => true,

];
