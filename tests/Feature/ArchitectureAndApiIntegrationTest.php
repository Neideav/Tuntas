<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Goal;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ArchitectureAndApiIntegrationTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;
    protected string $token;
    protected array $headers;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create([
            'email' => 'architect@tuntas.test',
            'role' => 'student',
        ]);
        $this->token = $this->user->createToken('test_token')->plainTextToken;
        $this->headers = ['Authorization' => 'Bearer ' . $this->token];
    }

    /**
     * Test web root routing behavior:
     * - Web requests redirect (302) to frontend URL.
     * - API/JSON requests receive structured JSON metadata.
     */
    public function test_web_root_routes_correctly_between_browser_and_api(): void
    {
        // 1. Browser request
        $browserResponse = $this->get('/');
        $browserResponse->assertStatus(302);

        // 2. JSON API request
        $apiResponse = $this->getJson('/');
        $apiResponse->assertStatus(200)
            ->assertJsonPath('status', 'ok')
            ->assertJsonPath('system', 'Tuntas API')
            ->assertJsonPath('version', '2.0.0')
            ->assertJsonStructure(['status', 'system', 'version', 'frontend_url', 'timestamp']);
    }

    /**
     * Test Task Form Request validation and cross-tenant isolation.
     */
    public function test_store_task_request_validates_and_enforces_tenant_isolation(): void
    {
        $otherUser = User::factory()->create();
        $foreignProject = Project::create([
            'user_id' => $otherUser->id,
            'title' => 'Foreign Project',
        ]);

        // Attempt to create task linked to another user's project
        $response = $this->withHeaders($this->headers)->postJson('/api/v1/tasks', [
            'title' => 'Valid Task Title',
            'project_id' => $foreignProject->id,
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['project_id']);

        // Successfully create task with valid payload
        $successResponse = $this->withHeaders($this->headers)->postJson('/api/v1/tasks', [
            'title' => 'Valid Personal Task',
            'priority' => 'high',
            'status' => 'todo',
        ]);

        $successResponse->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.title', 'Valid Personal Task');
    }

    /**
     * Test Project Form Request validation.
     */
    public function test_store_project_request_validates_dates_and_attributes(): void
    {
        // Invalid: deadline before start_date
        $invalidDates = $this->withHeaders($this->headers)->postJson('/api/v1/projects', [
            'title' => 'Project with Inverted Dates',
            'start_date' => Carbon::now()->addDays(5)->toDateString(),
            'deadline' => Carbon::now()->toDateString(),
        ]);

        $invalidDates->assertStatus(422)
            ->assertJsonValidationErrors(['deadline']);

        // Valid project creation
        $validProject = $this->withHeaders($this->headers)->postJson('/api/v1/projects', [
            'title' => 'Valid Architecture Refactor Project',
            'status' => 'in_progress',
            'priority' => 'urgent',
            'start_date' => Carbon::today()->toDateString(),
            'deadline' => Carbon::today()->addMonths(1)->toDateString(),
        ]);

        $validProject->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.title', 'Valid Architecture Refactor Project');
    }

    /**
     * Test Goal Form Request validation and atomic transaction execution.
     */
    public function test_store_goal_request_validates_and_creates_atomically_with_key_results(): void
    {
        $payload = [
            'title' => 'Achieve 100% Code Quality',
            'type' => 'okr',
            'confidence_level' => 'high',
            'start_date' => Carbon::today()->toDateString(),
            'target_date' => Carbon::today()->addMonths(3)->toDateString(),
            'key_results' => [
                [
                    'title' => 'Zero Failing Unit Tests',
                    'target_value' => 100.0,
                    'current_value' => 100.0,
                    'unit' => '%',
                    'weight' => 2.0,
                ],
                [
                    'title' => 'Maintain 100% Type Safety',
                    'target_value' => 100.0,
                    'current_value' => 100.0,
                    'unit' => '%',
                    'weight' => 1.5,
                ],
            ],
        ];

        $response = $this->withHeaders($this->headers)->postJson('/api/v1/goals', $payload);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.title', 'Achieve 100% Code Quality');

        $this->assertDatabaseHas('goals', [
            'title' => 'Achieve 100% Code Quality',
            'user_id' => $this->user->id,
        ]);

        $this->assertDatabaseHas('goal_milestones', [
            'title' => 'Zero Failing Unit Tests',
        ]);
        $this->assertDatabaseHas('goal_milestones', [
            'title' => 'Maintain 100% Type Safety',
        ]);
    }

    /**
     * Test API response standardization across endpoints.
     */
    public function test_api_endpoints_return_standardized_envelope_and_metadata(): void
    {
        // 1. Paginated tasks
        $tasksRes = $this->withHeaders($this->headers)->getJson('/api/v1/tasks');
        $tasksRes->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data',
                'meta' => ['current_page', 'last_page', 'per_page', 'total'],
            ]);

        // 2. Dashboard metrics
        $dashRes = $this->withHeaders($this->headers)->getJson('/api/v1/dashboard');
        $dashRes->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'summary',
                    'today_tasks',
                    'upcoming_deadlines',
                    'active_projects',
                    'habits',
                    'goals',
                    'active_courses',
                    'weekly_productivity',
                ],
            ]);
    }
}
