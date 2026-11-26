<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Notification;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\ReportReview;
use App\Models\Task;
use App\Models\User;
use App\Models\WorkReport;
use App\Services\ContentSanitizerService;
use App\Services\PermissionService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class WorkReportController extends Controller
{
    public function __construct(
        protected PermissionService $permissionService,
        protected ContentSanitizerService $sanitizer
    ) {}

    /**
     * Display a listing of reports with multifaceted filtering, sorting, and pagination.
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $query = WorkReport::with([
            'user:id,name,email',
            'reviewer:id,name,email',
            'project:id,title',
            'task:id,title,status',
            'reviews.reviewer:id,name,email',
        ]);

        // Review Queue mode: reports awaiting review where the user has review rights
        if ($request->boolean('queue') || $request->input('queue') === 'pending') {
            $userProjectIds = ProjectMember::where('user_id', $user->id)->pluck('project_id')->toArray();
            $ownedProjectIds = Project::where('user_id', $user->id)->pluck('id')->toArray();
            $allAccessibleProjectIds = array_unique(array_merge($userProjectIds, $ownedProjectIds));

            $query->whereIn('status', [WorkReport::STATUS_SUBMITTED, WorkReport::STATUS_IN_REVIEW])
                ->where('user_id', '!=', $user->id) // Author cannot review own report
                ->where(function ($q) use ($user, $allAccessibleProjectIds) {
                    $q->whereIn('project_id', $allAccessibleProjectIds)
                      ->orWhere('reviewer_id', $user->id);
                });
        } else {
            // General visibility: Author can see own reports, project members can see project reports, assigned reviewers
            $userProjectIds = ProjectMember::where('user_id', $user->id)->pluck('project_id')->toArray();
            $ownedProjectIds = Project::where('user_id', $user->id)->pluck('id')->toArray();
            $allAccessibleProjectIds = array_unique(array_merge($userProjectIds, $ownedProjectIds));

            $query->where(function ($q) use ($user, $allAccessibleProjectIds) {
                $q->where('user_id', $user->id)
                  ->orWhere('reviewer_id', $user->id)
                  ->orWhere(function ($sub) use ($allAccessibleProjectIds) {
                      $sub->whereIn('project_id', $allAccessibleProjectIds)
                          ->where('status', '!=', WorkReport::STATUS_DRAFT); // Other members only see submitted/reviewed
                  });
            });
        }

        // Filter: Context
        if ($context = $request->input('context')) {
            if ($context === 'workspace') {
                $query->whereNull('project_id')->whereNull('task_id');
            } elseif ($context === 'project') {
                $query->whereNotNull('project_id')->whereNull('task_id');
            } elseif ($context === 'task') {
                $query->whereNotNull('task_id');
            }
        }

        // Filter: Project ID
        if ($projectId = $request->input('project_id')) {
            $query->where('project_id', $projectId);
        }

        // Filter: Task ID
        if ($taskId = $request->input('task_id')) {
            $query->where('task_id', $taskId);
        }

        // Filter: Status
        if ($status = $request->input('status')) {
            if ($status !== 'all') {
                $query->where('status', $status);
            }
        }

        // Filter: Report Type
        if ($type = $request->input('type')) {
            if ($type !== 'all') {
                $query->where('type', $type);
            }
        }

        // Filter: Author ID
        if ($authorId = $request->input('author_id')) {
            $query->where('user_id', $authorId);
        }

        // Filter: Date range (submission or creation)
        if ($startDate = $request->input('start_date')) {
            $query->whereDate('created_at', '>=', $startDate);
        }
        if ($endDate = $request->input('end_date')) {
            $query->whereDate('created_at', '<=', $endDate);
        }

        // Search: Title, content, summary
        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('content', 'like', "%{$search}%")
                  ->orWhere('summary', 'like', "%{$search}%");
            });
        }

        // Sorting
        $sortBy = $request->input('sort_by', 'created_at');
        $sortDir = strtolower($request->input('sort_dir', 'desc')) === 'asc' ? 'asc' : 'desc';
        if (in_array($sortBy, ['created_at', 'submitted_at', 'reviewed_at', 'title', 'status', 'version'])) {
            $query->orderBy($sortBy, $sortDir);
        } else {
            $query->orderBy('created_at', 'desc');
        }

        // Summary counts for dashboard tabs
        $countsQuery = clone $query;
        $allReportsForCounts = (clone $query)->get(['id', 'status']);
        $metrics = [
            'total' => $allReportsForCounts->count(),
            'draft' => $allReportsForCounts->where('status', WorkReport::STATUS_DRAFT)->count(),
            'submitted' => $allReportsForCounts->where('status', WorkReport::STATUS_SUBMITTED)->count(),
            'in_review' => $allReportsForCounts->where('status', WorkReport::STATUS_IN_REVIEW)->count(),
            'revision_requested' => $allReportsForCounts->where('status', WorkReport::STATUS_REVISION_REQUESTED)->count(),
            'approved' => $allReportsForCounts->where('status', WorkReport::STATUS_APPROVED)->count(),
            'rejected' => $allReportsForCounts->where('status', WorkReport::STATUS_REJECTED)->count(),
        ];

        $perPage = min((int) $request->input('per_page', 15), 50);
        $reports = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $reports->items(),
            'meta' => [
                'current_page' => $reports->currentPage(),
                'last_page' => $reports->lastPage(),
                'per_page' => $reports->perPage(),
                'total' => $reports->total(),
                'metrics' => $metrics,
            ],
        ]);
    }

    /**
     * Store a newly created report.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'content' => 'required|string',
            'summary' => 'nullable|string',
            'type' => 'nullable|string|max:50',
            'context_type' => 'nullable|in:workspace,project,task',
            'project_id' => 'nullable|exists:projects,id',
            'task_id' => 'nullable|exists:tasks,id',
            'reviewer_id' => 'nullable|exists:users,id',
            'metrics' => 'nullable|array',
            'status' => 'nullable|in:draft,submitted',
        ]);

        $user = $request->user();
        $projectId = $validated['project_id'] ?? null;
        $taskId = $validated['task_id'] ?? null;
        $contextType = $validated['context_type'] ?? WorkReport::CONTEXT_WORKSPACE;

        // Context normalization
        if ($taskId) {
            $task = Task::find($taskId);
            if (!$task) {
                return response()->json(['success' => false, 'message' => 'Task not found.'], 404);
            }
            $contextType = WorkReport::CONTEXT_TASK;
            if ($task->project_id) {
                $projectId = $task->project_id;
            }
        } elseif ($projectId) {
            $contextType = WorkReport::CONTEXT_PROJECT;
        }

        // Authorization check
        if ($projectId) {
            $project = Project::find($projectId);
            if (!$project || !$this->permissionService->userHasProjectPermission($user, $project, 'reports.submit')) {
                return response()->json([
                    'success' => false,
                    'message' => 'Anda tidak memiliki izin untuk mengirimkan laporan pada proyek ini (Unauthorized to submit reports in this project).',
                ], 403);
            }
        }

        $cleanContent = $this->sanitizer->sanitizeHtml($validated['content']);
        $initialStatus = $validated['status'] ?? WorkReport::STATUS_SUBMITTED;
        $submittedAt = $initialStatus === WorkReport::STATUS_SUBMITTED ? Carbon::now() : null;

        $report = DB::transaction(function () use ($user, $validated, $projectId, $taskId, $contextType, $cleanContent, $initialStatus, $submittedAt) {
            $report = WorkReport::create([
                'user_id' => $user->id,
                'project_id' => $projectId,
                'task_id' => $taskId,
                'reviewer_id' => $validated['reviewer_id'] ?? null,
                'type' => $validated['type'] ?? WorkReport::TYPE_PROGRESS_REPORT,
                'context_type' => $contextType,
                'version' => 1,
                'title' => trim($validated['title']),
                'summary' => $validated['summary'] ?? null,
                'content' => $cleanContent,
                'status' => $initialStatus,
                'submitted_at' => $submittedAt,
                'metrics' => $validated['metrics'] ?? null,
            ]);

            // Mentions
            $this->sanitizer->extractAndStoreMentions($user, $report, $cleanContent, $projectId);

            // Audit Log
            AuditLog::log(
                $user->id,
                $initialStatus === WorkReport::STATUS_SUBMITTED ? 'report.submitted' : 'report.draft_created',
                "Laporan '{$report->title}' dibuat dengan status {$initialStatus}.",
                $projectId,
                ['report_id' => $report->id, 'context' => $contextType, 'type' => $report->type]
            );

            return $report;
        });

        return response()->json([
            'success' => true,
            'message' => $initialStatus === WorkReport::STATUS_DRAFT ? 'Draft laporan berhasil disimpan.' : 'Laporan berhasil dikirimkan untuk direview.',
            'data' => $report->load(['user:id,name,email', 'reviewer:id,name,email', 'project:id,title', 'task:id,title,status']),
        ], 201);
    }

    /**
     * Display the specified report details and review history.
     */
    public function show(Request $request, WorkReport $report)
    {
        $user = $request->user();

        if (!$this->permissionService->userHasReportPermission($user, $report, 'reports.view')) {
            return response()->json([
                'success' => false,
                'message' => 'Anda tidak memiliki akses untuk melihat laporan ini.',
            ], 403);
        }

        $report->load([
            'user:id,name,email',
            'reviewer:id,name,email',
            'project:id,title,user_id',
            'task:id,title,status,requires_report',
            'reviews.reviewer:id,name,email',
            'mentions.mentionedUser:id,name,email',
            'mentions.mentionedRole:id,name,color',
        ]);

        return response()->json([
            'success' => true,
            'data' => $report,
        ]);
    }

    /**
     * Update an existing report (draft or revision).
     */
    public function update(Request $request, WorkReport $report)
    {
        $user = $request->user();

        // RULE: Approved reports CANNOT be modified
        if ($report->status === WorkReport::STATUS_APPROVED) {
            return response()->json([
                'success' => false,
                'message' => 'Laporan yang telah disetujui tidak dapat diubah (Approved reports cannot be modified).',
            ], 422);
        }

        // Only author can edit report content
        if ($report->user_id !== $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Hanya penulis yang dapat mengubah konten laporan ini.',
            ], 403);
        }

        $validated = $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'content' => 'sometimes|required|string',
            'summary' => 'nullable|string',
            'type' => 'nullable|string|max:50',
            'reviewer_id' => 'nullable|exists:users,id',
            'metrics' => 'nullable|array',
        ]);

        DB::transaction(function () use ($request, $report, $validated, $user) {
            if (isset($validated['content'])) {
                $validated['content'] = $this->sanitizer->sanitizeHtml($validated['content']);
                $this->sanitizer->extractAndStoreMentions($user, $report, $validated['content'], $report->project_id);
            }

            $report->update($validated);

            AuditLog::log(
                $user->id,
                'report.updated',
                "Laporan '{$report->title}' diperbarui.",
                $report->project_id,
                ['report_id' => $report->id, 'version' => $report->version]
            );
        });

        return response()->json([
            'success' => true,
            'message' => 'Laporan berhasil diperbarui.',
            'data' => $report->fresh(['user:id,name,email', 'reviewer:id,name,email', 'project:id,title', 'task:id,title,status']),
        ]);
    }

    /**
     * Submit a draft report for review.
     */
    public function submit(Request $request, WorkReport $report)
    {
        $user = $request->user();

        if ($report->user_id !== $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Hanya penulis yang dapat mengirimkan laporan ini.',
            ], 403);
        }

        if ($report->status !== WorkReport::STATUS_DRAFT) {
            return response()->json([
                'success' => false,
                'message' => 'Hanya draft laporan yang dapat dikirimkan untuk review.',
            ], 422);
        }

        DB::transaction(function () use ($report, $user) {
            $report->update([
                'status' => WorkReport::STATUS_SUBMITTED,
                'submitted_at' => Carbon::now(),
            ]);

            AuditLog::log(
                $user->id,
                'report.submitted',
                "Laporan '{$report->title}' telah dikirimkan untuk review.",
                $report->project_id,
                ['report_id' => $report->id]
            );
        });

        return response()->json([
            'success' => true,
            'message' => 'Laporan berhasil dikirimkan untuk review.',
            'data' => $report->fresh(['user:id,name,email', 'reviewer:id,name,email', 'project:id,title', 'task:id,title,status']),
        ]);
    }

    /**
     * Start reviewing a submitted report.
     */
    public function startReview(Request $request, WorkReport $report)
    {
        $user = $request->user();

        // Review Rule: Author CANNOT review own report
        if ($report->user_id === $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Penulis tidak dapat mereview laporannya sendiri (Author cannot review their own report).',
            ], 403);
        }

        if (!$this->permissionService->userHasReportPermission($user, $report, 'reports.review')) {
            return response()->json([
                'success' => false,
                'message' => 'Anda tidak memiliki izin untuk mereview laporan ini.',
            ], 403);
        }

        if ($report->status !== WorkReport::STATUS_SUBMITTED) {
            return response()->json([
                'success' => false,
                'message' => 'Hanya laporan dengan status submitted yang dapat diproses ke in_review.',
            ], 422);
        }

        DB::transaction(function () use ($report, $user) {
            // Lock report row to prevent concurrency races
            $locked = WorkReport::where('id', $report->id)->lockForUpdate()->first();

            $locked->update([
                'status' => WorkReport::STATUS_IN_REVIEW,
                'reviewer_id' => $user->id,
            ]);

            AuditLog::log(
                $user->id,
                'report.in_review',
                "Laporan '{$locked->title}' sedang direview oleh {$user->name}.",
                $locked->project_id,
                ['report_id' => $locked->id]
            );
        });

        return response()->json([
            'success' => true,
            'message' => 'Review laporan telah dimulai.',
            'data' => $report->fresh(['user:id,name,email', 'reviewer:id,name,email', 'project:id,title', 'task:id,title,status', 'reviews.reviewer:id,name,email']),
        ]);
    }

    /**
     * Request revisions on a submitted or in-review report.
     */
    public function requestRevision(Request $request, WorkReport $report)
    {
        $user = $request->user();

        // Review Rule: Author CANNOT review own report
        if ($report->user_id === $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Penulis tidak dapat meminta revisi pada laporannya sendiri (Author cannot review their own report).',
            ], 403);
        }

        if (!$this->permissionService->userHasReportPermission($user, $report, 'reports.request_revision')) {
            return response()->json([
                'success' => false,
                'message' => 'Anda tidak memiliki izin untuk meminta revisi pada laporan ini.',
            ], 403);
        }

        if (!in_array($report->status, [WorkReport::STATUS_SUBMITTED, WorkReport::STATUS_IN_REVIEW], true)) {
            return response()->json([
                'success' => false,
                'message' => 'Revisi hanya dapat diminta pada laporan yang submitted atau in_review.',
            ], 422);
        }

        $validated = $request->validate([
            'feedback' => 'required|string|min:3|max:2000',
        ]);

        DB::transaction(function () use ($report, $user, $validated) {
            $locked = WorkReport::where('id', $report->id)->lockForUpdate()->first();

            $locked->update([
                'status' => WorkReport::STATUS_REVISION_REQUESTED,
                'reviewer_id' => $user->id,
                'reviewed_at' => Carbon::now(),
            ]);

            ReportReview::create([
                'work_report_id' => $locked->id,
                'reviewer_id' => $user->id,
                'status' => WorkReport::STATUS_REVISION_REQUESTED,
                'feedback' => trim($validated['feedback']),
                'version' => $locked->version,
                'report_snapshot' => [
                    'title' => $locked->title,
                    'summary' => $locked->summary,
                    'content' => $locked->content,
                    'metrics' => $locked->metrics,
                    'version' => $locked->version,
                ],
            ]);

            AuditLog::log(
                $user->id,
                'report.revision_requested',
                "Revisi diminta untuk laporan '{$locked->title}': {$validated['feedback']}",
                $locked->project_id,
                ['report_id' => $locked->id, 'version' => $locked->version]
            );

            // Notify author
            Notification::create([
                'user_id' => $locked->user_id,
                'title' => 'Revisi Laporan Diminta',
                'message' => "Laporan '{$locked->title}' memerlukan revisi: {$validated['feedback']}",
                'type' => 'report_revision_requested',
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Permintaan revisi berhasil dikirimkan kepada penulis.',
            'data' => $report->fresh(['user:id,name,email', 'reviewer:id,name,email', 'project:id,title', 'task:id,title,status', 'reviews.reviewer:id,name,email']),
        ]);
    }

    /**
     * Resubmit a revised report.
     */
    public function resubmit(Request $request, WorkReport $report)
    {
        $user = $request->user();

        if ($report->user_id !== $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Hanya penulis yang dapat mengirimkan kembali laporan revisi.',
            ], 403);
        }

        if ($report->status !== WorkReport::STATUS_REVISION_REQUESTED) {
            return response()->json([
                'success' => false,
                'message' => 'Hanya laporan dengan status revision_requested yang dapat di-resubmit.',
            ], 422);
        }

        $validated = $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'content' => 'sometimes|required|string',
            'summary' => 'nullable|string', // Revision notes explaining changes
            'metrics' => 'nullable|array',
        ]);

        DB::transaction(function () use ($report, $user, $validated) {
            $locked = WorkReport::where('id', $report->id)->lockForUpdate()->first();

            $updateData = [
                'status' => WorkReport::STATUS_SUBMITTED,
                'version' => $locked->version + 1, // Increment version
                'submitted_at' => Carbon::now(),
            ];

            if (isset($validated['title'])) {
                $updateData['title'] = trim($validated['title']);
            }
            if (isset($validated['summary'])) {
                $updateData['summary'] = trim($validated['summary']);
            }
            if (isset($validated['metrics'])) {
                $updateData['metrics'] = $validated['metrics'];
            }
            if (isset($validated['content'])) {
                $cleanContent = $this->sanitizer->sanitizeHtml($validated['content']);
                $updateData['content'] = $cleanContent;
                $this->sanitizer->extractAndStoreMentions($user, $locked, $cleanContent, $locked->project_id);
            }

            $locked->update($updateData);

            AuditLog::log(
                $user->id,
                'report.resubmitted',
                "Laporan '{$locked->title}' versi {$locked->version} berhasil dikirim kembali.",
                $locked->project_id,
                ['report_id' => $locked->id, 'version' => $locked->version]
            );
        });

        return response()->json([
            'success' => true,
            'message' => "Laporan revisi versi {$report->fresh()->version} berhasil dikirimkan untuk review ulang.",
            'data' => $report->fresh(['user:id,name,email', 'reviewer:id,name,email', 'project:id,title', 'task:id,title,status', 'reviews.reviewer:id,name,email']),
        ]);
    }

    /**
     * Approve a submitted or in-review report.
     * NOTE: Approving a report does NOT automatically complete a task.
     */
    public function approve(Request $request, WorkReport $report)
    {
        $user = $request->user();

        // STRICT RULE: Author CANNOT approve own report
        if ($report->user_id === $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Penulis tidak dapat menyetujui laporannya sendiri (Author cannot approve their own report).',
            ], 403);
        }

        if (!$this->permissionService->userHasReportPermission($user, $report, 'reports.approve')) {
            return response()->json([
                'success' => false,
                'message' => 'Anda tidak memiliki izin untuk menyetujui laporan ini.',
            ], 403);
        }

        if (!in_array($report->status, [WorkReport::STATUS_SUBMITTED, WorkReport::STATUS_IN_REVIEW], true)) {
            return response()->json([
                'success' => false,
                'message' => 'Hanya laporan yang berstatus submitted atau in_review yang dapat disetujui.',
            ], 422);
        }

        $validated = $request->validate([
            'feedback' => 'nullable|string|max:2000',
        ]);

        DB::transaction(function () use ($report, $user, $validated) {
            $locked = WorkReport::where('id', $report->id)->lockForUpdate()->first();

            $locked->update([
                'status' => WorkReport::STATUS_APPROVED,
                'reviewer_id' => $user->id,
                'reviewed_at' => Carbon::now(),
            ]);

            ReportReview::create([
                'work_report_id' => $locked->id,
                'reviewer_id' => $user->id,
                'status' => WorkReport::STATUS_APPROVED,
                'feedback' => $validated['feedback'] ?? 'Laporan disetujui.',
                'version' => $locked->version,
                'report_snapshot' => [
                    'title' => $locked->title,
                    'summary' => $locked->summary,
                    'content' => $locked->content,
                    'metrics' => $locked->metrics,
                    'version' => $locked->version,
                ],
            ]);

            AuditLog::log(
                $user->id,
                'report.approved',
                "Laporan '{$locked->title}' telah disetujui oleh {$user->name}.",
                $locked->project_id,
                ['report_id' => $locked->id, 'version' => $locked->version]
            );

            // Notify author
            Notification::create([
                'user_id' => $locked->user_id,
                'title' => 'Laporan Disetujui',
                'message' => "Laporan '{$locked->title}' Anda telah disetujui oleh {$user->name}.",
                'type' => 'report_approved',
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Laporan berhasil disetujui.',
            'data' => $report->fresh(['user:id,name,email', 'reviewer:id,name,email', 'project:id,title', 'task:id,title,status', 'reviews.reviewer:id,name,email']),
        ]);
    }

    /**
     * Reject a submitted or in-review report with mandatory feedback.
     */
    public function reject(Request $request, WorkReport $report)
    {
        $user = $request->user();

        // Review Rule: Author CANNOT review/reject own report
        if ($report->user_id === $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Penulis tidak dapat menolak laporannya sendiri (Author cannot reject their own report).',
            ], 403);
        }

        if (!$this->permissionService->userHasReportPermission($user, $report, 'reports.approve') &&
            !$this->permissionService->userHasReportPermission($user, $report, 'reports.review')) {
            return response()->json([
                'success' => false,
                'message' => 'Anda tidak memiliki izin untuk menolak laporan ini.',
            ], 403);
        }

        if (!in_array($report->status, [WorkReport::STATUS_SUBMITTED, WorkReport::STATUS_IN_REVIEW], true)) {
            return response()->json([
                'success' => false,
                'message' => 'Hanya laporan yang berstatus submitted atau in_review yang dapat ditolak.',
            ], 422);
        }

        $validated = $request->validate([
            'feedback' => 'required|string|min:3|max:2000',
        ]);

        DB::transaction(function () use ($report, $user, $validated) {
            $locked = WorkReport::where('id', $report->id)->lockForUpdate()->first();

            $locked->update([
                'status' => WorkReport::STATUS_REJECTED,
                'reviewer_id' => $user->id,
                'reviewed_at' => Carbon::now(),
            ]);

            ReportReview::create([
                'work_report_id' => $locked->id,
                'reviewer_id' => $user->id,
                'status' => WorkReport::STATUS_REJECTED,
                'feedback' => trim($validated['feedback']),
                'version' => $locked->version,
                'report_snapshot' => [
                    'title' => $locked->title,
                    'summary' => $locked->summary,
                    'content' => $locked->content,
                    'metrics' => $locked->metrics,
                    'version' => $locked->version,
                ],
            ]);

            AuditLog::log(
                $user->id,
                'report.rejected',
                "Laporan '{$locked->title}' ditolak oleh {$user->name}: {$validated['feedback']}",
                $locked->project_id,
                ['report_id' => $locked->id, 'version' => $locked->version]
            );

            // Notify author
            Notification::create([
                'user_id' => $locked->user_id,
                'title' => 'Laporan Ditolak',
                'message' => "Laporan '{$locked->title}' Anda telah ditolak: {$validated['feedback']}",
                'type' => 'report_rejected',
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Laporan telah ditolak.',
            'data' => $report->fresh(['user:id,name,email', 'reviewer:id,name,email', 'project:id,title', 'task:id,title,status', 'reviews.reviewer:id,name,email']),
        ]);
    }

    /**
     * Soft delete a report.
     */
    public function destroy(Request $request, WorkReport $report)
    {
        $user = $request->user();

        // Author can delete draft; Project owner/admin can delete non-approved or reports if permitted
        $canDelete = false;
        if ($report->user_id === $user->id && $report->status === WorkReport::STATUS_DRAFT) {
            $canDelete = true;
        } elseif ($report->project_id) {
            $project = Project::find($report->project_id);
            if ($project && ($project->user_id === $user->id || $this->permissionService->userHasProjectPermission($user, $project, 'reports.delete'))) {
                $canDelete = true;
            }
        } elseif ($report->user_id === $user->id) {
            $canDelete = true;
        }

        if (!$canDelete) {
            return response()->json([
                'success' => false,
                'message' => 'Anda tidak memiliki izin untuk menghapus laporan ini.',
            ], 403);
        }

        $report->delete();

        return response()->json([
            'success' => true,
            'message' => 'Laporan berhasil dihapus.',
        ]);
    }
}
