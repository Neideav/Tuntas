<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Goal;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\ProjectRole;
use App\Models\ReportReview;
use App\Models\Subtask;
use App\Models\Task;
use App\Models\User;
use App\Models\WorkReport;
use App\Services\TaskCompletionService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TaskEngineAndCompletionLogicTest extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected User $adminUser;
    protected User $memberUser;
    protected User $viewerUser;
    protected User $outsider;
    protected Project $projectA;
    protected Project $projectB;
    protected Category $category;
    protected Goal $goal;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create(['name' => 'Project Owner', 'email' => 'owner@tuntas.test']);
        $this->adminUser = User::factory()->create(['name' => 'Project Admin', 'email' => 'admin@tuntas.test']);
        $this->memberUser = User::factory()->create(['name' => 'Project Member', 'email' => 'member@tuntas.test']);
        $this->viewerUser = User::factory()->create(['name' => 'Project Viewer', 'email' => 'viewer@tuntas.test']);
        $this->outsider = User::factory()->create(['name' => 'External Outsider', 'email' => 'outsider@tuntas.test']);

        // Project A
        $this->projectA = Project::create([
            'user_id' => $this->owner->id,
            'title' => 'Project Alpha',
            'status' => 'in_progress',
            'progress' => 0,
        ]);
        $rolesA = ProjectRole::ensureBuiltinRolesForProject($this->projectA);

        ProjectMember::create([
            'project_id' => $this->projectA->id,
            'user_id' => $this->owner->id,
            'role_id' => $rolesA[ProjectRole::ROLE_OWNER]->id,
            'role' => ProjectRole::ROLE_OWNER,
        ]);
        ProjectMember::create([
            'project_id' => $this->projectA->id,
            'user_id' => $this->adminUser->id,
            'role_id' => $rolesA[ProjectRole::ROLE_ADMIN]->id,
            'role' => ProjectRole::ROLE_ADMIN,
        ]);
        ProjectMember::create([
            'project_id' => $this->projectA->id,
            'user_id' => $this->memberUser->id,
            'role_id' => $rolesA[ProjectRole::ROLE_MEMBER]->id,
            'role' => ProjectRole::ROLE_MEMBER,
        ]);
        ProjectMember::create([
            'project_id' => $this->projectA->id,
            'user_id' => $this->viewerUser->id,
            'role_id' => $rolesA[ProjectRole::ROLE_VIEWER]->id,
            'role' => ProjectRole::ROLE_VIEWER,
        ]);

        // Project B
        $this->projectB = Project::create([
            'user_id' => $this->outsider->id,
            'title' => 'Project Beta',
            'status' => 'planning',
            'progress' => 0,
        ]);
        $rolesB = ProjectRole::ensureBuiltinRolesForProject($this->projectB);
        ProjectMember::create([
            'project_id' => $this->projectB->id,
            'user_id' => $this->outsider->id,
            'role_id' => $rolesB[ProjectRole::ROLE_OWNER]->id,
            'role' => ProjectRole::ROLE_OWNER,
        ]);

        $this->category = Category::create([
            'user_id' => $this->owner->id,
            'name' => 'Engineering',
        ]);

        $this->goal = Goal::create([
            'user_id' => $this->owner->id,
            'title' => 'Complete Q4 Roadmap',
            'start_date' => now()->toDateString(),
            'target_date' => now()->addMonths(3)->toDateString(),
            'progress' => 0,
        ]);
    }

    /**
     * 1. Assignee project task harus merupakan anggota aktif proyek (Create, Update & Project Move).
     */
    public function test_assignee_must_be_active_project_member_on_create_update_and_move(): void
    {
        // 1A. Create task with outsider assignee -> rejected with 422
        $responseCreate = $this->actingAs($this->owner, 'sanctum')->postJson('/api/v1/tasks', [
            'title' => 'New Project Task',
            'project_id' => $this->projectA->id,
            'assigned_to' => $this->outsider->id,
        ]);
        $responseCreate->assertStatus(422);

        // 1B. Create task with valid member assignee -> succeeds
        $responseValid = $this->actingAs($this->owner, 'sanctum')->postJson('/api/v1/tasks', [
            'title' => 'Valid Project Task',
            'project_id' => $this->projectA->id,
            'assigned_to' => $this->memberUser->id,
        ]);
        $responseValid->assertStatus(201);
        $taskId = $responseValid->json('data.id');

        // 1C. Update task to assign outsider -> rejected with 422
        $responseUpdate = $this->actingAs($this->owner, 'sanctum')->putJson("/api/v1/tasks/{$taskId}", [
            'assigned_to' => $this->outsider->id,
        ]);
        $responseUpdate->assertStatus(422);

        // 1D. Move task to Project B where memberUser is NOT a member -> rejected with 422
        // First grant owner tasks.create in projectB for moving test
        ProjectMember::create([
            'project_id' => $this->projectB->id,
            'user_id' => $this->owner->id,
            'role_id' => ProjectRole::where('project_id', $this->projectB->id)->where('name', 'Admin')->value('id'),
            'role' => 'admin',
        ]);

        $responseMove = $this->actingAs($this->owner, 'sanctum')->putJson("/api/v1/tasks/{$taskId}", [
            'project_id' => $this->projectB->id,
        ]);
        $responseMove->assertStatus(422);
    }

    /**
     * 2. Perubahan assignee harus memerlukan permission tasks.assign.
     */
    public function test_changing_assignee_requires_tasks_assign_permission(): void
    {
        $task = Task::create([
            'user_id' => $this->owner->id,
            'project_id' => $this->projectA->id,
            'title' => 'Assignment Test Task',
            'status' => 'todo',
            'priority' => 'medium',
        ]);

        // Viewer does not have tasks.assign permission -> 403 Forbidden
        $response = $this->actingAs($this->viewerUser, 'sanctum')->putJson("/api/v1/tasks/{$task->id}", [
            'assigned_to' => $this->memberUser->id,
        ]);
        $response->assertStatus(403);
    }

    /**
     * 3. Task dengan incomplete dependencies tidak dapat diselesaikan (canBeCompleted).
     */
    public function test_task_with_incomplete_dependencies_cannot_be_completed(): void
    {
        $prereqTask = Task::create([
            'user_id' => $this->owner->id,
            'project_id' => $this->projectA->id,
            'title' => 'Prerequisite Task',
            'status' => 'todo',
            'priority' => 'medium',
        ]);

        $blockedTask = Task::create([
            'user_id' => $this->owner->id,
            'project_id' => $this->projectA->id,
            'title' => 'Blocked Task',
            'status' => 'todo',
            'priority' => 'medium',
        ]);
        $blockedTask->dependencies()->sync([$prereqTask->id]);

        // 3A. Toggle status to completed -> rejected 422
        $toggleRes = $this->actingAs($this->owner, 'sanctum')->patchJson("/api/v1/tasks/{$blockedTask->id}/toggle");
        $toggleRes->assertStatus(422)
            ->assertJsonPath('success', false);

        // 3B. Update status to completed -> rejected 422
        $updateRes = $this->actingAs($this->owner, 'sanctum')->putJson("/api/v1/tasks/{$blockedTask->id}", [
            'status' => 'completed',
        ]);
        $updateRes->assertStatus(422)
            ->assertJsonPath('success', false);

        // Complete prerequisite task
        $prereqTask->update(['status' => 'completed', 'completed_at' => now()]);

        // 3C. Now blocked task can be completed
        $toggleSuccess = $this->actingAs($this->owner, 'sanctum')->patchJson("/api/v1/tasks/{$blockedTask->id}/toggle");
        $toggleSuccess->assertStatus(200)
            ->assertJsonPath('data.status', 'completed');
    }

    /**
     * 4. Circular dependency detection: Direct (A->B->A), Indirect (A->B->C->A), and Self-dependency.
     */
    public function test_circular_and_self_dependency_detection(): void
    {
        $taskA = Task::create([
            'user_id' => $this->owner->id,
            'project_id' => $this->projectA->id,
            'title' => 'Task A',
            'status' => 'todo',
            'priority' => 'medium',
        ]);

        $taskB = Task::create([
            'user_id' => $this->owner->id,
            'project_id' => $this->projectA->id,
            'title' => 'Task B',
            'status' => 'todo',
            'priority' => 'medium',
        ]);

        $taskC = Task::create([
            'user_id' => $this->owner->id,
            'project_id' => $this->projectA->id,
            'title' => 'Task C',
            'status' => 'todo',
            'priority' => 'medium',
        ]);

        // 4A. Self-dependency: Task A depends on Task A -> rejected 422
        $selfRes = $this->actingAs($this->owner, 'sanctum')->putJson("/api/v1/tasks/{$taskA->id}", [
            'dependencies' => [$taskA->id],
        ]);
        $selfRes->assertStatus(422);

        // Setup: A depends on B
        $taskA->dependencies()->sync([$taskB->id]);

        // 4B. Direct cycle: B attempts to depend on A -> rejected 422
        $directCycleRes = $this->actingAs($this->owner, 'sanctum')->putJson("/api/v1/tasks/{$taskB->id}", [
            'dependencies' => [$taskA->id],
        ]);
        $directCycleRes->assertStatus(422)
            ->assertJsonPath('message', 'Terdeteksi circular dependency (ketergantungan berulang). Tugas tidak dapat saling bergantung secara langsung atau tidak langsung.');

        // Setup chain: B depends on C (Chain: A -> B -> C)
        $taskB->dependencies()->sync([$taskC->id]);

        // 4C. Indirect cycle: C attempts to depend on A (C -> A, causing C -> A -> B -> C) -> rejected 422
        $indirectCycleRes = $this->actingAs($this->owner, 'sanctum')->putJson("/api/v1/tasks/{$taskC->id}", [
            'dependencies' => [$taskA->id],
        ]);
        $indirectCycleRes->assertStatus(422)
            ->assertJsonPath('message', 'Terdeteksi circular dependency (ketergantungan berulang). Tugas tidak dapat saling bergantung secara langsung atau tidak langsung.');
    }

    /**
     * 5. Isolasi dependensi: larangan cross-project & cross-context dependencies.
     */
    public function test_cross_project_and_cross_context_dependencies_rejected(): void
    {
        $taskProjA = Task::create([
            'user_id' => $this->owner->id,
            'project_id' => $this->projectA->id,
            'title' => 'Task Project A',
            'status' => 'todo',
            'priority' => 'medium',
        ]);

        $taskProjB = Task::create([
            'user_id' => $this->outsider->id,
            'project_id' => $this->projectB->id,
            'title' => 'Task Project B',
            'status' => 'todo',
            'priority' => 'medium',
        ]);

        $personalTask = Task::create([
            'user_id' => $this->owner->id,
            'project_id' => null,
            'title' => 'Personal Task',
            'status' => 'todo',
            'priority' => 'medium',
        ]);

        // Project A task attempting to depend on Project B task -> rejected 422
        $resCrossProject = $this->actingAs($this->owner, 'sanctum')->putJson("/api/v1/tasks/{$taskProjA->id}", [
            'dependencies' => [$taskProjB->id],
        ]);
        $resCrossProject->assertStatus(422);

        // Project A task attempting to depend on Personal Task -> rejected 422
        $resCrossContext = $this->actingAs($this->owner, 'sanctum')->putJson("/api/v1/tasks/{$taskProjA->id}", [
            'dependencies' => [$personalTask->id],
        ]);
        $resCrossContext->assertStatus(422);
    }

    /**
     * 6. requires_report: tugas tidak dapat diselesaikan tanpa approved report.
     */
    public function test_requires_report_gatekeeping(): void
    {
        $task = Task::create([
            'user_id' => $this->owner->id,
            'project_id' => $this->projectA->id,
            'title' => 'Report Guarded Task',
            'status' => 'todo',
            'priority' => 'medium',
            'requires_report' => true,
        ]);

        // Attempt completion without approved report -> rejected 422
        $failToggle = $this->actingAs($this->owner, 'sanctum')->patchJson("/api/v1/tasks/{$task->id}/toggle");
        $failToggle->assertStatus(422)
            ->assertJsonPath('message', 'Tugas ini memerlukan laporan yang telah disetujui (approved report) sebelum dapat diselesaikan.');

        // Create an approved work report for this task
        WorkReport::create([
            'user_id' => $this->owner->id,
            'project_id' => $this->projectA->id,
            'task_id' => $task->id,
            'title' => 'Completion Report',
            'summary' => 'Finished work successfully.',
            'content' => 'Full detailed report content for task completion.',
            'status' => WorkReport::STATUS_APPROVED,
            'reviewed_at' => now(),
        ]);

        // Now completion succeeds
        $successToggle = $this->actingAs($this->owner, 'sanctum')->patchJson("/api/v1/tasks/{$task->id}/toggle");
        $successToggle->assertStatus(200)
            ->assertJsonPath('data.status', 'completed');
    }

    /**
     * 7. requires_review: tugas tidak dapat diselesaikan tanpa proses review yang disetujui.
     */
    public function test_requires_review_gatekeeping(): void
    {
        $task = Task::create([
            'user_id' => $this->owner->id,
            'project_id' => $this->projectA->id,
            'title' => 'Review Guarded Task',
            'status' => 'todo',
            'priority' => 'medium',
            'requires_review' => true,
        ]);

        // Attempt completion without review -> rejected 422
        $failToggle = $this->actingAs($this->owner, 'sanctum')->patchJson("/api/v1/tasks/{$task->id}/toggle");
        $failToggle->assertStatus(422)
            ->assertJsonPath('message', 'Tugas ini memerlukan proses review yang telah disetujui sebelum dapat diselesaikan.');

        // Pass review via completion_conditions reviewed flag
        $task->update([
            'completion_conditions' => ['review_passed' => true],
        ]);

        // Now completion succeeds
        $successToggle = $this->actingAs($this->owner, 'sanctum')->patchJson("/api/v1/tasks/{$task->id}/toggle");
        $successToggle->assertStatus(200)
            ->assertJsonPath('data.status', 'completed');
    }

    /**
     * 8. completion_conditions: subtasks completed dan checklist criteria evaluation.
     */
    public function test_completion_conditions_subtasks_and_checklist_evaluation(): void
    {
        $task = Task::create([
            'user_id' => $this->owner->id,
            'project_id' => $this->projectA->id,
            'title' => 'Conditions Guarded Task',
            'status' => 'todo',
            'priority' => 'medium',
            'completion_conditions' => [
                'require_subtasks_completed' => true,
                'checklist' => [
                    ['title' => 'Design QA', 'completed' => false],
                    ['title' => 'Security Scan', 'completed' => true],
                ],
            ],
        ]);

        $sub1 = Subtask::create([
            'task_id' => $task->id,
            'title' => 'Subtask 1',
            'is_completed' => false,
            'order' => 0,
        ]);

        // 8A. Uncompleted subtask blocks completion -> 422
        $res1 = $this->actingAs($this->owner, 'sanctum')->patchJson("/api/v1/tasks/{$task->id}/toggle");
        $res1->assertStatus(422)
            ->assertJsonPath('message', 'Terdapat 1 subtask yang belum diselesaikan.');

        // Complete the subtask
        $sub1->update(['is_completed' => true]);

        // 8B. Incomplete checklist item blocks completion -> 422
        $res2 = $this->actingAs($this->owner, 'sanctum')->patchJson("/api/v1/tasks/{$task->id}/toggle");
        $res2->assertStatus(422)
            ->assertJsonPath('message', "Item kondisi penyelesaian 'Design QA' belum terpenuhi.");

        // Fulfill checklist item
        $task->update([
            'completion_conditions' => [
                'require_subtasks_completed' => true,
                'checklist' => [
                    ['title' => 'Design QA', 'completed' => true],
                    ['title' => 'Security Scan', 'completed' => true],
                ],
            ],
        ]);

        // 8C. Now all conditions satisfied -> completion succeeds
        $resSuccess = $this->actingAs($this->owner, 'sanctum')->patchJson("/api/v1/tasks/{$task->id}/toggle");
        $resSuccess->assertStatus(200)
            ->assertJsonPath('data.status', 'completed');
    }

    /**
     * 9. Bulk completion with partial success and transparent failure reporting.
     */
    public function test_bulk_completion_partial_success_reporting(): void
    {
        // Task 1: Valid and can be completed
        $task1 = Task::create([
            'user_id' => $this->owner->id,
            'project_id' => $this->projectA->id,
            'title' => 'Ready Task',
            'status' => 'todo',
            'priority' => 'medium',
        ]);

        // Task 2: Blocked by incomplete dependency
        $prereq = Task::create([
            'user_id' => $this->owner->id,
            'project_id' => $this->projectA->id,
            'title' => 'Prereq for Task 2',
            'status' => 'todo',
            'priority' => 'medium',
        ]);
        $task2 = Task::create([
            'user_id' => $this->owner->id,
            'project_id' => $this->projectA->id,
            'title' => 'Blocked Task 2',
            'status' => 'todo',
            'priority' => 'medium',
        ]);
        $task2->dependencies()->sync([$prereq->id]);

        $response = $this->actingAs($this->owner, 'sanctum')->postJson('/api/v1/tasks/bulk', [
            'action' => 'status',
            'task_ids' => [$task1->id, $task2->id],
            'status' => 'completed',
        ]);

        $response->assertStatus(200);
        $this->assertEquals(1, $response->json('affected_count'));
        $this->assertEquals(1, $response->json('failed_count'));
        $this->assertContains($task1->id, $response->json('succeeded_ids'));
        $this->assertCount(1, $response->json('failures'));
        $this->assertEquals($task2->id, $response->json('failures.0.id'));

        // Verify database statuses
        $this->assertEquals('completed', $task1->fresh()->status);
        $this->assertEquals('todo', $task2->fresh()->status);
    }

    /**
     * 10. Recurring task inheritance and clean subtask reset.
     */
    public function test_recurring_task_inheritance_and_subtask_reset(): void
    {
        $task = Task::create([
            'user_id' => $this->owner->id,
            'assigned_to' => $this->memberUser->id,
            'project_id' => $this->projectA->id,
            'category_id' => $this->category->id,
            'goal_id' => $this->goal->id,
            'title' => 'Weekly Sync Review',
            'description' => 'Review weekly performance metrics.',
            'priority' => 'high',
            'status' => 'todo',
            'due_date' => Carbon::parse('2026-11-20'),
            'is_recurring' => true,
            'recurrence_pattern' => 'weekly',
            'requires_report' => false,
            'requires_review' => false,
            'completion_conditions' => ['checklist' => [['title' => 'Check stats', 'completed' => true]]],
        ]);

        Subtask::create([
            'task_id' => $task->id,
            'title' => 'Prepare agenda',
            'is_completed' => true,
            'order' => 0,
        ]);
        Subtask::create([
            'task_id' => $task->id,
            'title' => 'Publish minutes',
            'is_completed' => true,
            'order' => 1,
        ]);

        // Complete the recurring task via toggleStatus
        $res = $this->actingAs($this->owner, 'sanctum')->patchJson("/api/v1/tasks/{$task->id}/toggle");
        $res->assertStatus(200);

        // Verify original task completed
        $this->assertEquals('completed', $task->fresh()->status);

        // Find successor instance
        $successor = Task::where('project_id', $this->projectA->id)
            ->where('title', 'Weekly Sync Review')
            ->where('status', 'todo')
            ->first();

        $this->assertNotNull($successor);
        $this->assertEquals($this->memberUser->id, $successor->assigned_to);
        $this->assertEquals($this->category->id, $successor->category_id);
        $this->assertEquals($this->goal->id, $successor->goal_id);
        $this->assertEquals('high', $successor->priority);
        $this->assertEquals('Weekly Sync Review', $successor->title);
        $this->assertEquals('Review weekly performance metrics.', $successor->description);
        $this->assertTrue($successor->is_recurring);
        $this->assertEquals('weekly', $successor->recurrence_pattern);
        $this->assertEquals('2026-11-27', Carbon::parse($successor->due_date)->toDateString());

        // Verify subtasks were cloned in uncompleted state
        $subtasks = $successor->subtasks;
        $this->assertCount(2, $subtasks);
        foreach ($subtasks as $sub) {
            $this->assertFalse((bool) $sub->is_completed, "Subtask '{$sub->title}' should be reset to uncompleted.");
        }
    }

    /**
     * 11. Deduplication guard against concurrent completions.
     */
    public function test_concurrent_completion_deduplication_prevents_duplicate_recurrence(): void
    {
        $task = Task::create([
            'user_id' => $this->owner->id,
            'project_id' => $this->projectA->id,
            'title' => 'Daily Standup',
            'status' => 'todo',
            'priority' => 'medium',
            'due_date' => Carbon::today(),
            'is_recurring' => true,
            'recurrence_pattern' => 'daily',
        ]);

        $service = app(TaskCompletionService::class);

        // First spawn call
        $firstInstance = $service->spawnNextRecurrence($task);
        $this->assertNotNull($firstInstance);

        // Second spawn call immediately (simulating concurrent worker / API double trigger)
        $secondInstance = $service->spawnNextRecurrence($task);
        $this->assertNotNull($secondInstance);

        // Both calls should return the same instance, no double-spawn in database
        $this->assertEquals($firstInstance->id, $secondInstance->id);
        $totalDailyTasks = Task::where('title', 'Daily Standup')->count();
        $this->assertEquals(2, $totalDailyTasks); // 1 original + 1 successor
    }

    /**
     * 12. Progress recalculation on task movement, status toggle, and deletion.
     */
    public function test_progress_recalculation_on_task_movement_deletion_and_toggle(): void
    {
        // Create 2 tasks in Project A
        $t1 = Task::create([
            'user_id' => $this->owner->id,
            'project_id' => $this->projectA->id,
            'title' => 'Task 1',
            'status' => 'todo',
            'priority' => 'medium',
        ]);
        $t2 = Task::create([
            'user_id' => $this->owner->id,
            'project_id' => $this->projectA->id,
            'title' => 'Task 2',
            'status' => 'todo',
            'priority' => 'medium',
        ]);

        $this->projectA->updateProgress();
        $this->assertEquals(0, $this->projectA->fresh()->progress);

        // 12A. Complete Task 1 -> progress becomes 50%
        $this->actingAs($this->owner, 'sanctum')->patchJson("/api/v1/tasks/{$t1->id}/toggle");
        $this->assertEquals(50, $this->projectA->fresh()->progress);

        // 12B. Complete Task 2 -> progress becomes 100%
        $this->actingAs($this->owner, 'sanctum')->patchJson("/api/v1/tasks/{$t2->id}/toggle");
        $this->assertEquals(100, $this->projectA->fresh()->progress);

        // 12C. Uncomplete Task 1 -> progress drops back to 50%
        $this->actingAs($this->owner, 'sanctum')->patchJson("/api/v1/tasks/{$t1->id}/toggle");
        $this->assertEquals(50, $this->projectA->fresh()->progress);

        // 12D. Move Task 2 (completed) from Project A to Project B
        // Grant owner tasks.create in Project B
        ProjectMember::firstOrCreate([
            'project_id' => $this->projectB->id,
            'user_id' => $this->owner->id,
        ], [
            'role_id' => ProjectRole::where('project_id', $this->projectB->id)->where('name', 'Admin')->value('id'),
            'role' => 'admin',
        ]);

        $moveRes = $this->actingAs($this->owner, 'sanctum')->putJson("/api/v1/tasks/{$t2->id}", [
            'project_id' => $this->projectB->id,
        ]);
        $moveRes->assertStatus(200);

        // In Project A: only Task 1 remains (which is 'todo') -> progress is now 0%
        $this->assertEquals(0, $this->projectA->fresh()->progress);
        // In Project B: has Task 2 (which is 'completed') -> progress is 100%
        $this->assertEquals(100, $this->projectB->fresh()->progress);

        // 12E. Delete Task 1 from Project A
        $delRes = $this->actingAs($this->owner, 'sanctum')->deleteJson("/api/v1/tasks/{$t1->id}");
        $delRes->assertStatus(200);

        // Project A now has 0 tasks -> progress is 0%
        $this->assertEquals(0, $this->projectA->fresh()->progress);
    }
}
