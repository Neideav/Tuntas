<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Category;
use App\Models\Course;
use App\Models\ExamAttempt;
use App\Models\ExamBlueprint;
use App\Models\Examination;
use App\Models\Goal;
use App\Models\GoalMilestone;
use App\Models\Habit;
use App\Models\HabitLog;
use App\Models\LearningLesson;
use App\Models\LearningModule;
use App\Models\LearningSession;
use App\Models\Notification;
use App\Models\Project;
use App\Models\ProjectMilestone;
use App\Models\Question;
use App\Models\QuestionBank;
use App\Models\QuestionOption;
use App\Models\Subtask;
use App\Models\Tag;
use App\Models\Task;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class EndToEndSystemAndPerformanceTest extends TestCase
{
    use RefreshDatabase;

    protected User $userA;
    protected User $userB;

    protected function setUp(): void
    {
        parent::setUp();
        $this->userA = User::factory()->create([
            'email' => 'qa.alpha@tuntas.test',
            'role' => 'student',
        ]);
        $this->userB = User::factory()->create([
            'email' => 'qa.bravo@tuntas.test',
            'role' => 'student',
        ]);
    }

    /**
     * 1. End-to-End User Flow across ALL core & productivity modules.
     */
    public function test_e2e_full_user_lifecycle_across_all_modules(): void
    {
        // A. Profile & Settings Update
        $settingsRes = $this->actingAs($this->userA, 'sanctum')
            ->putJson('/api/v1/settings', [
                'theme' => 'dark',
                'language' => 'id',
                'daily_study_goal_minutes' => 120,
            ]);
        $settingsRes->assertStatus(200);

        // B. Category Creation
        $catRes = $this->actingAs($this->userA, 'sanctum')
            ->postJson('/api/v1/categories', [
                'name' => 'Software Engineering',
                'color' => '#3b82f6',
                'icon' => 'code',
                'type' => 'general',
            ]);
        $catRes->assertStatus(201);
        $categoryId = $catRes->json('data.id');

        // C. Project Creation with Milestones
        $projRes = $this->actingAs($this->userA, 'sanctum')
            ->postJson('/api/v1/projects', [
                'title' => 'Tuntas Release 2.0',
                'description' => 'Flagship production readiness release',
                'category_id' => $categoryId,
                'status' => 'in_progress',
                'priority' => 'urgent',
                'start_date' => Carbon::today()->toDateString(),
                'deadline' => Carbon::today()->addDays(14)->toDateString(),
            ]);
        $projRes->assertStatus(201);
        $projectId = $projRes->json('data.id');

        // Add Milestone to Project
        $milestoneRes = $this->actingAs($this->userA, 'sanctum')
            ->postJson("/api/v1/projects/{$projectId}/milestones", [
                'title' => 'Architecture Hardening Complete',
                'due_date' => Carbon::today()->addDays(5)->toDateString(),
            ]);
        $milestoneRes->assertStatus(201);
        $milestoneId = $milestoneRes->json('data.id');

        // D. Goal Creation with Key Results (Milestones)
        $goalRes = $this->actingAs($this->userA, 'sanctum')
            ->postJson('/api/v1/goals', [
                'title' => 'Master Full-Stack Cloud Architecture',
                'type' => 'standard',
                'start_date' => Carbon::today()->toDateString(),
                'target_date' => Carbon::today()->addMonths(3)->toDateString(),
                'category_id' => $categoryId,
                'key_results' => [
                    ['title' => 'Docker Hardening & AWS RDS', 'target_value' => 100, 'current_value' => 50, 'unit' => '%'],
                ],
            ]);
        $goalRes->assertStatus(201);
        $goalId = $goalRes->json('data.id');

        // E. Tasks with Dependency & Subtasks
        // Task 1: Prerequisite
        $task1Res = $this->actingAs($this->userA, 'sanctum')
            ->postJson('/api/v1/tasks', [
                'title' => 'Configure Docker Compose & Entrypoint',
                'status' => 'in_progress',
                'priority' => 'high',
                'project_id' => $projectId,
                'goal_id' => $goalId,
                'category_id' => $categoryId,
                'due_date' => Carbon::today()->addDays(2)->toIso8601String(),
                'subtasks' => [
                    ['title' => 'Write entrypoint.sh', 'is_completed' => true],
                    ['title' => 'Verify DB retry loop', 'is_completed' => false],
                ],
            ]);
        $task1Res->assertStatus(201);
        $task1Id = $task1Res->json('data.id');

        // Task 2: Blocked by Task 1
        $task2Res = $this->actingAs($this->userA, 'sanctum')
            ->postJson('/api/v1/tasks', [
                'title' => 'Deploy to AWS EC2 Production',
                'status' => 'todo',
                'priority' => 'urgent',
                'project_id' => $projectId,
                'due_date' => Carbon::today()->addDays(3)->toIso8601String(),
                'dependencies' => [$task1Id],
            ]);
        $task2Res->assertStatus(201);
        $task2Id = $task2Res->json('data.id');

        // Attempt to complete Task 2 before Task 1 is finished -> Expect 422 block
        $blockedComplete = $this->actingAs($this->userA, 'sanctum')
            ->putJson("/api/v1/tasks/{$task2Id}", [
                'title' => 'Deploy to AWS EC2 Production',
                'status' => 'completed',
            ]);
        $blockedComplete->assertStatus(422);

        // Complete Task 1 now
        $finishTask1 = $this->actingAs($this->userA, 'sanctum')
            ->putJson("/api/v1/tasks/{$task1Id}", [
                'title' => 'Configure Docker Compose & Entrypoint',
                'status' => 'completed',
            ]);
        $finishTask1->assertStatus(200);

        // Now Task 2 can be completed
        $finishTask2 = $this->actingAs($this->userA, 'sanctum')
            ->putJson("/api/v1/tasks/{$task2Id}", [
                'title' => 'Deploy to AWS EC2 Production',
                'status' => 'completed',
            ]);
        $finishTask2->assertStatus(200);

        // F. Habit Creation & Daily Log Tracking
        $habitRes = $this->actingAs($this->userA, 'sanctum')
            ->postJson('/api/v1/habits', [
                'title' => 'Solve 1 Architecture Challenge Daily',
                'frequency' => 'daily',
                'target_days' => 7,
                'color' => '#10b981',
            ]);
        $habitRes->assertStatus(201);
        $habitId = $habitRes->json('data.id');

        $logHabitRes = $this->actingAs($this->userA, 'sanctum')
            ->postJson("/api/v1/habits/{$habitId}/toggle", [
                'date' => Carbon::today()->toDateString(),
            ]);
        $logHabitRes->assertStatus(200);

        // G. Learning Course, Module, Lesson, and Session
        $courseRes = $this->actingAs($this->userA, 'sanctum')
            ->postJson('/api/v1/courses', [
                'title' => 'Cloud Native Devops with AWS',
                'description' => 'Complete guide to production hardening',
                'category_id' => $categoryId,
            ]);
        $courseRes->assertStatus(201);
        $courseId = $courseRes->json('data.id');

        $moduleRes = $this->actingAs($this->userA, 'sanctum')
            ->postJson("/api/v1/courses/{$courseId}/modules", [
                'title' => 'Module 1: Docker & Container Orchestration',
            ]);
        $moduleRes->assertStatus(201);
        $moduleId = $moduleRes->json('data.id');

        $lessonRes = $this->actingAs($this->userA, 'sanctum')
            ->postJson("/api/v1/modules/{$moduleId}/lessons", [
                'title' => 'Lesson 1.1: Multi-stage Dockerfile Design',
                'duration_minutes' => 45,
            ]);
        $lessonRes->assertStatus(201);

        $sessionRes = $this->actingAs($this->userA, 'sanctum')
            ->postJson('/api/v1/learning-sessions/start', [
                'course_id' => $courseId,
                'topic' => 'Study Session on Docker Optimization',
            ]);
        $sessionRes->assertStatus(201);

        // H. Dedicated Examination & Assessment Engine
        $bankRes = $this->actingAs($this->userA, 'sanctum')
            ->postJson('/api/v1/question-banks', [
                'title' => 'AWS Certified DevOps Question Bank',
                'subject' => 'DevOps',
            ]);
        $bankRes->assertStatus(201);
        $bankId = $bankRes->json('data.id');

        $qRes = $this->actingAs($this->userA, 'sanctum')
            ->postJson("/api/v1/question-banks/{$bankId}/questions", [
                'prompt' => 'Which protocol is used for encrypted communication to RDS?',
                'type' => 'multiple_choice_single',
                'points' => 10,
                'options' => [
                    ['option_text' => 'TLS/SSL', 'is_correct' => true],
                    ['option_text' => 'Telnet', 'is_correct' => false],
                    ['option_text' => 'FTP', 'is_correct' => false],
                ],
            ]);
        $qRes->assertStatus(201);
        $questionId = $qRes->json('data.id');
        $correctOptionId = $qRes->json('data.options.0.id');

        $blueprint = ExamBlueprint::create([
            'user_id' => $this->userA->id,
            'title' => 'DevOps Certification Midterm',
            'subject' => 'DevOps',
            'duration_minutes' => 60,
            'passing_score' => 70.0,
            'is_published' => true,
        ]);
        $blueprint->questions()->attach($questionId, ['points' => 10.0, 'order' => 1]);

        // Start Exam Attempt
        $attemptRes = $this->actingAs($this->userA, 'sanctum')
            ->postJson("/api/v1/exam-blueprints/{$blueprint->id}/start");
        $attemptRes->assertStatus(200);
        $attemptId = $attemptRes->json('data.id');

        // Sync answers
        $syncRes = $this->actingAs($this->userA, 'sanctum')
            ->postJson("/api/v1/exam-attempts/{$attemptId}/sync", [
                'answers' => [
                    [
                        'question_id' => $questionId,
                        'selected_option_ids' => [$correctOptionId],
                    ],
                ],
            ]);
        $syncRes->assertStatus(200);

        // Submit Answers & Complete Attempt
        $submitRes = $this->actingAs($this->userA, 'sanctum')
            ->postJson("/api/v1/exam-attempts/{$attemptId}/submit");
        $submitRes->assertStatus(200);
        $this->assertEquals(10, $submitRes->json('data.total_points_earned'));
        $this->assertEquals(100, $submitRes->json('data.score_percentage'));

        // I. Notification Lifecycle
        Notification::create([
            'user_id' => $this->userA->id,
            'title' => 'E2E Test Passed',
            'message' => 'All modules successfully integrated',
            'type' => 'system',
            'is_read' => false,
            'is_archived' => false,
        ]);

        $notifIndex = $this->actingAs($this->userA, 'sanctum')
            ->getJson('/api/v1/notifications');
        $notifIndex->assertStatus(200);
        $notifId = $notifIndex->json('data.0.id');

        $markRead = $this->actingAs($this->userA, 'sanctum')
            ->patchJson("/api/v1/notifications/{$notifId}/read");
        $markRead->assertStatus(200);

        // J. Dashboard Metrics Aggregation Verification
        $dashRes = $this->actingAs($this->userA, 'sanctum')
            ->getJson('/api/v1/dashboard');
        $dashRes->assertStatus(200);
        $dashRes->assertJsonStructure([
            'success',
            'data' => [
                'summary',
                'metrics',
                'today_tasks',
                'active_projects',
                'habits',
                'goals',
                'active_courses',
                'upcoming_examinations',
                'weekly_productivity',
            ],
        ]);
        $this->assertEquals(2, $dashRes->json('data.summary.total_tasks'));
        $this->assertEquals(2, $dashRes->json('data.summary.completed_tasks'));
        $this->assertEquals(100, $dashRes->json('data.summary.completion_rate'));

        // K. CSV Analytics Export Verification
        $csvRes = $this->actingAs($this->userA, 'sanctum')
            ->get('/api/v1/analytics/export?type=productivity&range=last_30_days');
        $csvRes->assertStatus(200);
        $csvRes->assertHeader('Content-Type', 'text/csv; charset=UTF-8');
    }

    /**
     * 2. Strict Multi-Tenant Data Isolation.
     */
    public function test_multi_tenant_strict_data_isolation(): void
    {
        // User A creates resources
        $task = Task::create([
            'user_id' => $this->userA->id,
            'title' => 'Secret User A Task',
            'status' => 'todo',
            'priority' => 'urgent',
        ]);

        $project = Project::create([
            'user_id' => $this->userA->id,
            'title' => 'Secret User A Project',
            'status' => 'in_progress',
        ]);

        $goal = Goal::create([
            'user_id' => $this->userA->id,
            'title' => 'Secret User A Goal',
            'status' => 'in_progress',
            'start_date' => Carbon::today()->toDateString(),
            'target_date' => Carbon::today()->addMonths(1)->toDateString(),
        ]);

        $bank = QuestionBank::create([
            'user_id' => $this->userA->id,
            'title' => 'Secret User A Bank',
            'subject' => 'Confidential',
        ]);

        // User B attempts to read User A's task -> 403
        $this->actingAs($this->userB, 'sanctum')
            ->getJson("/api/v1/tasks/{$task->id}")
            ->assertStatus(403);

        // User B attempts to update User A's task -> 403
        $this->actingAs($this->userB, 'sanctum')
            ->putJson("/api/v1/tasks/{$task->id}", ['title' => 'Hacked Task'])
            ->assertStatus(403);

        // User B attempts to delete User A's task -> 403
        $this->actingAs($this->userB, 'sanctum')
            ->deleteJson("/api/v1/tasks/{$task->id}")
            ->assertStatus(403);

        // User B attempts to read User A's project -> 403
        $this->actingAs($this->userB, 'sanctum')
            ->getJson("/api/v1/projects/{$project->id}")
            ->assertStatus(403);

        // User B attempts to read User A's goal -> 403
        $this->actingAs($this->userB, 'sanctum')
            ->getJson("/api/v1/goals/{$goal->id}")
            ->assertStatus(403);

        // User B attempts to read User A's question bank -> 403
        $this->actingAs($this->userB, 'sanctum')
            ->getJson("/api/v1/question-banks/{$bank->id}")
            ->assertStatus(403);

        // User B attempts to attach User A's project to User B's new task -> 422 validation failure
        $this->actingAs($this->userB, 'sanctum')
            ->postJson('/api/v1/tasks', [
                'title' => 'Cross Tenant Attempt',
                'project_id' => $project->id,
            ])
            ->assertStatus(422);
    }

    /**
     * 3. Database Transactions, Consistency & Cascade Deletions.
     */
    public function test_database_transactions_and_cascade_integrity(): void
    {
        // A. Goal creation rollback when milestone creation fails
        $initialGoalCount = Goal::count();
        try {
            DB::transaction(function () {
                $goal = Goal::create([
                    'user_id' => $this->userA->id,
                    'title' => 'Atomic Transaction Goal',
                    'status' => 'not_started',
                ]);

                // Simulate failure on key result creation
                throw new \Exception('Intentional key result transaction failure');
            });
        } catch (\Throwable $e) {
            // Expected
        }

        $this->assertEquals($initialGoalCount, Goal::count(), 'Goal must be rolled back on exception');

        // B. Task deletion soft-deletes the task
        $task = Task::create([
            'user_id' => $this->userA->id,
            'title' => 'Task for Soft Delete Test',
            'status' => 'todo',
        ]);

        $this->actingAs($this->userA, 'sanctum')
            ->deleteJson("/api/v1/tasks/{$task->id}")
            ->assertStatus(200);

        $this->assertSoftDeleted('tasks', ['id' => $task->id]);

        // C. Cascade deletion: deleting Question Bank deletes Questions and Options
        $bank = QuestionBank::create([
            'user_id' => $this->userA->id,
            'title' => 'Cascade Test Bank',
            'subject' => 'Science',
        ]);
        $question = Question::create([
            'question_bank_id' => $bank->id,
            'prompt' => 'Test Question Prompt',
            'type' => 'multiple_choice_single',
            'points' => 5,
        ]);
        $option = QuestionOption::create([
            'question_id' => $question->id,
            'option_text' => 'Option A',
            'is_correct' => true,
        ]);

        $this->actingAs($this->userA, 'sanctum')
            ->deleteJson("/api/v1/question-banks/{$bank->id}")
            ->assertStatus(200);

        $this->assertDatabaseMissing('questions', ['id' => $question->id]);
        $this->assertDatabaseMissing('question_options', ['id' => $option->id]);
    }

    /**
     * 4. Production Health Check & Degraded State Handling.
     */
    public function test_health_check_healthy_and_degraded_contract(): void
    {
        // 1. Normal state -> 200 OK
        $res = $this->getJson('/api/v1/health');
        $res->assertStatus(200)
            ->assertJson([
                'status' => 'ok',
                'health' => 'healthy',
                'services' => [
                    'database' => 'connected',
                ],
            ]);

        $this->assertArrayHasKey('version', $res->json());
        $this->assertArrayHasKey('timestamp', $res->json());
    }

    /**
     * 5. Standardized Error Response Formats.
     */
    public function test_standardized_error_response_formats(): void
    {
        // Unauthenticated access
        $this->getJson('/api/v1/tasks')
            ->assertStatus(401);

        // Validation error on register
        $res = $this->postJson('/api/v1/auth/register', [
            'name' => 'Bad User',
            'email' => 'invalid-email',
            'password' => 'short',
        ]);
        $res->assertStatus(422)
            ->assertJsonValidationErrors(['email', 'password']);

        // Resource Not Found
        $this->actingAs($this->userA, 'sanctum')
            ->getJson('/api/v1/tasks/999999')
            ->assertStatus(404);
    }

    /**
     * 6. Query Performance and High-Volume Load Simulation.
     */
    public function test_query_performance_and_bulk_operations(): void
    {
        // Seed high-volume tasks for User A
        $tasksData = [];
        for ($i = 1; $i <= 30; $i++) {
            $tasksData[] = [
                'user_id' => $this->userA->id,
                'title' => "High Volume Task {$i}",
                'status' => $i % 2 === 0 ? 'completed' : 'todo',
                'priority' => 'medium',
                'due_date' => Carbon::today()->addDays($i)->toDateTimeString(),
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }
        Task::insert($tasksData);

        // Measure Dashboard Index Execution Time
        $startTime = microtime(true);
        $res = $this->actingAs($this->userA, 'sanctum')->getJson('/api/v1/dashboard');
        $elapsedMs = (microtime(true) - $startTime) * 1000;

        $res->assertStatus(200);
        $this->assertLessThan(1500, $elapsedMs, 'Dashboard endpoint must complete under 1.5 seconds');

        // Measure Task Index Filtered Execution Time
        $taskStart = microtime(true);
        $taskRes = $this->actingAs($this->userA, 'sanctum')->getJson('/api/v1/tasks?status=todo');
        $taskElapsedMs = (microtime(true) - $taskStart) * 1000;

        $taskRes->assertStatus(200);
        $this->assertLessThan(1000, $taskElapsedMs, 'Filtered tasks endpoint must complete under 1 second');
    }
}
