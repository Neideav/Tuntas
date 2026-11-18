<?php

namespace App\Services;

use App\Models\Category;
use App\Models\Course;
use App\Models\ExamAnswer;
use App\Models\ExamAttempt;
use App\Models\Examination;
use App\Models\Goal;
use App\Models\Habit;
use App\Models\HabitLog;
use App\Models\LearningLesson;
use App\Models\LearningSession;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class AnalyticsService
{
    /**
     * Parse date range parameters into start, end, and previous comparison window.
     */
    public function resolveDateRange(array $params, string $timezone = 'UTC'): array
    {
        try {
            $now = Carbon::now($timezone);
        } catch (\Exception $e) {
            $now = Carbon::now('UTC');
        }

        $range = $params['range'] ?? 'this_month';
        $startDate = null;
        $endDate = null;

        switch ($range) {
            case 'today':
                $startDate = $now->copy()->startOfDay();
                $endDate = $now->copy()->endOfDay();
                $prevStart = $startDate->copy()->subDay();
                $prevEnd = $endDate->copy()->subDay();
                break;

            case 'this_week':
                $startDate = $now->copy()->startOfWeek();
                $endDate = $now->copy()->endOfWeek();
                $days = $startDate->diffInDays($endDate) + 1;
                $prevStart = $startDate->copy()->subDays($days);
                $prevEnd = $endDate->copy()->subDays($days);
                break;

            case 'last_30_days':
                $startDate = $now->copy()->subDays(29)->startOfDay();
                $endDate = $now->copy()->endOfDay();
                $prevStart = $startDate->copy()->subDays(30);
                $prevEnd = $endDate->copy()->subDays(30);
                break;

            case 'custom':
                if (!empty($params['start_date']) && !empty($params['end_date'])) {
                    $startDate = Carbon::parse($params['start_date'], $timezone)->startOfDay();
                    $endDate = Carbon::parse($params['end_date'], $timezone)->endOfDay();
                    $days = max(1, $startDate->diffInDays($endDate) + 1);
                    $prevStart = $startDate->copy()->subDays($days);
                    $prevEnd = $endDate->copy()->subDays($days);
                } else {
                    $startDate = $now->copy()->startOfMonth();
                    $endDate = $now->copy()->endOfMonth();
                    $prevStart = $startDate->copy()->subMonth();
                    $prevEnd = $endDate->copy()->subMonth();
                }
                break;

            case 'this_month':
            default:
                $range = 'this_month';
                $startDate = $now->copy()->startOfMonth();
                $endDate = $now->copy()->endOfMonth();
                $prevStart = $startDate->copy()->subMonth();
                $prevEnd = $endDate->copy()->subMonth();
                break;
        }

        return [
            'range' => $range,
            'start' => $startDate,
            'end' => $endDate,
            'prev_start' => $prevStart,
            'prev_end' => $prevEnd,
            'now' => $now,
            'timezone' => $timezone,
        ];
    }

    /**
     * Compute full-suite productivity analytics with trend, workload, and rule-based insights.
     */
    public function getProductivityAnalytics(User $user, array $params = []): array
    {
        $userId = $user->id;
        $window = $this->resolveDateRange($params, $user->settings->timezone ?? 'UTC');
        $start = $window['start'];
        $end = $window['end'];
        $prevStart = $window['prev_start'];
        $prevEnd = $window['prev_end'];
        $now = $window['now'];

        $projectId = !empty($params['project_id']) ? (int) $params['project_id'] : null;
        $categoryId = !empty($params['category_id']) ? (int) $params['category_id'] : null;

        // Base query for tasks
        $taskQuery = Task::where('user_id', $userId);
        if ($projectId) {
            $taskQuery->where('project_id', $projectId);
        }
        if ($categoryId) {
            $taskQuery->where('category_id', $categoryId);
        }

        $allTasks = (clone $taskQuery)->get();
        $totalTasks = $allTasks->count();
        $completedTasks = $allTasks->where('status', 'completed')->count();
        $inProgressTasks = $allTasks->whereIn('status', ['todo', 'in_progress', 'in_review'])->count();
        $overdueTasks = $allTasks->whereIn('status', ['todo', 'in_progress'])
            ->filter(fn($t) => $t->due_date && Carbon::parse($t->due_date)->lt($now))
            ->count();

        $completionRate = $totalTasks > 0 ? round(($completedTasks / $totalTasks) * 100, 1) : 0.0;

        // Priority Breakdown
        $byPriority = [
            'urgent' => $allTasks->where('priority', 'urgent')->count(),
            'high' => $allTasks->where('priority', 'high')->count(),
            'medium' => $allTasks->where('priority', 'medium')->count(),
            'low' => $allTasks->where('priority', 'low')->count(),
        ];

        // Status Breakdown
        $byStatus = [
            'todo' => $allTasks->where('status', 'todo')->count(),
            'in_progress' => $allTasks->where('status', 'in_progress')->count(),
            'in_review' => $allTasks->where('status', 'in_review')->count(),
            'completed' => $completedTasks,
        ];

        // Category breakdown
        $byCategory = Category::where('user_id', $userId)
            ->withCount('tasks')
            ->get()
            ->map(fn($c) => [
                'id' => $c->id,
                'name' => $c->name,
                'color' => $c->color,
                'count' => $c->tasks_count,
            ]);

        // Planned vs Completed in period
        $plannedInPeriod = (clone $taskQuery)->whereBetween('due_date', [$start, $end])->count();
        $completedInPeriod = (clone $taskQuery)->where('status', 'completed')
            ->whereBetween('completed_at', [$start, $end])
            ->count();

        // 7-day completion trend for velocity visualization
        $sevenDaysAgo = $now->copy()->subDays(6)->startOfDay();
        $trendTasks = (clone $taskQuery)->where('status', 'completed')
            ->where('completed_at', '>=', $sevenDaysAgo)
            ->get(['completed_at']);

        $weeklyTrend = [];
        for ($i = 6; $i >= 0; $i--) {
            $day = $now->copy()->subDays($i);
            $dateStr = $day->format('Y-m-d');
            $cCount = $trendTasks->filter(function ($t) use ($dateStr) {
                return $t->completed_at && Carbon::parse($t->completed_at)->format('Y-m-d') === $dateStr;
            })->count();

            $weeklyTrend[] = [
                'date' => $dateStr,
                'day' => $day->format('D'),
                'count' => $cCount,
            ];
        }

        // Previous Period Overdue (for rule-based comparison)
        $prevOverdueCount = Task::where('user_id', $userId)
            ->whereIn('status', ['todo', 'in_progress'])
            ->whereNotNull('due_date')
            ->where('due_date', '<', $prevEnd)
            ->count();

        // Project Metrics
        $projectQuery = Project::where('user_id', $userId);
        if ($projectId) {
            $projectQuery->where('id', $projectId);
        }
        $allProjects = $projectQuery->with('milestones')->get();
        $totalProjects = $allProjects->count();
        $activeProjects = $allProjects->whereIn('status', ['planning', 'in_progress'])->count();
        $completedProjects = $allProjects->where('status', 'completed')->count();
        $delayedProjects = $allProjects->whereIn('status', ['planning', 'in_progress'])
            ->filter(fn($p) => $p->deadline && Carbon::parse($p->deadline)->lt($now))
            ->count();
        $avgProjectProgress = $totalProjects > 0 ? round($allProjects->avg('progress'), 1) : 0.0;

        $allMilestones = $allProjects->flatMap->milestones;
        $totalMilestones = $allMilestones->count();
        $completedMilestones = $allMilestones->where('is_completed', true)->count();
        $milestoneRate = $totalMilestones > 0 ? round(($completedMilestones / $totalMilestones) * 100, 1) : 0.0;

        // Habit Metrics
        $habits = Habit::where('user_id', $userId)->where('is_archived', false)->get();
        $totalHabits = $habits->count();
        $habitsOnStreak = $habits->where('current_streak', '>', 0)->count();
        $bestStreak = $habits->max('best_streak') ?? 0;
        $totalFreezeTokens = (int) $habits->sum('freeze_tokens');

        $thirtyDaysAgo = $now->copy()->subDays(29)->startOfDay();
        $recentHabitLogs = HabitLog::where('user_id', $userId)
            ->where('log_date', '>=', $thirtyDaysAgo->toDateString())
            ->where('is_completed', true)
            ->count();

        $prevThirtyDaysAgo = $thirtyDaysAgo->copy()->subDays(30);
        $prevHabitLogs = HabitLog::where('user_id', $userId)
            ->whereBetween('log_date', [$prevThirtyDaysAgo->toDateString(), $thirtyDaysAgo->toDateString()])
            ->where('is_completed', true)
            ->count();

        $possibleHabitEvents = max(1, $totalHabits * 30);
        $habitConsistencyRate = round(($recentHabitLogs / $possibleHabitEvents) * 100, 1);
        $prevHabitConsistencyRate = round(($prevHabitLogs / $possibleHabitEvents) * 100, 1);

        $habitComparison = $habits->sortByDesc('current_streak')->take(5)->map(fn($h) => [
            'id' => $h->id,
            'title' => $h->title,
            'frequency' => $h->frequency,
            'current_streak' => $h->current_streak,
            'best_streak' => $h->best_streak,
            'color' => $h->color,
        ])->values()->all();

        // Goal Metrics
        $goals = Goal::where('user_id', $userId)->with('milestones')->get();
        $totalGoals = $goals->count();
        $achievedGoals = $goals->where('status', 'achieved')->count();
        $activeGoals = $goals->whereIn('status', ['not_started', 'in_progress'])->count();
        $avgGoalProgress = $totalGoals > 0 ? round($goals->avg('progress'), 1) : 0.0;

        $goalMilestones = $goals->flatMap->milestones;
        $totalGoalMilestones = $goalMilestones->count();
        $completedGoalMilestones = $goalMilestones->where('is_completed', true)->count();

        // Learning & Exams Overview (for unified analytics matrix)
        $learningSessions = LearningSession::where('user_id', $userId)->get();
        $totalStudyMinutes = (int) $learningSessions->sum('duration_minutes');
        $totalStudyHours = round($totalStudyMinutes / 60, 1);

        $examAttempts = ExamAttempt::where('user_id', $userId)->where('status', 'completed')->get();
        $totalAttempts = $examAttempts->count();
        $passedAttempts = $examAttempts->where('is_passed', true)->count();
        $avgScore = $totalAttempts > 0 ? round($examAttempts->avg('score_percentage'), 1) : 0.0;
        $passRate = $totalAttempts > 0 ? round(($passedAttempts / $totalAttempts) * 100, 1) : 0.0;

        // Generate Traceable Rule-Based Insights
        $insights = $this->generateRuleBasedInsights([
            'overdue_tasks' => $overdueTasks,
            'prev_overdue_tasks' => $prevOverdueCount,
            'habit_consistency' => $habitConsistencyRate,
            'prev_habit_consistency' => $prevHabitConsistencyRate,
            'max_habit_streak' => $habits->max('current_streak') ?? 0,
            'best_habit_title' => $habits->sortByDesc('current_streak')->first()?->title,
            'delayed_projects' => $delayedProjects,
            'active_goals_near_complete' => $goals->filter(fn($g) => $g->progress >= 80 && $g->progress < 100)->first(),
            'total_study_hours' => $totalStudyHours,
        ]);

        return [
            // Unified keys matching frontend expectations:
            'tasks' => [
                'total' => $totalTasks,
                'completed' => $completedTasks,
                'in_progress' => $inProgressTasks,
                'overdue' => $overdueTasks,
                'completion_rate' => $completionRate,
                'by_status' => $byStatus,
                'by_priority' => $byPriority,
                'by_category' => $byCategory,
                'planned_vs_completed' => [
                    'planned_in_period' => $plannedInPeriod,
                    'completed_in_period' => $completedInPeriod,
                ],
                'weekly_trend' => $weeklyTrend,
            ],
            'projects' => [
                'total' => $totalProjects,
                'active' => $activeProjects,
                'completed' => $completedProjects,
                'delayed' => $delayedProjects,
                'avg_progress' => $avgProjectProgress,
                'milestones' => [
                    'total' => $totalMilestones,
                    'completed' => $completedMilestones,
                    'completion_rate' => $milestoneRate,
                ],
            ],
            'habits' => [
                'total' => $totalHabits,
                'active_streaks' => $habitsOnStreak,
                'best_streak' => $bestStreak,
                'completion_rate_30_days' => $habitConsistencyRate,
                'total_freeze_tokens' => $totalFreezeTokens,
                'ranked_habits' => $habitComparison,
            ],
            'goals' => [
                'total' => $totalGoals,
                'active' => $activeGoals,
                'achieved' => $achievedGoals,
                'avg_progress' => $avgGoalProgress,
                'milestones' => [
                    'total' => $totalGoalMilestones,
                    'completed' => $completedGoalMilestones,
                ],
            ],
            'learning' => [
                'total_hours' => $totalStudyHours,
                'total_minutes' => $totalStudyMinutes,
                'total_sessions' => $learningSessions->count(),
            ],
            'examinations' => [
                'total_attempts' => $totalAttempts,
                'passed_attempts' => $passedAttempts,
                'avg_score' => $avgScore,
                'pass_rate' => $passRate,
            ],
            'insights' => $insights,
            'date_range' => [
                'range' => $window['range'],
                'start' => $start->toDateString(),
                'end' => $end->toDateString(),
            ],

            // Backward compatibility aliases
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
        ];
    }

    /**
     * Compute comprehensive learning and exam performance analytics.
     */
    public function getLearningAnalytics(User $user, array $params = []): array
    {
        $userId = $user->id;
        $window = $this->resolveDateRange($params, $user->settings->timezone ?? 'UTC');
        $start = $window['start'];
        $end = $window['end'];
        $courseId = !empty($params['course_id']) ? (int) $params['course_id'] : null;

        // 1. Study Sessions Activity Query (Effort)
        $sessionQuery = LearningSession::where('user_id', $userId);
        if ($courseId) {
            $sessionQuery->where('course_id', $courseId);
        }
        $allSessions = (clone $sessionQuery)->get();
        $totalMinutes = (int) $allSessions->sum('duration_minutes');
        $totalSessions = $allSessions->count();

        // Active study days in the period
        $periodSessions = (clone $sessionQuery)->whereBetween('session_date', [$start->toDateString(), $end->toDateString()])->get();
        $activeDays = $periodSessions->pluck('session_date')->unique()->count();

        // Trend over days in the period
        $trendMap = $periodSessions->groupBy('session_date');
        $studySessionTrend = [];
        $cursor = $start->copy();
        while ($cursor->lte($end)) {
            $dStr = $cursor->toDateString();
            $daySessions = $trendMap->get($dStr, collect());
            $studySessionTrend[] = [
                'date' => $dStr,
                'day' => $cursor->format('D'),
                'minutes' => (int) $daySessions->sum('duration_minutes'),
                'sessions_count' => $daySessions->count(),
            ];
            $cursor->addDay();
        }

        // Study time per course
        $timePerCourse = Course::where('user_id', $userId)
            ->with('learningSessions')
            ->get()
            ->map(function ($c) {
                $mins = (int) $c->learningSessions->sum('duration_minutes');
                return [
                    'course_id' => $c->id,
                    'title' => $c->title,
                    'color' => $c->color,
                    'duration_minutes' => $mins,
                    'duration_hours' => round($mins / 60, 1),
                    'sessions_count' => $c->learningSessions->count(),
                ];
            });

        // 2. Learning Outcome Metrics (Attainment)
        $courseQuery = Course::where('user_id', $userId)->with('modules.lessons');
        if ($courseId) {
            $courseQuery->where('id', $courseId);
        }
        $courses = $courseQuery->get();
        $coursesOverview = $courses->map(function ($c) {
            $allLessons = $c->modules->flatMap->lessons;
            return [
                'id' => $c->id,
                'title' => $c->title,
                'code' => $c->code,
                'color' => $c->color,
                'status' => $c->status ?? 'published',
                'progress' => $c->progress,
                'modules_count' => $c->modules->count(),
                'total_lessons' => $allLessons->count(),
                'completed_lessons' => $allLessons->where('is_completed', true)->count(),
            ];
        });

        $totalCourses = $courses->count();
        $completedCourses = $courses->where('progress', 100)->count();
        $allLessonsFlat = $courses->flatMap(fn($c) => $c->modules->flatMap->lessons);
        $totalLessons = $allLessonsFlat->count();
        $completedLessons = $allLessonsFlat->where('is_completed', true)->count();

        // 3. Exam Analytics (Attainment & Mastery)
        $attempts = ExamAttempt::where('user_id', $userId)
            ->where('status', 'completed')
            ->with(['blueprint', 'answers'])
            ->orderBy('submitted_at', 'desc')
            ->get();

        $totalAttempts = $attempts->count();
        $passedAttempts = $attempts->where('is_passed', true)->count();
        $failedAttempts = $totalAttempts - $passedAttempts;
        $passRate = $totalAttempts > 0 ? round(($passedAttempts / $totalAttempts) * 100, 1) : 0.0;
        $avgScore = $totalAttempts > 0 ? round($attempts->avg('score_percentage'), 1) : 0.0;
        $highestScore = $totalAttempts > 0 ? round($attempts->max('score_percentage'), 1) : 0.0;
        $lowestScore = $totalAttempts > 0 ? round($attempts->min('score_percentage'), 1) : 0.0;

        // Completion duration in minutes
        $durations = $attempts->map(function ($a) {
            if ($a->started_at && $a->submitted_at) {
                return max(1, round(Carbon::parse($a->started_at)->diffInMinutes($a->submitted_at)));
            }
            return null;
        })->filter();
        $avgDurationMinutes = $durations->count() > 0 ? round($durations->avg(), 1) : 0.0;

        $scoreDistribution = [
            'below_50' => $attempts->where('score_percentage', '<', 50)->count(),
            'range_50_69' => $attempts->whereBetween('score_percentage', [50, 69.99])->count(),
            'range_70_84' => $attempts->whereBetween('score_percentage', [70, 84.99])->count(),
            'range_85_100' => $attempts->where('score_percentage', '>=', 85)->count(),
        ];

        // Performance per topic/subject
        $performancePerSubject = $attempts->groupBy(fn($a) => $a->blueprint?->subject ?? 'General')
            ->map(function ($grp, $subject) {
                $cnt = $grp->count();
                $passed = $grp->where('is_passed', true)->count();
                return [
                    'subject' => $subject,
                    'attempts_count' => $cnt,
                    'average_score' => round($grp->avg('score_percentage'), 1),
                    'pass_rate' => $cnt > 0 ? round(($passed / $cnt) * 100, 1) : 0.0,
                ];
            })->values()->all();

        // Question accuracy & difficulty analysis (evaluated purely from completed attempts without leaking answer keys)
        $questionAccuracyList = [];
        $allAnswers = $attempts->flatMap->answers;
        if ($allAnswers->count() > 0) {
            $groupedByQ = $allAnswers->groupBy('question_id');
            foreach ($groupedByQ as $qId => $answersForQ) {
                $qAttempts = $answersForQ->count();
                $qCorrect = $answersForQ->where('is_correct', true)->count();
                $accuracy = round(($qCorrect / $qAttempts) * 100, 1);

                $difficultyCategory = 'medium';
                if ($accuracy >= 75.0) {
                    $difficultyCategory = 'easy';
                } elseif ($accuracy < 40.0) {
                    $difficultyCategory = 'hard';
                }

                $questionAccuracyList[] = [
                    'question_id' => $qId,
                    'attempts_count' => $qAttempts,
                    'correct_count' => $qCorrect,
                    'accuracy_percentage' => $accuracy,
                    'difficulty_category' => $difficultyCategory,
                ];
            }
        }

        return [
            'activity_metrics' => [
                'total_study_minutes' => $totalMinutes,
                'total_study_hours' => round($totalMinutes / 60, 1),
                'total_sessions' => $totalSessions,
                'consistency_days_in_period' => $activeDays,
                'study_session_trend' => $studySessionTrend,
                'study_time_per_course' => $timePerCourse,
            ],
            'outcome_metrics' => [
                'courses_total' => $totalCourses,
                'courses_completed' => $completedCourses,
                'course_completion_rate' => $totalCourses > 0 ? round(($completedCourses / $totalCourses) * 100, 1) : 0.0,
                'lessons_total' => $totalLessons,
                'lessons_completed' => $completedLessons,
                'lesson_completion_rate' => $totalLessons > 0 ? round(($completedLessons / $totalLessons) * 100, 1) : 0.0,
                'courses_overview' => $coursesOverview,
            ],
            'examination_analytics' => [
                'total_attempts' => $totalAttempts,
                'passed_attempts' => $passedAttempts,
                'failed_attempts' => $failedAttempts,
                'pass_rate' => $passRate,
                'average_score' => $avgScore,
                'highest_score' => $highestScore,
                'lowest_score' => $lowestScore,
                'average_duration_minutes' => $avgDurationMinutes,
                'score_distribution' => $scoreDistribution,
                'performance_per_subject' => $performancePerSubject,
                'question_accuracy' => array_slice($questionAccuracyList, 0, 20),
                'score_trend' => $attempts->take(15)->map(fn($a) => [
                    'id' => $a->id,
                    'title' => $a->blueprint?->title ?? 'Exam Attempt',
                    'subject' => $a->blueprint?->subject ?? 'General',
                    'score_percentage' => $a->score_percentage,
                    'is_passed' => $a->is_passed,
                    'submitted_at' => $a->submitted_at?->toIso8601String(),
                ]),
            ],
            'examination_performance' => [
                'total_attempts' => $totalAttempts,
                'passed_attempts' => $passedAttempts,
                'failed_attempts' => $failedAttempts,
                'pass_rate' => $passRate,
                'average_score' => $avgScore,
                'score_distribution' => $scoreDistribution,
            ],

            // Backward compatibility
            'study_statistics' => [
                'total_study_minutes' => $totalMinutes,
                'total_study_hours' => round($totalMinutes / 60, 1),
                'total_sessions' => $totalSessions,
                'consistency_days_30' => $activeDays,
            ],
            'subjects_breakdown' => $coursesOverview,
            'recent_exam_results' => $attempts->take(10)->map(fn($att) => [
                'id' => $att->id,
                'title' => $att->blueprint?->title ?? 'Exam Attempt',
                'subject' => $att->blueprint?->subject ?? 'General',
                'score_percentage' => $att->score_percentage,
                'is_passed' => $att->is_passed,
                'submitted_at' => $att->submitted_at?->toIso8601String(),
            ]),
        ];
    }

    /**
     * Generate deterministic, fully traceable rule-based insights.
     */
    protected function generateRuleBasedInsights(array $context): array
    {
        $insights = [];

        // Rule 1: Overdue Task Velocity
        $overdue = $context['overdue_tasks'] ?? 0;
        $prevOverdue = $context['prev_overdue_tasks'] ?? 0;
        if ($overdue > $prevOverdue && $overdue > 0) {
            $diff = $overdue - $prevOverdue;
            $insights[] = [
                'id' => 'overdue_increase',
                'type' => 'warning',
                'title' => 'Peningkatan Task Terlambat',
                'message' => "Terdapat {$overdue} task terlambat (+{$diff} dibandingkan periode sebelumnya). Segera jadwalkan ulang atau tuntaskan prioritas utama.",
                'metric' => 'overdue_tasks',
            ];
        } elseif ($overdue === 0 && $prevOverdue > 0) {
            $insights[] = [
                'id' => 'overdue_resolved',
                'type' => 'success',
                'title' => 'Semua Task Tepat Waktu',
                'message' => 'Luar biasa! Tidak ada task yang melewati tenggat waktu pada periode ini.',
                'metric' => 'overdue_tasks',
            ];
        }

        // Rule 2: Habit Consistency Slump or Streak
        $consistency = $context['habit_consistency'] ?? 0.0;
        $prevConsistency = $context['prev_habit_consistency'] ?? 0.0;
        $maxStreak = $context['max_habit_streak'] ?? 0;
        $bestHabit = $context['best_habit_title'] ?? 'Habit Utama';

        if ($maxStreak >= 7) {
            $insights[] = [
                'id' => 'habit_momentum',
                'type' => 'success',
                'title' => 'Momentum Kebiasaan Kuat',
                'message' => "Streak '{$bestHabit}' telah mencapai {$maxStreak} hari berturut-turut. Pertahankan rutinitas harian Anda!",
                'metric' => 'habit_streak',
            ];
        } elseif ($prevConsistency > 0 && ($prevConsistency - $consistency) >= 15.0) {
            $insights[] = [
                'id' => 'habit_slump',
                'type' => 'info',
                'title' => 'Konsistensi Kebiasaan Menurun',
                'message' => "Kepatuhan jadwal kebiasaan Anda tercatat {$consistency}%, turun dari {$prevConsistency}%. Gunakan Freeze Token jika diperlukan.",
                'metric' => 'habit_consistency',
            ];
        }

        // Rule 3: Delayed Project Flag
        $delayedProjects = $context['delayed_projects'] ?? 0;
        if ($delayedProjects > 0) {
            $insights[] = [
                'id' => 'project_delayed',
                'type' => 'warning',
                'title' => 'Proyek Melewati Deadline',
                'message' => "{$delayedProjects} proyek aktif telah melewati tanggal deadline yang direncanakan. Evaluasi kembali alokasi milestone.",
                'metric' => 'delayed_projects',
            ];
        }

        // Rule 4: Goal Near Completion
        if (!empty($context['active_goals_near_complete'])) {
            $g = $context['active_goals_near_complete'];
            $insights[] = [
                'id' => 'goal_near_completion',
                'type' => 'success',
                'title' => 'Target Hampir Tuntas',
                'message' => "Target '{$g->title}' sudah mencapai {$g->progress}%. Sedikit lagi untuk mencapai pencapaian 100%!",
                'metric' => 'goal_progress',
            ];
        }

        // Rule 5: Study Hours Recognition
        $studyHours = $context['total_study_hours'] ?? 0.0;
        if ($studyHours >= 10.0) {
            $insights[] = [
                'id' => 'study_milestone',
                'type' => 'info',
                'title' => 'Dedikasi Belajar Tinggi',
                'message' => "Anda telah mencatat {$studyHours} jam sesi belajar terfokus pada platform Tuntas.",
                'metric' => 'study_hours',
            ];
        }

        return $insights;
    }

    /**
     * Export user data to RFC 4180 compliant CSV stream.
     */
    public function exportCsv(User $user, string $type, array $params = []): string
    {
        $userId = $user->id;
        $output = fopen('php://temp', 'r+');

        switch ($type) {
            case 'tasks':
                fputcsv($output, ['ID', 'Title', 'Status', 'Priority', 'Category', 'Project', 'Due Date', 'Completed At']);
                Task::where('user_id', $userId)
                    ->with(['category', 'project'])
                    ->chunk(100, function ($tasks) use ($output) {
                        foreach ($tasks as $t) {
                            fputcsv($output, [
                                $t->id,
                                $t->title,
                                $t->status,
                                $t->priority,
                                $t->category?->name ?? '-',
                                $t->project?->title ?? '-',
                                $t->due_date ? Carbon::parse($t->due_date)->toIso8601String() : '-',
                                $t->completed_at ? Carbon::parse($t->completed_at)->toIso8601String() : '-',
                            ]);
                        }
                    });
                break;

            case 'projects':
                fputcsv($output, ['ID', 'Title', 'Status', 'Progress (%)', 'Deadline', 'Milestones Count', 'Created At']);
                Project::where('user_id', $userId)
                    ->withCount('milestones')
                    ->chunk(100, function ($projects) use ($output) {
                        foreach ($projects as $p) {
                            fputcsv($output, [
                                $p->id,
                                $p->title,
                                $p->status,
                                $p->progress,
                                $p->deadline ?? '-',
                                $p->milestones_count,
                                $p->created_at->toIso8601String(),
                            ]);
                        }
                    });
                break;

            case 'learning':
                fputcsv($output, ['ID', 'Date', 'Topic', 'Course', 'Duration (Minutes)', 'Status', 'Notes']);
                LearningSession::where('user_id', $userId)
                    ->with('course')
                    ->chunk(100, function ($sessions) use ($output) {
                        foreach ($sessions as $s) {
                            fputcsv($output, [
                                $s->id,
                                $s->session_date,
                                $s->topic,
                                $s->course?->title ?? '-',
                                $s->duration_minutes,
                                $s->status ?? 'completed',
                                $s->notes ?? '-',
                            ]);
                        }
                    });
                break;

            case 'exams':
                fputcsv($output, ['ID', 'Blueprint Title', 'Subject', 'Score (%)', 'Passed', 'Points Earned', 'Points Possible', 'Submitted At']);
                ExamAttempt::where('user_id', $userId)
                    ->where('status', 'completed')
                    ->with('blueprint')
                    ->chunk(100, function ($attempts) use ($output) {
                        foreach ($attempts as $a) {
                            fputcsv($output, [
                                $a->id,
                                $a->blueprint?->title ?? 'Exam',
                                $a->blueprint?->subject ?? 'General',
                                $a->score_percentage,
                                $a->is_passed ? 'YES' : 'NO',
                                $a->total_points_earned,
                                $a->total_points_possible,
                                $a->submitted_at ? Carbon::parse($a->submitted_at)->toIso8601String() : '-',
                            ]);
                        }
                    });
                break;

            case 'productivity':
            default:
                $analytics = $this->getProductivityAnalytics($user, $params);
                fputcsv($output, ['Metric Domain', 'Indicator', 'Value']);
                fputcsv($output, ['Tasks', 'Total Tasks', $analytics['tasks']['total']]);
                fputcsv($output, ['Tasks', 'Completed Tasks', $analytics['tasks']['completed']]);
                fputcsv($output, ['Tasks', 'Overdue Tasks', $analytics['tasks']['overdue']]);
                fputcsv($output, ['Tasks', 'Completion Rate (%)', $analytics['tasks']['completion_rate']]);
                fputcsv($output, ['Projects', 'Active Projects', $analytics['projects']['active']]);
                fputcsv($output, ['Projects', 'Average Progress (%)', $analytics['projects']['avg_progress']]);
                fputcsv($output, ['Habits', 'Active Streaks Count', $analytics['habits']['active_streaks']]);
                fputcsv($output, ['Habits', '30-Day Consistency (%)', $analytics['habits']['completion_rate_30_days']]);
                fputcsv($output, ['Goals', 'Active Goals', $analytics['goals']['active']]);
                fputcsv($output, ['Goals', 'Average Progress (%)', $analytics['goals']['avg_progress']]);
                fputcsv($output, ['Learning', 'Total Focus Study Hours', $analytics['learning']['total_hours']]);
                fputcsv($output, ['Exams', 'Completed Exam Attempts', $analytics['examinations']['total_attempts']]);
                fputcsv($output, ['Exams', 'Average Exam Score (%)', $analytics['examinations']['avg_score']]);
                break;
        }

        rewind($output);
        $csvContent = stream_get_contents($output);
        fclose($output);

        return $csvContent ?: '';
    }
}
