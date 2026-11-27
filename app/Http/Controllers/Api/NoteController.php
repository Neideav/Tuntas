<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Mention;
use App\Models\Note;
use App\Models\NoteAttachment;
use App\Models\NoteComment;
use App\Models\NoteVersion;
use App\Models\Project;
use App\Models\ProjectRole;
use App\Models\Task;
use App\Models\User;
use App\Services\ContentSanitizerService;
use App\Services\MentionService;
use App\Services\NotificationService;
use App\Services\PermissionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class NoteController extends Controller
{
    public function __construct(
        protected PermissionService $permissionService,
        protected ContentSanitizerService $sanitizerService,
        protected MentionService $mentionService,
        protected NotificationService $notificationService
    ) {}

    /**
     * List notes across workspace, project, and task contexts with filtering and search.
     */
    public function index(Request $request)
    {
        $userId = $request->user()->id;

        // Base query: accessible notes
        // 1. Notes authored by the user
        // 2. OR Notes in projects where the user is an active member or owner
        $query = Note::where(function ($q) use ($userId) {
            $q->where('user_id', $userId)
              ->orWhere(function ($sub) use ($userId) {
                  $sub->whereNotNull('project_id')
                      ->whereHas('project', function ($pq) use ($userId) {
                          $pq->where('user_id', $userId)
                             ->orWhereHas('members', fn ($mq) => $mq->where('user_id', $userId));
                      });
              });
        })->with(['user:id,name,email', 'project:id,title', 'task:id,title']);

        // Context filtering: 'workspace', 'project', 'task'
        if ($request->filled('context') && $request->context !== 'all') {
            $ctx = $request->context;
            if ($ctx === 'workspace') {
                $query->workspace();
            } elseif ($ctx === 'project') {
                $query->whereNotNull('project_id')->whereNull('task_id');
            } elseif ($ctx === 'task') {
                $query->whereNotNull('task_id');
            }
        }

        // Project filtering
        if ($request->filled('project_id')) {
            $pId = (int) $request->project_id;
            $project = Project::find($pId);
            if ($project && !$this->permissionService->userHasProjectPermission($request->user(), $project, 'notes.view')) {
                abort(403, 'Unauthorized to view notes in this project.');
            }
            $query->where('project_id', $pId);
        }

        // Task filtering
        if ($request->filled('task_id')) {
            $query->where('task_id', $request->task_id);
        }

        // Status filtering: default active unless requested
        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        } else {
            $query->active();
        }

        // Pinned only filter
        if ($request->boolean('pinned_only')) {
            $query->where('is_pinned', true);
        }

        // Tag filter
        if ($request->filled('tag')) {
            $tag = $request->tag;
            $query->whereJsonContains('tags', $tag);
        }

        // Search query in title, content, or tags
        if ($request->filled('q')) {
            $q = $request->q;
            $query->where(function ($sub) use ($q) {
                $sub->where('title', 'like', "%{$q}%")
                    ->orWhere('content', 'like', "%{$q}%")
                    ->orWhereJsonContains('tags', $q);
            });
        }

        // Summary statistics calculation
        $accessibleBase = Note::where(function ($q) use ($userId) {
            $q->where('user_id', $userId)
              ->orWhere(function ($sub) use ($userId) {
                  $sub->whereNotNull('project_id')
                      ->whereHas('project', function ($pq) use ($userId) {
                          $pq->where('user_id', $userId)
                             ->orWhereHas('members', fn ($mq) => $mq->where('user_id', $userId));
                      });
              });
        })->active();

        $summary = [
            'total' => (clone $accessibleBase)->count(),
            'workspace_count' => (clone $accessibleBase)->workspace()->count(),
            'project_count' => (clone $accessibleBase)->whereNotNull('project_id')->whereNull('task_id')->count(),
            'task_count' => (clone $accessibleBase)->whereNotNull('task_id')->count(),
            'pinned_count' => (clone $accessibleBase)->where('is_pinned', true)->count(),
            'drafts_count' => Note::where('user_id', $userId)->where('status', Note::STATUS_DRAFT)->count(),
        ];

        // Sorting: pinned notes always surface first, then requested order
        $sortBy = $request->get('sort_by', 'updated_at');
        $sortOrder = $request->get('sort_order', 'desc') === 'asc' ? 'asc' : 'desc';

        $query->orderBy('is_pinned', 'desc');
        if (in_array($sortBy, ['title', 'created_at', 'updated_at', 'version'])) {
            $query->orderBy($sortBy, $sortOrder);
        } else {
            $query->orderBy('updated_at', 'desc');
        }

        $perPage = min(100, max(1, (int) $request->get('per_page', 20)));
        $notes = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $notes->items(),
            'summary' => $summary,
            'meta' => [
                'current_page' => $notes->currentPage(),
                'last_page' => $notes->lastPage(),
                'per_page' => $notes->perPage(),
                'total' => $notes->total(),
            ],
        ]);
    }

    /**
     * Store a newly created note.
     */
    public function store(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'title' => 'nullable|string|max:255',
            'content' => 'required|string',
            'context_type' => ['nullable', Rule::in([Note::CONTEXT_WORKSPACE, Note::CONTEXT_PROJECT, Note::CONTEXT_TASK])],
            'project_id' => 'nullable|exists:projects,id',
            'task_id' => 'nullable|exists:tasks,id',
            'status' => ['nullable', Rule::in([Note::STATUS_DRAFT, Note::STATUS_PUBLISHED, Note::STATUS_ARCHIVED])],
            'visibility' => ['nullable', Rule::in([Note::VISIBILITY_PRIVATE, Note::VISIBILITY_TEAM, Note::VISIBILITY_PUBLIC])],
            'color' => 'nullable|string|max:30',
            'tags' => 'nullable|array',
            'tags.*' => 'string|max:50',
            'is_pinned' => 'nullable|boolean',
        ]);

        $contextType = $validated['context_type'] ?? Note::CONTEXT_WORKSPACE;
        $projectId = $validated['project_id'] ?? null;
        $taskId = $validated['task_id'] ?? null;

        // Context validation and authorization checks
        if ($taskId) {
            $task = Task::findOrFail($taskId);
            $contextType = Note::CONTEXT_TASK;
            if ($task->project_id) {
                $projectId = $task->project_id;
            }
            if (!$this->permissionService->userHasTaskPermission($user, $task, 'notes.create')) {
                abort(403, 'Unauthorized to attach notes to this task.');
            }
        } elseif ($projectId) {
            $project = Project::findOrFail($projectId);
            $contextType = Note::CONTEXT_PROJECT;
            if (!$this->permissionService->userHasProjectPermission($user, $project, 'notes.create')) {
                abort(403, 'Unauthorized to create notes in this project.');
            }
        }

        // Sanitize content against XSS attacks
        $sanitizedContent = $this->sanitizerService->sanitize($validated['content']);
        $title = !empty($validated['title']) ? trim($validated['title']) : 'Untitled Note';

        $note = DB::transaction(function () use ($user, $validated, $contextType, $projectId, $taskId, $sanitizedContent, $title) {
            $note = Note::create([
                'user_id' => $user->id,
                'context_type' => $contextType,
                'context_id' => $contextType === Note::CONTEXT_PROJECT ? $projectId : ($contextType === Note::CONTEXT_TASK ? $taskId : null),
                'project_id' => $projectId,
                'task_id' => $taskId,
                'title' => $title,
                'content' => $sanitizedContent,
                'status' => $validated['status'] ?? Note::STATUS_PUBLISHED,
                'visibility' => $validated['visibility'] ?? Note::VISIBILITY_TEAM,
                'version' => 1,
                'color' => $validated['color'] ?? '#ffffff',
                'tags' => !empty($validated['tags']) ? array_values(array_unique($validated['tags'])) : [],
                'is_pinned' => $validated['is_pinned'] ?? false,
            ]);

            // Create initial version snapshot
            NoteVersion::create([
                'note_id' => $note->id,
                'user_id' => $user->id,
                'version' => 1,
                'title' => $note->title,
                'content' => $note->content,
                'summary' => 'Initial version created',
            ]);

            // Extract and log mentions
            $this->processMentions($note, $sanitizedContent, $user->id, $projectId);

            AuditLog::create([
                'user_id' => $user->id,
                'project_id' => $projectId,
                'action' => 'notes.created',
                'auditable_type' => Note::class,
                'auditable_id' => (string) $note->id,
                'payload' => [
                    'title' => $note->title,
                    'context_type' => $contextType,
                ],
                'created_at' => now(),
            ]);

            return $note;
        });

        return response()->json([
            'success' => true,
            'message' => 'Catatan berhasil dibuat.',
            'data' => $note->load(['user:id,name,email', 'project:id,title', 'task:id,title']),
        ], 201);
    }

    /**
     * Show note details with version history, comments, and attachments.
     */
    public function show(Request $request, Note $note)
    {
        $user = $request->user();

        if (!$this->permissionService->userHasNotePermission($user, $note, 'notes.view')) {
            abort(403, 'Unauthorized to view this note.');
        }

        return response()->json([
            'success' => true,
            'data' => $note->load([
                'user:id,name,email',
                'project:id,title',
                'task:id,title',
                'versions.user:id,name',
                'comments',
                'attachments',
            ]),
        ]);
    }

    /**
     * Update an existing note with debounced autosave and optimistic concurrency check.
     */
    public function update(Request $request, Note $note)
    {
        $user = $request->user();

        if (!$this->permissionService->userHasNotePermission($user, $note, 'notes.update')) {
            abort(403, 'Unauthorized to edit this note.');
        }

        $validated = $request->validate([
            'title' => 'sometimes|nullable|string|max:255',
            'content' => 'sometimes|required|string',
            'status' => ['nullable', Rule::in([Note::STATUS_DRAFT, Note::STATUS_PUBLISHED, Note::STATUS_ARCHIVED])],
            'visibility' => ['nullable', Rule::in([Note::VISIBILITY_PRIVATE, Note::VISIBILITY_TEAM, Note::VISIBILITY_PUBLIC])],
            'color' => 'nullable|string|max:30',
            'tags' => 'nullable|array',
            'tags.*' => 'string|max:50',
            'is_pinned' => 'nullable|boolean',
            'version' => 'nullable|integer',
            'summary' => 'nullable|string|max:255',
        ]);

        // Optimistic locking / Version conflict detection
        if (isset($validated['version']) && $validated['version'] < $note->version) {
            return response()->json([
                'success' => false,
                'conflict' => true,
                'message' => 'Konflik versi terdeteksi. Catatan ini telah diperbarui oleh pengguna lain saat Anda sedang mengedit.',
                'server_version' => $note->version,
                'server_data' => $note->fresh(['user:id,name,email']),
            ], 409);
        }

        $updateData = [];
        $contentChanged = false;

        if (array_key_exists('title', $validated)) {
            $updateData['title'] = $validated['title'] ? trim($validated['title']) : 'Untitled Note';
        }

        if (array_key_exists('content', $validated)) {
            $sanitized = $this->sanitizerService->sanitize($validated['content']);
            if ($sanitized !== $note->content) {
                $contentChanged = true;
                $updateData['content'] = $sanitized;
            }
        }

        if (isset($validated['status'])) {
            $updateData['status'] = $validated['status'];
            $updateData['is_archived'] = $validated['status'] === Note::STATUS_ARCHIVED;
        }

        if (isset($validated['visibility'])) {
            $updateData['visibility'] = $validated['visibility'];
        }

        if (isset($validated['color'])) {
            $updateData['color'] = $validated['color'];
        }

        if (array_key_exists('tags', $validated)) {
            $updateData['tags'] = array_values(array_unique($validated['tags']));
        }

        if (array_key_exists('is_pinned', $validated)) {
            $updateData['is_pinned'] = $validated['is_pinned'];
        }

        DB::transaction(function () use ($note, $user, $updateData, $contentChanged, $validated) {
            if ($contentChanged || (isset($updateData['title']) && $updateData['title'] !== $note->title)) {
                $newVersion = $note->version + 1;
                $updateData['version'] = $newVersion;

                // Save snapshot to version history
                NoteVersion::create([
                    'note_id' => $note->id,
                    'user_id' => $user->id,
                    'version' => $newVersion,
                    'title' => $updateData['title'] ?? $note->title,
                    'content' => $updateData['content'] ?? $note->content,
                    'summary' => $validated['summary'] ?? ($contentChanged ? 'Konten diperbarui' : 'Judul diperbarui'),
                ]);

                // Update mentions if content was modified
                if ($contentChanged && isset($updateData['content'])) {
                    $this->processMentions($note, $updateData['content'], $user->id, $note->project_id);
                }
            }

            $note->update($updateData);

            AuditLog::create([
                'user_id' => $user->id,
                'project_id' => $note->project_id,
                'action' => 'notes.updated',
                'auditable_type' => Note::class,
                'auditable_id' => (string) $note->id,
                'payload' => [
                    'version' => $note->version,
                ],
                'created_at' => now(),
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Catatan berhasil disimpan.',
            'data' => $note->fresh(['user:id,name,email', 'project:id,title', 'task:id,title']),
        ]);
    }

    /**
     * Delete a note (Soft delete).
     */
    public function destroy(Request $request, Note $note)
    {
        $user = $request->user();

        if (!$this->permissionService->userHasNotePermission($user, $note, 'notes.delete')) {
            abort(403, 'Unauthorized to delete this note.');
        }

        $noteId = $note->id;
        $projectId = $note->project_id;
        $title = $note->title;

        $note->delete();

        AuditLog::create([
            'user_id' => $user->id,
            'project_id' => $projectId,
            'action' => 'notes.deleted',
            'auditable_type' => Note::class,
            'auditable_id' => (string) $noteId,
            'payload' => ['title' => $title],
            'created_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Catatan berhasil dihapus.',
        ]);
    }

    /**
     * Toggle pinned status of a note.
     */
    public function togglePin(Request $request, Note $note)
    {
        $user = $request->user();

        if (!$this->permissionService->userHasNotePermission($user, $note, 'notes.pin')) {
            abort(403, 'Unauthorized.');
        }

        $note->update([
            'is_pinned' => !$note->is_pinned,
        ]);

        return response()->json([
            'success' => true,
            'message' => $note->is_pinned ? 'Catatan disematkan.' : 'Sematkan catatan dilepas.',
            'data' => $note->fresh(),
        ]);
    }

    /**
     * Convert note into a collaborative Task.
     * Preserves original note and links it to newly created task.
     */
    public function convertToTask(Request $request, Note $note)
    {
        $user = $request->user();

        if (!$this->permissionService->userHasNotePermission($user, $note, 'notes.view')) {
            abort(403, 'Unauthorized.');
        }

        // If note belongs to a project, check if user can create tasks in it
        if ($note->project_id) {
            $project = $note->project ?? Project::find($note->project_id);
            if ($project && !$this->permissionService->userHasProjectPermission($user, $project, 'tasks.create')) {
                abort(403, 'Unauthorized to create tasks in this project.');
            }
        }

        $task = DB::transaction(function () use ($note, $user) {
            $taskTitle = $note->title && $note->title !== 'Untitled Note'
                ? $note->title
                : Str::limit(strip_tags($note->content), 60);

            $task = Task::create([
                'user_id' => $user->id,
                'project_id' => $note->project_id,
                'title' => $taskTitle,
                'description' => $note->content,
                'status' => 'todo',
                'priority' => 'medium',
                'due_date' => now()->addDays(3),
            ]);

            // Link note to created task
            $note->task_id = $task->id;
            $note->context_type = Note::CONTEXT_TASK;
            $note->context_id = $task->id;
            $note->save();

            // Record version note
            NoteVersion::create([
                'note_id' => $note->id,
                'user_id' => $user->id,
                'version' => $note->version + 1,
                'title' => $note->title,
                'content' => $note->content,
                'summary' => "Catatan dikonversi menjadi Tugas #{$task->id}",
            ]);

            $note->increment('version');

            AuditLog::create([
                'user_id' => $user->id,
                'project_id' => $note->project_id,
                'action' => 'notes.converted_to_task',
                'auditable_type' => Task::class,
                'auditable_id' => (string) $task->id,
                'payload' => [
                    'note_id' => $note->id,
                    'task_title' => $task->title,
                ],
                'created_at' => now(),
            ]);

            return $task;
        });

        return response()->json([
            'success' => true,
            'message' => 'Catatan berhasil dikonversi menjadi tugas.',
            'data' => [
                'task' => $task->load(['project', 'category']),
                'note' => $note->fresh(),
            ],
        ], 201);
    }

    /**
     * Restore note to a previous version snapshot.
     */
    public function restoreVersion(Request $request, Note $note, NoteVersion $version)
    {
        $user = $request->user();

        if ($version->note_id !== $note->id) {
            abort(404, 'Versi tidak ditemukan pada catatan ini.');
        }

        if (!$this->permissionService->userHasNotePermission($user, $note, 'notes.update')) {
            abort(403, 'Unauthorized.');
        }

        DB::transaction(function () use ($note, $version, $user) {
            $newVerNum = $note->version + 1;

            NoteVersion::create([
                'note_id' => $note->id,
                'user_id' => $user->id,
                'version' => $newVerNum,
                'title' => $version->title,
                'content' => $version->content,
                'summary' => "Dipulihkan dari versi {$version->version}",
            ]);

            $note->update([
                'title' => $version->title,
                'content' => $version->content,
                'version' => $newVerNum,
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => "Catatan berhasil dipulihkan ke versi {$version->version}.",
            'data' => $note->fresh(['versions.user:id,name']),
        ]);
    }

    /**
     * Add a comment to a note.
     */
    public function addComment(Request $request, Note $note)
    {
        $user = $request->user();

        if (!$this->permissionService->userHasNotePermission($user, $note, 'notes.view')) {
            abort(403, 'Unauthorized.');
        }

        $validated = $request->validate([
            'content' => 'required|string|max:2000',
            'parent_id' => 'nullable|exists:note_comments,id',
        ]);

        $sanitized = $this->sanitizerService->sanitize($validated['content']);

        $comment = NoteComment::create([
            'note_id' => $note->id,
            'user_id' => $user->id,
            'parent_id' => $validated['parent_id'] ?? null,
            'content' => $sanitized,
        ]);

        // Process mentions in comment
        $this->processMentions($comment, $sanitized, $user->id, $note->project_id);

        // Notify note owner about new comment
        $this->notificationService->notifyNoteCommented($user, $note, Str::limit(strip_tags($sanitized), 100));

        return response()->json([
            'success' => true,
            'message' => 'Komentar berhasil ditambahkan.',
            'data' => $comment->load('user:id,name,email'),
        ], 201);
    }

    /**
     * Delete a comment on a note.
     */
    public function deleteComment(Request $request, Note $note, NoteComment $comment)
    {
        $user = $request->user();

        if ($comment->note_id !== $note->id) {
            abort(404, 'Komentar tidak ditemukan pada catatan ini.');
        }

        // Only comment author OR note owner OR project admin can delete comment
        $canDelete = $comment->user_id === $user->id || $note->user_id === $user->id;
        if (!$canDelete && $note->project_id) {
            $canDelete = $this->permissionService->userHasProjectPermission($user, $note->project, 'notes.delete');
        }

        if (!$canDelete) {
            abort(403, 'Unauthorized to delete this comment.');
        }

        $comment->delete();

        return response()->json([
            'success' => true,
            'message' => 'Komentar berhasil dihapus.',
        ]);
    }

    /**
     * Upload an attachment to a note.
     */
    public function uploadAttachment(Request $request, Note $note)
    {
        $user = $request->user();

        if (!$this->permissionService->userHasNotePermission($user, $note, 'notes.update')) {
            abort(403, 'Unauthorized.');
        }

        $request->validate([
            'file' => 'required|file|max:10240', // 10MB max
        ]);

        $file = $request->file('file');
        $fileName = $file->getClientOriginalName();
        $fileSize = $file->getSize();
        $fileType = $file->getClientMimeType();

        $path = $file->store("note_attachments/{$note->id}", 'public');

        $attachment = NoteAttachment::create([
            'note_id' => $note->id,
            'user_id' => $user->id,
            'file_name' => $fileName,
            'file_path' => Storage::url($path),
            'file_size' => $fileSize,
            'file_type' => $fileType,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Lampiran berhasil diunggah.',
            'data' => $attachment,
        ], 201);
    }

    /**
     * Delete an attachment from a note.
     */
    public function deleteAttachment(Request $request, Note $note, NoteAttachment $attachment)
    {
        $user = $request->user();

        if ($attachment->note_id !== $note->id) {
            abort(404, 'Lampiran tidak ditemukan.');
        }

        if (!$this->permissionService->userHasNotePermission($user, $note, 'notes.update')) {
            abort(403, 'Unauthorized.');
        }

        // Delete physical file if exists
        $relativePath = str_replace('/storage/', '', $attachment->file_path);
        Storage::disk('public')->delete($relativePath);

        $attachment->delete();

        return response()->json([
            'success' => true,
            'message' => 'Lampiran berhasil dihapus.',
        ]);
    }

    /**
     * Internal helper to record mentions for @user or @role in note/comment content.
     */
    private function processMentions($mentionable, string $content, int $mentionerId, ?int $projectId): void
    {
        $mentioner = User::find($mentionerId);
        if (!$mentioner) return;

        $contextType = $mentionable instanceof NoteComment ? 'comment' : 'note';
        $contextTitle = $mentionable instanceof NoteComment
            ? ($mentionable->note?->title ?? 'Komentar Catatan')
            : ($mentionable->title ?? 'Catatan');

        $this->mentionService->processMentions(
            $mentioner,
            $mentionable,
            $content,
            $contextType,
            $mentionable->id,
            $contextTitle,
            $projectId
        );
    }
}
