<?php

use App\Http\Controllers\Api\AnalyticsController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CalendarController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\ExamAssessmentController;
use App\Http\Controllers\Api\ExaminationController;
use App\Http\Controllers\Api\GoalController;
use App\Http\Controllers\Api\HabitController;
use App\Http\Controllers\Api\LearningController;
use App\Http\Controllers\Api\NoteController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\ProjectController;
use App\Http\Controllers\Api\ProjectMemberController;
use App\Http\Controllers\Api\ProjectRoleController;
use App\Http\Controllers\Api\SearchController;
use App\Http\Controllers\Api\SubtaskController;
use App\Http\Controllers\Api\TagController;
use App\Http\Controllers\Api\TaskController;
use App\Http\Controllers\Api\UserSettingController;
use App\Http\Controllers\Api\WorkReportController;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Tuntas RESTful API Routes — v1
|--------------------------------------------------------------------------
*/

Route::prefix('v1')->group(function () {
    // Health check
    Route::get('/health', function () {
        $dbConnected = false;
        try {
            DB::connection()->getPdo();
            $dbConnected = true;
        } catch (\Throwable $e) {
            $dbConnected = false;
        }

        // Verify scheduler heartbeat
        $heartbeatFile = storage_path('framework/scheduler_heartbeat.txt');
        $schedulerStatus = 'inactive';
        $lastHeartbeat = null;
        $ageSeconds = null;

        if (file_exists($heartbeatFile)) {
            $mtime = filemtime($heartbeatFile);
            $lastHeartbeat = date('c', $mtime);
            $ageSeconds = time() - $mtime;
            // Considered active if heartbeat file was modified within 150 seconds (2.5 cycles)
            if ($ageSeconds <= 150) {
                $schedulerStatus = 'active';
            } else {
                $schedulerStatus = 'stale';
            }
        }

        // Verify queue worker heartbeat
        $queueHeartbeatFile = storage_path('framework/queue_worker_heartbeat.txt');
        $queueStatus = 'inactive';
        $queueLastHeartbeat = null;
        $queueAgeSeconds = null;

        if (file_exists($queueHeartbeatFile)) {
            $mtime = filemtime($queueHeartbeatFile);
            $queueLastHeartbeat = date('c', $mtime);
            $queueAgeSeconds = time() - $mtime;
            // Considered active if modified within 60 seconds (worker loops every 3-10s)
            if ($queueAgeSeconds <= 60) {
                $queueStatus = 'active';
            } else {
                $queueStatus = 'stale';
            }
        }

        // In production, database, scheduler, and queue worker must all be operational
        $isProduction = config('app.env') === 'production';
        $queueDriver = config('queue.default');
        $queueRequired = $isProduction && $queueDriver !== 'sync';

        $isHealthy = $isProduction
            ? ($dbConnected && $schedulerStatus === 'active' && (!$queueRequired || $queueStatus === 'active'))
            : $dbConnected;

        return response()->json([
            'status' => $isHealthy ? 'ok' : 'degraded',
            'health' => $isHealthy ? 'healthy' : 'degraded',
            'system' => 'Tuntas API',
            'version' => '2.0.0',
            'environment' => config('app.env'),
            'timestamp' => now()->toIso8601String(),
            'services' => [
                'database' => $dbConnected ? 'connected' : 'disconnected',
                'scheduler' => $schedulerStatus,
                'queue' => $queueStatus,
            ],
            'details' => [
                'scheduler' => [
                    'status' => $schedulerStatus,
                    'last_heartbeat' => $lastHeartbeat,
                    'age_seconds' => $ageSeconds,
                ],
                'queue' => [
                    'driver' => $queueDriver,
                    'status' => $queueStatus,
                    'last_heartbeat' => $queueLastHeartbeat,
                    'age_seconds' => $queueAgeSeconds,
                ],
            ],
        ], $isHealthy ? 200 : 503);
    });

    // Public Authentication (rate limited)
    Route::middleware('throttle:5,1')->post('/auth/register', [AuthController::class, 'register']);
    Route::middleware('throttle:10,1')->group(function () {
        Route::post('/auth/login', [AuthController::class, 'login']);
        Route::post('/auth/forgot-password', [AuthController::class, 'forgotPassword']);
        Route::post('/auth/reset-password', [AuthController::class, 'resetPassword']);
    });

    // Authenticated Routes (Sanctum + rate limit)
    Route::middleware(['auth:sanctum', 'throttle:60,1'])->group(function () {
        // Auth session & Profile (tidak perlu verified — user butuh akses untuk verifikasi)
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::get('/auth/me', [AuthController::class, 'me']);
        Route::put('/auth/profile', [AuthController::class, 'updateProfile']);
        Route::put('/auth/password', [AuthController::class, 'updatePassword']);
        Route::get('/activity', function (\Illuminate\Http\Request $request) {
            $logs = \App\Models\AuditLog::where('user_id', $request->user()->id)
                ->orderBy('created_at', 'desc')
                ->limit(40)
                ->get();
            return response()->json([
                'success' => true,
                'data' => $logs,
            ]);
        });

        // Routes berikut memerlukan autentikasi
        // Dashboard Metrics
        Route::get('/dashboard', [DashboardController::class, 'index']);

        // Tasks & Subtasks
        Route::post('tasks/bulk', [TaskController::class, 'bulkAction']);
        Route::apiResource('tasks', TaskController::class);
        Route::patch('tasks/{task}/toggle', [TaskController::class, 'toggleStatus']);
        Route::patch('tasks/{task}/status', [TaskController::class, 'toggleStatus']);
        Route::post('tasks/{task}/subtasks', [SubtaskController::class, 'store']);
        Route::patch('subtasks/{subtask}/toggle', [SubtaskController::class, 'toggle']);
        Route::delete('subtasks/{subtask}', [SubtaskController::class, 'destroy']);

        // Projects & Milestones
        Route::post('projects/{project}/milestones', [ProjectController::class, 'addMilestone']);
        Route::patch('projects/{project}/milestones/{milestone}/toggle', [ProjectController::class, 'toggleMilestone']);
        Route::delete('projects/{project}/milestones/{milestone}', [ProjectController::class, 'deleteMilestone']);
        Route::patch('projects/{project}/archive', [ProjectController::class, 'toggleArchive']);
        Route::apiResource('projects', ProjectController::class);

        // Project Roles & Permissions
        Route::get('permissions/catalog', [ProjectRoleController::class, 'catalog']);
        Route::get('projects/{project}/roles', [ProjectRoleController::class, 'index']);
        Route::post('projects/{project}/roles', [ProjectRoleController::class, 'store']);
        Route::get('projects/{project}/roles/{role}', [ProjectRoleController::class, 'show']);
        Route::put('projects/{project}/roles/{role}', [ProjectRoleController::class, 'update']);
        Route::delete('projects/{project}/roles/{role}', [ProjectRoleController::class, 'destroy']);

        // Project Members & Invitations
        Route::get('projects/{project}/members', [ProjectMemberController::class, 'index']);
        Route::post('projects/{project}/invitations', [ProjectMemberController::class, 'invite']);
        Route::get('projects/{project}/invitations', [ProjectMemberController::class, 'invitations']);
        Route::delete('projects/{project}/invitations/{invitation}', [ProjectMemberController::class, 'cancelInvitation']);
        Route::patch('projects/{project}/members/{user}/role', [ProjectMemberController::class, 'updateRole']);
        Route::delete('projects/{project}/members/{user}', [ProjectMemberController::class, 'destroy']);
        Route::post('invitations/{token}/accept', [ProjectMemberController::class, 'acceptInvitation']);

        // Notes Module (Workspace, Project, Task Documentation)
        Route::patch('notes/{note}/pin', [NoteController::class, 'togglePin']);
        Route::post('notes/{note}/convert-to-task', [NoteController::class, 'convertToTask']);
        Route::post('notes/{note}/restore/{version}', [NoteController::class, 'restoreVersion']);
        Route::post('notes/{note}/comments', [NoteController::class, 'addComment']);
        Route::delete('notes/{note}/comments/{comment}', [NoteController::class, 'deleteComment']);
        Route::post('notes/{note}/attachments', [NoteController::class, 'uploadAttachment']);
        Route::delete('notes/{note}/attachments/{attachment}', [NoteController::class, 'deleteAttachment']);
        Route::apiResource('notes', NoteController::class);

        // Reports Module (Workspace, Project, Task Reports with Review & Approval Workflow)
        Route::post('reports/{report}/submit', [WorkReportController::class, 'submit']);
        Route::post('reports/{report}/start-review', [WorkReportController::class, 'startReview']);
        Route::post('reports/{report}/request-revision', [WorkReportController::class, 'requestRevision']);
        Route::post('reports/{report}/resubmit', [WorkReportController::class, 'resubmit']);
        Route::post('reports/{report}/approve', [WorkReportController::class, 'approve']);
        Route::post('reports/{report}/reject', [WorkReportController::class, 'reject']);
        Route::apiResource('reports', WorkReportController::class);

        // Dedicated Examination System
        Route::apiResource('examinations', ExaminationController::class);
        Route::post('examinations/{examination}/preparations', [ExaminationController::class, 'addPreparation']);
        Route::patch('examinations/preparations/{preparation}/toggle', [ExaminationController::class, 'togglePreparation']);

        // Calendar & Scheduling
        Route::get('/calendar', [CalendarController::class, 'index']);
        Route::get('/calendar/events', [CalendarController::class, 'index']);

        // Categories & Tags
        Route::apiResource('categories', CategoryController::class);
        Route::apiResource('tags', TagController::class)->only(['index', 'store', 'update', 'destroy']);

        // Notifications
        Route::get('/notifications/preferences', [NotificationController::class, 'getPreferences']);
        Route::put('/notifications/preferences', [NotificationController::class, 'updatePreferences']);
        Route::get('/notifications', [NotificationController::class, 'index']);
        Route::post('/notifications', [NotificationController::class, 'store']);
        Route::post('/notifications/check-reminders', [NotificationController::class, 'generateDeadlineReminders']);
        Route::patch('/notifications/{notification}/read', [NotificationController::class, 'markAsRead']);
        Route::patch('/notifications/{notification}/archive', [NotificationController::class, 'archive']);
        Route::patch('/notifications/{notification}/unarchive', [NotificationController::class, 'unarchive']);
        Route::post('/notifications/read-all', [NotificationController::class, 'markAllAsRead']);
        Route::delete('/notifications/{notification}', [NotificationController::class, 'destroy']);

        // Analytics Engine
        Route::get('/analytics/export', [AnalyticsController::class, 'export']);
        Route::get('/analytics/productivity', [AnalyticsController::class, 'productivity']);
        Route::get('/analytics/learning', [AnalyticsController::class, 'learning']);

        // Global Search
        Route::get('/search', [SearchController::class, 'search']);

        // User Settings
        Route::get('/settings', [UserSettingController::class, 'show']);
        Route::put('/settings', [UserSettingController::class, 'update']);

        // Habits (Streak Engine)
        Route::apiResource('habits', HabitController::class);
        Route::post('habits/{habit}/toggle', [HabitController::class, 'toggle']);
        Route::post('habits/{habit}/freeze', [HabitController::class, 'useFreeze']);
        Route::get('habits/{habit}/history', [HabitController::class, 'history']);

        // Goals & Milestones
        Route::patch('goals/{goal}/archive', [GoalController::class, 'toggleArchive']);
        Route::apiResource('goals', GoalController::class);
        Route::post('goals/{goal}/milestones', [GoalController::class, 'addMilestone']);
        Route::patch('milestones/{milestone}', [GoalController::class, 'updateMilestone']);
        Route::delete('milestones/{milestone}', [GoalController::class, 'deleteMilestone']);

        // Learning Management (LMS)
        Route::get('courses', [LearningController::class, 'coursesIndex']);
        Route::post('courses', [LearningController::class, 'coursesStore']);
        Route::get('courses/{course}', [LearningController::class, 'coursesShow']);
        Route::put('courses/{course}', [LearningController::class, 'coursesUpdate']);
        Route::delete('courses/{course}', [LearningController::class, 'coursesDestroy']);
        Route::post('courses/{course}/modules', [LearningController::class, 'modulesStore']);
        Route::put('modules/{module}', [LearningController::class, 'modulesUpdate']);
        Route::delete('modules/{module}', [LearningController::class, 'modulesDestroy']);
        Route::post('modules/{module}/lessons', [LearningController::class, 'lessonsStore']);
        Route::put('lessons/{lesson}', [LearningController::class, 'lessonsUpdate']);
        Route::delete('lessons/{lesson}', [LearningController::class, 'lessonsDestroy']);
        Route::patch('lessons/{lesson}/toggle', [LearningController::class, 'lessonsToggle']);
        Route::get('learning-sessions/active', [LearningController::class, 'sessionsActive']);
        Route::post('learning-sessions/start', [LearningController::class, 'sessionsStart']);
        Route::post('learning-sessions/{session}/pause', [LearningController::class, 'sessionsPause']);
        Route::post('learning-sessions/{session}/resume', [LearningController::class, 'sessionsResume']);
        Route::post('learning-sessions/{session}/complete', [LearningController::class, 'sessionsComplete']);
        Route::get('learning-sessions', [LearningController::class, 'sessionsIndex']);
        Route::post('learning-sessions', [LearningController::class, 'sessionsStore']);
        Route::get('learning-analytics', [LearningController::class, 'analytics']);

        // Dedicated Examination Assessment Engine
        Route::get('question-banks', [ExamAssessmentController::class, 'banksIndex']);
        Route::post('question-banks', [ExamAssessmentController::class, 'banksStore']);
        Route::get('question-banks/{bank}', [ExamAssessmentController::class, 'banksShow']);
        Route::put('question-banks/{bank}', [ExamAssessmentController::class, 'banksUpdate']);
        Route::delete('question-banks/{bank}', [ExamAssessmentController::class, 'banksDestroy']);
        Route::post('question-banks/{bank}/questions', [ExamAssessmentController::class, 'questionsStore']);
        Route::put('questions/{question}', [ExamAssessmentController::class, 'questionsUpdate']);
        Route::delete('questions/{question}', [ExamAssessmentController::class, 'questionsDestroy']);
        Route::get('exam-blueprints', [ExamAssessmentController::class, 'blueprintsIndex']);
        Route::post('exam-blueprints', [ExamAssessmentController::class, 'blueprintsStore']);
        Route::get('exam-blueprints/{blueprint}', [ExamAssessmentController::class, 'blueprintsShow']);
        Route::put('exam-blueprints/{blueprint}', [ExamAssessmentController::class, 'blueprintsUpdate']);
        Route::delete('exam-blueprints/{blueprint}', [ExamAssessmentController::class, 'blueprintsDestroy']);
        Route::post('exam-blueprints/{blueprint}/attach-questions', [ExamAssessmentController::class, 'attachQuestions']);
        Route::post('exam-blueprints/{blueprint}/start', [ExamAssessmentController::class, 'startAttempt']);
        Route::get('exam-attempts', [ExamAssessmentController::class, 'attemptsIndex']);
        Route::get('exam-attempts/{attempt}', [ExamAssessmentController::class, 'showAttempt']);
        Route::post('exam-attempts/{attempt}/sync', [ExamAssessmentController::class, 'syncAnswers']);
        Route::post('exam-attempts/{attempt}/integrity', [ExamAssessmentController::class, 'logIntegrity']);
        Route::post('exam-attempts/{attempt}/submit', [ExamAssessmentController::class, 'submitAttempt']);
        Route::get('exam-attempts/{attempt}/review', [ExamAssessmentController::class, 'getReview']);

        // Instructor Manual Grading Queue
        Route::get('exam-grading', [ExamAssessmentController::class, 'gradingIndex']);
        Route::get('exam-grading/{attempt}', [ExamAssessmentController::class, 'gradingShow']);
        Route::post('exam-grading/{attempt}', [ExamAssessmentController::class, 'gradingStore']);

        // Mention Engine
        Route::get('mentions/autocomplete', [\App\Http\Controllers\Api\MentionController::class, 'autocomplete']);
        Route::get('mentions/me', [\App\Http\Controllers\Api\MentionController::class, 'myMentions']);
        Route::get('mentions', [\App\Http\Controllers\Api\MentionController::class, 'forModel']);
    }); // end middleware(['auth:sanctum', 'throttle:60,1'])
});
