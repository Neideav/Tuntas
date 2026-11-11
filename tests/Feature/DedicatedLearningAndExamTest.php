<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\ExamAttempt;
use App\Models\ExamBlueprint;
use App\Models\LearningLesson;
use App\Models\LearningModule;
use App\Models\LearningSession;
use App\Models\Question;
use App\Models\QuestionBank;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DedicatedLearningAndExamTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;
    protected User $otherUser;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create([
            'email' => 'student@tuntas.test',
            'role' => 'student',
        ]);
        $this->otherUser = User::factory()->create([
            'email' => 'other@tuntas.test',
            'role' => 'student',
        ]);
    }

    public function test_learning_subjects_and_materials_crud(): void
    {
        // 1. Create Course (Learning Subject)
        $cRes = $this->actingAs($this->user)->postJson('/api/v1/courses', [
            'title' => 'Operating Systems & Concurrency',
            'code' => 'CS-302',
            'description' => 'Kernel design, mutexes, and scheduling',
            'color' => '#8b5cf6',
        ]);
        $cRes->assertStatus(201);
        $courseId = $cRes->json('data.id');

        // 2. Update Course
        $upCRes = $this->actingAs($this->user)->putJson("/api/v1/courses/{$courseId}", [
            'title' => 'Modern Operating Systems & Concurrency',
        ]);
        $upCRes->assertStatus(200)
            ->assertJsonPath('data.title', 'Modern Operating Systems & Concurrency');

        // 3. Create Module
        $mRes = $this->actingAs($this->user)->postJson("/api/v1/courses/{$courseId}/modules", [
            'title' => 'Process Synchronization',
            'description' => 'Semaphores and Monitors',
        ]);
        $mRes->assertStatus(201);
        $moduleId = $mRes->json('data.id');

        // 4. Update Module
        $upMRes = $this->actingAs($this->user)->putJson("/api/v1/modules/{$moduleId}", [
            'title' => 'Process Synchronization & Deadlocks',
        ]);
        $upMRes->assertStatus(200)
            ->assertJsonPath('data.title', 'Process Synchronization & Deadlocks');

        // 5. Create Lessons (Learning Materials) with resource references
        $l1Res = $this->actingAs($this->user)->postJson("/api/v1/modules/{$moduleId}/lessons", [
            'title' => 'Peterson Solution & Hardware Lock',
            'content' => 'Atomic instructions test_and_set',
            'resource_url' => 'https://kernel.org/doc/Documentation/locking/mutex-design.txt',
            'duration_minutes' => 30,
        ]);
        $l1Res->assertStatus(201);
        $l1Id = $l1Res->json('data.id');

        $l2Res = $this->actingAs($this->user)->postJson("/api/v1/modules/{$moduleId}/lessons", [
            'title' => 'Bankers Algorithm for Deadlock Avoidance',
            'content' => 'Safe state evaluation matrices',
            'resource_url' => 'https://mit.edu/6.828/lectures/deadlock.pdf',
            'duration_minutes' => 45,
        ]);
        $l2Res->assertStatus(201);
        $l2Id = $l2Res->json('data.id');

        // Initial progress: 0/2 = 0%
        $course = Course::find($courseId);
        $this->assertEquals(0, $course->progress);

        // 6. Complete Lesson 1 -> 1/2 = 50%
        $togRes = $this->actingAs($this->user)->patchJson("/api/v1/lessons/{$l1Id}/toggle");
        $togRes->assertStatus(200)
            ->assertJsonPath('data.course_progress', 50);

        // 7. Update Lesson 2
        $upLRes = $this->actingAs($this->user)->putJson("/api/v1/lessons/{$l2Id}", [
            'title' => 'Advanced Bankers Algorithm Matrix Modeling',
        ]);
        $upLRes->assertStatus(200)
            ->assertJsonPath('data.title', 'Advanced Bankers Algorithm Matrix Modeling');

        // 8. Delete Lesson 2 -> Remaining: 1 lesson (which is completed) -> 100%
        $delLRes = $this->actingAs($this->user)->deleteJson("/api/v1/lessons/{$l2Id}");
        $delLRes->assertStatus(200);

        $course->refresh();
        $this->assertEquals(100, $course->progress);
    }

    public function test_study_sessions_and_learning_analytics(): void
    {
        $course = Course::create([
            'user_id' => $this->user->id,
            'title' => 'Distributed Database Architecture',
            'code' => 'CS-501',
            'progress' => 80,
        ]);

        // Record 2 study sessions
        $this->actingAs($this->user)->postJson('/api/v1/learning-sessions', [
            'course_id' => $course->id,
            'topic' => 'Spanner Paxos Groups Deep Dive',
            'duration_minutes' => 60,
            'session_date' => Carbon::today()->toDateString(),
            'notes' => 'TrueTime API analysis with GPS atomic clocks',
        ])->assertStatus(201);

        $this->actingAs($this->user)->postJson('/api/v1/learning-sessions', [
            'course_id' => $course->id,
            'topic' => 'Two-Phase Commit vs Raft consensus',
            'duration_minutes' => 45,
            'session_date' => Carbon::yesterday()->toDateString(),
        ])->assertStatus(201);

        // Request analytics
        $res = $this->actingAs($this->user)->getJson('/api/v1/learning-analytics');
        $res->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.total_study_minutes', 105)
            ->assertJsonPath('data.total_sessions', 2)
            ->assertJsonPath('data.consistency_days_30', 2);
    }

    public function test_question_bank_and_multi_type_questions_crud(): void
    {
        // 1. Create Question Bank
        $bankRes = $this->actingAs($this->user)->postJson('/api/v1/question-banks', [
            'title' => 'Backend Engineering Comprehensive Bank',
            'subject' => 'Software Engineering',
            'description' => 'Database indices, transactions, and distributed cache',
        ]);
        $bankRes->assertStatus(201);
        $bankId = $bankRes->json('data.id');

        // 2. Question: Multiple Choice Single
        $q1Res = $this->actingAs($this->user)->postJson("/api/v1/question-banks/{$bankId}/questions", [
            'type' => 'multiple_choice_single',
            'prompt' => 'Which index structure is standard for PostgreSQL B-Tree?',
            'explanation' => 'PostgreSQL implements Lehman & Yao B-Tree algorithm.',
            'points' => 5.0,
            'difficulty' => 'medium',
            'options' => [
                ['option_text' => 'B+ Tree with high concurrency Lehman & Yao locks', 'is_correct' => true],
                ['option_text' => 'Red-Black Tree', 'is_correct' => false],
                ['option_text' => 'SkipList', 'is_correct' => false],
            ],
        ]);
        $q1Res->assertStatus(201);
        $q1Id = $q1Res->json('data.id');

        // 3. Question: Multiple Choice Multiple (Multi-select)
        $q2Res = $this->actingAs($this->user)->postJson("/api/v1/question-banks/{$bankId}/questions", [
            'type' => 'multiple_choice_multiple',
            'prompt' => 'Which of the following are ACID properties in RDBMS? (Select all that apply)',
            'points' => 5.0,
            'difficulty' => 'easy',
            'options' => [
                ['option_text' => 'Atomicity', 'is_correct' => true],
                ['option_text' => 'Consistency', 'is_correct' => true],
                ['option_text' => 'Availability', 'is_correct' => false],
                ['option_text' => 'Durability', 'is_correct' => true],
            ],
        ]);
        $q2Res->assertStatus(201);

        // 4. Question: Short Answer
        $q3Res = $this->actingAs($this->user)->postJson("/api/v1/question-banks/{$bankId}/questions", [
            'type' => 'short_answer',
            'prompt' => 'What isolation level avoids non-repeatable reads in ANSI SQL?',
            'explanation' => 'Repeatable Read (or Serializable) avoids non-repeatable reads.',
            'points' => 5.0,
            'difficulty' => 'medium',
            'options' => [
                ['option_text' => 'repeatable read', 'is_correct' => true],
                ['option_text' => 'serializable', 'is_correct' => true],
            ],
        ]);
        $q3Res->assertStatus(201);

        // 5. Update Question
        $upQRes = $this->actingAs($this->user)->putJson("/api/v1/questions/{$q1Id}", [
            'points' => 10.0,
            'difficulty' => 'hard',
        ]);
        $upQRes->assertStatus(200)
            ->assertJsonPath('data.difficulty', 'hard');
        $this->assertEquals(10, (int) $upQRes->json('data.points'));

        // 6. Delete Question
        $delQRes = $this->actingAs($this->user)->deleteJson("/api/v1/questions/{$q1Id}");
        $delQRes->assertStatus(200);
        $this->assertNull(Question::find($q1Id));
    }

    public function test_exam_attempt_execution_anti_leak_and_grading(): void
    {
        // 1. Setup Bank & Questions
        $bank = QuestionBank::create([
            'user_id' => $this->user->id,
            'title' => 'Certification Bank',
            'subject' => 'Architecture',
        ]);

        // Q1: True / False
        $q1 = $bank->questions()->create([
            'type' => 'true_false',
            'prompt' => 'In a distributed system, network partitions cannot be prevented.',
            'explanation' => 'Under Brewer CAP theorem, networks are prone to partitions.',
            'points' => 5.0,
        ]);
        $q1->options()->create(['option_text' => 'True', 'is_correct' => true, 'order' => 1]);
        $q1->options()->create(['option_text' => 'False', 'is_correct' => false, 'order' => 2]);

        // Q2: Short Answer
        $q2 = $bank->questions()->create([
            'type' => 'short_answer',
            'prompt' => 'What data structure provides O(1) average lookup time?',
            'explanation' => 'Hash table (or HashMap, Hash map) provides amortized O(1).',
            'points' => 5.0,
        ]);
        $q2->options()->create(['option_text' => 'hash table', 'is_correct' => true]);
        $q2->options()->create(['option_text' => 'hashmap', 'is_correct' => true]);

        // 2. Setup Blueprint
        $course = Course::create([
            'user_id' => $this->user->id,
            'title' => 'System Design Certification',
            'code' => 'SYS-101',
        ]);

        $blueprint = ExamBlueprint::create([
            'user_id' => $this->user->id,
            'course_id' => $course->id,
            'title' => 'System Design Qualifying Exam',
            'subject' => 'System Design',
            'duration_minutes' => 45,
            'passing_score' => 70.0,
            'max_attempts' => 1,
            'shuffle_questions' => false,
            'shuffle_options' => false,
            'is_published' => true,
        ]);

        $blueprint->questions()->attach([
            $q1->id => ['points' => 5.0, 'order' => 1],
            $q2->id => ['points' => 5.0, 'order' => 2],
        ]);

        // 3. Start Attempt
        $startRes = $this->actingAs($this->user)->postJson("/api/v1/exam-blueprints/{$blueprint->id}/start");
        $startRes->assertStatus(200);
        $attemptId = $startRes->json('data.id');

        // SECURITY CHECK: Verify snapshot does NOT leak is_correct or explanation
        $snapshot = $startRes->json('data.questions_snapshot');
        $this->assertCount(2, $snapshot);
        $this->assertArrayNotHasKey('explanation', $snapshot[0]);
        foreach ($snapshot[0]['options'] as $opt) {
            $this->assertArrayNotHasKey('is_correct', $opt);
        }

        // 4. Test Reconnection / Resuming active session without duplicating
        $resumeRes = $this->actingAs($this->user)->postJson("/api/v1/exam-blueprints/{$blueprint->id}/start");
        $resumeRes->assertStatus(200);
        $this->assertEquals($attemptId, $resumeRes->json('data.id'));

        // 5. Sync Answers: Q1 = True (correct), Q2 = 'HashMap' (correct trimmed case-insensitive)
        $trueOpt = $q1->options()->where('is_correct', true)->first();

        $syncRes = $this->actingAs($this->user)->postJson("/api/v1/exam-attempts/{$attemptId}/sync", [
            'answers' => [
                [
                    'question_id' => $q1->id,
                    'selected_option_ids' => [$trueOpt->id],
                ],
                [
                    'question_id' => $q2->id,
                    'text_response' => '  HashMap  ', // whitespace & mixed case
                ],
            ],
        ]);
        $syncRes->assertStatus(200)
            ->assertJsonPath('data.saved_count', 2);

        // 6. Proctoring Integrity Event
        $integRes = $this->actingAs($this->user)->postJson("/api/v1/exam-attempts/{$attemptId}/integrity", [
            'event_type' => 'tab_switch',
            'details' => 'Tab switch to external window',
        ]);
        $integRes->assertStatus(200);

        // 7. Submit and Evaluate
        $submitRes = $this->actingAs($this->user)->postJson("/api/v1/exam-attempts/{$attemptId}/submit");
        $submitRes->assertStatus(200)
            ->assertJsonPath('data.status', 'completed')
            ->assertJsonPath('data.total_points_earned', 10)
            ->assertJsonPath('data.score_percentage', 100)
            ->assertJsonPath('data.is_passed', true);

        // 8. Review Screen (Authorized & Shows Full Analysis)
        $reviewRes = $this->actingAs($this->user)->getJson("/api/v1/exam-attempts/{$attemptId}/review");
        $reviewRes->assertStatus(200)
            ->assertJsonPath('data.questions.0.is_correct', true)
            ->assertJsonPath('data.questions.1.is_correct', true)
            ->assertJsonPath('data.integrity_summary.tab_switch', 1);

        // 9. Verify Max Attempts Constraint (Limit = 1)
        $secondAttemptRes = $this->actingAs($this->user)->postJson("/api/v1/exam-blueprints/{$blueprint->id}/start");
        $secondAttemptRes->assertStatus(400)
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'Maximum attempt limit reached for this examination.');

        // 10. Verify Integration with Learning Analytics
        $analyticsRes = $this->actingAs($this->user)->getJson('/api/v1/learning-analytics');
        $analyticsRes->assertStatus(200);
        $recentResults = $analyticsRes->json('data.recent_exam_results');
        $this->assertNotEmpty($recentResults);
        $this->assertEquals('System Design Qualifying Exam', $recentResults[0]['title']);
        $this->assertTrue($recentResults[0]['is_passed']);
    }

    public function test_examination_availability_window_restrictions(): void
    {
        $bank = QuestionBank::create([
            'user_id' => $this->user->id,
            'title' => 'Bank',
            'subject' => 'General',
        ]);
        $q = $bank->questions()->create(['prompt' => '1+1?', 'points' => 1.0]);

        // Future blueprint
        $futureBp = ExamBlueprint::create([
            'user_id' => $this->user->id,
            'title' => 'Future Exam',
            'subject' => 'General',
            'duration_minutes' => 30,
            'starts_at' => Carbon::now()->addDays(5),
            'is_published' => true,
        ]);
        $futureBp->questions()->attach($q->id, ['points' => 1.0, 'order' => 1]);

        $futureRes = $this->actingAs($this->user)->postJson("/api/v1/exam-blueprints/{$futureBp->id}/start");
        $futureRes->assertStatus(400)
            ->assertJsonPath('message', 'This examination is not yet available.');

        // Past blueprint
        $pastBp = ExamBlueprint::create([
            'user_id' => $this->user->id,
            'title' => 'Past Exam',
            'subject' => 'General',
            'duration_minutes' => 30,
            'ends_at' => Carbon::now()->subDays(1),
            'is_published' => true,
        ]);
        $pastBp->questions()->attach($q->id, ['points' => 1.0, 'order' => 1]);

        $pastRes = $this->actingAs($this->user)->postJson("/api/v1/exam-blueprints/{$pastBp->id}/start");
        $pastRes->assertStatus(400)
            ->assertJsonPath('message', 'This examination availability period has ended.');
    }

    public function test_unauthorized_attempt_access_is_prevented(): void
    {
        $blueprint = ExamBlueprint::create([
            'user_id' => $this->user->id,
            'title' => 'Security Exam',
            'subject' => 'Security',
            'duration_minutes' => 30,
            'is_published' => true,
        ]);

        $bank = QuestionBank::create([
            'user_id' => $this->user->id,
            'title' => 'Bank',
            'subject' => 'Security',
        ]);
        $q = $bank->questions()->create(['prompt' => 'Is SSL secure?', 'points' => 1.0]);
        $blueprint->questions()->attach($q->id, ['points' => 1.0, 'order' => 1]);

        // User starts attempt
        $startRes = $this->actingAs($this->user)->postJson("/api/v1/exam-blueprints/{$blueprint->id}/start");
        $attemptId = $startRes->json('data.id');

        // Other user attempts to sync answers to user's attempt
        $unauthSync = $this->actingAs($this->otherUser)->postJson("/api/v1/exam-attempts/{$attemptId}/sync", [
            'answers' => [
                ['question_id' => $q->id, 'text_response' => 'hacked'],
            ],
        ]);
        $unauthSync->assertStatus(403);

        // Other user attempts to submit user's attempt
        $unauthSubmit = $this->actingAs($this->otherUser)->postJson("/api/v1/exam-attempts/{$attemptId}/submit");
        $unauthSubmit->assertStatus(403);
    }
}
