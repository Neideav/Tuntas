<?php

namespace Tests\Feature;

use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class ProductionSecurityAndHardeningTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create([
            'email' => 'victim@tuntas.test',
            'role' => 'student',
        ]);
    }

    /**
     * 1. Invalid Bearer Token is strictly rejected with 401.
     */
    public function test_invalid_bearer_token_is_rejected(): void
    {
        $response = $this->withHeaders([
            'Authorization' => 'Bearer invalid_garbage_token_12345',
            'Accept' => 'application/json',
        ])->getJson('/api/v1/auth/me');

        $response->assertStatus(401)
            ->assertJson([
                'success' => false,
            ]);
    }

    /**
     * 2. Production Security Headers are attached to responses.
     */
    public function test_security_headers_are_present_in_responses(): void
    {
        $response = $this->get('/api/v1/health');

        $response->assertStatus(200);
        $response->assertHeader('X-Content-Type-Options', 'nosniff');
        $response->assertHeader('X-Frame-Options', 'SAMEORIGIN');
        $response->assertHeader('X-XSS-Protection', '1; mode=block');
        $response->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        $response->assertHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    }

    /**
     * 3. CORS preflight and allowed origins configuration.
     */
    public function test_cors_preflight_and_allowed_origins(): void
    {
        // Allowed origin preflight OPTIONS request
        $response = $this->withHeaders([
            'Origin' => 'http://localhost:3000',
            'Access-Control-Request-Method' => 'POST',
            'Access-Control-Request-Headers' => 'Content-Type, Authorization',
        ])->optionsJson('/api/v1/auth/login');

        $response->assertStatus(204);
        $response->assertHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
        $response->assertHeader('Access-Control-Allow-Credentials', 'true');
    }

    /**
     * 4. Rate Limiter blocks excessive login brute-force attempts.
     */
    public function test_rate_limiter_throttles_excessive_login_attempts(): void
    {
        for ($i = 0; $i < 10; $i++) {
            $this->postJson('/api/v1/auth/login', [
                'email' => 'victim@tuntas.test',
                'password' => 'wrong-password',
            ]);
        }

        // 11th request must be throttled with HTTP 429 Too Many Requests
        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'victim@tuntas.test',
            'password' => 'wrong-password',
        ]);

        $response->assertStatus(429);
    }

    /**
     * 5. Mass assignment attack to escalate role is blocked.
     */
    public function test_mass_assignment_privilege_escalation_is_blocked(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Hacker User',
            'email' => 'hacker@tuntas.test',
            'password' => 'SecurePass123!',
            'password_confirmation' => 'SecurePass123!',
            'role' => 'admin', // Attempted privilege escalation
        ]);

        $response->assertStatus(201);

        $registeredUser = User::where('email', 'hacker@tuntas.test')->first();
        $this->assertNotNull($registeredUser);
        // Ensure role remained 'student', ignoring injected 'admin'
        $this->assertEquals('student', $registeredUser->role);
    }

    /**
     * 6. Password reset token expiry and one-time consumption.
     */
    public function test_password_reset_token_cannot_be_reused(): void
    {
        $plainToken = Str::random(64);

        DB::table('password_reset_tokens')->insert([
            'email' => $this->user->email,
            'token' => Hash::make($plainToken),
            'created_at' => Carbon::now(),
        ]);

        // First reset must succeed
        $response = $this->postJson('/api/v1/auth/reset-password', [
            'email' => $this->user->email,
            'token' => $plainToken,
            'password' => 'BrandNewPassword123!',
            'password_confirmation' => 'BrandNewPassword123!',
        ]);

        $response->assertStatus(200);

        // Second reset with the same token must fail (consumed / invalidated)
        $replayResponse = $this->postJson('/api/v1/auth/reset-password', [
            'email' => $this->user->email,
            'token' => $plainToken,
            'password' => 'AnotherNewPassword123!',
            'password_confirmation' => 'AnotherNewPassword123!',
        ]);

        $replayResponse->assertStatus(422);
    }

    /**
     * 7. Expired password reset token is rejected.
     */
    public function test_expired_password_reset_token_is_rejected(): void
    {
        $plainToken = Str::random(64);

        DB::table('password_reset_tokens')->insert([
            'email' => $this->user->email,
            'token' => Hash::make($plainToken),
            'created_at' => Carbon::now()->subMinutes(61), // Expired (> 60 minutes)
        ]);

        $response = $this->postJson('/api/v1/auth/reset-password', [
            'email' => $this->user->email,
            'token' => $plainToken,
            'password' => 'NewPassword123!',
            'password_confirmation' => 'NewPassword123!',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['token']);
    }
}
