<?php

namespace Tests\Feature;

use App\Events\NotificationCreated;
use App\Events\RoleMentioned;
use App\Events\UserMentioned;
use App\Models\Mention;
use App\Models\Note;
use App\Models\Notification;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\ProjectRole;
use App\Models\Task;
use App\Models\User;
use App\Models\UserSetting;
use App\Services\MentionService;
use App\Services\NotificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class UserMentionRoleMentionAndNotificationEngineTest extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected User $developer;
    protected User $designer;
    protected User $outsider;
    protected Project $project;
    protected ProjectRole $devRole;
    protected ProjectRole $designerRole;

    protected function setUp(): void
    {
        parent::setUp();

        // Users
        $this->owner = User::factory()->create(['name' => 'Project Owner', 'email' => 'owner@tuntas.test']);
        $this->developer = User::factory()->create(['name' => 'Alice Dev', 'email' => 'alice@tuntas.test']);
        $this->designer = User::factory()->create(['name' => 'Bob Designer', 'email' => 'bob@tuntas.test']);
        $this->outsider = User::factory()->create(['name' => 'Eve Outsider', 'email' => 'eve@tuntas.test']);

        // Project
        $this->project = Project::create([
            'user_id' => $this->owner->id,
            'title' => 'Tuntas Platform Project',
            'status' => 'in_progress',
        ]);

        // Roles
        ProjectRole::ensureBuiltinRolesForProject($this->project);
        $this->devRole = ProjectRole::create([
            'project_id' => $this->project->id,
            'name' => 'Frontend Developer',
            'slug' => 'frontend-developer',
            'color' => '#3B82F6',
            'permissions' => ['*'],
        ]);
        $this->designerRole = ProjectRole::create([
            'project_id' => $this->project->id,
            'name' => 'UI Designer',
            'slug' => 'ui-designer',
            'color' => '#EC4899',
            'permissions' => ['project.view', 'notes.view'],
        ]);

        // Memberships
        ProjectMember::create([
            'project_id' => $this->project->id,
            'user_id' => $this->owner->id,
            'role' => 'owner',
            'joined_at' => now(),
        ]);
        ProjectMember::create([
            'project_id' => $this->project->id,
            'user_id' => $this->developer->id,
            'role_id' => $this->devRole->id,
            'role' => 'member',
            'joined_at' => now(),
        ]);
        ProjectMember::create([
            'project_id' => $this->project->id,
            'user_id' => $this->designer->id,
            'role_id' => $this->designerRole->id,
            'role' => 'member',
            'joined_at' => now(),
        ]);
    }

    /**
     * 1. Autocomplete returns only valid project members and project roles.
     */
    public function test_mention_autocomplete_returns_project_members_and_roles()
    {
        $response = $this->actingAs($this->developer, 'sanctum')
            ->getJson("/api/v1/mentions/autocomplete?project_id={$this->project->id}&q=");

        $response->assertStatus(200)
            ->assertJsonPath('success', true);

        $users = collect($response->json('data.users'))->pluck('name');
        $roles = collect($response->json('data.roles'))->pluck('name');

        $this->assertTrue($users->contains('Alice Dev'));
        $this->assertTrue($users->contains('Bob Designer'));
        $this->assertFalse($users->contains('Eve Outsider')); // outsider not included

        $this->assertTrue($roles->contains('Frontend Developer'));
        $this->assertTrue($roles->contains('UI Designer'));
    }

    /**
     * 2. Outsider cannot access project autocomplete.
     */
    public function test_outsider_cannot_access_project_mention_autocomplete()
    {
        $response = $this->actingAs($this->outsider, 'sanctum')
            ->getJson("/api/v1/mentions/autocomplete?project_id={$this->project->id}&q=");

        $response->assertStatus(403);
    }

    /**
     * 3. User mention creates mention entity, notification, and broadcasts event.
     */
    public function test_user_mention_persists_notifies_and_broadcasts()
    {
        Event::fake([UserMentioned::class, NotificationCreated::class]);

        $note = Note::create([
            'user_id' => $this->owner->id,
            'project_id' => $this->project->id,
            'title' => 'Architecture Discussion',
            'content' => 'Hey @alice@tuntas.test please review this design.',
            'status' => 'published',
            'version' => 1,
        ]);

        $mentionService = app(MentionService::class);
        $mentionService->processMentions(
            $this->owner,
            $note,
            $note->content,
            'note',
            $note->id,
            $note->title,
            $this->project->id
        );

        // Assert mention persisted
        $this->assertDatabaseHas('mentions', [
            'mentioner_id' => $this->owner->id,
            'mentioned_user_id' => $this->developer->id,
            'mentionable_type' => Note::class,
            'mentionable_id' => $note->id,
            'project_id' => $this->project->id,
        ]);

        // Assert notification created for developer
        $this->assertDatabaseHas('notifications', [
            'user_id' => $this->developer->id,
            'type' => 'user_mentioned',
            'is_read' => false,
        ]);

        // Assert author is not notified about themselves
        $this->assertDatabaseMissing('notifications', [
            'user_id' => $this->owner->id,
            'type' => 'user_mentioned',
        ]);

        Event::assertDispatched(UserMentioned::class);
        Event::assertDispatched(NotificationCreated::class);
    }

    /**
     * 4. Role mention resolves active members and notifies all members in that role.
     */
    public function test_role_mention_resolves_and_notifies_active_role_members()
    {
        Event::fake([RoleMentioned::class, NotificationCreated::class]);

        // Add a second developer to devRole
        $dev2 = User::factory()->create(['name' => 'Charlie Dev', 'email' => 'charlie@tuntas.test']);
        ProjectMember::create([
            'project_id' => $this->project->id,
            'user_id' => $dev2->id,
            'role_id' => $this->devRole->id,
            'role' => 'member',
            'joined_at' => now(),
        ]);

        $note = Note::create([
            'user_id' => $this->owner->id,
            'project_id' => $this->project->id,
            'title' => 'Sprint Planning',
            'content' => 'Attention @role:frontend-developer please check requirements.',
            'status' => 'published',
            'version' => 1,
        ]);

        $mentionService = app(MentionService::class);
        $mentionService->processMentions(
            $this->owner,
            $note,
            $note->content,
            'note',
            $note->id,
            $note->title,
            $this->project->id
        );

        // Both dev1 and dev2 receive notification
        $this->assertDatabaseHas('notifications', [
            'user_id' => $this->developer->id,
            'type' => 'role_mentioned',
        ]);
        $this->assertDatabaseHas('notifications', [
            'user_id' => $dev2->id,
            'type' => 'role_mentioned',
        ]);

        // Designer is NOT notified for developer role mention
        $this->assertDatabaseMissing('notifications', [
            'user_id' => $this->designer->id,
            'type' => 'role_mentioned',
        ]);

        Event::assertDispatched(RoleMentioned::class);
    }

    /**
     * 5. Cross-project role mentions are strictly rejected.
     */
    public function test_cross_project_role_mention_is_rejected()
    {
        // Second project with its own role
        $otherProject = Project::create([
            'user_id' => $this->outsider->id,
            'title' => 'Other Project',
            'status' => 'in_progress',
        ]);
        $otherRole = ProjectRole::create([
            'project_id' => $otherProject->id,
            'name' => 'Other Role',
            'slug' => 'other-role',
            'color' => '#10B981',
            'permissions' => ['*'],
        ]);

        $note = Note::create([
            'user_id' => $this->owner->id,
            'project_id' => $this->project->id,
            'title' => 'Project Note',
            'content' => 'Content with cross project role',
            'status' => 'published',
            'version' => 1,
        ]);

        $mentionService = app(MentionService::class);

        // Attempt to process mentions targeting $otherRole from a different project
        $mentionService->processMentions(
            $this->owner,
            $note,
            json_encode([
                'type' => 'doc',
                'content' => [
                    [
                        'type' => 'paragraph',
                        'content' => [
                            [
                                'type' => 'mention',
                                'attrs' => ['id' => $otherRole->id, 'mentionType' => 'role'],
                            ],
                        ],
                    ],
                ],
            ]),
            'note',
            $note->id,
            $note->title,
            $this->project->id // scoped to project 1
        );

        // Mention must NOT be stored for other project's role
        $this->assertDatabaseMissing('mentions', [
            'mentioned_role_id' => $otherRole->id,
        ]);
    }

    /**
     * 6. Notification idempotency: duplicate triggers do not create duplicate notifications.
     */
    public function test_notification_idempotency_prevents_duplicate_delivery()
    {
        $notifService = app(NotificationService::class);

        $notif1 = $notifService->createIdempotent(
            userId: $this->developer->id,
            title: 'Tugas Baru',
            message: 'Deskripsi tugas',
            type: 'task_assigned',
            actionUrl: '/tasks/1',
            idempotencyKey: 'task.assigned.test.1'
        );

        $this->assertNotNull($notif1);

        // Immediate retry with the same key
        $notif2 = $notifService->createIdempotent(
            userId: $this->developer->id,
            title: 'Tugas Baru',
            message: 'Deskripsi tugas',
            type: 'task_assigned',
            actionUrl: '/tasks/1',
            idempotencyKey: 'task.assigned.test.1'
        );

        // Second creation must be suppressed
        $this->assertNull($notif2);

        // Total notifications in DB for this key must be exactly 1
        $count = Notification::where('user_id', $this->developer->id)
            ->where('idempotency_key', 'task.assigned.test.1')
            ->count();
        $this->assertEquals(1, $count);
    }

    /**
     * 7. Notification preferences: opted-out users do not receive notifications.
     */
    public function test_notification_preferences_suppresses_notifications_when_opted_out()
    {
        // Disable in-app notifications for developer
        UserSetting::updateOrCreate(
            ['user_id' => $this->developer->id],
            [
                'in_app_notifications' => false,
                'preferences' => ['mention_notifications' => false],
            ]
        );

        $note = Note::create([
            'user_id' => $this->owner->id,
            'project_id' => $this->project->id,
            'title' => 'Notice to Disabled User',
            'content' => 'Hey @alice@tuntas.test please read.',
            'status' => 'published',
            'version' => 1,
        ]);

        $mentionService = app(MentionService::class);
        $mentionService->processMentions(
            $this->owner,
            $note,
            $note->content,
            'note',
            $note->id,
            $note->title,
            $this->project->id
        );

        // Mention record exists, but NO notification created
        $this->assertDatabaseMissing('notifications', [
            'user_id' => $this->developer->id,
            'type' => 'user_mentioned',
        ]);
    }

    /**
     * 8. Notification read / mark-all-as-read API works cleanly.
     */
    public function test_notification_read_and_mark_all_as_read_api()
    {
        $n1 = Notification::create([
            'user_id' => $this->developer->id,
            'title' => 'Notification 1',
            'message' => 'Message 1',
            'type' => 'system',
            'is_read' => false,
        ]);
        $n2 = Notification::create([
            'user_id' => $this->developer->id,
            'title' => 'Notification 2',
            'message' => 'Message 2',
            'type' => 'system',
            'is_read' => false,
        ]);

        // Mark single as read
        $res1 = $this->actingAs($this->developer, 'sanctum')
            ->patchJson("/api/v1/notifications/{$n1->id}/read");
        $res1->assertStatus(200);
        $this->assertTrue($n1->fresh()->is_read);
        $this->assertFalse($n2->fresh()->is_read);

        // Mark all as read
        $resAll = $this->actingAs($this->developer, 'sanctum')
            ->postJson('/api/v1/notifications/read-all');
        $resAll->assertStatus(200);
        $this->assertTrue($n2->fresh()->is_read);
    }
}
