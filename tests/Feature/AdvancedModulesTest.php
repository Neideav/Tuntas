<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\ExamAttempt;
use App\Models\ExamBlueprint;
use App\Models\Goal;
use App\Models\Habit;
use App\Models\Question;
use App\Models\QuestionBank;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdvancedModulesTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create([
            'email' => 'engineer@tuntas.test',
            'role' => 'student',
        ]);
    }

    public function test_habit_creation_and_streak_tracking(): void
    {
        $createRes = $this->actingAs($this->user)->postJson('/api/v1/habits', [
            'title' => 'Read Clean Architecture',
            'frequency' => 'daily',
            'target_count' => 1,
            'color' => '#10b981',
            'freeze_tokens' => 2,
        ]);

        $createRes->assertStatus(201)
            ->assertJsonPath('success', true);

        $habitId = $createRes->json('data.id');

        // Toggle completion today
        $todayStr = Carbon::today()->toDateString();
        $toggleRes = $this->actingAs($this->user)->postJson("/api/v1/habits/{$habitId}/toggle", [
            'date' => $todayStr,
        ]);

        $toggleRes->assertStatus(200)
            ->assertJsonPath('data.habit.current_streak', 1);

        // Toggle completion yesterday to form a 2-day streak
        $yesterdayStr = Carbon::today()->subDay()->toDateString();
        $yesterdayRes = $this->actingAs($this->user)->postJson("/api/v1/habits/{$habitId}/toggle", [
            'date' => $yesterdayStr,
        ]);

        $yesterdayRes->assertStatus(200)
            ->assertJsonPath('data.habit.current_streak', 2);
    }

    public function test_habit_freeze_token_application(): void
    {
        $habit = Habit::create([
            'user_id' => $this->user->id,
            'title' => 'LeetCode Problem',
            'frequency' => 'daily',
            'freeze_tokens' => 2,
        ]);

        $freezeDate = Carbon::today()->subDays(2)->toDateString();
        $response = $this->actingAs($this->user)->postJson("/api/v1/habits/{$habit->id}/freeze", [
            'date' => $freezeDate,
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.habit.freeze_tokens', 1);
    }

    public function test_goal_milestones_and_progress_recalculation(): void
    {
        $goalRes = $this->actingAs($this->user)->postJson('/api/v1/goals', [
            'title' => 'Master Distributed Systems',
            'start_date' => Carbon::today()->toDateString(),
            'target_date' => Carbon::today()->addMonths(3)->toDateString(),
        ]);

        $goalRes->assertStatus(201);
        $goalId = $goalRes->json('data.id');

        // Add milestone 1 (target: 100, current: 50 -> 50%)
        $m1Res = $this->actingAs($this->user)->postJson("/api/v1/goals/{$goalId}/milestones", [
            'title' => 'Read Designing Data-Intensive Applications',
            'target_value' => 100,
            'current_value' => 50,
            'unit' => '%',
        ]);
        $m1Res->assertStatus(201)
            ->assertJsonPath('data.goal_progress', 50);

        $m1Id = $m1Res->json('data.milestone.id');

        // Add milestone 2 (target: 10, current: 10 -> 100%)
        $m2Res = $this->actingAs($this->user)->postJson("/api/v1/goals/{$goalId}/milestones", [
            'title' => 'Build Raft consensus lab',
            'target_value' => 10,
            'current_value' => 10,
            'is_completed' => true,
        ]);
        // Total progress = (50% + 100%) / 2 = 75%
        $m2Res->assertStatus(201)
            ->assertJsonPath('data.goal_progress', 75);

        // Update milestone 1 to 100 -> Goal progress reaches 100% and marks achieved
        $updateM1Res = $this->actingAs($this->user)->patchJson("/api/v1/milestones/{$m1Id}", [
            'current_value' => 100,
        ]);
        $updateM1Res->assertStatus(200)
            ->assertJsonPath('data.goal_progress', 100);

        $goal = Goal::find($goalId);
        $this->assertEquals('achieved', $goal->status);
    }

    public function test_learning_course_and_sessions(): void
    {
        $courseRes = $this->actingAs($this->user)->postJson('/api/v1/courses', [
            'title' => 'Advanced Algorithms',
            'code' => 'CS-401',
        ]);
        $courseRes->assertStatus(201);
        $courseId = $courseRes->json('data.id');

        // Add module
        $moduleRes = $this->actingAs($this->user)->postJson("/api/v1/courses/{$courseId}/modules", [
            'title' => 'Dynamic Programming',
        ]);
        $moduleRes->assertStatus(201);
        $moduleId = $moduleRes->json('data.id');

        // Add lesson
        $lessonRes = $this->actingAs($this->user)->postJson("/api/v1/modules/{$moduleId}/lessons", [
            'title' => 'Knapsack Problem',
            'duration_minutes' => 30,
        ]);
        $lessonRes->assertStatus(201);
        $lessonId = $lessonRes->json('data.id');

        // Toggle lesson completion -> course progress reaches 100%
        $toggleRes = $this->actingAs($this->user)->patchJson("/api/v1/lessons/{$lessonId}/toggle");
        $toggleRes->assertStatus(200)
            ->assertJsonPath('data.course_progress', 100);

        // Record learning session
        $sessionRes = $this->actingAs($this->user)->postJson('/api/v1/learning-sessions', [
            'course_id' => $courseId,
            'lesson_id' => $lessonId,
            'topic' => 'Knapsack Dynamic Programming Matrix Analysis',
            'duration_minutes' => 30,
            'session_date' => Carbon::today()->toDateString(),
        ]);
        $sessionRes->assertStatus(201);
    }

    public function test_examination_assessment_engine_lifecycle_and_security(): void
    {
        // 1. Create Question Bank
        $bank = QuestionBank::create([
            'user_id' => $this->user->id,
            'title' => 'Software Architecture Bank',
            'subject' => 'System Design',
        ]);

        // 2. Add Question with options
        $question = $bank->questions()->create([
            'type' => 'multiple_choice_single',
            'prompt' => 'What does CAP stand for in Distributed Systems?',
            'explanation' => 'Consistency, Availability, Partition Tolerance.',
            'points' => 5.0,
            'difficulty' => 'medium',
        ]);

        $optCorrect = $question->options()->create([
            'option_text' => 'Consistency, Availability, Partition Tolerance',
            'is_correct' => true,
            'order' => 1,
        ]);

        $optWrong = $question->options()->create([
            'option_text' => 'Concurrency, Atomicity, Persistence',
            'is_correct' => false,
            'order' => 2,
        ]);

        // 3. Create Blueprint
        $blueprint = ExamBlueprint::create([
            'user_id' => $this->user->id,
            'title' => 'Distributed Systems Midterm',
            'subject' => 'Computer Science',
            'duration_minutes' => 60,
            'passing_score' => 70.0,
            'shuffle_questions' => false,
            'shuffle_options' => false,
            'is_published' => true,
        ]);

        $blueprint->questions()->attach($question->id, ['points' => 5.0, 'order' => 1]);

        // 4. Start Attempt
        $startRes = $this->actingAs($this->user)->postJson("/api/v1/exam-blueprints/{$blueprint->id}/start");
        $startRes->assertStatus(200)
            ->assertJsonPath('success', true);

        $attemptId = $startRes->json('data.id');
        $snapshot = $startRes->json('data.questions_snapshot');

        $this->assertNotEmpty($snapshot);
        $snapshotOptions = $snapshot[0]['options'];

        // SECURITY CHECK: Ensure 'is_correct' and 'explanation' are NOT leaked in active student snapshot
        $this->assertArrayNotHasKey('explanation', $snapshot[0]);
        foreach ($snapshotOptions as $opt) {
            $this->assertArrayNotHasKey('is_correct', $opt, 'Security vulnerability: is_correct leaked in exam session snapshot!');
        }

        // 5. Sync Student Answer
        $syncRes = $this->actingAs($this->user)->postJson("/api/v1/exam-attempts/{$attemptId}/sync", [
            'answers' => [
                [
                    'question_id' => $question->id,
                    'selected_option_ids' => [$optCorrect->id],
                ],
            ],
        ]);
        $syncRes->assertStatus(200)
            ->assertJsonPath('data.saved_count', 1);

        // 6. Proctoring Integrity Event
        $integrityRes = $this->actingAs($this->user)->postJson("/api/v1/exam-attempts/{$attemptId}/integrity", [
            'event_type' => 'tab_switch',
            'details' => 'Switched to Chrome DevTools',
        ]);
        $integrityRes->assertStatus(200)
            ->assertJsonPath('data.event_type', 'tab_switch');

        // 7. Submit and Grade
        $submitRes = $this->actingAs($this->user)->postJson("/api/v1/exam-attempts/{$attemptId}/submit");
        $submitRes->assertStatus(200)
            ->assertJsonPath('data.status', 'completed')
            ->assertJsonPath('data.total_points_earned', 5)
            ->assertJsonPath('data.score_percentage', 100)
            ->assertJsonPath('data.is_passed', true);

        // 8. Get Post-Exam Review (Now explanations and results are authorized to be shown)
        $reviewRes = $this->actingAs($this->user)->getJson("/api/v1/exam-attempts/{$attemptId}/review");
        $reviewRes->assertStatus(200)
            ->assertJsonPath('data.questions.0.is_correct', true)
            ->assertJsonPath('data.questions.0.explanation', 'Consistency, Availability, Partition Tolerance.')
            ->assertJsonPath('data.integrity_summary.tab_switch', 1);
    }

    public function test_expired_attempt_rejects_sync(): void
    {
        $blueprint = ExamBlueprint::create([
            'user_id' => $this->user->id,
            'title' => 'Quick Quiz',
            'subject' => 'General',
            'duration_minutes' => 10,
            'is_published' => true,
        ]);

        $bank = QuestionBank::create([
            'user_id' => $this->user->id,
            'title' => 'Bank',
            'subject' => 'General',
        ]);

        $q = $bank->questions()->create([
            'prompt' => 'Is 1 + 1 = 2?',
            'type' => 'true_false',
            'points' => 1.0,
        ]);

        $blueprint->questions()->attach($q->id, ['points' => 1.0, 'order' => 1]);

        $attempt = ExamAttempt::create([
            'id' => (string) \Illuminate\Support\Str::uuid(),
            'exam_blueprint_id' => $blueprint->id,
            'user_id' => $this->user->id,
            'status' => 'in_progress',
            'started_at' => Carbon::now()->subMinutes(20),
            'expires_at' => Carbon::now()->subMinutes(5), // Expired 5 minutes ago
            'total_points_possible' => 1.0,
            'questions_snapshot' => [],
        ]);

        $response = $this->actingAs($this->user)->postJson("/api/v1/exam-attempts/{$attempt->id}/sync", [
            'answers' => [
                ['question_id' => $q->id, 'text_response' => 'true'],
            ],
        ]);

        $response->assertStatus(410)
            ->assertJsonPath('success', false);
    }
}

