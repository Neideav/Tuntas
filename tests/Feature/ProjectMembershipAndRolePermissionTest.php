<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\ProjectInvitation;
use App\Models\ProjectMember;
use App\Models\ProjectRole;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProjectMembershipAndRolePermissionTest extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected User $memberUser;
    protected User $outsider;
    protected Project $project;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create([
            'name' => 'Project Owner',
            'email' => 'owner@tuntas.test',
        ]);

        $this->memberUser = User::factory()->create([
            'name' => 'Team Member',
            'email' => 'member@tuntas.test',
        ]);

        $this->outsider = User::factory()->create([
            'name' => 'Outsider User',
            'email' => 'outsider@tuntas.test',
        ]);

        // Create project owned by owner
        $response = $this->actingAs($this->owner)->postJson('/api/v1/projects', [
            'title' => 'Alpha Core Platform',
            'description' => 'Multi-user project',
        ]);
        $response->assertStatus(201);
        $this->project = Project::find($response->json('data.id'));
    }

    public function test_project_creation_auto_initializes_builtin_roles_and_owner_membership()
    {
        // 4 built-in roles should exist: owner, admin, member, viewer
        $roles = ProjectRole::where('project_id', $this->project->id)->get();
        $this->assertCount(4, $roles);

        $slugs = $roles->pluck('slug')->toArray();
        $this->assertContains('owner', $slugs);
        $this->assertContains('admin', $slugs);
        $this->assertContains('member', $slugs);
        $this->assertContains('viewer', $slugs);

        // Owner must be recorded in project_members
        $ownerMember = ProjectMember::where('project_id', $this->project->id)
            ->where('user_id', $this->owner->id)
            ->first();

        $this->assertNotNull($ownerMember);
        $this->assertEquals('owner', $ownerMember->role);
    }

    public function test_permission_catalog_endpoint_returns_complete_modules()
    {
        $response = $this->actingAs($this->owner)->getJson('/api/v1/permissions/catalog');
        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonStructure([
                'data' => [
                    'project' => ['title', 'permissions'],
                    'members' => ['title', 'permissions'],
                    'roles' => ['title', 'permissions'],
                    'tasks' => ['title', 'permissions'],
                    'notes' => ['title', 'permissions'],
                    'reports' => ['title', 'permissions'],
                ],
            ]);
    }

    public function test_owner_can_create_and_manage_custom_roles()
    {
        // Create custom role: Frontend Developer
        $res = $this->actingAs($this->owner)->postJson("/api/v1/projects/{$this->project->id}/roles", [
            'name' => 'Frontend Developer',
            'slug' => 'frontend-dev',
            'description' => 'Builds UI interfaces and completes tasks',
            'color' => '#10B981',
            'permissions' => [
                'project.view',
                'tasks.view',
                'tasks.create',
                'tasks.update',
                'tasks.complete',
                'notes.view',
                'notes.create',
            ],
        ]);

        $res->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.slug', 'frontend-dev')
            ->assertJsonPath('data.color', '#10B981');

        $roleId = $res->json('data.id');

        // Update custom role
        $updateRes = $this->actingAs($this->owner)->putJson("/api/v1/projects/{$this->project->id}/roles/{$roleId}", [
            'name' => 'Lead Frontend Developer',
            'color' => '#059669',
            'permissions' => [
                'project.view',
                'tasks.view',
                'tasks.create',
                'tasks.update',
                'tasks.complete',
                'tasks.assign',
            ],
        ]);

        $updateRes->assertStatus(200)
            ->assertJsonPath('data.name', 'Lead Frontend Developer');

        // Delete custom role
        $delRes = $this->actingAs($this->owner)->deleteJson("/api/v1/projects/{$this->project->id}/roles/{$roleId}");
        $delRes->assertStatus(200);

        $this->assertDatabaseMissing('project_roles', ['id' => $roleId]);
    }

    public function test_reserved_role_slugs_and_builtin_role_modifications_are_rejected()
    {
        // 1. Cannot create role with reserved slug 'admin'
        $res = $this->actingAs($this->owner)->postJson("/api/v1/projects/{$this->project->id}/roles", [
            'name' => 'Fake Admin',
            'slug' => 'admin',
            'permissions' => ['project.view'],
        ]);
        $res->assertStatus(422);

        // 2. Cannot delete built-in viewer role
        $viewerRole = ProjectRole::where('project_id', $this->project->id)->where('slug', 'viewer')->firstOrFail();
        $delViewerRes = $this->actingAs($this->owner)->deleteJson("/api/v1/projects/{$this->project->id}/roles/{$viewerRole->id}");
        $delViewerRes->assertStatus(422);

        // 3. Cannot modify built-in owner role
        $ownerRole = ProjectRole::where('project_id', $this->project->id)->where('slug', 'owner')->firstOrFail();
        $modOwnerRes = $this->actingAs($this->owner)->putJson("/api/v1/projects/{$this->project->id}/roles/{$ownerRole->id}", [
            'permissions' => ['project.view'],
        ]);
        $modOwnerRes->assertStatus(403);
    }

    public function test_cannot_delete_role_with_active_members()
    {
        $customRole = ProjectRole::create([
            'project_id' => $this->project->id,
            'name' => 'Tester',
            'slug' => 'tester',
            'permissions' => ['project.view', 'tasks.view'],
        ]);

        ProjectMember::create([
            'project_id' => $this->project->id,
            'user_id' => $this->memberUser->id,
            'role_id' => $customRole->id,
            'role' => $customRole->slug,
        ]);

        // Attempting to delete role while assigned to memberUser must fail with 422
        $res = $this->actingAs($this->owner)->deleteJson("/api/v1/projects/{$this->project->id}/roles/{$customRole->id}");
        $res->assertStatus(422)
            ->assertJsonPath('success', false);
    }

    public function test_invitation_lifecycle_from_invite_to_acceptance()
    {
        // 1. Owner invites collaborator
        $inviteRes = $this->actingAs($this->owner)->postJson("/api/v1/projects/{$this->project->id}/invitations", [
            'email' => 'collaborator@tuntas.test',
            'role' => 'member',
        ]);

        $inviteRes->assertStatus(201)
            ->assertJsonPath('success', true);

        $token = $inviteRes->json('data.invite_token');
        $this->assertNotEmpty($token);

        // 2. Collaborator registers / logs in and accepts invitation
        $collaborator = User::factory()->create(['email' => 'collaborator@tuntas.test']);
        $acceptRes = $this->actingAs($collaborator)->postJson("/api/v1/invitations/{$token}/accept");
        $acceptRes->assertStatus(200)
            ->assertJsonPath('success', true);

        // Verify membership created
        $this->assertDatabaseHas('project_members', [
            'project_id' => $this->project->id,
            'user_id' => $collaborator->id,
            'role' => 'member',
        ]);

        // Invitation status must be 'accepted'
        $this->assertDatabaseHas('project_invitations', [
            'token' => $token,
            'status' => 'accepted',
        ]);

        // 3. Replay attack: accepting again must be rejected
        $replayRes = $this->actingAs($collaborator)->postJson("/api/v1/invitations/{$token}/accept");
        $replayRes->assertStatus(422);
    }

    public function test_expired_invitation_is_rejected()
    {
        $invitation = ProjectInvitation::create([
            'project_id' => $this->project->id,
            'inviter_id' => $this->owner->id,
            'email' => 'expired@tuntas.test',
            'role' => 'viewer',
            'token' => 'expired_token_123456789012345678901234567890',
            'status' => 'pending',
            'expires_at' => now()->subDay(),
        ]);

        $candidate = User::factory()->create(['email' => 'expired@tuntas.test']);
        $res = $this->actingAs($candidate)->postJson("/api/v1/invitations/{$invitation->token}/accept");
        $res->assertStatus(422);
    }

    public function test_cannot_invite_existing_member_again()
    {
        ProjectMember::create([
            'project_id' => $this->project->id,
            'user_id' => $this->memberUser->id,
            'role' => 'member',
        ]);

        $res = $this->actingAs($this->owner)->postJson("/api/v1/projects/{$this->project->id}/invitations", [
            'email' => $this->memberUser->email,
            'role' => 'viewer',
        ]);

        $res->assertStatus(422);
    }

    public function test_privilege_escalation_non_owner_cannot_invite_as_owner()
    {
        // Add memberUser as Admin
        $adminRole = ProjectRole::where('project_id', $this->project->id)->where('slug', 'admin')->firstOrFail();
        ProjectMember::create([
            'project_id' => $this->project->id,
            'user_id' => $this->memberUser->id,
            'role_id' => $adminRole->id,
            'role' => 'admin',
        ]);

        // Admin attempts to invite someone as Owner -> blocked with 403
        $res = $this->actingAs($this->memberUser)->postJson("/api/v1/projects/{$this->project->id}/invitations", [
            'email' => 'wannabeowner@tuntas.test',
            'role' => 'owner',
        ]);

        $res->assertStatus(403);
    }

    public function test_owner_cannot_be_removed_or_demoted()
    {
        // Add memberUser as Admin
        $adminRole = ProjectRole::where('project_id', $this->project->id)->where('slug', 'admin')->firstOrFail();
        ProjectMember::create([
            'project_id' => $this->project->id,
            'user_id' => $this->memberUser->id,
            'role_id' => $adminRole->id,
            'role' => 'admin',
        ]);

        // Admin attempts to remove owner -> blocked with 403
        $removeRes = $this->actingAs($this->memberUser)->deleteJson("/api/v1/projects/{$this->project->id}/members/{$this->owner->id}");
        $removeRes->assertStatus(403);

        // Admin attempts to change owner's role -> blocked with 403
        $roleChangeRes = $this->actingAs($this->memberUser)->patchJson("/api/v1/projects/{$this->project->id}/members/{$this->owner->id}/role", [
            'role' => 'viewer',
        ]);
        $roleChangeRes->assertStatus(403);
    }

    public function test_revoking_member_immediately_cuts_off_project_and_task_access()
    {
        // 1. Add memberUser as Member
        $memberRole = ProjectRole::where('project_id', $this->project->id)->where('slug', 'member')->firstOrFail();
        ProjectMember::create([
            'project_id' => $this->project->id,
            'user_id' => $this->memberUser->id,
            'role_id' => $memberRole->id,
            'role' => 'member',
        ]);

        // Member can view project
        $viewRes = $this->actingAs($this->memberUser)->getJson("/api/v1/projects/{$this->project->id}");
        $viewRes->assertStatus(200);

        // 2. Owner removes memberUser
        $removeRes = $this->actingAs($this->owner)->deleteJson("/api/v1/projects/{$this->project->id}/members/{$this->memberUser->id}");
        $removeRes->assertStatus(200);

        // 3. Member immediately gets 403 when accessing project
        $postRemovalRes = $this->actingAs($this->memberUser)->getJson("/api/v1/projects/{$this->project->id}");
        $postRemovalRes->assertStatus(403);
    }

    public function test_cross_project_isolation_outsider_cannot_access_or_modify()
    {
        // Outsider cannot view project
        $res = $this->actingAs($this->outsider)->getJson("/api/v1/projects/{$this->project->id}");
        $res->assertStatus(403);

        // Outsider cannot view roles
        $rolesRes = $this->actingAs($this->outsider)->getJson("/api/v1/projects/{$this->project->id}/roles");
        $rolesRes->assertStatus(403);

        // Outsider cannot invite
        $inviteRes = $this->actingAs($this->outsider)->postJson("/api/v1/projects/{$this->project->id}/invitations", [
            'email' => 'hack@tuntas.test',
            'role' => 'viewer',
        ]);
        $inviteRes->assertStatus(403);
    }

    public function test_member_with_tasks_view_and_assign_can_collaborate_on_tasks()
    {
        $memberRole = ProjectRole::where('project_id', $this->project->id)->where('slug', 'member')->firstOrFail();
        ProjectMember::create([
            'project_id' => $this->project->id,
            'user_id' => $this->memberUser->id,
            'role_id' => $memberRole->id,
            'role' => 'member',
        ]);

        // Member creates task in shared project assigned to owner
        $taskRes = $this->actingAs($this->memberUser)->postJson('/api/v1/tasks', [
            'title' => 'Collaborative Task #1',
            'project_id' => $this->project->id,
            'assigned_to' => $this->owner->id,
        ]);
        $taskRes->assertStatus(201);
        $taskId = $taskRes->json('data.id');

        // Member toggles status
        $toggleRes = $this->actingAs($this->memberUser)->patchJson("/api/v1/tasks/{$taskId}/toggle");
        $toggleRes->assertStatus(200)
            ->assertJsonPath('data.status', 'completed');
    }
}
