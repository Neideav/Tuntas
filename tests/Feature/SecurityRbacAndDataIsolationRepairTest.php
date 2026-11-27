<?php

namespace Tests\Feature;

use App\Models\Note;
use App\Models\Project;
use App\Models\ProjectInvitation;
use App\Models\ProjectMember;
use App\Models\ProjectRole;
use App\Models\Task;
use App\Models\User;
use App\Models\WorkReport;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SecurityRbacAndDataIsolationRepairTest extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected User $adminUser;
    protected User $memberUser;
    protected User $viewerUser;
    protected User $outsider;
    protected Project $projectA;
    protected Project $projectB;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create(['name' => 'Owner User', 'email' => 'owner@tuntas.test']);
        $this->adminUser = User::factory()->create(['name' => 'Admin User', 'email' => 'admin@tuntas.test']);
        $this->memberUser = User::factory()->create(['name' => 'Member User', 'email' => 'member@tuntas.test']);
        $this->viewerUser = User::factory()->create(['name' => 'Viewer User', 'email' => 'viewer@tuntas.test']);
        $this->outsider = User::factory()->create(['name' => 'Outsider User', 'email' => 'outsider@tuntas.test']);

        // Create Project A owned by $this->owner
        $this->projectA = Project::create([
            'user_id' => $this->owner->id,
            'title' => 'Project Alpha',
            'description' => 'First project for testing RBAC',
            'status' => 'planning',
        ]);
        $rolesA = ProjectRole::ensureBuiltinRolesForProject($this->projectA);

        // Attach owner to Project A
        ProjectMember::create([
            'project_id' => $this->projectA->id,
            'user_id' => $this->owner->id,
            'role_id' => $rolesA[ProjectRole::ROLE_OWNER]->id,
            'role' => ProjectRole::ROLE_OWNER,
        ]);

        // Attach admin to Project A
        ProjectMember::create([
            'project_id' => $this->projectA->id,
            'user_id' => $this->adminUser->id,
            'role_id' => $rolesA[ProjectRole::ROLE_ADMIN]->id,
            'role' => ProjectRole::ROLE_ADMIN,
        ]);

        // Attach member to Project A
        ProjectMember::create([
            'project_id' => $this->projectA->id,
            'user_id' => $this->memberUser->id,
            'role_id' => $rolesA[ProjectRole::ROLE_MEMBER]->id,
            'role' => ProjectRole::ROLE_MEMBER,
        ]);

        // Attach viewer to Project A
        ProjectMember::create([
            'project_id' => $this->projectA->id,
            'user_id' => $this->viewerUser->id,
            'role_id' => $rolesA[ProjectRole::ROLE_VIEWER]->id,
            'role' => ProjectRole::ROLE_VIEWER,
        ]);

        // Create Project B owned by $this->outsider
        $this->projectB = Project::create([
            'user_id' => $this->outsider->id,
            'title' => 'Project Beta',
            'description' => 'Isolated project for cross-tenant testing',
            'status' => 'planning',
        ]);
        $rolesB = ProjectRole::ensureBuiltinRolesForProject($this->projectB);
        ProjectMember::create([
            'project_id' => $this->projectB->id,
            'user_id' => $this->outsider->id,
            'role_id' => $rolesB[ProjectRole::ROLE_OWNER]->id,
            'role' => ProjectRole::ROLE_OWNER,
        ]);
    }

    /**
     * 1. User tanpa membership mengakses proyek -> HTTP 403
     */
    public function test_user_without_membership_cannot_access_project(): void
    {
        // Outsider tries to access Project A details
        $res = $this->actingAs($this->outsider)->getJson("/api/v1/projects/{$this->projectA->id}");
        $res->assertStatus(403);

        // Outsider tries to access Project A roles
        $rolesRes = $this->actingAs($this->outsider)->getJson("/api/v1/projects/{$this->projectA->id}/roles");
        $rolesRes->assertStatus(403);

        // Outsider tries to access Project A members
        $membersRes = $this->actingAs($this->outsider)->getJson("/api/v1/projects/{$this->projectA->id}/members");
        $membersRes->assertStatus(403);
    }

    /**
     * 2. Viewer mencoba mengubah task -> HTTP 403
     */
    public function test_viewer_cannot_update_task(): void
    {
        $task = Task::create([
            'user_id' => $this->owner->id,
            'project_id' => $this->projectA->id,
            'title' => 'Alpha Task #1',
            'status' => 'todo',
            'priority' => 'medium',
        ]);

        // Viewer attempts to update task title/status
        $res = $this->actingAs($this->viewerUser)->putJson("/api/v1/tasks/{$task->id}", [
            'title' => 'Tampered Task Title by Viewer',
            'status' => 'in_progress',
        ]);
        $res->assertStatus(403);

        // Viewer attempts toggleStatus
        $toggleRes = $this->actingAs($this->viewerUser)->patchJson("/api/v1/tasks/{$task->id}/toggle");
        $toggleRes->assertStatus(403);

        // Verify task state in database is unmodified
        $this->assertDatabaseHas('tasks', [
            'id' => $task->id,
            'title' => 'Alpha Task #1',
            'status' => 'todo',
        ]);
    }

    /**
     * 3. Viewer mencoba menghapus task -> HTTP 403
     */
    public function test_viewer_cannot_delete_task(): void
    {
        $task = Task::create([
            'user_id' => $this->owner->id,
            'project_id' => $this->projectA->id,
            'title' => 'Alpha Task #2',
            'status' => 'todo',
        ]);

        $res = $this->actingAs($this->viewerUser)->deleteJson("/api/v1/tasks/{$task->id}");
        $res->assertStatus(403);

        $this->assertDatabaseHas('tasks', ['id' => $task->id]);
    }

    /**
     * 4. Member mencoba mengelola role tanpa permission -> HTTP 403
     */
    public function test_member_without_permission_cannot_manage_roles(): void
    {
        // Standard member attempts to create a custom role
        $res = $this->actingAs($this->memberUser)->postJson("/api/v1/projects/{$this->projectA->id}/roles", [
            'name' => 'Unauthorized Role',
            'permissions' => ['tasks.view'],
        ]);
        $res->assertStatus(403);

        // Standard member attempts to delete an existing role
        $role = ProjectRole::where('project_id', $this->projectA->id)->where('slug', 'viewer')->first();
        $delRes = $this->actingAs($this->memberUser)->deleteJson("/api/v1/projects/{$this->projectA->id}/roles/{$role->id}");
        $delRes->assertStatus(403);
    }

    /**
     * 5. Custom role mencoba mendapatkan protected permission (project.delete) -> HTTP 422
     */
    public function test_custom_role_cannot_obtain_protected_permission(): void
    {
        // Owner attempts to create a custom role with 'project.delete'
        $res = $this->actingAs($this->owner)->postJson("/api/v1/projects/{$this->projectA->id}/roles", [
            'name' => 'Super Custom Manager',
            'slug' => 'super-custom-manager',
            'permissions' => [
                'project.view',
                'tasks.view',
                'project.delete', // Protected owner permission
            ],
        ]);

        $res->assertStatus(422)
            ->assertJsonPath('success', false);

        $this->assertDatabaseMissing('project_roles', [
            'project_id' => $this->projectA->id,
            'slug' => 'super-custom-manager',
        ]);
    }

    /**
     * 6. User dari proyek A mengakses resource proyek B -> HTTP 403
     */
    public function test_user_from_project_a_cannot_access_resource_in_project_b(): void
    {
        $taskB = Task::create([
            'user_id' => $this->outsider->id,
            'project_id' => $this->projectB->id,
            'title' => 'Secret Beta Task',
            'status' => 'todo',
        ]);

        $noteB = Note::create([
            'user_id' => $this->outsider->id,
            'project_id' => $this->projectB->id,
            'title' => 'Secret Beta Note',
            'content' => 'Confidential information',
        ]);

        $reportB = WorkReport::create([
            'user_id' => $this->outsider->id,
            'project_id' => $this->projectB->id,
            'title' => 'Secret Beta Report',
            'content' => 'Q4 financial results',
            'status' => 'submitted',
        ]);

        // User from Project A attempts to view Task B
        $this->actingAs($this->memberUser)->getJson("/api/v1/tasks/{$taskB->id}")->assertStatus(403);

        // User from Project A attempts to view Note B
        $this->actingAs($this->memberUser)->getJson("/api/v1/notes/{$noteB->id}")->assertStatus(403);

        // User from Project A attempts to view Report B
        $this->actingAs($this->memberUser)->getJson("/api/v1/reports/{$reportB->id}")->assertStatus(403);

        // User from Project A attempts to list tasks filtered by project B
        $this->actingAs($this->memberUser)->getJson("/api/v1/tasks?project_id={$this->projectB->id}")->assertStatus(403);
    }

    /**
     * 7. User lain menerima invitation yang bukan untuk email-nya -> HTTP 403
     */
    public function test_user_cannot_accept_invitation_sent_to_different_email(): void
    {
        $inviteRes = $this->actingAs($this->owner)->postJson("/api/v1/projects/{$this->projectA->id}/invitations", [
            'email' => 'legitimate-invitee@tuntas.test',
            'role' => 'member',
        ]);
        $inviteRes->assertStatus(201);
        $token = $inviteRes->json('data.invite_token');

        // Attacker with different email attempts to accept
        $attacker = User::factory()->create(['email' => 'attacker@tuntas.test']);
        $acceptRes = $this->actingAs($attacker)->postJson("/api/v1/invitations/{$token}/accept");

        $acceptRes->assertStatus(403)
            ->assertJsonPath('success', false);

        // Verify attacker was NOT added as a member
        $this->assertDatabaseMissing('project_members', [
            'project_id' => $this->projectA->id,
            'user_id' => $attacker->id,
        ]);

        // Verify invitation status remains 'pending'
        $this->assertDatabaseHas('project_invitations', [
            'token' => $token,
            'status' => 'pending',
        ]);
    }

    /**
     * 8. Invitation digunakan dua kali -> HTTP 422
     */
    public function test_invitation_cannot_be_used_twice(): void
    {
        $inviteRes = $this->actingAs($this->owner)->postJson("/api/v1/projects/{$this->projectA->id}/invitations", [
            'email' => 'single-use@tuntas.test',
            'role' => 'member',
        ]);
        $token = $inviteRes->json('data.invite_token');

        $user = User::factory()->create(['email' => 'single-use@tuntas.test']);

        // First acceptance: succeeds
        $firstRes = $this->actingAs($user)->postJson("/api/v1/invitations/{$token}/accept");
        $firstRes->assertStatus(200);

        // Second acceptance: rejected with 422
        $secondRes = $this->actingAs($user)->postJson("/api/v1/invitations/{$token}/accept");
        $secondRes->assertStatus(422)
            ->assertJsonPath('success', false);
    }

    /**
     * 9. Dua request menerima undangan bersamaan (race condition prevention) -> single acceptance
     */
    public function test_concurrent_invitation_acceptance_race_condition(): void
    {
        $inviteRes = $this->actingAs($this->owner)->postJson("/api/v1/projects/{$this->projectA->id}/invitations", [
            'email' => 'concurrency@tuntas.test',
            'role' => 'member',
        ]);
        $token = $inviteRes->json('data.invite_token');

        $user = User::factory()->create(['email' => 'concurrency@tuntas.test']);

        // First acceptance completes
        $first = $this->actingAs($user)->postJson("/api/v1/invitations/{$token}/accept");
        $first->assertStatus(200);

        // Immediate concurrent replay attempt
        $second = $this->actingAs($user)->postJson("/api/v1/invitations/{$token}/accept");
        $second->assertStatus(422);

        // Exactly one membership record exists for this user in Project A
        $count = ProjectMember::where('project_id', $this->projectA->id)
            ->where('user_id', $user->id)
            ->count();
        $this->assertEquals(1, $count);
    }

    /**
     * 10. User yang telah dihapus dari proyek mencoba mengakses data lama -> HTTP 403
     */
    public function test_user_removed_from_project_cannot_access_old_project_data(): void
    {
        // Member creates a task and a note in Project A
        $task = Task::create([
            'user_id' => $this->memberUser->id,
            'project_id' => $this->projectA->id,
            'title' => 'Task authored by Member',
            'status' => 'todo',
        ]);

        $note = Note::create([
            'user_id' => $this->memberUser->id,
            'project_id' => $this->projectA->id,
            'title' => 'Note authored by Member',
            'content' => 'Project documentation note',
        ]);

        $report = WorkReport::create([
            'user_id' => $this->memberUser->id,
            'project_id' => $this->projectA->id,
            'title' => 'Report authored by Member',
            'content' => 'Progress report content',
            'status' => 'submitted',
        ]);

        // Prior to removal, member can view their task, note, report
        $this->actingAs($this->memberUser)->getJson("/api/v1/tasks/{$task->id}")->assertStatus(200);
        $this->actingAs($this->memberUser)->getJson("/api/v1/notes/{$note->id}")->assertStatus(200);
        $this->actingAs($this->memberUser)->getJson("/api/v1/reports/{$report->id}")->assertStatus(200);

        // Owner removes memberUser from Project A
        $removeRes = $this->actingAs($this->owner)->deleteJson("/api/v1/projects/{$this->projectA->id}/members/{$this->memberUser->id}");
        $removeRes->assertStatus(200);

        // Immediately after removal:
        // Member cannot view Project A
        $this->actingAs($this->memberUser)->getJson("/api/v1/projects/{$this->projectA->id}")->assertStatus(403);

        // Member cannot view their former project task
        $this->actingAs($this->memberUser)->getJson("/api/v1/tasks/{$task->id}")->assertStatus(403);

        // Member cannot view their former project note
        $this->actingAs($this->memberUser)->getJson("/api/v1/notes/{$note->id}")->assertStatus(403);

        // Member cannot view their former project report
        $this->actingAs($this->memberUser)->getJson("/api/v1/reports/{$report->id}")->assertStatus(403);

        // In global task index, the old project task MUST NOT leak to the removed member
        $taskListRes = $this->actingAs($this->memberUser)->getJson('/api/v1/tasks');
        $taskListRes->assertStatus(200);
        $returnedTaskIds = collect($taskListRes->json('data'))->pluck('id')->toArray();
        $this->assertNotContains($task->id, $returnedTaskIds);
    }

    /**
     * 11. Personal task tidak memberikan akses permission yang tidak semestinya
     */
    public function test_personal_task_does_not_grant_unintended_permissions(): void
    {
        $creator = User::factory()->create(['name' => 'Personal Creator', 'email' => 'creator@tuntas.test']);
        $assignee = User::factory()->create(['name' => 'Personal Assignee', 'email' => 'assignee@tuntas.test']);
        $stranger = User::factory()->create(['name' => 'Stranger User', 'email' => 'stranger@tuntas.test']);

        // Personal task created by $creator and assigned to $assignee
        $task = Task::create([
            'user_id' => $creator->id,
            'assigned_to' => $assignee->id,
            'project_id' => null, // Personal task
            'title' => 'Personal Task Assignment',
            'status' => 'todo',
        ]);

        // 1. Assignee can view the task
        $viewRes = $this->actingAs($assignee)->getJson("/api/v1/tasks/{$task->id}");
        $viewRes->assertStatus(200);

        // 2. Assignee can toggle status to complete
        $toggleRes = $this->actingAs($assignee)->patchJson("/api/v1/tasks/{$task->id}/toggle");
        $toggleRes->assertStatus(200)
            ->assertJsonPath('data.status', 'completed');

        // 3. Assignee CANNOT delete the personal task owned by another user
        $delRes = $this->actingAs($assignee)->deleteJson("/api/v1/tasks/{$task->id}");
        $delRes->assertStatus(403);
        $this->assertDatabaseHas('tasks', ['id' => $task->id]);

        // 4. Assignee CANNOT update title/description of creator's personal task
        $updRes = $this->actingAs($assignee)->putJson("/api/v1/tasks/{$task->id}", [
            'title' => 'Tampered Title by Assignee',
        ]);
        $updRes->assertStatus(403);

        // 5. Unrelated stranger has NO access
        $strangerRes = $this->actingAs($stranger)->getJson("/api/v1/tasks/{$task->id}");
        $strangerRes->assertStatus(403);
    }
}
