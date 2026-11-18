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
use App\Models\Question;
use App\Models\QuestionBank;
use App\Models\Task;
use App\Models\User;
use App\Models\UserSetting;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AnalyticsAndNotificationIntelligenceTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;
    protected User $otherUser;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create([
            'email' => 'analytics.user@tuntas.test',
            'role' => 'student',
        ]);
        $this->otherUser = User::factory()->create([
            'email' => 'other.analytics@tuntas.test',
            'role' => 'student',
        ]);

        UserSetting::create([
            'user_id' => $this->user->id,
            'theme' => 'dark',
            'email_notifications' => true,
            'in_app_notifications' => true,
            'timezone' => 'Asia/Jakarta',
            'preferences' => [
                'task_reminders' => true,
                'project_reminders' => true,
                'habit_reminders' => true,
                'goal_reminders' => true,
                'exam_reminders' => true,
                'preferred_reminder_time' => '09:00',
            ],
        ]);
    }

    /**
     * 1. Multi-dimensional productivity analytics calculations & metrics accuracy.
     */
    public function test_productivity_analytics_calculations_and_data_accuracy(): void
    {
        $now = Carbon::now('Asia/Jakarta');

        // Create tasks: 1 completed, 1 in_progress, 1 overdue
        Task::create([
            'user_id' => $this->user->id,
            'title' => 'Finished Task',
            'status' => 'completed',
            'priority' => 'high',
            'completed_at' => $now,
            'due_date' => $now->copy()->addDay(),
        ]);
        Task::create([
            'user_id' => $this->user->id,
            'title' => 'Active Task',
            'status' => 'in_progress',
            'priority' => 'urgent',
            'due_date' => $now->copy()->addDays(2),
        ]);
        Task::create([
            'user_id' => $this->user->id,
            'title' => 'Overdue Task',
            'status' => 'todo',
            'priority' => 'low',
            'due_date' => $now->copy()->subDays(2),
        ]);

        // Create project
        $proj = Project::create([
            'user_id' => $this->user->id,
            'title' => 'Alpha Project',
            'status' => 'in_progress',
            'progress' => 50,
            'deadline' => $now->copy()->addDays(10)->toDateString(),
        ]);
        $proj->milestones()->create(['title' => 'M1', 'is_completed' => true]);
        $proj->milestones()->create(['title' => 'M2', 'is_completed' => false]);

        // Create habit
        $habit = Habit::create([
            'user_id' => $this->user->id,
            'title' => 'Morning Jogging',
            'frequency' => 'daily',
            'current_streak' => 8,
            'best_streak' => 12,
            'freeze_tokens' => 2,
        ]);
        HabitLog::create([
            'user_id' => $this->user->id,
            'habit_id' => $habit->id,
            'log_date' => $now->toDateString(),
            'is_completed' => true,
        ]);

        // Create Goal
        Goal::create([
            'user_id' => $this->user->id,
            'title' => 'Publish Tech Book',
            'status' => 'in_progress',
            'start_date' => $now->copy()->subMonth()->toDateString(),
            'target_date' => $now->copy()->addMonths(2)->toDateString(),
            'progress' => 85,
        ]);

        // Query analytics
        $res = $this->actingAs($this->user)->getJson('/api/v1/analytics/productivity');
        $res->assertStatus(200);

        // Verify task metrics
        $res->assertJsonPath('data.tasks.total', 3)
            ->assertJsonPath('data.tasks.completed', 1)
            ->assertJsonPath('data.tasks.overdue', 1)
            ->assertJsonPath('data.tasks.completion_rate', 33.3)
            ->assertJsonPath('data.tasks.by_priority.urgent', 1)
            ->assertJsonPath('data.tasks.by_priority.high', 1)
            ->assertJsonPath('data.tasks.by_priority.low', 1);

        // Verify project metrics
        $res->assertJsonPath('data.projects.total', 1)
            ->assertJsonPath('data.projects.active', 1)
            ->assertJsonPath('data.projects.avg_progress', 50)
            ->assertJsonPath('data.projects.milestones.total', 2)
            ->assertJsonPath('data.projects.milestones.completed', 1);

        // Verify habit metrics
        $res->assertJsonPath('data.habits.total', 1)
            ->assertJsonPath('data.habits.active_streaks', 1)
            ->assertJsonPath('data.habits.best_streak', 12);

        // Verify rule-based insights: streak >= 7 triggers 'habit_momentum', goal >= 80 triggers 'goal_near_completion'
        $insights = collect($res->json('data.insights'));
        $this->assertTrue($insights->contains('id', 'habit_momentum'));
        $this->assertTrue($insights->contains('id', 'goal_near_completion'));
    }

    /**
     * 2. Date range filtering and user isolation.
     */
    public function test_analytics_date_range_filtering_and_tenant_isolation(): void
    {
        $now = Carbon::now('Asia/Jakarta');

        // Other user data (MUST NOT bleed into this user's analytics)
        Task::create([
            'user_id' => $this->otherUser->id,
            'title' => 'Foreign Task',
            'status' => 'completed',
            'priority' => 'urgent',
            'completed_at' => $now,
        ]);

        // This user data
        Task::create([
            'user_id' => $this->user->id,
            'title' => 'Today Completed Task',
            'status' => 'completed',
            'completed_at' => $now,
            'due_date' => $now,
        ]);

        // Task completed 40 days ago
        Task::create([
            'user_id' => $this->user->id,
            'title' => 'Old Completed Task',
            'status' => 'completed',
            'completed_at' => $now->copy()->subDays(40),
            'due_date' => $now->copy()->subDays(40),
        ]);

        // Range = today
        $todayRes = $this->actingAs($this->user)->getJson('/api/v1/analytics/productivity?range=today');
        $todayRes->assertStatus(200);
        $this->assertEquals(1, $todayRes->json('data.tasks.planned_vs_completed.completed_in_period'));

        // Custom range covering 45 days ago to 35 days ago
        $from = $now->copy()->subDays(45)->toDateString();
        $to = $now->copy()->subDays(35)->toDateString();
        $customRes = $this->actingAs($this->user)->getJson("/api/v1/analytics/productivity?range=custom&start_date={$from}&end_date={$to}");
        $customRes->assertStatus(200);
        $this->assertEquals(1, $customRes->json('data.tasks.planned_vs_completed.completed_in_period'));

        // Verify foreign task did not bleed in
        $allRes = $this->actingAs($this->user)->getJson('/api/v1/analytics/productivity');
        $this->assertEquals(2, $allRes->json('data.tasks.total')); // 2 tasks for this user, not 3
    }

    /**
     * 3. Learning and Exam Performance Analytics (Outcome vs Effort separation).
     */
    public function test_learning_and_examination_analytics_breakdown(): void
    {
        $now = Carbon::now();

        // 1. Course & Lessons
        $course = Course::create([
            'user_id' => $this->user->id,
            'title' => 'Systems Architecture',
            'status' => 'published',
            'progress' => 100,
        ]);
        $mod = $course->modules()->create(['title' => 'Module 1', 'is_completed' => true, 'progress' => 100]);
        $mod->lessons()->create(['title' => 'Lesson 1', 'is_completed' => true, 'duration_minutes' => 30]);

        // 2. Study Sessions
        LearningSession::create([
            'user_id' => $this->user->id,
            'course_id' => $course->id,
            'topic' => 'Distributed Microservices',
            'duration_minutes' => 90,
            'session_date' => $now->toDateString(),
            'status' => 'completed',
        ]);

        // 3. Question Bank & Exam Attempt
        $bank = QuestionBank::create([
            'user_id' => $this->user->id,
            'title' => 'Architecture Bank',
            'subject' => 'Software Eng',
        ]);
        $q = Question::create([
            'question_bank_id' => $bank->id,
            'type' => 'multiple_choice_single',
            'prompt' => 'What is CAP Theorem?',
            'points' => 1.0,
        ]);

        $blueprint = ExamBlueprint::create([
            'user_id' => $this->user->id,
            'title' => 'Architecture Final',
            'subject' => 'Software Eng',
            'duration_minutes' => 60,
        ]);

        $attempt = ExamAttempt::create([
            'exam_blueprint_id' => $blueprint->id,
            'user_id' => $this->user->id,
            'status' => 'completed',
            'started_at' => $now->copy()->subMinutes(30),
            'submitted_at' => $now,
            'total_points_possible' => 10,
            'total_points_earned' => 9,
            'score_percentage' => 90,
            'is_passed' => true,
            'questions_snapshot' => [],
        ]);

        $attempt->answers()->create([
            'question_id' => $q->id,
            'is_correct' => true,
            'awarded_points' => 1.0,
        ]);

        $res = $this->actingAs($this->user)->getJson('/api/v1/analytics/learning');
        $res->assertStatus(200);

        // Activity metrics
        $res->assertJsonPath('data.activity_metrics.total_study_minutes', 90)
            ->assertJsonPath('data.activity_metrics.total_study_hours', 1.5)
            ->assertJsonPath('data.activity_metrics.total_sessions', 1);

        // Outcome metrics
        $res->assertJsonPath('data.outcome_metrics.courses_total', 1)
            ->assertJsonPath('data.outcome_metrics.courses_completed', 1)
            ->assertJsonPath('data.outcome_metrics.course_completion_rate', 100);

        // Exam metrics & question accuracy
        $res->assertJsonPath('data.examination_analytics.total_attempts', 1)
            ->assertJsonPath('data.examination_analytics.passed_attempts', 1)
            ->assertJsonPath('data.examination_analytics.pass_rate', 100)
            ->assertJsonPath('data.examination_analytics.average_score', 90)
            ->assertJsonPath('data.examination_analytics.average_duration_minutes', 30)
            ->assertJsonPath('data.examination_analytics.question_accuracy.0.question_id', $q->id)
            ->assertJsonPath('data.examination_analytics.question_accuracy.0.accuracy_percentage', 100)
            ->assertJsonPath('data.examination_analytics.question_accuracy.0.difficulty_category', 'easy');
    }

    /**
     * 4. Notification lifecycle: create, mark as read, archive, unarchive, delete.
     */
    public function test_notification_full_lifecycle(): void
    {
        // 1. Create notification
        $createRes = $this->actingAs($this->user)->postJson('/api/v1/notifications', [
            'title' => 'Security Alert',
            'message' => 'New login from unknown browser.',
            'type' => 'system',
            'action_url' => '/settings',
        ]);
        $createRes->assertStatus(201);
        $notifId = $createRes->json('data.id');

        // 2. Query active notifications (should include notif)
        $listRes = $this->actingAs($this->user)->getJson('/api/v1/notifications');
        $listRes->assertStatus(200)
            ->assertJsonPath('unread_count', 1);

        // 3. Mark as read
        $readRes = $this->actingAs($this->user)->patchJson("/api/v1/notifications/{$notifId}/read");
        $readRes->assertStatus(200)
            ->assertJsonPath('data.is_read', true);

        // Unread count should become 0
        $listRes2 = $this->actingAs($this->user)->getJson('/api/v1/notifications');
        $this->assertEquals(0, $listRes2->json('unread_count'));

        // 4. Archive notification
        $archRes = $this->actingAs($this->user)->patchJson("/api/v1/notifications/{$notifId}/archive");
        $archRes->assertStatus(200)
            ->assertJsonPath('data.is_archived', true);

        // Active list should now be empty
        $listRes3 = $this->actingAs($this->user)->getJson('/api/v1/notifications');
        $this->assertCount(0, $listRes3->json('data'));

        // Archived list should show 1
        $archListRes = $this->actingAs($this->user)->getJson('/api/v1/notifications?is_archived=true');
        $this->assertCount(1, $archListRes->json('data'));

        // 5. Unarchive notification
        $unarchRes = $this->actingAs($this->user)->patchJson("/api/v1/notifications/{$notifId}/unarchive");
        $unarchRes->assertStatus(200)
            ->assertJsonPath('data.is_archived', false);

        // Active list now shows 1 again
        $listRes4 = $this->actingAs($this->user)->getJson('/api/v1/notifications');
        $this->assertCount(1, $listRes4->json('data'));

        // 6. Delete notification
        $delRes = $this->actingAs($this->user)->deleteJson("/api/v1/notifications/{$notifId}");
        $delRes->assertStatus(200);
        $this->assertNull(Notification::find($notifId));
    }

    /**
     * 5. Notification preferences and category reminder generation with deduplication and quiet hours.
     */
    public function test_notification_preferences_and_deduplicated_reminder_dispatch(): void
    {
        $now = Carbon::now('Asia/Jakarta');

        // 1. Create impending task (due in 5 hours)
        $task = Task::create([
            'user_id' => $this->user->id,
            'title' => 'Urgent Submission',
            'status' => 'todo',
            'priority' => 'urgent',
            'due_date' => $now->copy()->addHours(5),
        ]);

        // 2. Create impending exam (in 24 hours)
        $exam = Examination::create([
            'user_id' => $this->user->id,
            'title' => 'Algorithms Midterm',
            'subject' => 'CS',
            'examination_date' => $now->copy()->addDay()->toDateString(),
            'status' => 'upcoming',
        ]);

        // 3. Create uncompleted habit
        Habit::create([
            'user_id' => $this->user->id,
            'title' => 'Read Book',
            'frequency' => 'daily',
        ]);

        // 4. Test Quiet Hours: When current hour is within quiet hours window, reminders must be suppressed
        $curHour = (int)$now->format('H');
        $startHour = sprintf('%02d:00', ($curHour - 1 + 24) % 24);
        $endHour = sprintf('%02d:00', ($curHour + 1) % 24);

        $this->actingAs($this->user)->putJson('/api/v1/notifications/preferences', [
            'task_reminders' => true,
            'exam_reminders' => true,
            'habit_reminders' => false,
            'quiet_hours_start' => $startHour,
            'quiet_hours_end' => $endHour,
        ]);

        $quietScan = $this->actingAs($this->user)->postJson('/api/v1/notifications/check-reminders');
        $quietScan->assertStatus(200);
        $this->assertEquals(0, Notification::where('user_id', $this->user->id)->count(), 'Quiet hours should suppress notifications');

        // 5. Disable quiet hours to test generation with preferences
        $prefRes = $this->actingAs($this->user)->putJson('/api/v1/notifications/preferences', [
            'task_reminders' => true,
            'exam_reminders' => true,
            'habit_reminders' => false, // explicitly disabled
            'quiet_hours_start' => null,
            'quiet_hours_end' => null,
        ]);
        $prefRes->assertStatus(200)
            ->assertJsonPath('data.habit_reminders', false);

        // 6. Trigger reminder scan outside quiet hours
        $scan1 = $this->actingAs($this->user)->postJson('/api/v1/notifications/check-reminders');
        $scan1->assertStatus(200);

        // Task & exam reminders generated, but habit reminder skipped because habit_reminders = false
        $this->assertDatabaseHas('notifications', [
            'user_id' => $this->user->id,
            'type' => 'deadline',
            'action_url' => "/tasks?id={$task->id}",
        ]);
        $this->assertDatabaseHas('notifications', [
            'user_id' => $this->user->id,
            'type' => 'exam',
            'action_url' => "/examinations?id={$exam->id}",
        ]);
        $this->assertDatabaseMissing('notifications', [
            'user_id' => $this->user->id,
            'type' => 'habit',
        ]);

        $initialCount = Notification::where('user_id', $this->user->id)->count();

        // 7. Trigger reminder scan a SECOND time: Deduplication must ensure 0 duplicates!
        $scan2 = $this->actingAs($this->user)->postJson('/api/v1/notifications/check-reminders');
        $scan2->assertStatus(200)
            ->assertJsonPath('data.reminders_created', 0);

        $this->assertEquals($initialCount, Notification::where('user_id', $this->user->id)->count());
    }

    /**
     * 6. Console Command `reminders:generate` execution.
     */
    public function test_console_command_generate_reminders_executes_cleanly(): void
    {
        $now = Carbon::now();

        Task::create([
            'user_id' => $this->user->id,
            'title' => 'Scheduled Task',
            'status' => 'todo',
            'due_date' => $now->copy()->addHours(10),
        ]);

        $this->artisan('reminders:generate')->assertExitCode(0);

        $this->assertDatabaseHas('notifications', [
            'user_id' => $this->user->id,
            'type' => 'deadline',
        ]);
    }

    /**
     * 7. Authorized and tenant-isolated CSV export.
     */
    public function test_csv_report_export_authorization_and_isolation(): void
    {
        // User tasks
        Task::create([
            'user_id' => $this->user->id,
            'title' => 'User Confidential Task',
            'status' => 'completed',
        ]);

        // Foreign task
        Task::create([
            'user_id' => $this->otherUser->id,
            'title' => 'Other Confidential Task',
            'status' => 'completed',
        ]);

        // Unauthenticated request must be rejected with 401
        $this->get('/api/v1/analytics/export?type=tasks')->assertStatus(401);

        // Authenticated request
        $res = $this->actingAs($this->user)->get('/api/v1/analytics/export?type=tasks');
        $res->assertStatus(200);
        $this->assertStringContainsString('text/csv', $res->headers->get('Content-Type'));
        $csv = $res->getContent();

        // Must contain user's task
        $this->assertStringContainsString('User Confidential Task', $csv);
        // Must NOT contain other user's task
        $this->assertStringNotContainsString('Other Confidential Task', $csv);

        // Productivity summary export
        $prodRes = $this->actingAs($this->user)->get('/api/v1/analytics/export?type=productivity');
        $prodRes->assertStatus(200);
        $this->assertStringContainsString('Metric Domain', $prodRes->getContent());
    }
}
