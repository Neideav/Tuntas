<?php

namespace Tests\Feature;

// use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    /**
     * Test that root route redirects guests to todos (which redirects to login).
     */
    public function test_root_route_redirects(): void
    {
        $response = $this->get('/');

        $response->assertStatus(302);
    }

    /**
     * Test that API health check endpoint returns success.
     */
    public function test_api_health_endpoint_returns_ok(): void
    {
        $response = $this->getJson('/api/v1/health');

        $response->assertStatus(200)
                 ->assertJson(['status' => 'ok']);
    }
}
