<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Note;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\ProjectRole;
use App\Models\Task;
use App\Models\User;
use App\Models\WorkReport;
use App\Services\ActivityService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ActivityTimelineAndAuditLogsTest extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected User $member;
    protected User $outsider;
    protected Project $project;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create(['name' => 'Project Owner', 'email' => 'owner@tuntas.test']);
        $this->member = User::factory()->create(['name' => 'Team Member', 'email' => 'member@tuntas.test']);
        $this->outsider = User::factory()->create(['name' => 'Outsider User', 'email' => 'outsider@tuntas.test']);

        $this->project = Project::create([
            'user_id' => $this->owner->id,
            'title' => 'Alpha Operations',
            'status' => 'in_progress',
        ]);

        ProjectRole::ensureBuiltinRolesForProject($this->project);
        $memberRole = ProjectRole::where('project_id', $this->project->id)->where('slug', ProjectRole::ROLE_MEMBER)->first();

        ProjectMember::create([
            'project_id' => $this->project->id,
            'user_id' => $this->owner->id,
            'role' => 'owner',
            'joined_at' => now(),
        ]);

        ProjectMember::create([
            'project_id' => $this->project->id,
            'user_id' => $this->member->id,
            'role_id' => $memberRole->id,
            'role' => 'member',
            'joined_at' => now(),
        ]);
    }

    /**
     * 1. Sensitive data is automatically redacted by ActivityService.
     */
    public function test_sensitive_data_is_redacted_from_audit_logs()
    {
        $activityService = app(ActivityService::class);

        $log = $activityService->record(
            action: 'auth.login',
            resource: $this->owner,
            actor: $this->owner,
            oldValues: ['password' => 'secret_123', 'token' => 'access_xyz'],
            newValues: ['email' => 'owner@tuntas.test', 'secret' => 'do_not_leak'],
            metadata: ['api_key' => 'key_abc', 'device' => 'Desktop']
        );

        $this->assertEquals('[REDACTED]', $log->old_values['password']);
        $this->assertEquals('[REDACTED]', $log->old_values['token']);
        $this->assertEquals('[REDACTED]', $log->new_values['secret']);
        $this->assertEquals('[REDACTED]', $log->metadata['api_key']);
        $this->assertEquals('Desktop', $log->metadata['device']);
    }

    /**
     * 2. Project activity is isolated; outsiders cannot access project timeline.
     */
    public function test_project_activity_is_isolated_and_forbids_outsiders()
    {
        AuditLog::log(
            userId: $this->owner->id,
            action: 'project.updated',
            description: 'Updated sprint milestones',
            projectId: $this->project->id
        );

        // Member can access
        $memberResp = $this->actingAs($this->member, 'sanctum')
            ->getJson("/api/v1/activity?project_id={$this->project->id}");
        $memberResp->assertStatus(200)
            ->assertJsonPath('success', true);
        $this->assertNotEmpty($memberResp->json('data'));

        // Outsider is forbidden (403)
        $outsiderResp = $this->actingAs($this->outsider, 'sanctum')
            ->getJson("/api/v1/activity?project_id={$this->project->id}");
        $outsiderResp->assertStatus(403);
    }

    /**
     * 3. Workspace activity timeline filtering works by category and search.
     */
    public function test_activity_timeline_filters_by_category_and_search()
    {
        AuditLog::create([
            'actor_id' => $this->owner->id,
            'user_id' => $this->owner->id,
            'action' => 'task.created',
            'auditable_type' => Task::class,
            'auditable_id' => '1',
            'resource_type' => 'Task',
            'resource_id' => '1',
            'payload' => ['title' => 'Build login screen'],
            'created_at' => now(),
        ]);

        AuditLog::create([
            'actor_id' => $this->owner->id,
            'user_id' => $this->owner->id,
            'action' => 'notes.published',
            'auditable_type' => Note::class,
            'auditable_id' => '2',
            'resource_type' => 'Note',
            'resource_id' => '2',
            'payload' => ['title' => 'Architecture RFC'],
            'created_at' => now(),
        ]);

        // Filter by category: task
        $taskResp = $this->actingAs($this->owner, 'sanctum')
            ->getJson('/api/v1/activity?category=task');
        $taskResp->assertStatus(200);
        $actions = collect($taskResp->json('data'))->pluck('action');
        $this->assertTrue($actions->contains('task.created'));
        $this->assertFalse($actions->contains('notes.published'));

        // Filter by search term
        $searchResp = $this->actingAs($this->owner, 'sanctum')
            ->getJson('/api/v1/activity?search=Architecture');
        $searchResp->assertStatus(200);
        $searchActions = collect($searchResp->json('data'))->pluck('action');
        $this->assertTrue($searchActions->contains('notes.published'));
        $this->assertFalse($searchActions->contains('task.created'));
    }

    /**
     * 4. Rapid duplicate actions within deduplication window are prevented.
     */
    public function test_rapid_duplicate_events_are_prevented()
    {
        $activityService = app(ActivityService::class);

        $log1 = $activityService->record(
            action: 'task.updated',
            resource: $this->project,
            actor: $this->owner
        );

        $log2 = $activityService->record(
            action: 'task.updated',
            resource: $this->project,
            actor: $this->owner
        );

        $this->assertEquals($log1->id, $log2->id);
    }

    /**
     * 5. Task creation, completion, and note pinning record consistent audit trails.
     */
    public function test_task_and_note_actions_record_accurate_audit_logs()
    {
        // 1. Task Creation & Completion
        $task = Task::create([
            'user_id' => $this->owner->id,
            'project_id' => $this->project->id,
            'title' => 'Audit Test Task',
            'status' => 'in_progress',
        ]);

        $this->actingAs($this->owner, 'sanctum')
            ->patchJson("/api/v1/tasks/{$task->id}/status");

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'task.completed',
            'resource_id' => (string) $task->id,
            'project_id' => $this->project->id,
        ]);

        // 2. Note Pinning
        $note = Note::create([
            'user_id' => $this->owner->id,
            'project_id' => $this->project->id,
            'title' => 'Audit Test Note',
            'content' => 'Some content',
            'status' => 'published',
            'is_pinned' => false,
            'version' => 1,
        ]);

        $this->actingAs($this->owner, 'sanctum')
            ->patchJson("/api/v1/notes/{$note->id}/pin");

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'notes.pinned',
            'resource_id' => (string) $note->id,
            'project_id' => $this->project->id,
        ]);
    }
}
