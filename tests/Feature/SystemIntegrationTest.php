<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Course;
use App\Models\ExamAttempt;
use App\Models\ExamBlueprint;
use App\Models\Examination;
use App\Models\Goal;
use App\Models\Habit;
use App\Models\HabitLog;
use App\Models\LearningSession;
use App\Models\Notification;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SystemIntegrationTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create([
            'email' => 'integrator@tuntas.test',
            'role' => 'student',
        ]);
    }

    public function test_dashboard_aggregation_across_all_modules(): void
    {
        $today = Carbon::today();
        $now = Carbon::now();

        // 1. Task (due today)
        Task::create([
            'user_id' => $this->user->id,
            'title' => 'Deliver System Design Doc',
            'status' => 'in_progress',
            'priority' => 'urgent',
            'due_date' => $now->copy()->addHours(2),
        ]);

        // 2. Project with 2 tasks (1 completed -> 50% progress)
        $project = Project::create([
            'user_id' => $this->user->id,
            'title' => 'Tuntas V2 Release',
            'status' => 'in_progress',
            'deadline' => $today->copy()->addDays(14)->toDateString(),
            'progress' => 50,
        ]);

        // 3. Habit with log today
        $habit = Habit::create([
            'user_id' => $this->user->id,
            'title' => 'Read Whitepapers',
            'frequency' => 'daily',
            'current_streak' => 7,
            'best_streak' => 14,
        ]);

        HabitLog::create([
            'habit_id' => $habit->id,
            'user_id' => $this->user->id,
            'log_date' => $today->toDateString(),
            'is_completed' => true,
        ]);

        // 4. Goal (OKR)
        Goal::create([
            'user_id' => $this->user->id,
            'title' => 'Complete System Architecture Mastery',
            'start_date' => $today->toDateString(),
            'target_date' => $today->copy()->addMonths(2)->toDateString(),
            'status' => 'in_progress',
            'progress' => 65,
        ]);

        // 5. Course & Study Session
        $course = Course::create([
            'user_id' => $this->user->id,
            'title' => 'High Concurrency Databases',
            'progress' => 40,
        ]);

        LearningSession::create([
            'user_id' => $this->user->id,
            'course_id' => $course->id,
            'topic' => 'PostgreSQL MVCC vacuuming internals',
            'duration_minutes' => 90,
            'session_date' => $today->toDateString(),
        ]);

        // 6. Upcoming Examination (Dedicated Subsystem)
        Examination::create([
            'user_id' => $this->user->id,
            'title' => 'AWS Certified DevOps Pro',
            'subject' => 'DevOps',
            'examination_date' => $today->copy()->addDays(5)->toDateString(),
            'status' => 'upcoming',
        ]);

        // 7. Completed Exam Attempt
        $bp = ExamBlueprint::create([
            'user_id' => $this->user->id,
            'title' => 'Distributed Cache Midterm',
            'subject' => 'Architecture',
            'duration_minutes' => 45,
            'is_published' => true,
        ]);

        ExamAttempt::create([
            'id' => (string) \Illuminate\Support\Str::uuid(),
            'exam_blueprint_id' => $bp->id,
            'user_id' => $this->user->id,
            'status' => 'completed',
            'started_at' => $now->copy()->subHours(1),
            'submitted_at' => $now,
            'total_points_earned' => 45,
            'total_points_possible' => 50,
            'score_percentage' => 90.0,
            'is_passed' => true,
            'questions_snapshot' => [],
        ]);

        // 8. Notification
        Notification::create([
            'user_id' => $this->user->id,
            'title' => 'System Update Complete',
            'message' => 'Tuntas V2 microservice integration active.',
            'type' => 'system',
            'is_read' => false,
        ]);

        // Request Dashboard
        $response = $this->actingAs($this->user)->getJson('/api/v1/dashboard');

        $response->assertStatus(200)
            ->assertJsonPath('success', true);

        $metrics = $response->json('data.metrics');
        $this->assertEquals(1, $metrics['tasks_in_progress_count']);
        $this->assertEquals(1, $metrics['active_projects_count']);
        $this->assertEquals(7, $metrics['active_habit_streaks']);
        $this->assertEquals(1, $metrics['goals_active_count']);
        $this->assertEquals(1.5, $metrics['total_study_hours']); // 90 min = 1.5 hr
        $this->assertEquals(1, $metrics['upcoming_examinations_count']);
        $this->assertEquals(1, $metrics['unread_notifications_count']);

        $habits = $response->json('data.habits');
        $this->assertNotEmpty($habits);
        $this->assertTrue((bool) $habits[0]['is_completed_today']);

        $recentExams = $response->json('data.recent_exam_results');
        $this->assertCount(1, $recentExams);
        $this->assertEquals('Distributed Cache Midterm', $recentExams[0]['title']);
        $this->assertTrue($recentExams[0]['is_passed']);
    }

    public function test_productivity_analytics_endpoint(): void
    {
        $cat = Category::create([
            'user_id' => $this->user->id,
            'name' => 'Infrastructure',
            'color' => '#0284c7',
        ]);

        Task::create([
            'user_id' => $this->user->id,
            'category_id' => $cat->id,
            'title' => 'Provision Redis Cluster',
            'status' => 'completed',
            'priority' => 'urgent',
            'completed_at' => Carbon::now(),
        ]);

        Task::create([
            'user_id' => $this->user->id,
            'category_id' => $cat->id,
            'title' => 'Benchmark Sentinels',
            'status' => 'in_progress',
            'priority' => 'high',
        ]);

        $res = $this->actingAs($this->user)->getJson('/api/v1/analytics/productivity');

        $res->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.task_metrics.total_tasks', 2)
            ->assertJsonPath('data.task_metrics.completed_tasks', 1)
            ->assertJsonPath('data.task_distribution.by_priority.urgent', 1)
            ->assertJsonPath('data.task_distribution.by_priority.high', 1)
            ->assertJsonPath('data.task_distribution.by_status.completed', 1);

        $this->assertEquals(50, (int) $res->json('data.task_metrics.completion_rate'));
    }

    public function test_learning_analytics_endpoint(): void
    {
        $course = Course::create([
            'user_id' => $this->user->id,
            'title' => 'Advanced Algorithms',
            'progress' => 75,
        ]);

        LearningSession::create([
            'user_id' => $this->user->id,
            'course_id' => $course->id,
            'topic' => 'A* Pathfinding & Heuristics',
            'duration_minutes' => 60,
            'session_date' => Carbon::today()->toDateString(),
        ]);

        $bp = ExamBlueprint::create([
            'user_id' => $this->user->id,
            'course_id' => $course->id,
            'title' => 'Graph Theory Final',
            'subject' => 'Algorithms',
            'duration_minutes' => 60,
            'is_published' => true,
        ]);

        ExamAttempt::create([
            'id' => (string) \Illuminate\Support\Str::uuid(),
            'exam_blueprint_id' => $bp->id,
            'user_id' => $this->user->id,
            'status' => 'completed',
            'started_at' => Carbon::now()->subHours(2),
            'submitted_at' => Carbon::now()->subHour(),
            'total_points_earned' => 95,
            'total_points_possible' => 100,
            'score_percentage' => 95.0,
            'is_passed' => true,
            'questions_snapshot' => [],
        ]);

        $res = $this->actingAs($this->user)->getJson('/api/v1/analytics/learning');

        $res->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.study_statistics.total_study_minutes', 60)
            ->assertJsonPath('data.study_statistics.total_sessions', 1)
            ->assertJsonPath('data.examination_performance.total_attempts', 1)
            ->assertJsonPath('data.examination_performance.passed_attempts', 1);

        $this->assertEquals(1, (int) $res->json('data.study_statistics.total_study_hours'));
        $this->assertEquals(100, (int) $res->json('data.examination_performance.pass_rate'));
        $this->assertEquals(95, (int) $res->json('data.examination_performance.average_score'));
    }

    public function test_notification_lifecycle_categories_and_duplicate_prevention(): void
    {
        // 1. Create Notification
        $createRes = $this->actingAs($this->user)->postJson('/api/v1/notifications', [
            'title' => 'Security Audit Passed',
            'message' => 'All penetration testing checks cleared.',
            'type' => 'system',
            'action_url' => '/settings',
        ]);
        $createRes->assertStatus(201);
        $notifId = $createRes->json('data.id');

        // 2. Duplicate Prevention: Attempt creating exact same notification immediately
        $dupRes = $this->actingAs($this->user)->postJson('/api/v1/notifications', [
            'title' => 'Security Audit Passed',
            'message' => 'All penetration testing checks cleared.',
            'type' => 'system',
        ]);
        $dupRes->assertStatus(200);
        $this->assertEquals($notifId, $dupRes->json('data.id'));

        // 3. Mark all as read
        $readAllRes = $this->actingAs($this->user)->postJson('/api/v1/notifications/read-all');
        $readAllRes->assertStatus(200);

        $notif = Notification::find($notifId);
        $this->assertTrue((bool) $notif->is_read);
        $this->assertNotNull($notif->read_at);
    }

    public function test_deadline_reminder_generation_without_duplicates(): void
    {
        $now = Carbon::now();

        // Task due in 8 hours (<24 hours)
        $task = Task::create([
            'user_id' => $this->user->id,
            'title' => 'Submit System Architecture Whitepaper',
            'status' => 'todo',
            'due_date' => $now->copy()->addHours(8),
        ]);

        // Examination scheduled tomorrow (<48 hours)
        $exam = Examination::create([
            'user_id' => $this->user->id,
            'title' => 'Kubernetes CKA Certification',
            'subject' => 'Infrastructure',
            'examination_date' => $now->copy()->addDay()->toDateString(),
            'status' => 'upcoming',
        ]);

        // 1. First trigger: Should generate 2 reminders (1 task, 1 exam)
        $checkRes1 = $this->actingAs($this->user)->postJson('/api/v1/notifications/check-reminders');
        $checkRes1->assertStatus(200)
            ->assertJsonPath('data.reminders_created', 2);

        $notifications = Notification::where('user_id', $this->user->id)->get();
        $this->assertCount(2, $notifications);

        $types = $notifications->pluck('type')->all();
        $this->assertContains('deadline', $types);
        $this->assertContains('exam', $types);

        // 2. Second trigger immediately: Should generate 0 duplicates
        $checkRes2 = $this->actingAs($this->user)->postJson('/api/v1/notifications/check-reminders');
        $checkRes2->assertStatus(200)
            ->assertJsonPath('data.reminders_created', 0);

        $this->assertCount(2, Notification::where('user_id', $this->user->id)->get());
    }
}
