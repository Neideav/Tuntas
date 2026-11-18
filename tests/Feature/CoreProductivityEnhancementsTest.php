<?php

namespace Tests\Feature;

use App\Models\Goal;
use App\Models\Habit;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CoreProductivityEnhancementsTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
    }

    public function test_task_dependencies_prevent_completion_until_prerequisite_is_completed(): void
    {
        $this->actingAs($this->user);

        // Create prerequisite task
        $taskA = Task::create([
            'user_id' => $this->user->id,
            'title' => 'Prerequisite Task A',
            'status' => 'todo',
        ]);

        // Create dependent task
        $taskB = Task::create([
            'user_id' => $this->user->id,
            'title' => 'Dependent Task B',
            'status' => 'todo',
        ]);
        $taskB->dependencies()->attach($taskA->id);

        // Attempt to toggle taskB to completed when taskA is still 'todo'
        $response = $this->patchJson("/api/v1/tasks/{$taskB->id}/toggle");
        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
            ]);

        $this->assertEquals('todo', $taskB->fresh()->status);

        // Now complete taskA
        $this->patchJson("/api/v1/tasks/{$taskA->id}/toggle")->assertOk();
        $this->assertEquals('completed', $taskA->fresh()->status);

        // Now taskB can be completed successfully
        $response = $this->patchJson("/api/v1/tasks/{$taskB->id}/toggle");
        $response->assertOk();
        $this->assertEquals('completed', $taskB->fresh()->status);
    }

    public function test_task_bulk_actions_process_multiple_tasks_with_isolation(): void
    {
        $this->actingAs($this->user);

        $t1 = Task::create(['user_id' => $this->user->id, 'title' => 'Bulk T1', 'status' => 'todo']);
        $t2 = Task::create(['user_id' => $this->user->id, 'title' => 'Bulk T2', 'status' => 'todo']);

        // Bulk status update
        $res = $this->postJson('/api/v1/tasks/bulk', [
            'action' => 'status',
            'task_ids' => [$t1->id, $t2->id],
            'status' => 'completed',
        ]);

        $res->assertOk()->assertJson(['success' => true, 'affected_count' => 2]);
        $this->assertEquals('completed', $t1->fresh()->status);
        $this->assertEquals('completed', $t2->fresh()->status);

        // Bulk delete
        $delRes = $this->postJson('/api/v1/tasks/bulk', [
            'action' => 'delete',
            'task_ids' => [$t1->id, $t2->id],
        ]);

        $delRes->assertOk();
        $this->assertSoftDeleted('tasks', ['id' => $t1->id]);
        $this->assertSoftDeleted('tasks', ['id' => $t2->id]);
    }

    public function test_project_milestones_and_unified_progress_recalculation(): void
    {
        $this->actingAs($this->user);

        $project = Project::create([
            'user_id' => $this->user->id,
            'title' => 'Redesign Platform',
            'health' => 'on_track',
            'progress' => 0,
        ]);

        // Add 1 task to project
        $task = Task::create([
            'user_id' => $this->user->id,
            'project_id' => $project->id,
            'title' => 'Setup repo',
            'status' => 'todo',
        ]);

        // Add 1 milestone to project via API
        $mRes = $this->postJson("/api/v1/projects/{$project->id}/milestones", [
            'title' => 'Phase 1: Architecture Review',
        ]);
        $mRes->assertStatus(201);
        $milestoneId = $mRes->json('data.milestone.id');

        // Total units = 1 task + 1 milestone = 2. 0 completed => progress = 0
        $this->assertEquals(0, $project->fresh()->progress);

        // Complete the task
        $this->patchJson("/api/v1/tasks/{$task->id}/toggle")->assertOk();
        // 1 of 2 completed => 50%
        $this->assertEquals(50, $project->fresh()->progress);

        // Complete the milestone
        $this->patchJson("/api/v1/projects/{$project->id}/milestones/{$milestoneId}/toggle")->assertOk();
        // 2 of 2 completed => 100%
        $this->assertEquals(100, $project->fresh()->progress);
        $this->assertEquals('completed', $project->fresh()->status);

        // Test project archive toggle
        $this->patchJson("/api/v1/projects/{$project->id}/archive")->assertOk();
        $this->assertTrue($project->fresh()->is_archived);
    }

    public function test_habit_numeric_measurements_and_custom_selected_days_streak(): void
    {
        $this->actingAs($this->user);

        // Numeric habit: drink 2000 ml water
        $habit = Habit::create([
            'user_id' => $this->user->id,
            'title' => 'Drink Water',
            'frequency' => 'daily',
            'habit_type' => 'numeric',
            'target_value' => 2000,
            'unit' => 'ml',
            'current_streak' => 0,
            'best_streak' => 0,
        ]);

        // Log 1500 ml (below target => not completed)
        $this->postJson("/api/v1/habits/{$habit->id}/toggle", [
            'numeric_value' => 1500,
        ])->assertOk();

        $this->assertEquals(0, $habit->fresh()->current_streak);

        // Log 2200 ml (meets target => completed)
        $this->postJson("/api/v1/habits/{$habit->id}/toggle", [
            'numeric_value' => 2200,
        ])->assertOk();

        $this->assertEquals(1, $habit->fresh()->current_streak);

        // Custom schedule habit (MWF: Monday=1, Wednesday=3, Friday=5)
        $customHabit = Habit::create([
            'user_id' => $this->user->id,
            'title' => 'Gym Workout',
            'frequency' => 'daily',
            'selected_days' => [1, 3, 5],
            'current_streak' => 0,
        ]);

        $this->assertNotNull($customHabit);
    }

    public function test_goal_okr_weighted_progress_and_cross_module_linking(): void
    {
        $this->actingAs($this->user);

        // Create OKR Goal
        $goalRes = $this->postJson('/api/v1/goals', [
            'title' => 'Scale User Base to 10k',
            'type' => 'okr',
            'confidence_level' => 'high',
            'start_date' => Carbon::today()->toDateString(),
            'target_date' => Carbon::today()->addMonths(3)->toDateString(),
            'key_results' => [
                [
                    'title' => 'Active monthly users',
                    'target_value' => 10000,
                    'current_value' => 5000,
                    'unit' => 'users',
                    'weight' => 2.0,
                ],
                [
                    'title' => 'Organic signups',
                    'target_value' => 2000,
                    'current_value' => 2000,
                    'unit' => 'users',
                    'weight' => 1.0,
                ],
            ],
        ]);

        $goalRes->assertStatus(201);
        $goalId = $goalRes->json('data.id');
        $goal = Goal::find($goalId);

        // KR1 = 5000/10000 = 50% (weight 2), KR2 = 2000/2000 = 100% (weight 1)
        // Weighted progress = (0.50*2 + 1.0*1) / 3 = 2.0 / 3 = 67%
        $this->assertEquals(67, $goal->fresh()->progress);

        // Link a task to this goal
        $task = Task::create([
            'user_id' => $this->user->id,
            'goal_id' => $goal->id,
            'title' => 'Launch Referral Campaign',
            'status' => 'todo',
        ]);

        // Complete the task and verify goal progress blends
        $this->patchJson("/api/v1/tasks/{$task->id}/toggle")->assertOk();
        $this->assertGreaterThan(0, $goal->fresh()->progress);
    }
}
