<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Examination;
use App\Models\Habit;
use App\Models\HabitLog;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductivityModulesTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create([
            'email' => 'productivity@tuntas.test',
            'role' => 'student',
        ]);
    }

    public function test_recurring_task_auto_spawns_next_instance_on_completion(): void
    {
        $dueDate = Carbon::today()->setTime(10, 0);

        // 1. Create a daily recurring task with subtasks
        $createRes = $this->actingAs($this->user)->postJson('/api/v1/tasks', [
            'title' => 'Daily Architecture Review',
            'priority' => 'high',
            'status' => 'todo',
            'due_date' => $dueDate->toIso8601String(),
            'is_recurring' => true,
            'recurrence_pattern' => 'daily',
            'subtasks' => [
                ['title' => 'Review PRs'],
                ['title' => 'Check telemetry metrics'],
            ],
        ]);

        $createRes->assertStatus(201);
        $taskId = $createRes->json('data.id');

        // Toggle task status to completed
        $toggleRes = $this->actingAs($this->user)->patchJson("/api/v1/tasks/{$taskId}/toggle");
        $toggleRes->assertStatus(200)
            ->assertJsonPath('data.status', 'completed');

        // Verify original task is completed
        $originalTask = Task::find($taskId);
        $this->assertEquals('completed', $originalTask->status);
        $this->assertNotNull($originalTask->completed_at);

        // Verify next occurrence was automatically spawned
        $allTasks = Task::where('user_id', $this->user->id)->get();
        $this->assertCount(2, $allTasks);

        $nextTask = Task::where('user_id', $this->user->id)
            ->where('id', '!=', $taskId)
            ->first();

        $this->assertNotNull($nextTask);
        $this->assertEquals('Daily Architecture Review', $nextTask->title);
        $this->assertEquals('todo', $nextTask->status);
        $this->assertTrue((bool) $nextTask->is_recurring);
        $this->assertEquals('daily', $nextTask->recurrence_pattern);
        $this->assertEquals($dueDate->copy()->addDay()->toDateString(), Carbon::parse($nextTask->due_date)->toDateString());

        // Verify subtasks were duplicated in reset state
        $this->assertCount(2, $nextTask->subtasks);
        foreach ($nextTask->subtasks as $sub) {
            $this->assertFalse((bool) $sub->is_completed);
        }
    }

    public function test_project_progress_auto_recalculation(): void
    {
        // 1. Create Project
        $projRes = $this->actingAs($this->user)->postJson('/api/v1/projects', [
            'title' => 'Tuntas Microservice Migration',
            'status' => 'in_progress',
            'deadline' => Carbon::today()->addMonths(1)->toDateString(),
        ]);
        $projRes->assertStatus(201);
        $projectId = $projRes->json('data.id');

        $project = Project::find($projectId);
        $this->assertEquals(0, $project->progress);

        // 2. Add Task 1 (todo)
        $t1Res = $this->actingAs($this->user)->postJson('/api/v1/tasks', [
            'title' => 'Extract Exam Engine',
            'project_id' => $projectId,
            'status' => 'todo',
        ]);
        $t1Res->assertStatus(201);
        $t1Id = $t1Res->json('data.id');

        // Add Task 2 (todo)
        $t2Res = $this->actingAs($this->user)->postJson('/api/v1/tasks', [
            'title' => 'Set up Event Bus',
            'project_id' => $projectId,
            'status' => 'todo',
        ]);
        $t2Res->assertStatus(201);
        $t2Id = $t2Res->json('data.id');

        $project->refresh();
        $this->assertEquals(0, $project->progress);

        // 3. Complete Task 1 -> Progress should be 50%
        $this->actingAs($this->user)->patchJson("/api/v1/tasks/{$t1Id}/toggle");
        $project->refresh();
        $this->assertEquals(50, $project->progress);

        // 4. Complete Task 2 -> Progress should reach 100%
        $this->actingAs($this->user)->patchJson("/api/v1/tasks/{$t2Id}/toggle");
        $project->refresh();
        $this->assertEquals(100, $project->progress);

        // 5. Delete Task 2 -> Only Task 1 remains (which is completed), Progress stays 100%
        $this->actingAs($this->user)->deleteJson("/api/v1/tasks/{$t2Id}");
        $project->refresh();
        $this->assertEquals(100, $project->progress);
    }

    public function test_calendar_aggregates_tasks_projects_exams_and_habits(): void
    {
        $today = Carbon::today();

        // Task with due date
        Task::create([
            'user_id' => $this->user->id,
            'title' => 'Sprint Planning Meeting',
            'status' => 'todo',
            'priority' => 'high',
            'due_date' => $today->copy()->setTime(9, 0),
        ]);

        // Project with deadline
        Project::create([
            'user_id' => $this->user->id,
            'title' => 'SaaS MVP Release',
            'status' => 'in_progress',
            'deadline' => $today->copy()->addDays(2)->toDateString(),
        ]);

        // Examination
        Examination::create([
            'user_id' => $this->user->id,
            'title' => 'Database Internals Final',
            'subject' => 'Computer Science',
            'examination_date' => $today->copy()->addDays(3)->toDateString(),
            'start_time' => '13:00',
            'duration_minutes' => 90,
            'status' => 'upcoming',
            'passing_score' => 70,
        ]);

        // Habit & HabitLog
        $habit = Habit::create([
            'user_id' => $this->user->id,
            'title' => 'Code Katas',
            'frequency' => 'daily',
            'color' => '#10b981',
        ]);

        HabitLog::create([
            'habit_id' => $habit->id,
            'user_id' => $this->user->id,
            'log_date' => $today->toDateString(),
            'is_completed' => true,
        ]);

        $response = $this->actingAs($this->user)->getJson('/api/v1/calendar?' . http_build_query([
            'start' => $today->copy()->subDays(5)->toDateString(),
            'end' => $today->copy()->addDays(10)->toDateString(),
        ]));

        $response->assertStatus(200)
            ->assertJsonPath('success', true);

        $events = $response->json('data');
        $this->assertNotEmpty($events);

        $types = array_column($events, 'type');
        $this->assertContains('task', $types);
        $this->assertContains('project', $types);
        $this->assertContains('examination', $types);
        $this->assertContains('habit', $types);
    }

    public function test_habit_history_and_consistency_statistics(): void
    {
        $habit = Habit::create([
            'user_id' => $this->user->id,
            'title' => 'System Design Study',
            'frequency' => 'daily',
            'current_streak' => 5,
            'best_streak' => 12,
            'freeze_tokens' => 3,
        ]);

        // Create 3 completions in past 7 days
        for ($i = 0; $i < 3; $i++) {
            HabitLog::create([
                'habit_id' => $habit->id,
                'user_id' => $this->user->id,
                'log_date' => Carbon::today()->subDays($i)->toDateString(),
                'is_completed' => true,
            ]);
        }

        $res = $this->actingAs($this->user)->getJson("/api/v1/habits/{$habit->id}/history?days=10");

        $res->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.statistics.current_streak', 5)
            ->assertJsonPath('data.statistics.best_streak', 12)
            ->assertJsonPath('data.statistics.freeze_tokens', 3)
            ->assertJsonPath('data.statistics.total_completions', 3);

        $this->assertEquals(30, (int) $res->json('data.statistics.consistency_rate'));
    }

    public function test_task_filtering_and_tag_syncing(): void
    {
        $cat = Category::create([
            'user_id' => $this->user->id,
            'name' => 'Architecture',
            'color' => '#6366f1',
        ]);

        // Create task with tags and category
        $createRes = $this->actingAs($this->user)->postJson('/api/v1/tasks', [
            'title' => 'Refactor Domain Event Dispatcher',
            'category_id' => $cat->id,
            'priority' => 'urgent',
            'status' => 'in_progress',
            'due_date' => Carbon::today()->toIso8601String(),
            'tags' => ['backend', 'events', 'refactor'],
        ]);

        $createRes->assertStatus(201)
            ->assertJsonPath('data.category.name', 'Architecture');

        $tags = $createRes->json('data.tags');
        $tagNames = array_column($tags, 'name');
        $this->assertContains('backend', $tagNames);
        $this->assertContains('events', $tagNames);

        // Search by query
        $searchRes = $this->actingAs($this->user)->getJson('/api/v1/tasks?q=Dispatcher');
        $searchRes->assertStatus(200);
        $this->assertCount(1, $searchRes->json('data'));

        // Filter by horizon 'today'
        $todayRes = $this->actingAs($this->user)->getJson('/api/v1/tasks?filter=today');
        $todayRes->assertStatus(200);
        $this->assertCount(1, $todayRes->json('data'));

        // Filter by non-matching priority
        $lowRes = $this->actingAs($this->user)->getJson('/api/v1/tasks?priority=low');
        $lowRes->assertStatus(200);
        $this->assertCount(0, $lowRes->json('data'));
    }
}
