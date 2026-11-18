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

    public function test_relation_ownership_validation_prevents_cross_tenant_association(): void
    {
        $projectB = Project::create([
            'user_id' => $this->userB->id,
            'title' => 'Project B Private',
        ]);

        $categoryB = Category::create([
            'user_id' => $this->userB->id,
            'name' => 'Category B Private',
            'type' => 'task',
        ]);

        // 1. User A cannot create task linking User B's project
        $resProject = $this->actingAs($this->userA)->postJson('/api/v1/tasks', [
            'title' => 'Cross-tenant task',
            'project_id' => $projectB->id,
        ]);
        $resProject->assertStatus(422)->assertJsonValidationErrors(['project_id']);

        // 2. User A cannot create task linking User B's category
        $resCat = $this->actingAs($this->userA)->postJson('/api/v1/tasks', [
            'title' => 'Cross-tenant category task',
            'category_id' => $categoryB->id,
        ]);
        $resCat->assertStatus(422)->assertJsonValidationErrors(['category_id']);

        // 3. User A cannot update task to link User B's project or category
        $taskA = Task::create([
            'user_id' => $this->userA->id,
            'title' => 'Task Owned By A',
        ]);

        $resUpdateProj = $this->actingAs($this->userA)->putJson("/api/v1/tasks/{$taskA->id}", [
            'project_id' => $projectB->id,
        ]);
        $resUpdateProj->assertStatus(422)->assertJsonValidationErrors(['project_id']);

        $resUpdateCat = $this->actingAs($this->userA)->putJson("/api/v1/tasks/{$taskA->id}", [
            'category_id' => $categoryB->id,
        ]);
        $resUpdateCat->assertStatus(422)->assertJsonValidationErrors(['category_id']);
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

    public function test_cross_user_course_and_lesson_relationships_are_strictly_isolated(): void
    {
        // User B owns a course, module, and lesson
        $courseB = Course::create([
            'user_id' => $this->userB->id,
            'title' => 'Advanced Cryptography by User B',
        ]);
        $moduleB = $courseB->modules()->create(['title' => 'Module 1', 'order' => 1]);
        $lessonB = $moduleB->lessons()->create(['title' => 'Lesson 1', 'order' => 1]);

        // 1. User A cannot create exam blueprint attaching User B's course
        $bpRes = $this->actingAs($this->userA)->postJson('/api/v1/exam-blueprints', [
            'title' => 'Exam Blueprint A',
            'subject' => 'Crypto',
            'duration_minutes' => 60,
            'course_id' => $courseB->id,
        ]);
        $bpRes->assertStatus(422)->assertJsonValidationErrors(['course_id']);

        // 2. User A cannot create learning session attaching User B's course or lesson
        $sessionResCourse = $this->actingAs($this->userA)->postJson('/api/v1/learning-sessions', [
            'topic' => 'Illegal Study Session',
            'duration_minutes' => 45,
            'session_date' => Carbon::today()->toDateString(),
            'course_id' => $courseB->id,
        ]);
        $sessionResCourse->assertStatus(422)->assertJsonValidationErrors(['course_id']);

        $sessionResLesson = $this->actingAs($this->userA)->postJson('/api/v1/learning-sessions', [
            'topic' => 'Illegal Lesson Session',
            'duration_minutes' => 45,
            'session_date' => Carbon::today()->toDateString(),
            'lesson_id' => $lessonB->id,
        ]);
        $sessionResLesson->assertStatus(422)->assertJsonValidationErrors(['lesson_id']);
    }

    public function test_invalid_inverted_date_ranges_are_rejected(): void
    {
        // Task due_date before start_date is rejected
        $taskRes = $this->actingAs($this->userA)->postJson('/api/v1/tasks', [
            'title' => 'Time Traveler Task',
            'start_date' => '2026-12-10',
            'due_date' => '2026-12-01',
        ]);
        $taskRes->assertStatus(422)->assertJsonValidationErrors(['due_date']);

        // Project deadline before start_date is rejected
        $projRes = $this->actingAs($this->userA)->postJson('/api/v1/projects', [
            'title' => 'Time Traveler Project',
            'start_date' => '2026-12-10',
            'deadline' => '2026-12-01',
        ]);
        $projRes->assertStatus(422)->assertJsonValidationErrors(['deadline']);
    }

    public function test_login_rejects_wrong_password_without_backdoor_bypass(): void
    {
        // Attempting to log in to demo@tuntas.test with incorrect password MUST fail with 422
        $demoUser = User::create([
            'name' => 'Demo User',
            'email' => 'demo@tuntas.test',
            'password' => \Illuminate\Support\Facades\Hash::make('ActualSecretPassword123!'),
        ]);

        $loginAttempt = $this->postJson('/api/v1/auth/login', [
            'email' => 'demo@tuntas.test',
            'password' => 'WrongArbitraryPassword!',
        ]);

        $loginAttempt->assertStatus(422)->assertJsonValidationErrors(['password']);
    }
}

