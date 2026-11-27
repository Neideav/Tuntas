<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Services\ActivityService;
use Illuminate\Http\Request;

class ActivityController extends Controller
{
    public function __construct(
        protected ActivityService $activityService
    ) {}

    /**
     * List activity timeline for workspace or specific project with multifaceted filtering.
     * GET /api/v1/activity
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $query = AuditLog::with(['actor:id,name,email', 'project:id,title']);

        $projectId = $request->input('project_id');

        if ($projectId) {
            // Project-specific activity timeline
            $project = Project::find($projectId);
            if (!$project) {
                return response()->json(['success' => false, 'message' => 'Proyek tidak ditemukan.'], 404);
            }

            if (!$this->activityService->canViewProjectActivity($user, $project)) {
                return response()->json(['success' => false, 'message' => 'Anda tidak memiliki akses ke aktivitas proyek ini.'], 403);
            }

            $query->where('project_id', $projectId);
        } else {
            // Workspace-wide activity:
            // User can see activities where:
            // 1. They are the actor
            // 2. Or the activity belongs to a project where they are an active member / owner
            // 3. Or it's general workspace activity created by themselves
            $userProjectIds = ProjectMember::where('user_id', $user->id)->pluck('project_id')->toArray();
            $ownedProjectIds = Project::where('user_id', $user->id)->pluck('id')->toArray();
            $accessibleProjectIds = array_unique(array_merge($userProjectIds, $ownedProjectIds));

            $query->where(function ($q) use ($user, $accessibleProjectIds) {
                $q->where('actor_id', $user->id)
                  ->orWhere('user_id', $user->id)
                  ->orWhereIn('project_id', $accessibleProjectIds);
            });
        }

        // Filter: Activity type / category (e.g. project, member, task, note, report, role)
        if ($category = $request->input('category')) {
            if ($category !== 'all') {
                $query->where('action', 'like', "{$category}.%");
            }
        }

        // Filter: Specific action (e.g. task.created, report.approved)
        if ($action = $request->input('action')) {
            if ($action !== 'all') {
                $query->where('action', $action);
            }
        }

        // Filter: Member / Actor ID
        if ($actorId = $request->input('actor_id')) {
            $query->where(function ($q) use ($actorId) {
                $q->where('actor_id', $actorId)->orWhere('user_id', $actorId);
            });
        }

        // Filter: Resource Type (e.g. Task, Note, WorkReport, ProjectRole)
        if ($resourceType = $request->input('resource_type')) {
            $query->where(function ($q) use ($resourceType) {
                $q->where('resource_type', $resourceType)
                  ->orWhere('auditable_type', 'like', "%{$resourceType}%");
            });
        }

        // Filter: Resource ID
        if ($resourceId = $request->input('resource_id')) {
            $query->where(function ($q) use ($resourceId) {
                $q->where('resource_id', $resourceId)
                  ->orWhere('auditable_id', $resourceId);
            });
        }

        // Filter: Date Range
        if ($startDate = $request->input('start_date')) {
            $query->whereDate('created_at', '>=', $startDate);
        }
        if ($endDate = $request->input('end_date')) {
            $query->whereDate('created_at', '<=', $endDate);
        }

        // Search in action or metadata
        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('action', 'like', "%{$search}%")
                  ->orWhere('payload', 'like', "%{$search}%");
            });
        }

        // Reliable event ordering: newest first, guaranteed determinism via primary key
        $query->orderBy('created_at', 'desc')->orderBy('id', 'desc');

        $perPage = min((int) $request->input('per_page', 25), 100);
        $logs = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data'    => $logs->items(),
            'meta'    => [
                'current_page' => $logs->currentPage(),
                'last_page'    => $logs->lastPage(),
                'per_page'     => $logs->perPage(),
                'total'        => $logs->total(),
            ],
        ]);
    }
}
