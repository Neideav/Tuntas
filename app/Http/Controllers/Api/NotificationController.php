<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Examination;
use App\Models\Notification;
use App\Models\Task;
use Carbon\Carbon;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    /**
     * List user notifications with filtering by type, status, and category counts.
     */
    public function index(Request $request)
    {
        $userId = $request->user()->id;
        $query = Notification::where('user_id', $userId);

        if ($request->filled('type') && $request->type !== 'all') {
            $query->where('type', $request->type);
        }

        if ($request->has('is_read')) {
            $isRead = filter_var($request->is_read, FILTER_VALIDATE_BOOLEAN);
            $query->where('is_read', $isRead);
        }

        $notifications = $query->latest()->paginate(25);

        $unreadCount = Notification::where('user_id', $userId)
            ->where('is_read', false)
            ->count();

        $categoryCounts = Notification::where('user_id', $userId)
            ->where('is_read', false)
            ->selectRaw('type, count(*) as count')
            ->groupBy('type')
            ->pluck('count', 'type')
            ->all();

        return response()->json([
            'success' => true,
            'data' => $notifications->items(),
            'unread_count' => $unreadCount,
            'category_counts' => $categoryCounts,
            'meta' => [
                'current_page' => $notifications->currentPage(),
                'last_page' => $notifications->lastPage(),
                'total' => $notifications->total(),
            ],
        ]);
    }

    /**
     * Store a newly created notification.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'message' => 'required|string',
            'type' => 'nullable|in:system,deadline,exam,habit,achievement',
            'action_url' => 'nullable|string|max:255',
        ]);

        $userId = $request->user()->id;
        $type = $validated['type'] ?? 'system';
        $actionUrl = $validated['action_url'] ?? null;

        // Duplicate prevention: avoid identical notification within the past 1 hour
        $recentDuplicate = Notification::where('user_id', $userId)
            ->where('title', $validated['title'])
            ->where('type', $type)
            ->where('created_at', '>=', Carbon::now()->subHour())
            ->first();

        if ($recentDuplicate) {
            return response()->json([
                'success' => true,
                'message' => 'Identical notification was recently created',
                'data' => $recentDuplicate,
            ]);
        }

        $notification = Notification::create([
            'user_id' => $userId,
            'title' => $validated['title'],
            'message' => $validated['message'],
            'type' => $type,
            'action_url' => $actionUrl,
            'is_read' => false,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Notification created successfully',
            'data' => $notification,
        ], 201);
    }

    /**
     * Mark a specific notification as read.
     */
    public function markAsRead(Request $request, Notification $notification)
    {
        if ($notification->user_id !== $request->user()->id) {
            abort(403);
        }

        $notification->update([
            'is_read' => true,
            'read_at' => Carbon::now(),
        ]);

        return response()->json([
            'success' => true,
            'data' => $notification,
        ]);
    }

    /**
     * Mark all user notifications as read.
     */
    public function markAllAsRead(Request $request)
    {
        Notification::where('user_id', $request->user()->id)
            ->where('is_read', false)
            ->update([
                'is_read' => true,
                'read_at' => Carbon::now(),
            ]);

        return response()->json([
            'success' => true,
            'message' => 'All notifications marked as read',
        ]);
    }

    /**
     * Delete a notification.
     */
    public function destroy(Request $request, Notification $notification)
    {
        if ($notification->user_id !== $request->user()->id) {
            abort(403);
        }

        $notification->delete();

        return response()->json([
            'success' => true,
            'message' => 'Notification deleted successfully',
        ]);
    }

    /**
     * Scan upcoming deadlines and examinations to generate reminders without duplicates.
     */
    public function generateDeadlineReminders(Request $request)
    {
        $userId = $request->user()->id;
        $now = Carbon::now();
        $in24Hours = $now->copy()->addHours(24);
        $in48Hours = $now->copy()->addHours(48);

        $createdReminders = 0;

        // 1. Task Deadlines (<24 hours)
        $impendingTasks = Task::where('user_id', $userId)
            ->whereIn('status', ['todo', 'in_progress'])
            ->whereNotNull('due_date')
            ->whereBetween('due_date', [$now, $in24Hours])
            ->get();

        foreach ($impendingTasks as $task) {
            $actionUrl = "/tasks?id={$task->id}";

            // Check if reminder was already generated in the past 24 hours
            $existing = Notification::where('user_id', $userId)
                ->where('type', 'deadline')
                ->where('action_url', $actionUrl)
                ->where('created_at', '>=', $now->copy()->subHours(24))
                ->exists();

            if (!$existing) {
                Notification::create([
                    'user_id' => $userId,
                    'title' => "Upcoming Deadline: {$task->title}",
                    'message' => "Task '{$task->title}' is due within 24 hours ({$task->due_date->format('M d, H:i')}).",
                    'type' => 'deadline',
                    'action_url' => $actionUrl,
                    'is_read' => false,
                ]);
                $createdReminders++;
            }
        }

        // 2. Examination Schedules (<48 hours)
        $impendingExams = Examination::where('user_id', $userId)
            ->whereIn('status', ['upcoming', 'preparing'])
            ->whereBetween('examination_date', [$now->toDateString(), $in48Hours->toDateString()])
            ->get();

        foreach ($impendingExams as $exam) {
            $actionUrl = "/examinations?id={$exam->id}";

            $existing = Notification::where('user_id', $userId)
                ->where('type', 'exam')
                ->where('action_url', $actionUrl)
                ->where('created_at', '>=', $now->copy()->subHours(48))
                ->exists();

            if (!$existing) {
                Notification::create([
                    'user_id' => $userId,
                    'title' => "Exam Scheduled: {$exam->title}",
                    'message' => "Examination '{$exam->title}' ({$exam->subject}) is approaching on {$exam->examination_date->format('M d, Y')}.",
                    'type' => 'exam',
                    'action_url' => $actionUrl,
                    'is_read' => false,
                ]);
                $createdReminders++;
            }
        }

        return response()->json([
            'success' => true,
            'message' => "Generated {$createdReminders} new deadline reminders",
            'data' => [
                'reminders_created' => $createdReminders,
            ],
        ]);
    }
}
