<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\ExamAnswer;
use App\Models\ExamAttempt;
use App\Models\ExamBlueprint;
use App\Models\LearningSession;
use App\Models\Question;
use App\Models\QuestionBank;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ManualGradingAndSecurityEnhancementTest extends TestCase
{
    use RefreshDatabase;

    public function test_blueprints_show_sanitizes_questions_for_non_owner_students(): void
    {
        $instructor = User::factory()->create();
        $student = User::factory()->create();

        $bank = QuestionBank::create([
            'user_id' => $instructor->id,
            'title' => 'Software Engineering Bank',
            'subject' => 'SE',
        ]);

        $q = $bank->questions()->create([
            'type' => 'multiple_choice_single',
            'prompt' => 'What is OOP?',
            'explanation' => 'Confidential instructor explanation',
            'points' => 5.0,
        ]);

        $q->options()->createMany([
            ['option_text' => 'Object Oriented Programming', 'is_correct' => true, 'order' => 1],
            ['option_text' => 'Only One Program', 'is_correct' => false, 'order' => 2],
        ]);

        $blueprint = ExamBlueprint::create([
            'user_id' => $instructor->id,
            'title' => 'OOP Midterm',
            'subject' => 'SE',
            'duration_minutes' => 60,
            'passing_score' => 70,
            'is_published' => true,
        ]);
        $blueprint->questions()->attach($q->id, ['points' => 5.0, 'order' => 1]);

        // 1. Instructor view (owner)
        $instructorRes = $this->actingAs($instructor)->getJson("/api/v1/exam-blueprints/{$blueprint->id}");
        $instructorRes->assertOk();
        $this->assertEquals('Confidential instructor explanation', $instructorRes->json('data.questions.0.explanation'));
        $this->assertTrue($instructorRes->json('data.questions.0.options.0.is_correct'));

        // 2. Student view (non-owner): correct answers & explanation stripped
        $studentRes = $this->actingAs($student)->getJson("/api/v1/exam-blueprints/{$blueprint->id}");
        $studentRes->assertOk();
        $this->assertArrayNotHasKey('explanation', $studentRes->json('data.questions.0'));
        $this->assertArrayNotHasKey('is_correct', $studentRes->json('data.questions.0.options.0'));
    }

    public function test_cannot_attach_questions_from_other_users_question_bank(): void
    {
        $userA = User::factory()->create();
        $userB = User::factory()->create();

        $bankB = QuestionBank::create([
            'user_id' => $userB->id,
            'title' => 'User B Secret Bank',
            'subject' => 'Secret',
        ]);

        $qB = $bankB->questions()->create([
            'type' => 'multiple_choice_single',
            'prompt' => 'User B question',
            'points' => 2.0,
        ]);

        $blueprintA = ExamBlueprint::create([
            'user_id' => $userA->id,
            'title' => 'User A Blueprint',
            'subject' => 'General',
            'duration_minutes' => 30,
        ]);

        $res = $this->actingAs($userA)->postJson("/api/v1/exam-blueprints/{$blueprintA->id}/attach-questions", [
            'question_ids' => [$qB->id],
        ]);

        $res->assertStatus(403);
    }

    public function test_manual_grading_lifecycle_for_essay_questions(): void
    {
        $instructor = User::factory()->create();
        $student = User::factory()->create();

        $bank = QuestionBank::create([
            'user_id' => $instructor->id,
            'title' => 'Essay Bank',
            'subject' => 'Literature',
        ]);

        $qEssay = $bank->questions()->create([
            'type' => 'essay',
            'prompt' => 'Explain the core theme of Hamlet.',
            'points' => 20.0,
        ]);

        $blueprint = ExamBlueprint::create([
            'user_id' => $instructor->id,
            'title' => 'Literature Final',
            'subject' => 'Literature',
            'duration_minutes' => 60,
            'passing_score' => 70,
            'is_published' => true,
        ]);
        $blueprint->questions()->attach($qEssay->id, ['points' => 20.0, 'order' => 1]);

        // Student starts exam
        $startRes = $this->actingAs($student)->postJson("/api/v1/exam-blueprints/{$blueprint->id}/start");
        $startRes->assertOk();
        $attemptId = $startRes->json('data.id');

        // Student syncs answer
        $this->actingAs($student)->postJson("/api/v1/exam-attempts/{$attemptId}/sync", [
            'answers' => [
                [
                    'question_id' => $qEssay->id,
                    'text_response' => 'The central theme revolves around moral corruption, grief, and the consequences of revenge.',
                ],
            ],
        ])->assertOk();

        // Student submits exam -> should transition to 'grading', not 'completed'
        $submitRes = $this->actingAs($student)->postJson("/api/v1/exam-attempts/{$attemptId}/submit");
        $submitRes->assertOk();
        $this->assertEquals('grading', $submitRes->json('data.status'));
        $this->assertEquals(0, $submitRes->json('data.total_points_earned'));

        // Instructor views grading queue
        $queueRes = $this->actingAs($instructor)->getJson('/api/v1/exam-grading');
        $queueRes->assertOk();
        $this->assertCount(1, $queueRes->json('data'));
        $this->assertEquals($attemptId, $queueRes->json('data.0.id'));

        // Instructor loads attempt for grading
        $gradingShowRes = $this->actingAs($instructor)->getJson("/api/v1/exam-grading/{$attemptId}");
        $gradingShowRes->assertOk();
        $this->assertEquals('The central theme revolves around moral corruption, grief, and the consequences of revenge.', $gradingShowRes->json('data.questions.0.text_response'));

        // Instructor awards 18 points with evaluator feedback
        $gradeSubmitRes = $this->actingAs($instructor)->postJson("/api/v1/exam-grading/{$attemptId}", [
            'grades' => [
                [
                    'question_id' => $qEssay->id,
                    'awarded_points' => 18,
                    'feedback' => 'Excellent analytical depth and concise prose.',
                ],
            ],
        ]);

        $gradeSubmitRes->assertOk();
        $this->assertEquals('completed', $gradeSubmitRes->json('data.status'));
        $this->assertEquals(18.0, (float) $gradeSubmitRes->json('data.total_points_earned'));
        $this->assertEquals(90.0, (float) $gradeSubmitRes->json('data.score_percentage'));
        $this->assertTrue((bool) $gradeSubmitRes->json('data.is_passed'));

        // Verify student can now see review with feedback
        $reviewRes = $this->actingAs($student)->getJson("/api/v1/exam-attempts/{$attemptId}/review");
        $reviewRes->assertOk();
        $this->assertEquals(18.0, (float) $reviewRes->json('data.questions.0.points_awarded'));
        $this->assertEquals('Excellent analytical depth and concise prose.', $reviewRes->json('data.questions.0.evaluator_feedback'));
    }

    public function test_calendar_aggregates_learning_sessions(): void
    {
        $user = User::factory()->create();

        $session = LearningSession::create([
            'user_id' => $user->id,
            'topic' => 'Full-Stack Distributed Systems',
            'duration_minutes' => 45,
            'session_date' => Carbon::today()->toDateString(),
        ]);

        $res = $this->actingAs($user)->getJson('/api/v1/calendar');
        $res->assertOk();

        $sessionEvent = collect($res->json('data'))->firstWhere('type', 'learning_session');
        $this->assertNotNull($sessionEvent);
        $this->assertStringContainsString('Full-Stack Distributed Systems', $sessionEvent['title']);
        $this->assertEquals(45, $sessionEvent['duration_minutes']);
    }
}

