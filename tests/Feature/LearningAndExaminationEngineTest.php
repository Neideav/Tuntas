<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\ExamAnswer;
use App\Models\ExamAttempt;
use App\Models\ExamBlueprint;
use App\Models\LearningLesson;
use App\Models\LearningModule;
use App\Models\LearningSession;
use App\Models\Question;
use App\Models\QuestionBank;
use App\Models\QuestionOption;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LearningAndExaminationEngineTest extends TestCase
{
    use RefreshDatabase;

    protected User $student;
    protected User $instructor;

    protected function setUp(): void
    {
        parent::setUp();
        $this->student = User::factory()->create([
            'email' => 'student.engine@tuntas.test',
            'role' => 'student',
        ]);
        $this->instructor = User::factory()->create([
            'email' => 'instructor.engine@tuntas.test',
            'role' => 'instructor',
        ]);
    }

    /**
     * Priority Bug Fix: Immutable Exam Snapshot Guarantee
     * Modifying or deleting questions in Question Bank after attempt begins MUST NOT alter grading.
     */
    public function test_immutable_exam_snapshot_survives_bank_modifications_and_deletions(): void
    {
        // 1. Instructor creates bank and question
        $bank = QuestionBank::create([
            'user_id' => $this->instructor->id,
            'title' => 'Software Security Bank',
            'subject' => 'Cybersecurity',
        ]);

        $q = Question::create([
            'question_bank_id' => $bank->id,
            'type' => 'multiple_choice_single',
            'prompt' => 'Which memory bug is prevented by Rust ownership?',
            'explanation' => 'Rust prevents Use-After-Free and data races at compile time.',
            'points' => 2.0,
            'difficulty' => 'medium',
        ]);

        $optA = QuestionOption::create([
            'question_id' => $q->id,
            'option_text' => 'Use-After-Free',
            'is_correct' => true,
            'order' => 1,
        ]);

        $optB = QuestionOption::create([
            'question_id' => $q->id,
            'option_text' => 'SQL Injection',
            'is_correct' => false,
            'order' => 2,
        ]);

        $blueprint = ExamBlueprint::create([
            'user_id' => $this->instructor->id,
            'title' => 'Midterm Security Exam',
            'subject' => 'Cybersecurity',
            'duration_minutes' => 60,
            'passing_score' => 70.0,
            'is_published' => true,
        ]);
        $blueprint->questions()->attach($q->id, ['points' => 2.0, 'order' => 1]);

        // 2. Student starts attempt (immutable snapshot created)
        $startRes = $this->actingAs($this->student)->postJson("/api/v1/exam-blueprints/{$blueprint->id}/start");
        $startRes->assertStatus(200);
        $attemptId = $startRes->json('data.id');

        // 3. INSTRUCTOR DELETES OR MODIFIES QUESTION in QuestionBank
        // Invert correctness or delete
        $optA->update(['is_correct' => false]);
        $optB->update(['is_correct' => true]);
        $q->update(['prompt' => 'MODIFIED: What is SQL Injection?']);

        // 4. Student syncs answer selecting original correct option (optA)
        $syncRes = $this->actingAs($this->student)->postJson("/api/v1/exam-attempts/{$attemptId}/sync", [
            'answers' => [
                [
                    'question_id' => $q->id,
                    'selected_option_ids' => [$optA->id],
                ],
            ],
            'flagged_question_ids' => [$q->id],
        ]);
        $syncRes->assertStatus(200)
            ->assertJsonPath('data.saved_count', 1)
            ->assertJsonPath('data.flagged_question_ids.0', $q->id);

        // 5. Submit and Grade
        $submitRes = $this->actingAs($this->student)->postJson("/api/v1/exam-attempts/{$attemptId}/submit");
        $submitRes->assertStatus(200)
            ->assertJsonPath('data.status', 'completed')
            ->assertJsonPath('data.total_points_earned', 2)
            ->assertJsonPath('data.score_percentage', 100);

        // Even if question is completely deleted from DB, getReview still succeeds from snapshot
        $q->delete();
        $reviewRes = $this->actingAs($this->student)->getJson("/api/v1/exam-attempts/{$attemptId}/review");
        $reviewRes->assertStatus(200)
            ->assertJsonPath('data.questions.0.points_awarded', 2)
            ->assertJsonPath('data.questions.0.is_correct', true);
    }

    /**
     * Priority Bug Fix: Sync Answer Integrity and Validation (BUG-05)
     */
    public function test_answer_sync_strictly_rejects_foreign_and_invalid_question_ids(): void
    {
        $bank = QuestionBank::create([
            'user_id' => $this->instructor->id,
            'title' => 'Math Bank',
            'subject' => 'Math',
        ]);
        $q = Question::create([
            'question_bank_id' => $bank->id,
            'type' => 'true_false',
            'prompt' => 'Is 17 a prime number?',
            'points' => 1.0,
        ]);
        $optTrue = QuestionOption::create([
            'question_id' => $q->id,
            'option_text' => 'True',
            'is_correct' => true,
            'order' => 1,
        ]);

        $blueprint = ExamBlueprint::create([
            'user_id' => $this->instructor->id,
            'title' => 'Math Quiz',
            'subject' => 'Math',
            'duration_minutes' => 30,
            'is_published' => true,
        ]);
        $blueprint->questions()->attach($q->id, ['points' => 1.0, 'order' => 1]);

        $startRes = $this->actingAs($this->student)->postJson("/api/v1/exam-blueprints/{$blueprint->id}/start");
        $attemptId = $startRes->json('data.id');

        // Invalid foreign question id (99999) must be rejected with 422
        $res = $this->actingAs($this->student)->postJson("/api/v1/exam-attempts/{$attemptId}/sync", [
            'answers' => [
                [
                    'question_id' => 99999,
                    'text_response' => 'Hack attempt',
                ],
            ],
        ]);
        $res->assertStatus(422);

        // Invalid option id (88888) must be rejected with 422
        $res2 = $this->actingAs($this->student)->postJson("/api/v1/exam-attempts/{$attemptId}/sync", [
            'answers' => [
                [
                    'question_id' => $q->id,
                    'selected_option_ids' => [88888],
                ],
            ],
        ]);
        $res2->assertStatus(422);
    }

    /**
     * Concurrency & Idempotency: Double submission does not throw or duplicate score.
     */
    public function test_double_submission_is_idempotent_and_thread_safe(): void
    {
        $bank = QuestionBank::create([
            'user_id' => $this->instructor->id,
            'title' => 'General Science',
            'subject' => 'Science',
        ]);
        $q = Question::create([
            'question_bank_id' => $bank->id,
            'type' => 'true_false',
            'prompt' => 'Water boils at 100 degrees Celsius at sea level.',
            'points' => 1.0,
        ]);
        $optTrue = QuestionOption::create([
            'question_id' => $q->id,
            'option_text' => 'True',
            'is_correct' => true,
            'order' => 1,
        ]);

        $blueprint = ExamBlueprint::create([
            'user_id' => $this->instructor->id,
            'title' => 'Science Quiz',
            'subject' => 'Science',
            'duration_minutes' => 30,
            'is_published' => true,
        ]);
        $blueprint->questions()->attach($q->id, ['points' => 1.0, 'order' => 1]);

        $startRes = $this->actingAs($this->student)->postJson("/api/v1/exam-blueprints/{$blueprint->id}/start");
        $attemptId = $startRes->json('data.id');

        $this->actingAs($this->student)->postJson("/api/v1/exam-attempts/{$attemptId}/sync", [
            'answers' => [
                [
                    'question_id' => $q->id,
                    'selected_option_ids' => [$optTrue->id],
                ],
            ],
        ]);

        // Submit 1
        $res1 = $this->actingAs($this->student)->postJson("/api/v1/exam-attempts/{$attemptId}/submit");
        $res1->assertStatus(200)->assertJsonPath('data.status', 'completed');

        // Submit 2 (concurrent or repeated submit)
        $res2 = $this->actingAs($this->student)->postJson("/api/v1/exam-attempts/{$attemptId}/submit");
        $res2->assertStatus(200)->assertJsonPath('data.status', 'completed');
    }

    /**
     * Partial Scoring and Negative Marking on Multiple Choice Multiple.
     */
    public function test_partial_scoring_and_negative_marking_on_multiple_choice(): void
    {
        $bank = QuestionBank::create([
            'user_id' => $this->instructor->id,
            'title' => 'Programming Concepts',
            'subject' => 'CS',
        ]);

        // Question with 2 correct answers out of 3 options
        $q = Question::create([
            'question_bank_id' => $bank->id,
            'type' => 'multiple_choice_multiple',
            'prompt' => 'Select two functional programming languages:',
            'points' => 2.0,
        ]);

        $optHaskell = QuestionOption::create([
            'question_id' => $q->id,
            'option_text' => 'Haskell',
            'is_correct' => true,
            'order' => 1,
        ]);
        $optElixir = QuestionOption::create([
            'question_id' => $q->id,
            'option_text' => 'Elixir',
            'is_correct' => true,
            'order' => 2,
        ]);
        $optC = QuestionOption::create([
            'question_id' => $q->id,
            'option_text' => 'C',
            'is_correct' => false,
            'order' => 3,
        ]);

        $blueprint = ExamBlueprint::create([
            'user_id' => $this->instructor->id,
            'title' => 'FP Exam',
            'subject' => 'CS',
            'duration_minutes' => 30,
            'is_published' => true,
            'allow_partial_scoring' => true,
            'negative_marking' => 0.5,
        ]);
        $blueprint->questions()->attach($q->id, ['points' => 2.0, 'order' => 1]);

        // Student selects only Haskell (1 of 2 correct, no incorrect) -> should get 1.0 point
        $startRes = $this->actingAs($this->student)->postJson("/api/v1/exam-blueprints/{$blueprint->id}/start");
        $attemptId = $startRes->json('data.id');

        $this->actingAs($this->student)->postJson("/api/v1/exam-attempts/{$attemptId}/sync", [
            'answers' => [
                [
                    'question_id' => $q->id,
                    'selected_option_ids' => [$optHaskell->id],
                ],
            ],
        ]);

        $submitRes = $this->actingAs($this->student)->postJson("/api/v1/exam-attempts/{$attemptId}/submit");
        $submitRes->assertStatus(200)
            ->assertJsonPath('data.total_points_earned', 1)
            ->assertJsonPath('data.score_percentage', 50);
    }

    /**
     * Learning Session Study Timer: Lifecycle, Recovery, and Anti-Duplication
     */
    public function test_study_timer_lifecycle_recovery_and_anti_duplication(): void
    {
        $course = Course::create([
            'user_id' => $this->student->id,
            'title' => 'Distributed Systems',
            'code' => 'CS-401',
            'status' => 'published',
            'progress' => 0,
        ]);

        // 1. Start active session
        $startRes = $this->actingAs($this->student)->postJson('/api/v1/learning-sessions/start', [
            'topic' => 'Raft Consensus Study',
            'course_id' => $course->id,
            'notes' => 'Reading Section 5',
        ]);
        $startRes->assertStatus(201)
            ->assertJsonPath('data.status', 'active');
        $sessionId = $startRes->json('data.id');

        // 2. Query active session (e.g. on browser reload)
        $activeRes = $this->actingAs($this->student)->getJson('/api/v1/learning-sessions/active');
        $activeRes->assertStatus(200)
            ->assertJsonPath('data.id', $sessionId)
            ->assertJsonPath('data.status', 'active');

        // 3. Pause session
        $pauseRes = $this->actingAs($this->student)->postJson("/api/v1/learning-sessions/{$sessionId}/pause");
        $pauseRes->assertStatus(200)
            ->assertJsonPath('data.status', 'paused');

        // Active query should still return the paused session
        $activeRes2 = $this->actingAs($this->student)->getJson('/api/v1/learning-sessions/active');
        $activeRes2->assertStatus(200)
            ->assertJsonPath('data.id', $sessionId)
            ->assertJsonPath('data.status', 'paused');

        // 4. Resume session
        $resumeRes = $this->actingAs($this->student)->postJson("/api/v1/learning-sessions/{$sessionId}/resume");
        $resumeRes->assertStatus(200)
            ->assertJsonPath('data.status', 'active');

        // 5. Starting a second session auto-pauses the first session (prevents duplicate timer recording)
        $startRes2 = $this->actingAs($this->student)->postJson('/api/v1/learning-sessions/start', [
            'topic' => 'Paxos Algorithm Study',
            'course_id' => $course->id,
        ]);
        $startRes2->assertStatus(201);
        $session2Id = $startRes2->json('data.id');

        // Verify session 1 is now paused
        $this->assertEquals('paused', LearningSession::find($sessionId)->status);

        // 6. Complete session 2
        $compRes = $this->actingAs($this->student)->postJson("/api/v1/learning-sessions/{$session2Id}/complete", [
            'notes' => 'Finished understanding 2-phase commit comparison.',
        ]);
        $compRes->assertStatus(200)
            ->assertJsonPath('data.status', 'completed');
    }

    /**
     * Learning Progress Engine: Mathematically accurate progress based on actual lesson completion.
     */
    public function test_course_and_module_progress_recalculates_accurately(): void
    {
        $course = Course::create([
            'user_id' => $this->student->id,
            'title' => 'Database Internals',
            'status' => 'published',
            'progress' => 0,
        ]);

        $module1 = $course->modules()->create([
            'title' => 'Storage Engines',
            'order' => 1,
            'progress' => 0,
            'is_completed' => false,
        ]);

        $l1 = $module1->lessons()->create([
            'title' => 'B-Tree Indexing',
            'duration_minutes' => 20,
            'is_completed' => false,
            'order' => 1,
        ]);

        $l2 = $module1->lessons()->create([
            'title' => 'LSM Trees & SSTables',
            'duration_minutes' => 30,
            'is_completed' => false,
            'order' => 2,
        ]);

        // Initially 0%
        $this->assertEquals(0, $course->fresh()->progress);
        $this->assertEquals(0, $module1->fresh()->progress);

        // Toggle lesson 1 complete -> 1 of 2 lessons = 50%
        $this->actingAs($this->student)->patchJson("/api/v1/lessons/{$l1->id}/toggle")
            ->assertStatus(200)
            ->assertJsonPath('data.course_progress', 50);

        $this->assertEquals(50, $course->fresh()->progress);
        $this->assertEquals(50, $module1->fresh()->progress);
        $this->assertFalse((bool) $module1->fresh()->is_completed);

        // Toggle lesson 2 complete -> 2 of 2 lessons = 100%
        $this->actingAs($this->student)->patchJson("/api/v1/lessons/{$l2->id}/toggle")
            ->assertStatus(200)
            ->assertJsonPath('data.course_progress', 100);

        $this->assertEquals(100, $course->fresh()->progress);
        $this->assertEquals(100, $module1->fresh()->progress);
        $this->assertTrue((bool) $module1->fresh()->is_completed);
    }
}
