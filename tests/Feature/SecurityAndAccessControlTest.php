<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Course;
use App\Models\ExamAttempt;
use App\Models\ExamBlueprint;
use App\Models\Examination;
use App\Models\Goal;
use App\Models\Habit;
use App\Models\Notification;
use App\Models\Project;
use App\Models\QuestionBank;
use App\Models\Task;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SecurityAndAccessControlTest extends TestCase
{
    use RefreshDatabase;

    protected User $userA;
    protected User $userB;

    protected function setUp(): void
    {
        parent::setUp();
        $this->userA = User::factory()->create([
            'email' => 'usera@tuntas.test',
            'role' => 'student',
        ]);

        $this->userB = User::factory()->create([
            'email' => 'userb@tuntas.test',
            'role' => 'student',
        ]);
    }

    public function test_unauthenticated_requests_are_rejected(): void
    {
        $this->getJson('/api/v1/dashboard')->assertStatus(401);
        $this->getJson('/api/v1/tasks')->assertStatus(401);
        $this->getJson('/api/v1/projects')->assertStatus(401);
        $this->getJson('/api/v1/habits')->assertStatus(401);
        $this->getJson('/api/v1/goals')->assertStatus(401);
        $this->getJson('/api/v1/courses')->assertStatus(401);
        $this->getJson('/api/v1/exam-blueprints')->assertStatus(401);
        $this->getJson('/api/v1/notifications')->assertStatus(401);
    }

    public function test_multi_tenant_data_isolation_and_authorization(): void
    {
        // 1. Task owned by User B
        $taskB = Task::create([
            'user_id' => $this->userB->id,
            'title' => 'Secret Task User B',
            'status' => 'todo',
        ]);

        // User A cannot view, update, or delete User B's task
        $this->actingAs($this->userA)->getJson("/api/v1/tasks/{$taskB->id}")->assertStatus(403);
        $this->actingAs($this->userA)->putJson("/api/v1/tasks/{$taskB->id}", ['title' => 'Hacked'])->assertStatus(403);
        $this->actingAs($this->userA)->deleteJson("/api/v1/tasks/{$taskB->id}")->assertStatus(403);

        // 2. Project owned by User B
        $projectB = Project::create([
            'user_id' => $this->userB->id,
            'title' => 'Confidential Project B',
        ]);

        $this->actingAs($this->userA)->getJson("/api/v1/projects/{$projectB->id}")->assertStatus(403);
        $this->actingAs($this->userA)->putJson("/api/v1/projects/{$projectB->id}", ['title' => 'Tampered'])->assertStatus(403);
        $this->actingAs($this->userA)->deleteJson("/api/v1/projects/{$projectB->id}")->assertStatus(403);

        // 3. Habit owned by User B
        $habitB = Habit::create([
            'user_id' => $this->userB->id,
            'title' => 'Habit B',
            'frequency' => 'daily',
        ]);

        $this->actingAs($this->userA)->getJson("/api/v1/habits/{$habitB->id}")->assertStatus(403);
        $this->actingAs($this->userA)->postJson("/api/v1/habits/{$habitB->id}/toggle")->assertStatus(403);
        $this->actingAs($this->userA)->deleteJson("/api/v1/habits/{$habitB->id}")->assertStatus(403);

        // 4. Goal owned by User B
        $goalB = Goal::create([
            'user_id' => $this->userB->id,
            'title' => 'Goal B',
            'start_date' => Carbon::today()->toDateString(),
            'target_date' => Carbon::today()->addMonth()->toDateString(),
        ]);

        $this->actingAs($this->userA)->getJson("/api/v1/goals/{$goalB->id}")->assertStatus(403);
        $this->actingAs($this->userA)->deleteJson("/api/v1/goals/{$goalB->id}")->assertStatus(403);

        // 5. Course owned by User B
        $courseB = Course::create([
            'user_id' => $this->userB->id,
            'title' => 'Proprietary Course B',
        ]);

        $this->actingAs($this->userA)->getJson("/api/v1/courses/{$courseB->id}")->assertStatus(403);
        $this->actingAs($this->userA)->deleteJson("/api/v1/courses/{$courseB->id}")->assertStatus(403);

        // 6. Question Bank owned by User B
        $bankB = QuestionBank::create([
            'user_id' => $this->userB->id,
            'title' => 'Question Bank B',
            'subject' => 'Confidential',
        ]);

        $this->actingAs($this->userA)->getJson("/api/v1/question-banks/{$bankB->id}")->assertStatus(403);
        $this->actingAs($this->userA)->deleteJson("/api/v1/question-banks/{$bankB->id}")->assertStatus(403);

        // 7. Notification owned by User B
        $notifB = Notification::create([
            'user_id' => $this->userB->id,
            'title' => 'Confidential Notice',
            'message' => 'Private payload',
            'type' => 'system',
        ]);

        $this->actingAs($this->userA)->patchJson("/api/v1/notifications/{$notifB->id}/read")->assertStatus(403);
        $this->actingAs($this->userA)->deleteJson("/api/v1/notifications/{$notifB->id}")->assertStatus(403);
    }

    public function test_examination_security_and_anti_tampering(): void
    {
        $bank = QuestionBank::create([
            'user_id' => $this->userB->id,
            'title' => 'Certification Exam Bank',
            'subject' => 'Cryptography',
        ]);

        $question = $bank->questions()->create([
            'type' => 'multiple_choice_single',
            'prompt' => 'Which algorithm provides authenticated encryption with associated data (AEAD)?',
            'explanation' => 'AES-GCM is an AEAD cipher mode.',
            'points' => 10.0,
        ]);

        $question->options()->create(['option_text' => 'AES-GCM', 'is_correct' => true, 'order' => 1]);
        $question->options()->create(['option_text' => 'AES-ECB', 'is_correct' => false, 'order' => 2]);

        $blueprint = ExamBlueprint::create([
            'user_id' => $this->userB->id,
            'title' => 'Cryptography Certification Exam',
            'subject' => 'Security',
            'duration_minutes' => 60,
            'passing_score' => 80.0,
            'max_attempts' => 1,
            'is_published' => true,
        ]);

        $blueprint->questions()->attach($question->id, ['points' => 10.0, 'order' => 1]);

        // Student A starts attempt
        $startRes = $this->actingAs($this->userA)->postJson("/api/v1/exam-blueprints/{$blueprint->id}/start");
        $startRes->assertStatus(200);
        $attemptId = $startRes->json('data.id');

        // SECURITY CHECK: Snapshot must NOT leak is_correct or explanation
        $snapshot = $startRes->json('data.questions_snapshot');
        $this->assertArrayNotHasKey('explanation', $snapshot[0], 'VULNERABILITY: Question explanation leaked in active exam session snapshot!');
        foreach ($snapshot[0]['options'] as $opt) {
            $this->assertArrayNotHasKey('is_correct', $opt, 'CRITICAL VULNERABILITY: Correct answer flag leaked to student in active snapshot!');
        }

        // SECURITY CHECK: Student cannot access review endpoint while examination is in progress
        $unauthReview = $this->actingAs($this->userA)->getJson("/api/v1/exam-attempts/{$attemptId}/review");
        $unauthReview->assertStatus(403);

        // SECURITY CHECK: User B cannot hijack User A's exam attempt
        $hijackSync = $this->actingAs($this->userB)->postJson("/api/v1/exam-attempts/{$attemptId}/sync", [
            'answers' => [
                ['question_id' => $question->id, 'text_response' => 'hijacked'],
            ],
        ]);
        $hijackSync->assertStatus(403);

        $hijackSubmit = $this->actingAs($this->userB)->postJson("/api/v1/exam-attempts/{$attemptId}/submit");
        $hijackSubmit->assertStatus(403);
    }
}

