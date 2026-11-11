<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Examination;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TuntasApiTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create([
            'email' => 'user@tuntas.test',
            'role' => 'student',
        ]);
    }

    public function test_api_health_check(): void
    {
        $response = $this->getJson('/api/v1/health');

        $response->assertStatus(200)
                 ->assertJson(['status' => 'ok']);
    }

    public function test_user_can_register(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Budi Santoso',
            'email' => 'budi@tuntas.test',
            'password' => 'SecurePass123!',
            'password_confirmation' => 'SecurePass123!',
        ]);

        $response->assertStatus(201)
                 ->assertJsonPath('success', true)
                 ->assertJsonStructure(['data' => ['user', 'token']]);
    }

    public function test_user_can_login(): void
    {
        $user = User::factory()->create([
            'email' => 'login@tuntas.test',
            'password' => bcrypt('Password123!'),
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'login@tuntas.test',
            'password' => 'Password123!',
        ]);

        $response->assertStatus(200)
                 ->assertJsonPath('success', true)
                 ->assertJsonStructure(['data' => ['token']]);
    }

    public function test_user_can_create_and_manage_tasks(): void
    {
        // 1. Create task
        $response = $this->actingAs($this->user)->postJson('/api/v1/tasks', [
            'title' => 'Selesaikan Bab 3 PostgreSQL',
            'description' => 'Membaca indexing dan VACUUM',
            'status' => 'todo',
            'priority' => 'high',
            'due_date' => now()->addDays(2)->toIso8601String(),
            'subtasks' => [
                ['title' => 'Baca dokumentasi'],
                ['title' => 'Coba EXPLAIN ANALYZE'],
            ],
        ]);

        $response->assertStatus(201)
                 ->assertJsonPath('success', true)
                 ->assertJsonPath('data.title', 'Selesaikan Bab 3 PostgreSQL');

        $taskId = $response->json('data.id');

        // 2. Toggle status
        $toggleResponse = $this->actingAs($this->user)->patchJson("/api/v1/tasks/{$taskId}/toggle");
        $toggleResponse->assertStatus(200)
                       ->assertJsonPath('data.status', 'completed');

        // 3. List tasks
        $listResponse = $this->actingAs($this->user)->getJson('/api/v1/tasks');
        $listResponse->assertStatus(200)
                     ->assertJsonPath('success', true);
    }

    public function test_user_can_manage_projects(): void
    {
        $response = $this->actingAs($this->user)->postJson('/api/v1/projects', [
            'title' => 'Redesign Platform Tuntas',
            'description' => 'Migrasi ke Next.js dan Laravel',
            'status' => 'in_progress',
            'priority' => 'urgent',
            'deadline' => now()->addMonth()->toDateString(),
        ]);

        $response->assertStatus(201)
                 ->assertJsonPath('success', true)
                 ->assertJsonPath('data.title', 'Redesign Platform Tuntas');
    }

    public function test_dedicated_examination_system(): void
    {
        // Test Dedicated Examination Subsystem
        $response = $this->actingAs($this->user)->postJson('/api/v1/examinations', [
            'title' => 'Sertifikasi AWS Cloud Practitioner',
            'subject' => 'Cloud Computing',
            'examination_date' => now()->addWeeks(2)->toDateString(),
            'duration_minutes' => 90,
            'passing_score' => 70,
            'status' => 'preparing',
            'preparations' => [
                ['title' => 'Mock Exam 1'],
                ['title' => 'Review IAM Policy'],
            ],
        ]);

        $response->assertStatus(201)
                 ->assertJsonPath('success', true)
                 ->assertJsonPath('data.subject', 'Cloud Computing');

        $examId = $response->json('data.id');

        // Verify exam details
        $showResponse = $this->actingAs($this->user)->getJson("/api/v1/examinations/{$examId}");
        $showResponse->assertStatus(200)
                     ->assertJsonPath('data.title', 'Sertifikasi AWS Cloud Practitioner');
    }

    public function test_dashboard_metrics_aggregation(): void
    {
        Task::factory()->create([
            'user_id' => $this->user->id,
            'title' => 'Task Test',
            'status' => 'completed',
            'completed_at' => now(),
        ]);

        $response = $this->actingAs($this->user)->getJson('/api/v1/dashboard');

        $response->assertStatus(200)
                 ->assertJsonPath('success', true)
                 ->assertJsonStructure([
                     'data' => [
                         'summary' => [
                             'total_tasks',
                             'completed_tasks',
                             'pending_tasks',
                             'completion_rate',
                         ],
                         'weekly_productivity',
                     ],
                 ]);
    }
}

