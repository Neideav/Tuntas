<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\ExamAttempt;
use App\Models\LearningLesson;
use App\Models\LearningModule;
use App\Models\LearningSession;
use Carbon\Carbon;
use Illuminate\Http\Request;

class LearningController extends Controller
{
    // ==========================================
    // Courses
    // ==========================================
    public function coursesIndex(Request $request)
    {
        $courses = Course::where('user_id', $request->user()->id)
            ->with(['modules.lessons', 'category'])
            ->orderBy('id', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $courses,
        ]);
    }

    public function coursesStore(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'code' => 'nullable|string|max:50',
            'description' => 'nullable|string',
            'category_id' => 'nullable|exists:categories,id',
            'color' => 'nullable|string|max:50',
        ]);

        $course = Course::create(array_merge($validated, [
            'user_id' => $request->user()->id,
            'color' => $validated['color'] ?? '#3b82f6',
            'progress' => 0,
        ]));

        return response()->json([
            'success' => true,
            'message' => 'Course created successfully',
            'data' => $course,
        ], 201);
    }

    public function coursesShow(Request $request, Course $course)
    {
        if ($course->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $course->load(['modules.lessons', 'category']);

        return response()->json([
            'success' => true,
            'data' => $course,
        ]);
    }

    public function coursesUpdate(Request $request, Course $course)
    {
        if ($course->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'title' => 'sometimes|string|max:255',
            'code' => 'nullable|string|max:50',
            'description' => 'nullable|string',
            'category_id' => 'nullable|exists:categories,id',
            'color' => 'nullable|string|max:50',
            'is_published' => 'nullable|boolean',
        ]);

        $course->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Course updated successfully',
            'data' => $course,
        ]);
    }

    public function coursesDestroy(Request $request, Course $course)
    {
        if ($course->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $course->delete();

        return response()->json([
            'success' => true,
            'message' => 'Course deleted successfully',
        ]);
    }

    // ==========================================
    // Modules
    // ==========================================
    public function modulesStore(Request $request, Course $course)
    {
        if ($course->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'order' => 'nullable|integer',
        ]);

        $maxOrder = $course->modules()->max('order') ?? 0;
        $module = $course->modules()->create([
            'title' => $validated['title'],
            'description' => $validated['description'] ?? null,
            'order' => $validated['order'] ?? ($maxOrder + 1),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Module created successfully',
            'data' => $module,
        ], 201);
    }

    public function modulesUpdate(Request $request, LearningModule $module)
    {
        if ($module->course->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'title' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'order' => 'nullable|integer',
        ]);

        $module->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Module updated successfully',
            'data' => $module,
        ]);
    }

    public function modulesDestroy(Request $request, LearningModule $module)
    {
        if ($module->course->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $course = $module->course;
        $module->delete();
        $course->recalculateProgress();

        return response()->json([
            'success' => true,
            'message' => 'Module deleted successfully',
        ]);
    }

    // ==========================================
    // Lessons
    // ==========================================
    public function lessonsStore(Request $request, LearningModule $module)
    {
        if ($module->course->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'content' => 'nullable|string',
            'resource_url' => 'nullable|string|max:500',
            'duration_minutes' => 'nullable|integer|min:1',
            'order' => 'nullable|integer',
        ]);

        $maxOrder = $module->lessons()->max('order') ?? 0;
        $lesson = $module->lessons()->create([
            'title' => $validated['title'],
            'content' => $validated['content'] ?? null,
            'resource_url' => $validated['resource_url'] ?? null,
            'duration_minutes' => $validated['duration_minutes'] ?? 15,
            'order' => $validated['order'] ?? ($maxOrder + 1),
        ]);

        $module->course->recalculateProgress();

        return response()->json([
            'success' => true,
            'message' => 'Lesson created successfully',
            'data' => $lesson,
        ], 201);
    }

    public function lessonsUpdate(Request $request, LearningLesson $lesson)
    {
        if ($lesson->module->course->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'title' => 'sometimes|string|max:255',
            'content' => 'nullable|string',
            'resource_url' => 'nullable|string|max:500',
            'duration_minutes' => 'nullable|integer|min:1',
            'order' => 'nullable|integer',
        ]);

        $lesson->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Lesson updated successfully',
            'data' => $lesson,
        ]);
    }

    public function lessonsDestroy(Request $request, LearningLesson $lesson)
    {
        if ($lesson->module->course->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $course = $lesson->module->course;
        $lesson->delete();
        $course->recalculateProgress();

        return response()->json([
            'success' => true,
            'message' => 'Lesson deleted successfully',
        ]);
    }

    public function lessonsToggle(Request $request, LearningLesson $lesson)
    {
        if ($lesson->module->course->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $isCompleted = !$lesson->is_completed;
        $lesson->update([
            'is_completed' => $isCompleted,
            'completed_at' => $isCompleted ? Carbon::now() : null,
        ]);

        $course = $lesson->module->course;
        $newProgress = $course->recalculateProgress();

        return response()->json([
            'success' => true,
            'message' => 'Lesson status updated',
            'data' => [
                'lesson' => $lesson,
                'course_progress' => $newProgress,
            ],
        ]);
    }

    // ==========================================
    // Learning Sessions
    // ==========================================
    public function sessionsIndex(Request $request)
    {
        $sessions = LearningSession::where('user_id', $request->user()->id)
            ->with(['course', 'lesson'])
            ->orderBy('session_date', 'desc')
            ->limit(50)
            ->get();

        return response()->json([
            'success' => true,
            'data' => $sessions,
        ]);
    }

    public function sessionsStore(Request $request)
    {
        $validated = $request->validate([
            'topic' => 'required|string|max:255',
            'duration_minutes' => 'required|integer|min:1',
            'course_id' => 'nullable|exists:courses,id',
            'lesson_id' => 'nullable|exists:learning_lessons,id',
            'notes' => 'nullable|string',
            'session_date' => 'required|date',
        ]);

        $session = LearningSession::create(array_merge($validated, [
            'user_id' => $request->user()->id,
        ]));

        return response()->json([
            'success' => true,
            'message' => 'Learning session recorded',
            'data' => $session->load(['course', 'lesson']),
        ], 201);
    }

    // ==========================================
    // Learning Analytics & Integration
    // ==========================================
    public function analytics(Request $request)
    {
        $userId = $request->user()->id;

        $sessions = LearningSession::where('user_id', $userId)->get();
        $totalMinutes = (int) $sessions->sum('duration_minutes');
        $totalSessions = $sessions->count();

        $thirtyDaysAgo = Carbon::today()->subDays(30)->toDateString();
        $consistencyDays = LearningSession::where('user_id', $userId)
            ->where('session_date', '>=', $thirtyDaysAgo)
            ->distinct('session_date')
            ->count('session_date');

        $courses = Course::where('user_id', $userId)->with('modules.lessons')->get();
        $coursesOverview = $courses->map(function ($c) {
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

        $recentExamAttempts = ExamAttempt::where('user_id', $userId)
            ->where('status', 'completed')
            ->with('blueprint')
            ->orderBy('submitted_at', 'desc')
            ->limit(10)
            ->get()
            ->map(function ($att) {
                return [
                    'id' => $att->id,
                    'title' => $att->blueprint?->title ?? 'Exam Attempt',
                    'subject' => $att->blueprint?->subject ?? 'General',
                    'score_percentage' => $att->score_percentage,
                    'is_passed' => $att->is_passed,
                    'submitted_at' => $att->submitted_at?->toIso8601String(),
                ];
            });

        return response()->json([
            'success' => true,
            'data' => [
                'total_study_minutes' => $totalMinutes,
                'total_study_hours' => round($totalMinutes / 60, 1),
                'total_sessions' => $totalSessions,
                'consistency_days_30' => $consistencyDays,
                'courses_overview' => $coursesOverview,
                'recent_exam_results' => $recentExamAttempts,
            ],
        ]);
    }
}

