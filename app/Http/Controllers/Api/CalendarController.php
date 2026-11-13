<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Examination;
use App\Models\Project;
use App\Models\Task;
use Carbon\Carbon;
use Illuminate\Http\Request;

class CalendarController extends Controller
{
    /**
     * Retrieve aggregated calendar events across Tasks, Projects, and Examinations.
     */
    public function index(Request $request)
    {
        $userId = $request->user()->id;

        $startDate = $request->filled('start')
            ? Carbon::parse($request->start)->startOfDay()
            : Carbon::now()->startOfMonth()->subDays(7);

        $endDate = $request->filled('end')
            ? Carbon::parse($request->end)->endOfDay()
            : Carbon::now()->endOfMonth()->addDays(7);

        $events = [];

        // 1. Task Deadlines
        $tasks = Task::where('user_id', $userId)
            ->whereNotNull('due_date')
            ->whereBetween('due_date', [$startDate, $endDate])
            ->with(['category', 'project'])
            ->get();

        foreach ($tasks as $task) {
            $events[] = [
                'id' => "task-{$task->id}",
                'title' => $task->title,
                'type' => 'task',
                'start' => $task->due_date->toIso8601String(),
                'status' => $task->status,
                'priority' => $task->priority,
                'color' => '#06b6d4', // Cyan
                'reference_id' => $task->id,
                'category' => $task->category?->name,
                'project' => $task->project?->title,
            ];
        }

        // 2. Project Deadlines
        $projects = Project::where('user_id', $userId)
            ->whereNotNull('deadline')
            ->whereBetween('deadline', [$startDate->toDateString(), $endDate->toDateString()])
            ->get();

        foreach ($projects as $project) {
            $events[] = [
                'id' => "project-{$project->id}",
                'title' => "Proyek: {$project->title}",
                'type' => 'project',
                'start' => Carbon::parse($project->deadline)->toIso8601String(),
                'status' => $project->status,
                'priority' => $project->priority,
                'color' => '#3b82f6', // Blue
                'reference_id' => $project->id,
            ];
        }

        // 3. Examination Schedules (Dedicated Subsystem)
        $examinations = Examination::where('user_id', $userId)
            ->whereBetween('examination_date', [$startDate->toDateString(), $endDate->toDateString()])
            ->get();

        foreach ($examinations as $exam) {
            $start = $exam->examination_date->format('Y-m-d');
            if ($exam->start_time) {
                $start .= ' ' . $exam->start_time;
            }

            $events[] = [
                'id' => "exam-{$exam->id}",
                'title' => "Exam: {$exam->title} ({$exam->subject})",
                'type' => 'examination',
                'start' => Carbon::parse($start)->toIso8601String(),
                'status' => $exam->status,
                'duration_minutes' => $exam->duration_minutes,
                'color' => '#f59e0b', // Amber
                'reference_id' => $exam->id,
            ];
        }

        // 4. Habit Completions on Calendar
        $habitLogs = \App\Models\HabitLog::where('user_id', $userId)
            ->where('is_completed', true)
            ->whereBetween('log_date', [$startDate->toDateString(), $endDate->toDateString()])
            ->with('habit')
            ->get();

        foreach ($habitLogs as $log) {
            if ($log->habit) {
                $events[] = [
                    'id' => "habit-log-{$log->id}",
                    'title' => "Habit Done: {$log->habit->title}",
                    'type' => 'habit',
                    'start' => Carbon::parse($log->log_date)->toIso8601String(),
                    'status' => 'completed',
                    'color' => '#10b981', // Emerald
                    'reference_id' => $log->habit_id,
                ];
            }
        }

        // 5. LMS Study Sessions
        $studySessions = \App\Models\LearningSession::where('user_id', $userId)
            ->whereBetween('session_date', [$startDate->toDateString(), $endDate->toDateString()])
            ->with('course')
            ->get();

        foreach ($studySessions as $session) {
            $events[] = [
                'id' => "session-{$session->id}",
                'title' => "Study: {$session->topic}" . ($session->course ? " ({$session->course->title})" : ""),
                'type' => 'learning_session',
                'start' => Carbon::parse($session->session_date)->toIso8601String(),
                'status' => 'completed',
                'duration_minutes' => $session->duration_minutes,
                'color' => '#8b5cf6', // Violet
                'reference_id' => $session->id,
            ];
        }

        return response()->json([
            'success' => true,
            'data' => $events,
        ]);
    }
}

