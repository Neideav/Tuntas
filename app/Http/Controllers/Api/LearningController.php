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
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

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
        $userId = $request->user()->id;

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'code' => 'nullable|string|max:50',
            'description' => 'nullable|string',
            'overview' => 'nullable|string',
            'learning_objectives' => 'nullable|array',
            'estimated_duration' => 'nullable|string|max:100',
            'status' => 'nullable|in:draft,published,archived',
            'category_id' => [
                'nullable',
                Rule::exists('categories', 'id')->where(fn ($q) => $q->where('user_id', $userId)),
            ],
            'color' => 'nullable|string|max:50',
        ]);

        $course = Course::create(array_merge($validated, [
            'user_id' => $request->user()->id,
            'color' => $validated['color'] ?? '#3b82f6',
            'status' => $validated['status'] ?? 'draft',
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

        $userId = $request->user()->id;

        $validated = $request->validate([
            'title' => 'sometimes|string|max:255',
            'code' => 'nullable|string|max:50',
            'description' => 'nullable|string',
            'overview' => 'nullable|string',
            'learning_objectives' => 'nullable|array',
            'estimated_duration' => 'nullable|string|max:100',
            'status' => 'nullable|in:draft,published,archived',
            'category_id' => [
                'nullable',
                Rule::exists('categories', 'id')->where(fn ($q) => $q->where('user_id', $userId)),
            ],
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

        $userId = $request->user()->id;

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'order' => 'nullable|integer',
            'prerequisite_module_id' => [
                'nullable',
                Rule::exists('learning_modules', 'id')->where(function ($q) use ($course) {
                    $q->where('course_id', $course->id);
                }),
            ],
        ]);

        $maxOrder = $course->modules()->max('order') ?? 0;
        $module = $course->modules()->create([
            'title' => $validated['title'],
            'description' => $validated['description'] ?? null,
            'order' => $validated['order'] ?? ($maxOrder + 1),
            'prerequisite_module_id' => $validated['prerequisite_module_id'] ?? null,
            'is_completed' => false,
            'progress' => 0,
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

        $courseId = $module->course_id;

        $validated = $request->validate([
            'title' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'order' => 'nullable|integer',
            'prerequisite_module_id' => [
                'nullable',
                Rule::exists('learning_modules', 'id')->where(function ($q) use ($courseId, $module) {
                    $q->where('course_id', $courseId)->where('id', '!=', $module->id);
                }),
            ],
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
        DB::transaction(function () use ($module, $course) {
            $module->delete();
            $course->recalculateProgress();
        });

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
            'video_url' => 'nullable|string|max:500',
            'attachment_url' => 'nullable|string|max:500',
            'lesson_type' => 'nullable|in:text,video,quiz,assignment',
            'notes' => 'nullable|string',
            'duration_minutes' => 'nullable|integer|min:1',
            'order' => 'nullable|integer',
        ]);

        $maxOrder = $module->lessons()->max('order') ?? 0;
        $lesson = DB::transaction(function () use ($module, $validated, $maxOrder) {
            $lesson = $module->lessons()->create([
                'title' => $validated['title'],
                'content' => $validated['content'] ?? null,
                'resource_url' => $validated['resource_url'] ?? null,
                'video_url' => $validated['video_url'] ?? null,
                'attachment_url' => $validated['attachment_url'] ?? null,
                'lesson_type' => $validated['lesson_type'] ?? 'text',
                'notes' => $validated['notes'] ?? null,
                'duration_minutes' => $validated['duration_minutes'] ?? 15,
                'order' => $validated['order'] ?? ($maxOrder + 1),
                'is_completed' => false,
            ]);

            $module->course->recalculateProgress();
            return $lesson;
        });

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
            'video_url' => 'nullable|string|max:500',
            'attachment_url' => 'nullable|string|max:500',
            'lesson_type' => 'nullable|in:text,video,quiz,assignment',
            'notes' => 'nullable|string',
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
        DB::transaction(function () use ($lesson, $course) {
            $lesson->delete();
            $course->recalculateProgress();
        });

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
        $course = $lesson->module->course;

        $newProgress = DB::transaction(function () use ($lesson, $isCompleted, $course) {
            $lesson->update([
                'is_completed' => $isCompleted,
                'completed_at' => $isCompleted ? Carbon::now() : null,
            ]);

            return $course->recalculateProgress();
        });

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
    // Learning Sessions (Study Timer & History)
    // ==========================================
    public function sessionsIndex(Request $request)
    {
        $sessions = LearningSession::where('user_id', $request->user()->id)
            ->with(['course', 'lesson'])
            ->orderBy('session_date', 'desc')
            ->orderBy('id', 'desc')
            ->limit(50)
            ->get();

        return response()->json([
            'success' => true,
            'data' => $sessions,
        ]);
    }

    public function sessionsActive(Request $request)
    {
        $session = LearningSession::where('user_id', $request->user()->id)
            ->whereIn('status', ['active', 'paused'])
            ->with(['course', 'lesson'])
            ->latest('id')
            ->first();

        return response()->json([
            'success' => true,
            'data' => $session,
        ]);
    }

    public function sessionsStart(Request $request)
    {
        $userId = $request->user()->id;

        $validated = $request->validate([
            'topic' => 'required|string|max:255',
            'course_id' => [
                'nullable',
                Rule::exists('courses', 'id')->where(fn ($q) => $q->where('user_id', $userId)),
            ],
            'lesson_id' => [
                'nullable',
                Rule::exists('learning_lessons', 'id')->where(function ($query) use ($userId) {
                    $query->whereIn('module_id', function ($sub) use ($userId) {
                        $sub->select('learning_modules.id')
                            ->from('learning_modules')
                            ->join('courses', 'courses.id', '=', 'learning_modules.course_id')
                            ->where('courses.user_id', $userId);
                    });
                }),
            ],
            'notes' => 'nullable|string',
        ]);

        // Auto-pause any existing active sessions to prevent duplicate timer tracking
        $activeSessions = LearningSession::where('user_id', $userId)
            ->where('status', 'active')
            ->get();

        $now = Carbon::now();
        foreach ($activeSessions as $act) {
            $elapsed = $act->started_at ? max(0, $now->diffInSeconds($act->started_at)) : 0;
            $act->update([
                'status' => 'paused',
                'paused_at' => $now,
                'accumulated_seconds' => (int) $act->accumulated_seconds + $elapsed,
            ]);
        }

        $session = LearningSession::create([
            'user_id' => $userId,
            'topic' => $validated['topic'],
            'course_id' => $validated['course_id'] ?? null,
            'lesson_id' => $validated['lesson_id'] ?? null,
            'notes' => $validated['notes'] ?? null,
            'session_date' => Carbon::today()->toDateString(),
            'started_at' => $now,
            'duration_minutes' => 0,
            'accumulated_seconds' => 0,
            'status' => 'active',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Study session started',
            'data' => $session->load(['course', 'lesson']),
        ], 201);
    }

    public function sessionsPause(Request $request, LearningSession $session)
    {
        if ($session->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        if ($session->status === 'active') {
            $now = Carbon::now();
            $elapsed = $session->started_at ? max(0, $now->diffInSeconds($session->started_at)) : 0;
            $session->update([
                'status' => 'paused',
                'paused_at' => $now,
                'accumulated_seconds' => (int) $session->accumulated_seconds + $elapsed,
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Study session paused',
            'data' => $session->fresh(['course', 'lesson']),
        ]);
    }

    public function sessionsResume(Request $request, LearningSession $session)
    {
        if ($session->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        if ($session->status === 'paused') {
            $session->update([
                'status' => 'active',
                'started_at' => Carbon::now(),
                'paused_at' => null,
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Study session resumed',
            'data' => $session->fresh(['course', 'lesson']),
        ]);
    }

    public function sessionsComplete(Request $request, LearningSession $session)
    {
        if ($session->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $now = Carbon::now();
        $totalSeconds = (int) $session->accumulated_seconds;
        if ($session->status === 'active' && $session->started_at) {
            $totalSeconds += max(0, $now->diffInSeconds($session->started_at));
        }

        $durationMinutes = $request->filled('duration_minutes')
            ? (int) $request->input('duration_minutes')
            : max(1, (int) round($totalSeconds / 60));

        $session->update([
            'status' => 'completed',
            'ended_at' => $now,
            'accumulated_seconds' => $totalSeconds,
            'duration_minutes' => $durationMinutes,
            'notes' => $request->input('notes', $session->notes),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Study session completed and recorded',
            'data' => $session->fresh(['course', 'lesson']),
        ]);
    }

    public function sessionsStore(Request $request)
    {
        $userId = $request->user()->id;

        $validated = $request->validate([
            'topic' => 'required|string|max:255',
            'duration_minutes' => 'required|integer|min:1',
            'course_id' => [
                'nullable',
                Rule::exists('courses', 'id')->where(fn ($q) => $q->where('user_id', $userId)),
            ],
            'lesson_id' => [
                'nullable',
                Rule::exists('learning_lessons', 'id')->where(function ($query) use ($userId) {
                    $query->whereIn('module_id', function ($sub) use ($userId) {
                        $sub->select('learning_modules.id')
                            ->from('learning_modules')
                            ->join('courses', 'courses.id', '=', 'learning_modules.course_id')
                            ->where('courses.user_id', $userId);
                    });
                }),
            ],
            'notes' => 'nullable|string',
            'session_date' => 'required|date',
        ]);

        $session = LearningSession::create(array_merge($validated, [
            'user_id' => $request->user()->id,
            'status' => 'completed',
            'accumulated_seconds' => $validated['duration_minutes'] * 60,
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

