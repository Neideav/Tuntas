<?php

namespace Tests\Feature;

use App\Models\Note;
use App\Models\NoteComment;
use App\Models\NoteVersion;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\ProjectRole;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GlobalNotesAndDocumentationTest extends TestCase
{
    use RefreshDatabase;

    protected User $userA;
    protected User $userB;
    protected Project $project;
    protected Task $task;

    protected function setUp(): void
    {
        parent::setUp();

        $this->userA = User::factory()->create(['name' => 'Alice Developer', 'email' => 'alice@tuntas.test']);
        $this->userB = User::factory()->create(['name' => 'Bob Designer', 'email' => 'bob@tuntas.test']);

        // Create project owned by Alice
        $this->project = Project::create([
            'user_id' => $this->userA->id,
            'title' => 'Project Odyssey',
            'description' => 'Main engineering project',
        ]);
        ProjectRole::ensureBuiltinRolesForProject($this->project);

        // Create task owned by Alice in Project Odyssey
        $this->task = Task::create([
            'user_id' => $this->userA->id,
            'project_id' => $this->project->id,
            'title' => 'Design Architecture Document',
            'status' => 'todo',
        ]);
    }

    public function test_workspace_notes_crud_and_private_isolation()
    {
        // 1. User A creates private workspace note
        $res = $this->actingAs($this->userA)->postJson('/api/v1/notes', [
            'title' => 'Alice Personal Secrets',
            'content' => 'Private brainstorming thoughts',
            'context_type' => 'workspace',
            'visibility' => 'private',
            'tags' => ['ideas', 'personal'],
        ]);

        $res->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.title', 'Alice Personal Secrets')
            ->assertJsonPath('data.version', 1);

        $noteId = $res->json('data.id');

        // Initial version snapshot must be created automatically
        $this->assertDatabaseHas('note_versions', [
            'note_id' => $noteId,
            'version' => 1,
            'title' => 'Alice Personal Secrets',
        ]);

        // 2. User B cannot view User A's private workspace note (403)
        $resForbidden = $this->actingAs($this->userB)->getJson("/api/v1/notes/{$noteId}");
        $resForbidden->assertStatus(403);

        // 3. User A can view and update
        $resUpdate = $this->actingAs($this->userA)->putJson("/api/v1/notes/{$noteId}", [
            'title' => 'Alice Personal Secrets (Updated)',
            'content' => 'Updated content with new reflections',
            'version' => 1,
        ]);

        $resUpdate->assertStatus(200)
            ->assertJsonPath('data.version', 2);

        // Version 2 snapshot created
        $this->assertDatabaseHas('note_versions', [
            'note_id' => $noteId,
            'version' => 2,
        ]);
    }

    public function test_project_notes_permissions_and_collaborative_access()
    {
        // Add User B as Member with notes.view and notes.create
        $memberRole = ProjectRole::where('project_id', $this->project->id)->where('slug', 'member')->firstOrFail();
        ProjectMember::create([
            'project_id' => $this->project->id,
            'user_id' => $this->userB->id,
            'role_id' => $memberRole->id,
            'role' => 'member',
        ]);

        // 1. User B creates a project note in Project Odyssey
        $res = $this->actingAs($this->userB)->postJson('/api/v1/notes', [
            'title' => 'API Guidelines',
            'content' => '### Coding conventions\n- Use JSON REST responses',
            'context_type' => 'project',
            'project_id' => $this->project->id,
        ]);

        $res->assertStatus(201);
        $noteId = $res->json('data.id');

        // 2. User A (project owner) can view the project note
        $resOwnerView = $this->actingAs($this->userA)->getJson("/api/v1/notes/{$noteId}");
        $resOwnerView->assertStatus(200)
            ->assertJsonPath('data.title', 'API Guidelines');

        // 3. An outsider user C cannot view the project note
        $userC = User::factory()->create();
        $resOutsider = $this->actingAs($userC)->getJson("/api/v1/notes/{$noteId}");
        $resOutsider->assertStatus(403);
    }

    public function test_task_context_notes_association()
    {
        // Create note bound to Task
        $res = $this->actingAs($this->userA)->postJson('/api/v1/notes', [
            'title' => 'Task Implementation Specs',
            'content' => 'Specifications for task design',
            'task_id' => $this->task->id,
        ]);

        $res->assertStatus(201)
            ->assertJsonPath('data.task_id', $this->task->id)
            ->assertJsonPath('data.context_type', 'task');

        $noteId = $res->json('data.id');

        // Query notes by task_id
        $queryRes = $this->actingAs($this->userA)->getJson("/api/v1/notes?task_id={$this->task->id}");
        $queryRes->assertStatus(200)
            ->assertJsonPath('data.0.id', $noteId);
    }

    public function test_xss_content_sanitization_strips_malicious_scripts()
    {
        $maliciousPayload = '<script>alert("hacked")</script><p>Normal text</p><img src="x" onerror="alert(1)" /><a href="javascript:void(0)">Click here</a>';

        $res = $this->actingAs($this->userA)->postJson('/api/v1/notes', [
            'title' => 'Security Audit Payload',
            'content' => $maliciousPayload,
        ]);

        $res->assertStatus(201);
        $savedContent = $res->json('data.content');

        // Script, onerror handler, and javascript: scheme must be sanitized
        $this->assertStringNotContainsString('<script>', $savedContent);
        $this->assertStringNotContainsString('onerror', $savedContent);
        $this->assertStringNotContainsString('javascript:', $savedContent);
        $this->assertStringContainsString('Normal text', $savedContent);
    }

    public function test_optimistic_locking_detects_version_conflicts()
    {
        // 1. Create initial note (version 1)
        $note = Note::create([
            'user_id' => $this->userA->id,
            'title' => 'Concurrent Editing Note',
            'content' => 'Initial state',
            'version' => 1,
        ]);

        // 2. Client X updates to version 2
        $resX = $this->actingAs($this->userA)->putJson("/api/v1/notes/{$note->id}", [
            'title' => 'Updated by Client X',
            'content' => 'Content modified by X',
            'version' => 1,
        ]);
        $resX->assertStatus(200);

        // 3. Client Y tries to update based on stale version 1 -> 409 Conflict
        $resY = $this->actingAs($this->userA)->putJson("/api/v1/notes/{$note->id}", [
            'title' => 'Updated by Client Y',
            'content' => 'Content modified by Y',
            'version' => 1,
        ]);

        $resY->assertStatus(409)
            ->assertJsonPath('conflict', true)
            ->assertJsonPath('server_version', 2);
    }

    public function test_version_restoration_creates_new_snapshot()
    {
        $note = Note::create([
            'user_id' => $this->userA->id,
            'title' => 'Original Draft',
            'content' => 'V1 Content',
            'version' => 1,
        ]);

        $v1 = NoteVersion::create([
            'note_id' => $note->id,
            'user_id' => $this->userA->id,
            'version' => 1,
            'title' => 'Original Draft',
            'content' => 'V1 Content',
        ]);

        // Update to V2
        $this->actingAs($this->userA)->putJson("/api/v1/notes/{$note->id}", [
            'title' => 'Accidental Modification',
            'content' => 'V2 Corrupted',
            'version' => 1,
        ]);

        // Restore to V1
        $restoreRes = $this->actingAs($this->userA)->postJson("/api/v1/notes/{$note->id}/restore/{$v1->id}");
        $restoreRes->assertStatus(200);

        $fresh = $note->fresh();
        $this->assertEquals('Original Draft', $fresh->title);
        $this->assertEquals('V1 Content', $fresh->content);
        $this->assertEquals(3, $fresh->version);
    }

    public function test_convert_note_to_task_preserves_original_note()
    {
        $note = Note::create([
            'user_id' => $this->userA->id,
            'project_id' => $this->project->id,
            'title' => 'Draft Feature Spec',
            'content' => 'Build login with biometrics',
            'version' => 1,
        ]);

        $res = $this->actingAs($this->userA)->postJson("/api/v1/notes/{$note->id}/convert-to-task");
        $res->assertStatus(201)
            ->assertJsonPath('success', true);

        $taskId = $res->json('data.task.id');
        $this->assertNotNull($taskId);

        // Verify task exists in database
        $this->assertDatabaseHas('tasks', [
            'id' => $taskId,
            'title' => 'Draft Feature Spec',
            'project_id' => $this->project->id,
        ]);

        // Original note still exists and links to task
        $freshNote = $note->fresh();
        $this->assertNotNull($freshNote);
        $this->assertEquals($taskId, $freshNote->task_id);
    }

    public function test_threaded_comments_on_notes()
    {
        $note = Note::create([
            'user_id' => $this->userA->id,
            'title' => 'Commentable Note',
            'content' => 'Feel free to comment',
        ]);

        // 1. Add top-level comment
        $commentRes = $this->actingAs($this->userA)->postJson("/api/v1/notes/{$note->id}/comments", [
            'content' => 'Is this ready for review?',
        ]);
        $commentRes->assertStatus(201);
        $commentId = $commentRes->json('data.id');

        // 2. Add reply to comment
        $replyRes = $this->actingAs($this->userA)->postJson("/api/v1/notes/{$note->id}/comments", [
            'content' => 'Yes, ready for deployment.',
            'parent_id' => $commentId,
        ]);
        $replyRes->assertStatus(201)
            ->assertJsonPath('data.parent_id', $commentId);

        // 3. Delete top-level comment cascades to replies
        $delRes = $this->actingAs($this->userA)->deleteJson("/api/v1/notes/{$note->id}/comments/{$commentId}");
        $delRes->assertStatus(200);

        $this->assertDatabaseMissing('note_comments', ['id' => $commentId]);
    }

    public function test_pin_and_soft_delete_lifecycle()
    {
        $note = Note::create([
            'user_id' => $this->userA->id,
            'title' => 'Important Checklist',
            'content' => 'Important items',
            'is_pinned' => false,
        ]);

        // Toggle Pin
        $pinRes = $this->actingAs($this->userA)->patchJson("/api/v1/notes/{$note->id}/pin");
        $pinRes->assertStatus(200)
            ->assertJsonPath('data.is_pinned', true);

        // Soft Delete
        $delRes = $this->actingAs($this->userA)->deleteJson("/api/v1/notes/{$note->id}");
        $delRes->assertStatus(200);

        $this->assertSoftDeleted('notes', ['id' => $note->id]);
    }
}
