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
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\ProjectController;
use App\Http\Controllers\Api\SearchController;
use App\Http\Controllers\Api\SubtaskController;
use App\Http\Controllers\Api\TagController;
use App\Http\Controllers\Api\TaskController;
use App\Http\Controllers\Api\UserSettingController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Tuntas RESTful API Routes — v1
|--------------------------------------------------------------------------
*/

Route::prefix('v1')->group(function () {
    // Health check
    Route::get('/health', function () {
        return response()->json([
            'status' => 'ok',
            'system' => 'Tuntas API',
            'version' => '2.0.0',
            'timestamp' => now()->toIso8601String(),
        ]);
    });

    // Public Authentication
    Route::post('/auth/register', [AuthController::class, 'register']);
    Route::post('/auth/login', [AuthController::class, 'login']);

    // Authenticated Routes (Sanctum)
    Route::middleware('auth:sanctum')->group(function () {
        // Auth session & Profile
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::get('/auth/me', [AuthController::class, 'me']);
        Route::put('/auth/profile', [AuthController::class, 'updateProfile']);
        Route::put('/auth/password', [AuthController::class, 'updatePassword']);

        // Dashboard Metrics
        Route::get('/dashboard', [DashboardController::class, 'index']);

        // Tasks & Subtasks
        Route::apiResource('tasks', TaskController::class);
        Route::patch('tasks/{task}/toggle', [TaskController::class, 'toggleStatus']);
        Route::post('tasks/{task}/subtasks', [SubtaskController::class, 'store']);
        Route::patch('subtasks/{subtask}/toggle', [SubtaskController::class, 'toggle']);
        Route::delete('subtasks/{subtask}', [SubtaskController::class, 'destroy']);

        // Projects
        Route::apiResource('projects', ProjectController::class);

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
        Route::get('/notifications', [NotificationController::class, 'index']);
        Route::post('/notifications', [NotificationController::class, 'store']);
        Route::post('/notifications/check-reminders', [NotificationController::class, 'generateDeadlineReminders']);
        Route::patch('/notifications/{notification}/read', [NotificationController::class, 'markAsRead']);
        Route::post('/notifications/read-all', [NotificationController::class, 'markAllAsRead']);
        Route::delete('/notifications/{notification}', [NotificationController::class, 'destroy']);

        // Analytics Engine
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
    });
});
