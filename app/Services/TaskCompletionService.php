<?php

namespace App\Services;

use App\Models\Category;
use App\Models\Goal;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\Task;
use App\Models\User;
use App\Models\WorkReport;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class TaskCompletionService
{
    /**
     * Check if a task can be marked as completed.
     * Single source of truth across all completion entry points.
     *
     * @return array{allowed: bool, reason: string|null}
     */
    public function canBeCompleted(Task $task): array
    {
        // 1. Incomplete dependencies condition
        if ($task->hasUncompletedDependencies()) {
            return [
                'allowed' => false,
                'reason' => 'Tugas tidak dapat diselesaikan karena ada dependensi prasyarat yang belum selesai.',
            ];
        }

        // 2. Required work report condition
        if ($task->requires_report && !$task->hasApprovedReport()) {
            return [
                'allowed' => false,
                'reason' => 'Tugas ini memerlukan laporan yang telah disetujui (approved report) sebelum dapat diselesaikan.',
            ];
        }

        // 3. Required review condition
        if ($task->requires_review && !$this->hasPassedReview($task)) {
            return [
                'allowed' => false,
                'reason' => 'Tugas ini memerlukan proses review yang telah disetujui sebelum dapat diselesaikan.',
            ];
        }

        // 4. Completion conditions evaluation (subtasks, checklist, custom criteria)
        $condResult = $this->evaluateCompletionConditions($task);
        if (!$condResult['allowed']) {
            return $condResult;
        }

        return [
            'allowed' => true,
            'reason' => null,
        ];
    }

    /**
     * Determine if a task has satisfied the review requirement.
     */
    public function hasPassedReview(Task $task): bool
    {
        // Check 1: Approved work report directly linked to this task
        if ($task->workReports()->where('status', WorkReport::STATUS_APPROVED)->whereNotNull('reviewed_at')->exists()) {
            return true;
        }

        // Check 2: Approved work report review associated with this task
        $hasApprovedReportReview = $task->workReports()
            ->whereHas('reviews', function ($q) {
                $q->whereIn('decision', ['approved', 'approved_with_notes', 'review_passed']);
            })
            ->exists();

        if ($hasApprovedReportReview) {
            return true;
        }

        // Check 3: Reviewed flag in completion conditions or task metadata
        $conditions = $task->completion_conditions;
        if (is_string($conditions)) {
            $conditions = json_decode($conditions, true);
        }
        $conditions = $conditions ?? [];
        if (!empty($conditions['reviewed']) || !empty($conditions['is_reviewed']) || !empty($conditions['review_passed']) || !empty($conditions['reviewed_by'])) {
            return true;
        }

        return false;
    }

    /**
     * Evaluate completion conditions JSON (subtasks, checklists, criteria).
     *
     * @return array{allowed: bool, reason: string|null}
     */
    public function evaluateCompletionConditions(Task $task): array
    {
        $conditions = $task->completion_conditions;
        if (is_string($conditions)) {
            $conditions = json_decode($conditions, true);
        }
        if (empty($conditions)) {
            return ['allowed' => true, 'reason' => null];
        }

        // A. Require all subtasks completed
        if (!empty($conditions['require_subtasks_completed']) || !empty($conditions['require_all_subtasks'])) {
            $incompleteCount = $task->subtasks()->where('is_completed', false)->count();
            if ($incompleteCount > 0) {
                return [
                    'allowed' => false,
                    'reason' => "Terdapat {$incompleteCount} subtask yang belum diselesaikan.",
                ];
            }
        }

        // B. Checklist items evaluation
        if (!empty($conditions['checklist']) && is_array($conditions['checklist'])) {
            foreach ($conditions['checklist'] as $item) {
                $isDone = !empty($item['completed']) || !empty($item['done']) || !empty($item['is_completed']);
                if (!$isDone) {
                    $label = $item['title'] ?? $item['label'] ?? 'item checklist';
                    return [
                        'allowed' => false,
                        'reason' => "Item kondisi penyelesaian '{$label}' belum terpenuhi.",
                    ];
                }
            }
        }

        // C. Explicit criteria_met / passed flags
        if (array_key_exists('criteria_met', $conditions) && !$conditions['criteria_met']) {
            return [
                'allowed' => false,
                'reason' => 'Kriteria penyelesaian tugas belum terpenuhi.',
            ];
        }

        if (array_key_exists('passed', $conditions) && !$conditions['passed']) {
            return [
                'allowed' => false,
                'reason' => 'Kondisi penyelesaian khusus belum terpenuhi.',
            ];
        }

        return ['allowed' => true, 'reason' => null];
    }

    /**
     * Validate assignee membership within project context.
     *
     * @return array{valid: bool, message: string|null}
     */
    public function validateAssignee(?int $assigneeId, ?int $projectId): array
    {
        if (!$assigneeId) {
            return ['valid' => true, 'message' => null];
        }

        $user = User::find($assigneeId);
        if (!$user) {
            return ['valid' => false, 'message' => 'Pengguna yang ditugaskan tidak ditemukan.'];
        }

        if ($projectId) {
            $project = Project::find($projectId);
            if (!$project) {
                return ['valid' => false, 'message' => 'Proyek tidak ditemukan.'];
            }

            $isMember = ($project->user_id === $user->id) || ProjectMember::where('project_id', $project->id)
                ->where('user_id', $user->id)
                ->exists();

            if (!$isMember) {
                return [
                    'valid' => false,
                    'message' => 'Pengguna yang ditugaskan bukan merupakan anggota aktif proyek ini.',
                ];
            }
        }

        return ['valid' => true, 'message' => null];
    }

    /**
     * Validate dependencies for self-reference, cross-project, and circular references.
     *
     * @return array{valid: bool, message: string|null}
     */
    public function validateDependencies(?int $currentTaskId, array $dependencyIds, ?int $projectId, int $userId): array
    {
        $uniqueIds = array_values(array_unique(array_filter($dependencyIds)));
        if (empty($uniqueIds)) {
            return ['valid' => true, 'message' => null];
        }

        // 1. Self-dependency check
        if ($currentTaskId && in_array($currentTaskId, $uniqueIds, true)) {
            return [
                'valid' => false,
                'message' => 'Tugas tidak dapat bergantung pada dirinya sendiri (self-dependency tidak diizinkan).',
            ];
        }

        // 2. Existence, active status (not deleted), and context isolation check
        $dependencies = Task::whereIn('id', $uniqueIds)->get();
        if ($dependencies->count() !== count($uniqueIds)) {
            return [
                'valid' => false,
                'message' => 'Satu atau lebih tugas dependensi prasyarat tidak ditemukan atau telah dihapus.',
            ];
        }

        foreach ($dependencies as $dep) {
            if ($projectId) {
                // Project task: dependencies must belong to the exact same project
                if ($dep->project_id !== $projectId) {
                    return [
                        'valid' => false,
                        'message' => "Dependensi tugas #{$dep->id} tidak valid: dependensi harus berada dalam proyek yang sama.",
                    ];
                }
            } else {
                // Personal task: dependencies must be personal tasks owned by the same user
                if ($dep->project_id !== null || $dep->user_id !== $userId) {
                    return [
                        'valid' => false,
                        'message' => "Dependensi tugas #{$dep->id} tidak valid: tidak dapat bergantung pada tugas dari proyek atau pengguna lain.",
                    ];
                }
            }
        }

        // 3. Circular dependency detection via BFS graph traversal
        if ($currentTaskId && $this->wouldCreateCycle($currentTaskId, $uniqueIds)) {
            return [
                'valid' => false,
                'message' => 'Terdeteksi circular dependency (ketergantungan berulang). Tugas tidak dapat saling bergantung secara langsung atau tidak langsung.',
            ];
        }

        return ['valid' => true, 'message' => null];
    }

    /**
     * Detect if adding dependencies to a task introduces a directed cycle in the dependency graph.
     */
    public function wouldCreateCycle(int $taskId, array $dependencyIds): bool
    {
        if (in_array($taskId, $dependencyIds, true)) {
            return true;
        }

        $queue = $dependencyIds;
        $visited = [];

        while (!empty($queue)) {
            $currentId = array_shift($queue);
            if ($currentId === $taskId) {
                return true;
            }

            if (isset($visited[$currentId])) {
                continue;
            }
            $visited[$currentId] = true;

            $parents = DB::table('task_dependencies')
                ->where('task_id', $currentId)
                ->pluck('depends_on_task_id')
                ->toArray();

            foreach ($parents as $parent) {
                if ($parent === $taskId) {
                    return true;
                }
                if (!isset($visited[$parent])) {
                    $queue[] = $parent;
                }
            }
        }

        return false;
    }

    /**
     * Automatically spawn next recurrence instance with full inheritance of critical configurations.
     * Prevents race condition double-spawn using atomic query check.
     */
    public function spawnNextRecurrence(Task $task): ?Task
    {
        if (!$task->is_recurring) {
            return null;
        }

        $pattern = $task->recurrence_pattern ?: 'daily';
        $nextDueDate = $task->due_date ? Carbon::parse($task->due_date) : Carbon::today();

        if ($pattern === 'daily') {
            $nextDueDate->addDay();
        } elseif ($pattern === 'weekly') {
            $nextDueDate->addWeek();
        } elseif ($pattern === 'monthly') {
            $nextDueDate->addMonth();
        }

        // Deduplication guard against concurrent requests: check if uncompleted successor already spawned within 15s
        $existingSuccessor = Task::where('user_id', $task->user_id)
            ->where('title', $task->title)
            ->where('is_recurring', true)
            ->where('status', '!=', 'completed')
            ->whereDate('due_date', $nextDueDate->toDateString())
            ->where('created_at', '>=', now()->subSeconds(15))
            ->first();

        if ($existingSuccessor) {
            return $existingSuccessor;
        }

        // Validate assignee is still valid in project context
        $assigneeId = $task->assigned_to;
        if ($assigneeId && $task->project_id) {
            $isAssigneeValid = ProjectMember::where('project_id', $task->project_id)
                ->where('user_id', $assigneeId)
                ->exists();
            if (!$isAssigneeValid && $task->project?->user_id !== $assigneeId) {
                $assigneeId = null; // Reset invalid assignee
            }
        }

        // Validate category if still active
        $categoryId = $task->category_id;
        if ($categoryId && !Category::where('id', $categoryId)->exists()) {
            $categoryId = null;
        }

        // Validate goal if still active
        $goalId = $task->goal_id;
        if ($goalId && !Goal::where('id', $goalId)->exists()) {
            $goalId = null;
        }

        $nextTask = Task::create([
            'user_id' => $task->user_id,
            'assigned_to' => $assigneeId,
            'project_id' => $task->project_id,
            'category_id' => $categoryId,
            'goal_id' => $goalId,
            'title' => $task->title,
            'description' => $task->description,
            'priority' => $task->priority ?: 'medium',
            'status' => 'todo', // Clean initial status
            'due_date' => $nextDueDate,
            'is_recurring' => true,
            'recurrence_pattern' => $pattern,
            'requires_report' => (bool) $task->requires_report,
            'requires_review' => (bool) $task->requires_review,
            'completion_conditions' => $task->completion_conditions,
        ]);

        // Duplicate subtask templates in reset state
        foreach ($task->subtasks as $sub) {
            $nextTask->subtasks()->create([
                'title' => $sub->title,
                'is_completed' => false,
                'order' => $sub->order,
            ]);
        }

        // Sync tags if any
        if ($task->tags()->exists()) {
            $nextTask->tags()->sync($task->tags()->pluck('tags.id')->toArray());
        }

        // Recalculate progress for project/goal
        if ($nextTask->project_id) {
            $nextTask->project?->updateProgress();
        }
        if ($nextTask->goal_id) {
            $nextTask->goal?->recalculateProgress();
        }

        return $nextTask;
    }
}
