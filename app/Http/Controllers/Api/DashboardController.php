<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\ExamAttempt;
use App\Models\Examination;
use App\Models\Goal;
use App\Models\Habit;
use App\Models\HabitLog;
use App\Models\LearningSession;
use App\Models\Notification;
use App\Models\Project;
use App\Models\Task;
use Carbon\Carbon;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    /**
     * Compute comprehensive cross-domain personal dashboard metrics.
     */
    public function index(Request $request)
    {
        $userId = $request->user()->id;
        $now = Carbon::now();
        $todayStart = $now->copy()->startOfDay();
        $todayEnd = $now->copy()->endOfDay();
        $nextWeek = $now->copy()->addDays(7)->endOfDay();
        $todayStr = Carbon::today()->toDateString();

        // 1. Task Metrics
        $totalTasks = Task::where('user_id', $userId)->count();
        $completedTasks = Task::where('user_id', $userId)->where('status', 'completed')->count();
        $inProgressTasks = Task::where('user_id', $userId)->whereIn('status', ['todo', 'in_progress', 'in_review'])->count();
        $overdueTasks = Task::where('user_id', $userId)
            ->whereIn('status', ['todo', 'in_progress'])
            ->whereNotNull('due_date')
            ->where('due_date', '<', $now)
            ->count();

        $todayTasks = Task::where('user_id', $userId)
            ->where(function ($q) use ($todayStart, $todayEnd, $now) {
                $q->whereBetween('due_date', [$todayStart, $todayEnd])
                  ->orWhere(function ($sub) use ($now) {
                      $sub->whereIn('status', ['todo', 'in_progress'])
                          ->whereNotNull('due_date')
                          ->where('due_date', '<', $now);
                  });
            })
            ->with(['category', 'project'])
            ->orderBy('priority', 'desc')
            ->limit(10)
            ->get();

        $upcomingDeadlines = Task::where('user_id', $userId)
            ->whereIn('status', ['todo', 'in_progress'])
            ->whereNotNull('due_date')
            ->whereBetween('due_date', [$now, $nextWeek])
            ->with(['category', 'project'])
            ->orderBy('due_date', 'asc')
            ->limit(5)
            ->get();

        $taskCompletionRate = $totalTasks > 0 ? (int) round(($completedTasks / $totalTasks) * 100) : 0;

        // 2. Project Metrics
        $activeProjects = Project::where('user_id', $userId)
            ->whereIn('status', ['planning', 'in_progress'])
            ->withCount(['tasks', 'tasks as completed_tasks_count' => function ($q) {
                $q->where('status', 'completed');
            }])
            ->orderBy('deadline', 'asc')
            ->limit(4)
            ->get();

        $avgProjectProgress = $activeProjects->count() > 0
            ? (int) round($activeProjects->avg('progress'))
            : 0;

        // 3. Habits with Today's Status
        $habits = Habit::where('user_id', $userId)
            ->where('is_archived', false)
            ->orderBy('current_streak', 'desc')
            ->limit(6)
            ->get();

        $todayLogs = array_map('intval', HabitLog::where('user_id', $userId)
            ->whereDate('log_date', $todayStr)
            ->where('is_completed', true)
            ->pluck('habit_id')
            ->all());

        $habitItems = $habits->map(function ($h) use ($todayLogs) {
            return [
                'id' => $h->id,
                'title' => $h->title,
                'frequency' => $h->frequency,
                'color' => $h->color,
                'current_streak' => $h->current_streak,
                'best_streak' => $h->best_streak,
                'is_completed_today' => in_array((int) $h->id, $todayLogs),
            ];
        });

        // 4. Goals & OKRs
        $activeGoals = Goal::where('user_id', $userId)
            ->whereIn('status', ['not_started', 'in_progress'])
            ->withCount('milestones')
            ->orderBy('target_date', 'asc')
            ->limit(4)
            ->get();

        $avgGoalProgress = $activeGoals->count() > 0
            ? (int) round($activeGoals->avg('progress'))
            : 0;

        // 5. Learning & Study Sessions
        $studySessions = LearningSession::where('user_id', $userId)->get();
        $totalStudyMinutes = (int) $studySessions->sum('duration_minutes');
        $totalStudyHours = round($totalStudyMinutes / 60, 1);

        $activeCourses = Course::where('user_id', $userId)
            ->orderBy('progress', 'desc')
            ->limit(3)
            ->get();

        // 6. Dedicated Examination Subsystem
        $upcomingExams = Examination::where('user_id', $userId)
            ->whereIn('status', ['upcoming', 'preparing'])
            ->where('examination_date', '>=', $todayStart->toDateString())
            ->orderBy('examination_date', 'asc')
            ->limit(3)
            ->get();

        $recentExamAttempts = ExamAttempt::where('user_id', $userId)
            ->where('status', 'completed')
            ->with('blueprint')
            ->orderBy('submitted_at', 'desc')
            ->limit(4)
            ->get()
            ->map(function ($att) {
                return [
                    'id' => $att->id,
                    'title' => $att->blueprint?->title ?? 'Examination',
                    'subject' => $att->blueprint?->subject ?? 'General',
                    'score_percentage' => $att->score_percentage,
                    'is_passed' => $att->is_passed,
                    'submitted_at' => $att->submitted_at?->toIso8601String(),
                ];
            });

        // 7. Recent Notifications
        $recentNotifications = Notification::where('user_id', $userId)
            ->latest()
            ->limit(5)
            ->get();

        $unreadNotificationsCount = Notification::where('user_id', $userId)
            ->where('is_read', false)
            ->count();

        // 8. Weekly Productivity Trend (Last 7 Days)
        $weeklyProductivity = [];
        for ($i = 6; $i >= 0; $i--) {
            $day = $now->copy()->subDays($i);
            $dayStart = $day->copy()->startOfDay();
            $dayEnd = $day->copy()->endOfDay();

            $completedCount = Task::where('user_id', $userId)
                ->where('status', 'completed')
                ->whereBetween('completed_at', [$dayStart, $dayEnd])
                ->count();

            $weeklyProductivity[] = [
                'day' => $day->format('D'),
                'date' => $day->format('Y-m-d'),
                'completed' => $completedCount,
            ];
        }

        $summary = [
            'total_tasks' => $totalTasks,
            'completed_tasks' => $completedTasks,
            'pending_tasks' => $inProgressTasks,
            'overdue_tasks' => $overdueTasks,
            'completion_rate' => $taskCompletionRate,
            'active_projects_count' => $activeProjects->count(),
            'average_project_progress' => $avgProjectProgress,
            'upcoming_exams_count' => $upcomingExams->count(),
        ];

        return response()->json([
            'success' => true,
            'data' => [
                'summary' => $summary,
                'metrics' => [
                    'tasks_completed_count' => $completedTasks,
                    'tasks_in_progress_count' => $inProgressTasks,
                    'tasks_total_count' => $totalTasks,
                    'overdue_tasks_count' => $overdueTasks,
                    'completion_rate_percentage' => $taskCompletionRate,
                    'active_projects_count' => $activeProjects->count(),
                    'average_project_progress' => $avgProjectProgress,
                    'active_habit_streaks' => $habits->max('current_streak') ?? 0,
                    'goals_active_count' => $activeGoals->count(),
                    'average_goal_progress' => $avgGoalProgress,
                    'total_study_hours' => $totalStudyHours,
                    'upcoming_examinations_count' => $upcomingExams->count(),
                    'unread_notifications_count' => $unreadNotificationsCount,
                ],
                'today_tasks' => $todayTasks,
                'upcoming_deadlines' => $upcomingDeadlines,
                'active_projects' => $activeProjects,
                'habits' => $habitItems,
                'goals' => $activeGoals,
                'active_courses' => $activeCourses,
                'upcoming_examinations' => $upcomingExams,
                'recent_exam_results' => $recentExamAttempts,
                'recent_notifications' => $recentNotifications,
                'weekly_productivity' => $weeklyProductivity,
            ],
        ]);
    }
}
