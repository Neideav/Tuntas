<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Course;
use App\Models\ExamAttempt;
use App\Models\Examination;
use App\Models\Goal;
use App\Models\Habit;
use App\Models\HabitLog;
use App\Models\LearningSession;
use App\Models\Project;
use App\Models\Task;
use Carbon\Carbon;
use Illuminate\Http\Request;

class AnalyticsController extends Controller
{
    /**
     * Compute comprehensive multi-dimensional productivity analytics.
     */
    public function productivity(Request $request)
    {
        $userId = $request->user()->id;
        $now = Carbon::now();

        // 1. Task Completion & Overview
        $totalTasks = Task::where('user_id', $userId)->count();
        $completedTasks = Task::where('user_id', $userId)->where('status', 'completed')->count();
        $inProgressTasks = Task::where('user_id', $userId)->whereIn('status', ['todo', 'in_progress', 'in_review'])->count();
        $overdueTasks = Task::where('user_id', $userId)
            ->whereIn('status', ['todo', 'in_progress'])
            ->whereNotNull('due_date')
            ->where('due_date', '<', $now)
            ->count();

        $completionRate = $totalTasks > 0 ? round(($completedTasks / $totalTasks) * 100, 1) : 0.0;

        // 2. Task Distribution
        $byPriority = [
            'urgent' => Task::where('user_id', $userId)->where('priority', 'urgent')->count(),
            'high' => Task::where('user_id', $userId)->where('priority', 'high')->count(),
            'medium' => Task::where('user_id', $userId)->where('priority', 'medium')->count(),
            'low' => Task::where('user_id', $userId)->where('priority', 'low')->count(),
        ];

        $byStatus = [
            'todo' => Task::where('user_id', $userId)->where('status', 'todo')->count(),
            'in_progress' => Task::where('user_id', $userId)->where('status', 'in_progress')->count(),
            'in_review' => Task::where('user_id', $userId)->where('status', 'in_review')->count(),
            'completed' => Task::where('user_id', $userId)->where('status', 'completed')->count(),
        ];

        $byCategory = Category::where('user_id', $userId)
            ->withCount('tasks')
            ->get()
            ->map(fn($c) => [
                'id' => $c->id,
                'name' => $c->name,
                'color' => $c->color,
                'count' => $c->tasks_count,
            ]);

        // 3. Project Progress
        $allProjects = Project::where('user_id', $userId)->get();
        $totalProjects = $allProjects->count();
        $completedProjects = $allProjects->where('status', 'completed')->count();
        $activeProjects = $allProjects->whereIn('status', ['planning', 'in_progress'])->count();
        $avgProjectProgress = $totalProjects > 0 ? round($allProjects->avg('progress'), 1) : 0.0;

        // 4. Habit Consistency
        $habits = Habit::where('user_id', $userId)->where('is_archived', false)->get();
        $totalHabits = $habits->count();
        $habitsOnStreak = $habits->where('current_streak', '>', 0)->count();
        $bestStreak = $habits->max('best_streak') ?? 0;
        $totalFreezeTokens = (int) $habits->sum('freeze_tokens');

        $thirtyDaysAgo = Carbon::today()->subDays(30)->toDateString();
        $recentHabitLogs = HabitLog::where('user_id', $userId)
            ->where('log_date', '>=', $thirtyDaysAgo)
            ->where('is_completed', true)
            ->count();
        $possibleHabitEvents = max(1, $totalHabits * 30);
        $habitConsistencyRate = round(($recentHabitLogs / $possibleHabitEvents) * 100, 1);

        // 5. Goal Progress
        $goals = Goal::where('user_id', $userId)->get();
        $totalGoals = $goals->count();
        $achievedGoals = $goals->where('status', 'achieved')->count();
        $avgGoalProgress = $totalGoals > 0 ? round($goals->avg('progress'), 1) : 0.0;

        // 6. Calendar Activity (Current Month)
        $startOfMonth = $now->copy()->startOfMonth();
        $endOfMonth = $now->copy()->endOfMonth();

        $monthTasks = Task::where('user_id', $userId)->whereBetween('due_date', [$startOfMonth, $endOfMonth])->count();
        $monthProjects = Project::where('user_id', $userId)->whereBetween('deadline', [$startOfMonth->toDateString(), $endOfMonth->toDateString()])->count();
        $monthExams = Examination::where('user_id', $userId)->whereBetween('examination_date', [$startOfMonth->toDateString(), $endOfMonth->toDateString()])->count();

        return response()->json([
            'success' => true,
            'data' => [
                'task_metrics' => [
                    'total_tasks' => $totalTasks,
                    'completed_tasks' => $completedTasks,
                    'in_progress_tasks' => $inProgressTasks,
                    'overdue_tasks' => $overdueTasks,
                    'completion_rate' => $completionRate,
                ],
                'task_distribution' => [
                    'by_priority' => $byPriority,
                    'by_status' => $byStatus,
                    'by_category' => $byCategory,
                ],
                'project_metrics' => [
                    'total_projects' => $totalProjects,
                    'completed_projects' => $completedProjects,
                    'active_projects' => $activeProjects,
                    'average_progress' => $avgProjectProgress,
                ],
                'habit_metrics' => [
                    'total_habits' => $totalHabits,
                    'habits_on_streak' => $habitsOnStreak,
                    'best_streak' => $bestStreak,
                    'total_freeze_tokens' => $totalFreezeTokens,
                    'consistency_rate' => $habitConsistencyRate,
                ],
                'goal_metrics' => [
                    'total_goals' => $totalGoals,
                    'achieved_goals' => $achievedGoals,
                    'average_progress' => $avgGoalProgress,
                ],
                'calendar_activity' => [
                    'month_tasks_count' => $monthTasks,
                    'month_projects_count' => $monthProjects,
                    'month_exams_count' => $monthExams,
                    'month_total_events' => $monthTasks + $monthProjects + $monthExams,
                ],
            ],
        ]);
    }

