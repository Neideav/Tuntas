<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Services\NotificationService;
use Carbon\Carbon;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    protected NotificationService $notificationService;

    public function __construct(NotificationService $notificationService)
    {
        $this->notificationService = $notificationService;
    }

    /**
     * List user notifications with filtering by type, read status, archive status, and category counts.
     */
    public function index(Request $request)
    {
        $userId = $request->user()->id;
        $query = Notification::where('user_id', $userId);

        // Filter by archive status (default to active non-archived notifications)
        if ($request->has('is_archived') && $request->is_archived !== 'all') {
            $isArchived = filter_var($request->is_archived, FILTER_VALIDATE_BOOLEAN);
            $query->where('is_archived', $isArchived);
        } else {
            $query->where('is_archived', false);
        }

        if ($request->filled('type') && $request->type !== 'all') {
            $query->where('type', $request->type);
        }

        if ($request->has('is_read')) {
            $isRead = filter_var($request->is_read, FILTER_VALIDATE_BOOLEAN);
            $query->where('is_read', $isRead);
        }

        $perPage = min(100, max(10, (int) $request->input('per_page', 25)));
        $notifications = $query->latest('id')->paginate($perPage);

        $unreadCount = Notification::where('user_id', $userId)
            ->where('is_archived', false)
            ->where('is_read', false)
            ->count();

        $categoryCounts = Notification::where('user_id', $userId)
            ->where('is_archived', false)
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
                'per_page' => $notifications->perPage(),
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
            'type' => 'nullable|in:system,deadline,exam,habit,achievement,goal,learning',
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
            'is_archived' => false,
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
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
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
     * Archive/dismiss a notification.
     */
    public function archive(Request $request, Notification $notification)
    {
        if ($notification->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $notification->update([
            'is_archived' => true,
            'archived_at' => Carbon::now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Notification archived',
            'data' => $notification,
        ]);
    }

    /**
     * Unarchive a notification.
     */
    public function unarchive(Request $request, Notification $notification)
    {
        if ($notification->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $notification->update([
            'is_archived' => false,
            'archived_at' => null,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Notification unarchived',
            'data' => $notification,
        ]);
    }

    /**
     * Delete a notification.
     */
    public function destroy(Request $request, Notification $notification)
    {
        if ($notification->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $notification->delete();

        return response()->json([
            'success' => true,
            'message' => 'Notification deleted successfully',
        ]);
    }

    /**
     * Get user notification preferences.
     */
    public function getPreferences(Request $request)
    {
        $prefs = $this->notificationService->getPreferences($request->user());

        return response()->json([
            'success' => true,
            'data' => $prefs,
        ]);
    }

    /**
     * Update user notification preferences.
     */
    public function updatePreferences(Request $request)
    {
        $validated = $request->validate([
            'email_notifications' => 'nullable|boolean',
            'in_app_notifications' => 'nullable|boolean',
            'daily_digest' => 'nullable|boolean',
            'timezone' => 'nullable|string|max:50',
            'task_reminders' => 'nullable|boolean',
            'project_reminders' => 'nullable|boolean',
            'habit_reminders' => 'nullable|boolean',
            'goal_reminders' => 'nullable|boolean',
            'learning_reminders' => 'nullable|boolean',
            'exam_reminders' => 'nullable|boolean',
            'preferred_reminder_time' => 'nullable|string|regex:/^\d{2}:\d{2}$/',
            'quiet_hours_start' => 'nullable|string|regex:/^\d{2}:\d{2}$/',
            'quiet_hours_end' => 'nullable|string|regex:/^\d{2}:\d{2}$/',
        ]);

        $updated = $this->notificationService->updatePreferences($request->user(), $validated);

        return response()->json([
            'success' => true,
            'message' => 'Notification preferences updated successfully',
            'data' => $updated,
        ]);
    }

    /**
     * Scan upcoming tasks, projects, habits, goals, and exams to generate reminders without duplicates.
     */
    public function generateDeadlineReminders(Request $request)
    {
        $created = $this->notificationService->generateRemindersForUser($request->user());

        return response()->json([
            'success' => true,
            'message' => "Generated {$created} new reminders",
            'data' => [
                'reminders_created' => $created,
            ],
        ]);
    }
}
