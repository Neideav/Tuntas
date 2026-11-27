<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Mention;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Services\MentionService;
use Illuminate\Http\Request;

class MentionController extends Controller
{
    public function __construct(private readonly MentionService $mentionService) {}

    /**
     * Autocomplete: return project members and roles matching a search query.
     * Used by the frontend mention picker in the rich-text editor.
     *
     * GET /api/v1/mentions/autocomplete?project_id=&q=
     */
    public function autocomplete(Request $request)
    {
        $user      = $request->user();
        $projectId = $request->integer('project_id') ?: null;
        $query     = trim($request->input('q', ''));

        // Authorization: if scoped to a project, user must be a member
        if ($projectId) {
            $project = Project::find($projectId);
            if (!$project) {
                return response()->json(['success' => false, 'message' => 'Proyek tidak ditemukan.'], 404);
            }

            $isMember = $project->user_id === $user->id
                || ProjectMember::where('project_id', $projectId)
                       ->where('user_id', $user->id)
                       ->exists();

            if (!$isMember) {
                return response()->json(['success' => false, 'message' => 'Akses ditolak.'], 403);
            }
        }

        $candidates = $this->mentionService->getAutocompleteCandidates($projectId, $query);

        return response()->json([
            'success' => true,
            'data'    => $candidates,
        ]);
    }

    /**
     * Get mentions for the authenticated user (mentions of them).
     *
     * GET /api/v1/mentions/me
     */
    public function myMentions(Request $request)
    {
        $user    = $request->user();
        $perPage = min((int) $request->input('per_page', 20), 50);

        $mentions = Mention::with([
            'mentioner:id,name,email',
            'mentionable',
            'mentionedRole:id,name,color',
        ])
            ->where('mentioned_user_id', $user->id)
            ->latest()
            ->paginate($perPage);

        return response()->json([
            'success' => true,
            'data'    => $mentions->items(),
            'meta'    => [
                'current_page' => $mentions->currentPage(),
                'last_page'    => $mentions->lastPage(),
                'total'        => $mentions->total(),
            ],
        ]);
    }

    /**
     * Get mentions on a specific mentionable model (note, task, report, comment).
     *
     * GET /api/v1/mentions?mentionable_type=note&mentionable_id=5
     */
    public function forModel(Request $request)
    {
        $validated = $request->validate([
            'mentionable_type' => 'required|in:note,task,report,comment,work_report',
            'mentionable_id'   => 'required|integer',
        ]);

        $typeMap = [
            'note'        => \App\Models\Note::class,
            'task'        => \App\Models\Task::class,
            'report'      => \App\Models\WorkReport::class,
            'work_report' => \App\Models\WorkReport::class,
            'comment'     => \App\Models\NoteComment::class,
        ];

        $fqn = $typeMap[$validated['mentionable_type']] ?? null;

        $mentions = Mention::with([
            'mentioner:id,name,email',
            'mentionedUser:id,name,email',
            'mentionedRole:id,name,color',
        ])
            ->where('mentionable_type', $fqn)
            ->where('mentionable_id', $validated['mentionable_id'])
            ->get();

        return response()->json(['success' => true, 'data' => $mentions]);
    }
}