    /**
     * Compute comprehensive learning & examination analytics.
     */
    public function learning(Request $request)
    {
        $userId = $request->user()->id;

        // 1. Study Sessions
        $sessions = LearningSession::where('user_id', $userId)->get();
        $totalMinutes = (int) $sessions->sum('duration_minutes');
        $totalSessions = $sessions->count();

        $thirtyDaysAgo = Carbon::today()->subDays(30)->toDateString();
        $activeStudyDays = LearningSession::where('user_id', $userId)
            ->where('session_date', '>=', $thirtyDaysAgo)
            ->distinct('session_date')
            ->count('session_date');

        // 2. Subjects (Courses) Progress
        $courses = Course::where('user_id', $userId)->with('modules.lessons')->get();
        $subjectsBreakdown = $courses->map(function ($c) {
            $allLessons = $c->modules->flatMap->lessons;
            return [
                'id' => $c->id,
                'title' => $c->title,
                'code' => $c->code,
                'color' => $c->color,
                'progress' => $c->progress,
                'modules_count' => $c->modules->count(),
                'total_lessons' => $allLessons->count(),
                'completed_lessons' => $allLessons->where('is_completed', true)->count(),
            ];
        });

        // 3. Dedicated Examination Performance
        $attempts = ExamAttempt::where('user_id', $userId)
            ->where('status', 'completed')
            ->with('blueprint')
            ->orderBy('submitted_at', 'desc')
            ->get();

        $totalAttempts = $attempts->count();
        $passedAttempts = $attempts->where('is_passed', true)->count();
        $failedAttempts = $totalAttempts - $passedAttempts;
        $passRate = $totalAttempts > 0 ? round(($passedAttempts / $totalAttempts) * 100, 1) : 0.0;
        $avgScore = $totalAttempts > 0 ? round($attempts->avg('score_percentage'), 1) : 0.0;

        $scoreDistribution = [
            'below_50' => $attempts->where('score_percentage', '<', 50)->count(),
            'range_50_69' => $attempts->whereBetween('score_percentage', [50, 69.99])->count(),
            'range_70_84' => $attempts->whereBetween('score_percentage', [70, 84.99])->count(),
            'range_85_100' => $attempts->where('score_percentage', '>=', 85)->count(),
        ];

        return response()->json([
            'success' => true,
            'data' => [
                'study_statistics' => [
                    'total_study_minutes' => $totalMinutes,
                    'total_study_hours' => round($totalMinutes / 60, 1),
                    'total_sessions' => $totalSessions,
                    'consistency_days_30' => $activeStudyDays,
                ],
                'subjects_breakdown' => $subjectsBreakdown,
                'examination_performance' => [
                    'total_attempts' => $totalAttempts,
                    'passed_attempts' => $passedAttempts,
                    'failed_attempts' => $failedAttempts,
                    'pass_rate' => $passRate,
                    'average_score' => $avgScore,
                    'score_distribution' => $scoreDistribution,
                    'recent_results' => $attempts->take(10)->map(fn($a) => [
                        'id' => $a->id,
                        'title' => $a->blueprint?->title ?? 'Exam',
                        'subject' => $a->blueprint?->subject ?? 'General',
                        'score_percentage' => $a->score_percentage,
                        'is_passed' => $a->is_passed,
                        'submitted_at' => $a->submitted_at?->toIso8601String(),
                    ]),
                ],
            ],
        ]);
    }
}

