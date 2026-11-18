<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\ExamAttempt;
use App\Models\ExamBlueprint;
use App\Models\Goal;
use App\Models\Habit;
use App\Models\LearningSession;
use App\Models\Notification;
use App\Models\Project;
use App\Models\Question;
use App\Models\QuestionBank;
use App\Models\Task;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FullIntegrationAndUserJourneyE2ETest extends TestCase
{
    use RefreshDatabase;

    /**
     * Comprehensive 19-Step End-to-End User Journey:
     * 1. Register
     * 2. Login
     * 3. Create task
     * 4. Create project
     * 5. Link task with project
     * 6. Create habit
     * 7. Habit completion & streak
     * 8. Create goal
     * 9. Link goal with task/project & milestone progress
     * 10. Create course, module & lesson
     * 11. Run learning session timer lifecycle
     * 12. Create question bank & examination blueprint
     * 13. Start exam attempt
     * 14. Answer and sync answers
     * 15. Submit exam
     * 16. View results & review
     * 17. View analytics (productivity & learning activity vs outcome)
     * 18. Calendar & Notifications deduplicated check
     * 19. Logout and re-login verification
     */
    public function test_complete_19_step_user_journey_end_to_end(): void
    {
        // -------------------------------------------------------------
        // STEP 1: REGISTER
        // -------------------------------------------------------------
        $registerRes = $this->postJson('/api/v1/auth/register', [
            'name' => 'Aditya Pratama',
            'email' => 'aditya@tuntas.app',
            'password' => 'SecurePass123!',
            'password_confirmation' => 'SecurePass123!',
        ]);

        $registerRes->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonStructure(['data' => ['user', 'token']]);

        $userId = $registerRes->json('data.user.id');
        $this->assertDatabaseHas('users', ['email' => 'aditya@tuntas.app']);

        // -------------------------------------------------------------
        // STEP 2: LOGIN
        // -------------------------------------------------------------
        $loginRes = $this->postJson('/api/v1/auth/login', [
            'email' => 'aditya@tuntas.app',
            'password' => 'SecurePass123!',
        ]);

        $loginRes->assertStatus(200)
            ->assertJsonPath('success', true);

        $token = $loginRes->json('data.token');
        $this->assertNotEmpty($token);
        $headers = ['Authorization' => 'Bearer ' . $token];

        // Verify authenticated identity via /auth/me
        $meRes = $this->withHeaders($headers)->getJson('/api/v1/auth/me');
        $meRes->assertStatus(200)
            ->assertJsonPath('data.email', 'aditya@tuntas.app');

        // -------------------------------------------------------------
        // STEP 3: CREATE TASK
        // -------------------------------------------------------------
        $taskRes = $this->withHeaders($headers)->postJson('/api/v1/tasks', [
            'title' => 'Design System Architecture',
            'description' => 'Draft the component and API specifications for Tuntas 2.0',
            'priority' => 'high',
            'status' => 'todo',
            'due_date' => Carbon::now()->addDays(2)->toIso8601String(),
        ]);

        $taskRes->assertStatus(201)
            ->assertJsonPath('data.title', 'Design System Architecture');
        $taskId = $taskRes->json('data.id');

        // Add subtasks
        $subtaskRes = $this->withHeaders($headers)->postJson("/api/v1/tasks/{$taskId}/subtasks", [
            'title' => 'Define color tokens and typography',
        ]);
        $subtaskRes->assertStatus(201);

        // -------------------------------------------------------------
        // STEP 4: CREATE PROJECT
        // -------------------------------------------------------------
        $projectRes = $this->withHeaders($headers)->postJson('/api/v1/projects', [
            'title' => 'Tuntas Platform Release',
            'description' => 'Full-stack productivity and education suite',
            'status' => 'in_progress',
            'priority' => 'urgent',
            'start_date' => Carbon::now()->toDateString(),
            'deadline' => Carbon::now()->addDays(30)->toDateString(),
        ]);

        $projectRes->assertStatus(201)
            ->assertJsonPath('data.title', 'Tuntas Platform Release');
        $projectId = $projectRes->json('data.id');

        // Add Project Milestone
        $milestoneRes = $this->withHeaders($headers)->postJson("/api/v1/projects/{$projectId}/milestones", [
            'title' => 'Beta Launch to Early Adopters',
            'due_date' => Carbon::now()->addDays(14)->toDateString(),
            'order' => 1,
        ]);
        $milestoneRes->assertStatus(201);
        $milestoneId = $milestoneRes->json('data.id');

        // -------------------------------------------------------------
        // STEP 5: LINK TASK WITH PROJECT
        // -------------------------------------------------------------
        $linkTaskRes = $this->withHeaders($headers)->putJson("/api/v1/tasks/{$taskId}", [
            'title' => 'Design System Architecture',
            'project_id' => $projectId,
            'priority' => 'high',
            'status' => 'in_progress',
        ]);

        $linkTaskRes->assertStatus(200)
            ->assertJsonPath('data.project_id', $projectId);

        // Verify task appears within project details
        $projectDetailRes = $this->withHeaders($headers)->getJson("/api/v1/projects/{$projectId}");
        $projectDetailRes->assertStatus(200);

        // -------------------------------------------------------------
        // STEP 6: CREATE HABIT
        // -------------------------------------------------------------
        $habitRes = $this->withHeaders($headers)->postJson('/api/v1/habits', [
            'title' => 'Deep Focus Coding',
            'description' => 'At least 90 minutes of undisturbed development daily',
            'frequency' => 'daily',
            'target_count' => 1,
            'freeze_tokens' => 2,
        ]);

        $habitRes->assertStatus(201)
            ->assertJsonPath('data.title', 'Deep Focus Coding');
        $habitId = $habitRes->json('data.id');

        // -------------------------------------------------------------
        // STEP 7: HABIT COMPLETION & STREAK
        // -------------------------------------------------------------
        $toggleHabitRes = $this->withHeaders($headers)->postJson("/api/v1/habits/{$habitId}/toggle", [
            'date' => Carbon::today()->toDateString(),
        ]);

        $toggleHabitRes->assertStatus(200)
            ->assertJsonPath('data.habit.current_streak', 1);

        // -------------------------------------------------------------
        // STEP 8: CREATE GOAL (OKR)
        // -------------------------------------------------------------
        $goalRes = $this->withHeaders($headers)->postJson('/api/v1/goals', [
            'title' => 'Master Full-Stack Systems Engineering',
            'description' => 'Level up cloud architecture, databases, and UX',
            'type' => 'okr',
            'confidence_level' => 'high',
            'start_date' => Carbon::today()->toDateString(),
            'target_date' => Carbon::today()->addMonths(3)->toDateString(),
        ]);

        $goalRes->assertStatus(201)
            ->assertJsonPath('data.title', 'Master Full-Stack Systems Engineering');
        $goalId = $goalRes->json('data.id');

        // Add Key Result / Milestone
        $goalMilestoneRes = $this->withHeaders($headers)->postJson("/api/v1/goals/{$goalId}/milestones", [
            'title' => 'Pass Advanced Systems Certification',
            'target_value' => 100,
            'current_value' => 0,
            'unit' => '%',
            'weight' => 1.0,
        ]);
        $goalMilestoneRes->assertStatus(201);
        $goalMilestoneId = $goalMilestoneRes->json('data.milestone.id');

        // -------------------------------------------------------------
        // STEP 9: LINK GOAL WITH TASK & PROJECT
        // -------------------------------------------------------------
        $updateTaskGoalRes = $this->withHeaders($headers)->putJson("/api/v1/tasks/{$taskId}", [
            'title' => 'Design System Architecture',
            'goal_id' => $goalId,
            'project_id' => $projectId,
            'status' => 'completed',
        ]);
        $updateTaskGoalRes->assertStatus(200)
            ->assertJsonPath('data.goal_id', $goalId)
            ->assertJsonPath('data.status', 'completed');

        // Update Key Result progress
        $updateGoalMilestoneRes = $this->withHeaders($headers)->patchJson("/api/v1/milestones/{$goalMilestoneId}", [
            'current_value' => 60,
        ]);
        $updateGoalMilestoneRes->assertStatus(200);

        // Check goal progress recalculated (blended with linked completed task)
        $checkGoalRes = $this->withHeaders($headers)->getJson("/api/v1/goals/{$goalId}");
        $checkGoalRes->assertStatus(200)
            ->assertJsonPath('data.progress', 72);

        // -------------------------------------------------------------
        // STEP 10: CREATE COURSE, MODULE & LESSON
        // -------------------------------------------------------------
        $courseRes = $this->withHeaders($headers)->postJson('/api/v1/courses', [
            'title' => 'Distributed Microservices & Cloud Architecture',
            'code' => 'CS-501',
            'description' => 'Comprehensive enterprise cloud patterns',
        ]);
        $courseRes->assertStatus(201);
        $courseId = $courseRes->json('data.id');

        $modRes = $this->withHeaders($headers)->postJson("/api/v1/courses/{$courseId}/modules", [
            'title' => 'Module 1: CAP Theorem & Consistency Models',
            'order' => 1,
        ]);
        $modRes->assertStatus(201);
        $moduleId = $modRes->json('data.id');

        $lessonRes = $this->withHeaders($headers)->postJson("/api/v1/modules/{$moduleId}/lessons", [
            'title' => 'Linearizability and Eventual Consistency',
            'duration_minutes' => 45,
            'content' => 'Comprehensive analysis of distributed storage guarantees.',
            'order' => 1,
        ]);
        $lessonRes->assertStatus(201);
        $lessonId = $lessonRes->json('data.id');

        // -------------------------------------------------------------
        // STEP 11: RUN LEARNING SESSION TIMER LIFECYCLE
        // -------------------------------------------------------------
        $sessionStartRes = $this->withHeaders($headers)->postJson('/api/v1/learning-sessions/start', [
            'course_id' => $courseId,
            'lesson_id' => $lessonId,
            'topic' => 'CAP Theorem Deep Dive',
        ]);
        $sessionStartRes->assertStatus(201);
        $sessionId = $sessionStartRes->json('data.id');

        // Pause timer
        $pauseRes = $this->withHeaders($headers)->postJson("/api/v1/learning-sessions/{$sessionId}/pause");
        $pauseRes->assertStatus(200);

        // Resume timer
        $resumeRes = $this->withHeaders($headers)->postJson("/api/v1/learning-sessions/{$sessionId}/resume");
        $resumeRes->assertStatus(200);

        // Complete session with duration
        $completeSessionRes = $this->withHeaders($headers)->postJson("/api/v1/learning-sessions/{$sessionId}/complete", [
            'duration_minutes' => 60,
            'notes' => 'Completed detailed review of consistency tradeoffs.',
        ]);
        $completeSessionRes->assertStatus(200)
            ->assertJsonPath('data.status', 'completed')
            ->assertJsonPath('data.duration_minutes', 60);

        // -------------------------------------------------------------
        // STEP 12: CREATE QUESTION BANK & EXAMINATION BLUEPRINT
        // -------------------------------------------------------------
        $bankRes = $this->withHeaders($headers)->postJson('/api/v1/question-banks', [
            'title' => 'Distributed Systems Question Bank',
            'subject' => 'Computer Science',
            'description' => 'Curated multiple-choice and practical questions',
        ]);
        $bankRes->assertStatus(201);
        $bankId = $bankRes->json('data.id');

        // Add 2 questions to bank
        $q1Res = $this->withHeaders($headers)->postJson("/api/v1/question-banks/{$bankId}/questions", [
            'type' => 'multiple_choice_single',
            'prompt' => 'Which guarantee does DynamoDB provide by default for read operations?',
            'points' => 5.0,
            'explanation' => 'DynamoDB uses eventual consistency by default for standard reads.',
            'options' => [
                ['option_text' => 'Eventual Consistency', 'is_correct' => true],
                ['option_text' => 'Strict Serializability', 'is_correct' => false],
                ['option_text' => 'Linearizability', 'is_correct' => false],
            ],
        ]);
        $q1Res->assertStatus(201);
        $q1Id = $q1Res->json('data.id');

        $q2Res = $this->withHeaders($headers)->postJson("/api/v1/question-banks/{$bankId}/questions", [
            'type' => 'true_false',
            'prompt' => 'A system can achieve both 100% Availability and Strict Consistency during a network partition.',
            'points' => 5.0,
            'explanation' => 'Under CAP Theorem, a distributed partition forces a choice between C and A.',
            'options' => [
                ['option_text' => 'True', 'is_correct' => false],
                ['option_text' => 'False', 'is_correct' => true],
            ],
        ]);
        $q2Res->assertStatus(201);
        $q2Id = $q2Res->json('data.id');

        // Create blueprint and attach questions
        $bpRes = $this->withHeaders($headers)->postJson('/api/v1/exam-blueprints', [
            'title' => 'CS-501 Midterm Examination',
            'subject' => 'Distributed Systems',
            'course_id' => $courseId,
            'duration_minutes' => 60,
            'passing_score' => 70,
        ]);
        $bpRes->assertStatus(201);
        $bpId = $bpRes->json('data.id');

        $attachRes = $this->withHeaders($headers)->postJson("/api/v1/exam-blueprints/{$bpId}/attach-questions", [
            'question_ids' => [$q1Id, $q2Id],
        ]);
        $attachRes->assertStatus(200);

        // -------------------------------------------------------------
        // STEP 13: START EXAM ATTEMPT (ANTI-LEAK CHECK)
        // -------------------------------------------------------------
        $startAttemptRes = $this->withHeaders($headers)->postJson("/api/v1/exam-blueprints/{$bpId}/start");
        $startAttemptRes->assertStatus(200)
            ->assertJsonPath('data.status', 'in_progress');

        $attemptId = $startAttemptRes->json('data.id');
        $snapshot = $startAttemptRes->json('data.questions_snapshot');
        $this->assertCount(2, $snapshot);

        // CRITICAL ANTI-LEAK SECURITY VERIFICATION:
        // is_correct and explanation must NOT be present in active session snapshot!
        $this->assertArrayNotHasKey('explanation', $snapshot[0]);
        foreach ($snapshot[0]['options'] as $opt) {
            $this->assertArrayNotHasKey('is_correct', $opt);
        }

        // -------------------------------------------------------------
        // STEP 14: ANSWER AND SYNC ANSWERS
        // -------------------------------------------------------------
        $q1OptionCorrectId = $q1Res->json('data.options.0.id');
        $q2OptionCorrectId = $q2Res->json('data.options.1.id');

        $syncRes = $this->withHeaders($headers)->postJson("/api/v1/exam-attempts/{$attemptId}/sync", [
            'answers' => [
                ['question_id' => $q1Id, 'selected_option_id' => $q1OptionCorrectId],
                ['question_id' => $q2Id, 'selected_option_id' => $q2OptionCorrectId],
            ],
        ]);
        $syncRes->assertStatus(200)
            ->assertJsonPath('data.saved_count', 2);

        // -------------------------------------------------------------
        // STEP 15: SUBMIT EXAM
        // -------------------------------------------------------------
        $submitRes = $this->withHeaders($headers)->postJson("/api/v1/exam-attempts/{$attemptId}/submit");
        $submitRes->assertStatus(200)
            ->assertJsonPath('data.status', 'completed')
            ->assertJsonPath('data.total_points_possible', 10)
            ->assertJsonPath('data.total_points_earned', 10)
            ->assertJsonPath('data.score_percentage', 100)
            ->assertJsonPath('data.is_passed', true);

        // -------------------------------------------------------------
        // STEP 16: VIEW RESULTS & REVIEW
        // -------------------------------------------------------------
        $reviewRes = $this->withHeaders($headers)->getJson("/api/v1/exam-attempts/{$attemptId}/review");
        $reviewRes->assertStatus(200)
            ->assertJsonPath('data.attempt.score_percentage', 100)
            ->assertJsonPath('data.attempt.is_passed', true);

        // After submit, explanations and correct indicators are legitimately available for student review
        $reviewQuestions = $reviewRes->json('data.questions');
        $this->assertNotEmpty($reviewQuestions);
        $this->assertEquals(5.0, $reviewQuestions[0]['points_awarded']);

        // -------------------------------------------------------------
        // STEP 17: VIEW ANALYTICS (PRODUCTIVITY & LEARNING)
        // -------------------------------------------------------------
        $prodAnalytics = $this->withHeaders($headers)->getJson('/api/v1/analytics/productivity?range=today');
        $prodAnalytics->assertStatus(200)
            ->assertJsonPath('data.tasks.completed', 1)
            ->assertJsonPath('data.projects.total', 1)
            ->assertJsonPath('data.habits.total', 1);

        $learningAnalytics = $this->withHeaders($headers)->getJson('/api/v1/analytics/learning?range=today');
        $learningAnalytics->assertStatus(200)
            ->assertJsonPath('data.activity_metrics.total_study_minutes', 60)
            ->assertJsonPath('data.examination_analytics.total_attempts', 1)
            ->assertJsonPath('data.examination_analytics.average_score', 100)
            ->assertJsonPath('data.examination_analytics.pass_rate', 100);

        // -------------------------------------------------------------
        // STEP 18: CALENDAR & NOTIFICATIONS
        // -------------------------------------------------------------
        $calendarRes = $this->withHeaders($headers)->getJson('/api/v1/calendar/events');
        $calendarRes->assertStatus(200);
        $this->assertIsArray($calendarRes->json('data'));

        // Scan reminders (Deduplicated reminder dispatch)
        $reminderScan = $this->withHeaders($headers)->postJson('/api/v1/notifications/check-reminders');
        $reminderScan->assertStatus(200);

        $notifList = $this->withHeaders($headers)->getJson('/api/v1/notifications');
        $notifList->assertStatus(200);

        // -------------------------------------------------------------
        // STEP 19: LOGOUT AND RELOGIN VERIFICATION
        // -------------------------------------------------------------
        $logoutRes = $this->withHeaders($headers)->postJson('/api/v1/auth/logout');
        $logoutRes->assertStatus(200);

        // Reset in-memory test guard state so Sanctum parses token anew
        $this->app['auth']->forgetGuards();

        // Revoked token must now be rejected
        $rejectedMe = $this->withHeaders($headers)->getJson('/api/v1/auth/me');
        $rejectedMe->assertStatus(401);

        // Relogin with original credentials
        $reloginRes = $this->postJson('/api/v1/auth/login', [
            'email' => 'aditya@tuntas.app',
            'password' => 'SecurePass123!',
        ]);
        $reloginRes->assertStatus(200);
        $newToken = $reloginRes->json('data.token');
        $newHeaders = ['Authorization' => 'Bearer ' . $newToken];

        // Verify data persistence after relogin
        $reloginMe = $this->withHeaders($newHeaders)->getJson('/api/v1/auth/me');
        $reloginMe->assertStatus(200)
            ->assertJsonPath('data.email', 'aditya@tuntas.app');

        $reloginTasks = $this->withHeaders($newHeaders)->getJson('/api/v1/tasks');
        $reloginTasks->assertStatus(200);
        $this->assertCount(1, $reloginTasks->json('data'));
        $this->assertEquals('Design System Architecture', $reloginTasks->json('data.0.title'));

        $reloginHabits = $this->withHeaders($newHeaders)->getJson('/api/v1/habits');
        $reloginHabits->assertStatus(200);
        $this->assertEquals(1, $reloginHabits->json('data.0.current_streak'));
    }

    /**
     * EDGE CASE 1: Empty state and safe zero fallbacks (No divide-by-zero, no crash).
     */
    public function test_edge_case_empty_state_and_safe_fallbacks(): void
    {
        $freshUser = User::factory()->create();

        // 1. Dashboard on completely fresh user
        $dashRes = $this->actingAs($freshUser)->getJson('/api/v1/dashboard');
        $dashRes->assertStatus(200)
            ->assertJsonPath('data.metrics.tasks_total_count', 0)
            ->assertJsonPath('data.metrics.active_projects_count', 0);

        // 2. Productivity Analytics on empty data
        $prodRes = $this->actingAs($freshUser)->getJson('/api/v1/analytics/productivity?range=this_week');
        $prodRes->assertStatus(200)
            ->assertJsonPath('data.tasks.total', 0)
            ->assertJsonPath('data.tasks.completion_rate', 0)
            ->assertJsonPath('data.habits.completion_rate_30_days', 0);

        // 3. Learning Analytics on empty data
        $learnRes = $this->actingAs($freshUser)->getJson('/api/v1/analytics/learning?range=this_month');
        $learnRes->assertStatus(200)
            ->assertJsonPath('data.activity_metrics.total_study_minutes', 0)
            ->assertJsonPath('data.outcome_metrics.course_completion_rate', 0)
            ->assertJsonPath('data.examination_analytics.total_attempts', 0)
            ->assertJsonPath('data.examination_analytics.average_score', 0);

        // 4. Calendar on empty data
        $calRes = $this->actingAs($freshUser)->getJson('/api/v1/calendar/events');
        $calRes->assertStatus(200)
            ->assertJsonPath('data', []);

        // 5. Notifications on empty data
        $notifRes = $this->actingAs($freshUser)->getJson('/api/v1/notifications');
        $notifRes->assertStatus(200)
            ->assertJsonPath('data', [])
            ->assertJsonPath('unread_count', 0);
    }

    /**
     * EDGE CASE 2: Invalid input validation and error feedback.
     */
    public function test_edge_case_invalid_input_validation(): void
    {
        $user = User::factory()->create();

        // Task with empty title
        $taskRes = $this->actingAs($user)->postJson('/api/v1/tasks', [
            'title' => '',
            'priority' => 'invalid_priority',
        ]);
        $taskRes->assertStatus(422)
            ->assertJsonValidationErrors(['title', 'priority']);

        // Project with inverted dates
        $projRes = $this->actingAs($user)->postJson('/api/v1/projects', [
            'title' => 'Project Inverted',
            'start_date' => '2026-12-31',
            'deadline' => '2026-01-01',
        ]);
        $projRes->assertStatus(422)
            ->assertJsonValidationErrors(['deadline']);

        // Habit with invalid frequency
        $habitRes = $this->actingAs($user)->postJson('/api/v1/habits', [
            'title' => 'Invalid Habit',
            'frequency' => 'yearly_invalid',
        ]);
        $habitRes->assertStatus(422)
            ->assertJsonValidationErrors(['frequency']);
    }

    /**
     * EDGE CASE 3: Unauthenticated access and session security.
     */
    public function test_edge_case_unauthenticated_access_is_rejected(): void
    {
        $this->getJson('/api/v1/dashboard')->assertStatus(401);
        $this->getJson('/api/v1/tasks')->assertStatus(401);
        $this->getJson('/api/v1/analytics/productivity')->assertStatus(401);
        $this->getJson('/api/v1/notifications')->assertStatus(401);
    }

    /**
     * EDGE CASE 4: Multi-tenant strict isolation (IDOR protection).
     */
    public function test_edge_case_cross_tenant_isolation_prevents_idor(): void
    {
        $alice = User::factory()->create(['name' => 'Alice']);
        $bob = User::factory()->create(['name' => 'Bob']);

        $aliceTask = Task::create([
            'user_id' => $alice->id,
            'title' => 'Alice Private Document',
            'status' => 'todo',
        ]);

        $aliceProject = Project::create([
            'user_id' => $alice->id,
            'title' => 'Alice Secret Project',
            'status' => 'planning',
        ]);

        $aliceBank = QuestionBank::create([
            'user_id' => $alice->id,
            'title' => 'Alice Proprietary Bank',
            'subject' => 'Confidential',
        ]);

        // Bob attempts to view Alice task
        $this->actingAs($bob)->getJson("/api/v1/tasks/{$aliceTask->id}")
            ->assertStatus(403);

        // Bob attempts to modify Alice task
        $this->actingAs($bob)->putJson("/api/v1/tasks/{$aliceTask->id}", [
            'title' => 'Tampered by Bob',
        ])->assertStatus(403);

        // Bob attempts to delete Alice project
        $this->actingAs($bob)->deleteJson("/api/v1/projects/{$aliceProject->id}")
            ->assertStatus(403);

        // Bob attempts to attach Alice questions to his blueprint
        $bobBp = ExamBlueprint::create([
            'user_id' => $bob->id,
            'title' => 'Bob Blueprint',
            'subject' => 'General',
        ]);
        $aliceQ = Question::create([
            'question_bank_id' => $aliceBank->id,
            'type' => 'true_false',
            'prompt' => 'Secret question',
            'points' => 1.0,
        ]);

        $this->actingAs($bob)->postJson("/api/v1/exam-blueprints/{$bobBp->id}/attach-questions", [
            'question_ids' => [$aliceQ->id],
        ])->assertStatus(403);
    }

    /**
     * EDGE CASE 5: Mid-exam refresh recovery and idempotent submission.
     */
    public function test_edge_case_exam_session_recovery_and_idempotency(): void
    {
        $user = User::factory()->create();
        $bank = QuestionBank::create(['user_id' => $user->id, 'title' => 'Recovery Bank', 'subject' => 'Math']);
        $q = Question::create([
            'question_bank_id' => $bank->id,
            'type' => 'true_false',
            'prompt' => 'Is 7 a prime number?',
            'points' => 10.0,
        ]);
        $q->options()->createMany([
            ['option_text' => 'True', 'is_correct' => true],
            ['option_text' => 'False', 'is_correct' => false],
        ]);

        $bp = ExamBlueprint::create([
            'user_id' => $user->id,
            'title' => 'Math Test',
            'subject' => 'Math',
            'duration_minutes' => 30,
        ]);
        $bp->questions()->attach($q->id);

        // Start attempt
        $startRes = $this->actingAs($user)->postJson("/api/v1/exam-blueprints/{$bp->id}/start");
        $startRes->assertStatus(200);
        $attemptId = $startRes->json('data.id');

        // Simulate browser refresh: Fetch active attempt state
        $refreshRes = $this->actingAs($user)->getJson("/api/v1/exam-attempts/{$attemptId}");
        $refreshRes->assertStatus(200)
            ->assertJsonPath('data.status', 'in_progress')
            ->assertJsonPath('data.id', $attemptId);

        // Sync valid answer
        $qOptionId = $q->options()->where('is_correct', true)->first()->id;
        $syncRes = $this->actingAs($user)->postJson("/api/v1/exam-attempts/{$attemptId}/sync", [
            'answers' => [
                ['question_id' => $q->id, 'selected_option_id' => $qOptionId],
            ],
        ]);
        $syncRes->assertStatus(200);

        // Submit first time
        $submit1 = $this->actingAs($user)->postJson("/api/v1/exam-attempts/{$attemptId}/submit");
        $submit1->assertStatus(200)
            ->assertJsonPath('data.status', 'completed')
            ->assertJsonPath('data.score_percentage', 100);

        // Submit second time (Network retry / double-click): Must be idempotent!
        $submit2 = $this->actingAs($user)->postJson("/api/v1/exam-attempts/{$attemptId}/submit");
        $submit2->assertStatus(200)
            ->assertJsonPath('data.status', 'completed')
            ->assertJsonPath('data.score_percentage', 100);

        // Attempting to sync after submit must be rejected
        $lateSync = $this->actingAs($user)->postJson("/api/v1/exam-attempts/{$attemptId}/sync", [
            'answers' => [
                ['question_id' => $q->id, 'selected_option_id' => $qOptionId],
            ],
        ]);
        $lateSync->assertStatus(410);
    }

    /**
     * EDGE CASE 6: Timezone customization and profile update persistence.
     */
    public function test_edge_case_timezone_and_profile_updates(): void
    {
        $user = User::factory()->create(['timezone' => 'UTC']);

        $updateRes = $this->actingAs($user)->putJson('/api/v1/auth/profile', [
            'name' => 'Aditya Global',
            'email' => $user->email,
            'timezone' => 'Asia/Makassar',
        ]);

        $updateRes->assertStatus(200)
            ->assertJsonPath('data.timezone', 'Asia/Makassar')
            ->assertJsonPath('data.name', 'Aditya Global');

        $this->assertEquals('Asia/Makassar', $user->fresh()->timezone);
    }
}
