<?php

namespace App\Services;

use App\Events\NotificationCreated;
use App\Models\Course;
use App\Models\Examination;
use App\Models\Goal;
use App\Models\Habit;
use App\Models\HabitLog;
use App\Models\Notification;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\Task;
use App\Models\User;
use App\Models\UserSetting;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;

class NotificationService
{
    /**
     * Get consolidated user notification preferences with reliable defaults.
     */
    public function getPreferences(User $user): array
    {
        $settings = UserSetting::firstOrCreate(
            ['user_id' => $user->id],
            [
                'theme' => 'dark',
                'email_notifications' => true,
                'in_app_notifications' => true,
                'daily_digest' => false,
                'timezone' => $user->timezone ?? 'UTC',
            ]
        );

        $prefs = $settings->preferences ?? [];

        return [
            'email_notifications' => (bool) $settings->email_notifications,
            'in_app_notifications' => (bool) $settings->in_app_notifications,
            'daily_digest' => (bool) $settings->daily_digest,
            'timezone' => $settings->timezone ?? 'UTC',
            'task_reminders' => (bool) ($prefs['task_reminders'] ?? true),
            'project_reminders' => (bool) ($prefs['project_reminders'] ?? true),
            'habit_reminders' => (bool) ($prefs['habit_reminders'] ?? true),
            'goal_reminders' => (bool) ($prefs['goal_reminders'] ?? true),
            'learning_reminders' => (bool) ($prefs['learning_reminders'] ?? true),
            'exam_reminders' => (bool) ($prefs['exam_reminders'] ?? true),
            'mention_notifications' => (bool) ($prefs['mention_notifications'] ?? true),
            'report_notifications' => (bool) ($prefs['report_notifications'] ?? true),
            'note_notifications' => (bool) ($prefs['note_notifications'] ?? true),
            'preferred_reminder_time' => (string) ($prefs['preferred_reminder_time'] ?? '09:00'),
            'quiet_hours_start' => $prefs['quiet_hours_start'] ?? null,
            'quiet_hours_end' => $prefs['quiet_hours_end'] ?? null,
        ];
    }

    /**
     * Update user notification preferences safely.
     */
    public function updatePreferences(User $user, array $validated): array
    {
        $settings = UserSetting::firstOrCreate(['user_id' => $user->id]);

        if (isset($validated['email_notifications'])) {
            $settings->email_notifications = (bool) $validated['email_notifications'];
        }
        if (isset($validated['in_app_notifications'])) {
            $settings->in_app_notifications = (bool) $validated['in_app_notifications'];
        }
        if (isset($validated['daily_digest'])) {
            $settings->daily_digest = (bool) $validated['daily_digest'];
        }
        if (isset($validated['timezone'])) {
            $settings->timezone = $validated['timezone'];
            $user->update(['timezone' => $validated['timezone']]);
        }

        $currentPrefs = $settings->preferences ?? [];
        $prefKeys = [
            'task_reminders',
            'project_reminders',
            'habit_reminders',
            'goal_reminders',
            'learning_reminders',
            'exam_reminders',
            'mention_notifications',
            'report_notifications',
            'note_notifications',
            'preferred_reminder_time',
            'quiet_hours_start',
            'quiet_hours_end',
        ];

        foreach ($prefKeys as $k) {
            if (array_key_exists($k, $validated)) {
                $currentPrefs[$k] = $validated[$k];
            }
        }

        $settings->preferences = $currentPrefs;
        $settings->save();

        return $this->getPreferences($user);
    }

    // -------------------------------------------------------------------------
    // Core idempotent notification creation (used by MentionService & controllers)
    // -------------------------------------------------------------------------

    /**
     * Create a notification with idempotency guarantees.
     * Uses idempotency_key + 5-minute window to prevent queue retry duplicates.
     * Broadcasts the notification via the event system.
     *
     * Returns the Notification model if created (or null if duplicate).
     */
    public function createIdempotent(
        int     $userId,
        string  $title,
        string  $message,
        string  $type,
        ?string $actionUrl      = null,
        ?string $idempotencyKey = null,
        ?array  $meta           = null,
        int     $dedupeWindowMinutes = 5
    ): ?Notification {
        // Check for user's in_app_notifications preference
        $settings = UserSetting::where('user_id', $userId)->first();
        if ($settings && !(bool) $settings->in_app_notifications) {
            return null;
        }

        // Check type-specific preference
        if ($settings && !$this->isTypeEnabled($settings, $type)) {
            return null;
        }

        // Idempotency guard
        if ($idempotencyKey) {
            $existing = Notification::where('user_id', $userId)
                ->where('idempotency_key', $idempotencyKey)
                ->where('created_at', '>=', Carbon::now()->subMinutes($dedupeWindowMinutes))
                ->first();

            if ($existing) {
                return null; // Duplicate suppressed
            }
        }

        $notification = Notification::create([
            'user_id'          => $userId,
            'title'            => $title,
            'message'          => $message,
            'type'             => $type,
            'action_url'       => $actionUrl,
            'idempotency_key'  => $idempotencyKey,
            'meta'             => $meta,
            'is_read'          => false,
            'is_archived'      => false,
        ]);

        // Broadcast (graceful degradation on log driver)
        try {
            event(new NotificationCreated($notification));
        } catch (\Throwable $e) {
            Log::warning("NotificationCreated broadcast failed: {$e->getMessage()}");
        }

        return $notification;
    }

    /**
     * Notify a user about a task assignment.
     */
    public function notifyTaskAssigned(User $assignee, User $assigner, Task $task): void
    {
        $this->createIdempotent(
            userId:         $assignee->id,
            title:          "Tugas Ditetapkan: {$task->title}",
            message:        "{$assigner->name} menugaskan Anda pada tugas \"{$task->title}\".",
            type:           'task_assigned',
            actionUrl:      "/tasks/{$task->id}",
            idempotencyKey: "task.assigned.{$assignee->id}.{$task->id}.{$assigner->id}",
            meta:           ['task_id' => $task->id, 'assigner_id' => $assigner->id]
        );
    }

    /**
     * Notify task owner/team when a task is completed.
     */
    public function notifyTaskCompleted(User $completedBy, Task $task): void
    {
        $recipientIds = collect();

        // Notify project members (admin/owner) if project-scoped
        if ($task->project_id) {
            $admins = ProjectMember::where('project_id', $task->project_id)
                ->whereIn('role', ['owner', 'admin'])
                ->pluck('user_id');
            $recipientIds = $recipientIds->merge($admins);
        }

        // Notify the task owner if different from completer
        if ($task->user_id && $task->user_id !== $completedBy->id) {
            $recipientIds->push($task->user_id);
        }

        foreach ($recipientIds->unique() as $uid) {
            if ($uid === $completedBy->id) {
                continue;
            }
            $this->createIdempotent(
                userId:         $uid,
                title:          "Tugas Selesai: {$task->title}",
                message:        "{$completedBy->name} menyelesaikan tugas \"{$task->title}\".",
                type:           'task_completed',
                actionUrl:      "/tasks/{$task->id}",
                idempotencyKey: "task.completed.{$uid}.{$task->id}",
                meta:           ['task_id' => $task->id, 'completed_by' => $completedBy->id]
            );
        }
    }

    /**
     * Notify reviewer that a report was submitted for review.
     */
    public function notifyReportSubmitted(User $author, User $reviewer, $report): void
    {
        $this->createIdempotent(
            userId:         $reviewer->id,
            title:          "Laporan Menunggu Review",
            message:        "{$author->name} telah mengirimkan laporan \"{$report->title}\" untuk direview.",
            type:           'report_submitted',
            actionUrl:      "/reports/{$report->id}",
            idempotencyKey: "report.submitted.{$reviewer->id}.{$report->id}.{$report->version}",
            meta:           ['report_id' => $report->id, 'author_id' => $author->id]
        );
    }

    /**
     * Notify author that their report was approved.
     */
    public function notifyReportApproved(User $reviewer, User $author, $report): void
    {
        $this->createIdempotent(
            userId:         $author->id,
            title:          "Laporan Disetujui",
            message:        "{$reviewer->name} telah menyetujui laporan \"{$report->title}\" Anda.",
            type:           'report_approved',
            actionUrl:      "/reports/{$report->id}",
            idempotencyKey: "report.approved.{$author->id}.{$report->id}",
            meta:           ['report_id' => $report->id, 'reviewer_id' => $reviewer->id]
        );
    }

    /**
     * Notify author that revision was requested.
     */
    public function notifyRevisionRequested(User $reviewer, User $author, $report, string $feedback): void
    {
        $this->createIdempotent(
            userId:         $author->id,
            title:          "Revisi Laporan Diminta",
            message:        "{$reviewer->name} meminta revisi laporan \"{$report->title}\": {$feedback}",
            type:           'revision_requested',
            actionUrl:      "/reports/{$report->id}",
            idempotencyKey: "report.revision.{$author->id}.{$report->id}.{$report->version}",
            meta:           ['report_id' => $report->id, 'reviewer_id' => $reviewer->id]
        );
    }

    /**
     * Notify an invited user of a project invitation.
     */
    public function notifyProjectInvitation(User $invitee, User $inviter, $project, string $token): void
    {
        $this->createIdempotent(
            userId:         $invitee->id,
            title:          "Undangan Proyek: {$project->title}",
            message:        "{$inviter->name} mengundang Anda untuk bergabung dengan proyek \"{$project->title}\".",
            type:           'project_invitation',
            actionUrl:      "/invitations/{$token}",
            idempotencyKey: "invitation.{$invitee->id}.{$project->id}",
            meta:           ['project_id' => $project->id, 'inviter_id' => $inviter->id]
        );
    }

    /**
     * Notify project owner/admin when a new member joins.
     */
    public function notifyMemberJoined(User $newMember, $project): void
    {
        $admins = ProjectMember::where('project_id', $project->id)
            ->whereIn('role', ['owner', 'admin'])
            ->pluck('user_id');

        foreach ($admins as $uid) {
            if ($uid === $newMember->id) {
                continue;
            }
            $this->createIdempotent(
                userId:         $uid,
                title:          "Anggota Baru Bergabung",
                message:        "{$newMember->name} telah bergabung dengan proyek \"{$project->title}\".",
                type:           'member_joined',
                actionUrl:      "/projects/{$project->id}",
                idempotencyKey: "member.joined.{$uid}.{$newMember->id}.{$project->id}",
                meta:           ['project_id' => $project->id, 'new_member_id' => $newMember->id]
            );
        }
    }

    /**
     * Notify a member that their role was changed.
     */
    public function notifyRoleChanged(User $member, $project, string $oldRole, string $newRole, User $changedBy): void
    {
        $this->createIdempotent(
            userId:         $member->id,
            title:          "Peran Diubah",
            message:        "{$changedBy->name} mengubah peran Anda di proyek \"{$project->title}\" dari \"{$oldRole}\" menjadi \"{$newRole}\".",
            type:           'role_changed',
            actionUrl:      "/projects/{$project->id}",
            idempotencyKey: "role.changed.{$member->id}.{$project->id}.{$newRole}",
            meta:           ['project_id' => $project->id, 'old_role' => $oldRole, 'new_role' => $newRole]
        );
    }

    /**
     * Notify commenter's thread participants about a new note comment.
     */
    public function notifyNoteCommented(User $commenter, $note, string $excerpt): void
    {
        // Notify note owner if different from commenter
        if ($note->owner_id && $note->owner_id !== $commenter->id) {
            $this->createIdempotent(
                userId:         $note->owner_id,
                title:          "Komentar Baru pada Catatan",
                message:        "{$commenter->name} berkomentar pada catatan \"{$note->title}\": {$excerpt}",
                type:           'note_commented',
                actionUrl:      "/notes/{$note->id}",
                idempotencyKey: "note.comment.{$note->owner_id}.{$note->id}.{$commenter->id}",
                meta:           ['note_id' => $note->id, 'commenter_id' => $commenter->id]
            );
        }
    }

    /**
     * Check if a notification type is enabled for a user.
     */
    private function isTypeEnabled(UserSetting $settings, string $type): bool
    {
        $prefs = $settings->preferences ?? [];

        $typePrefsMap = [
            'user_mentioned'    => 'mention_notifications',
            'role_mentioned'    => 'mention_notifications',
            'task_assigned'     => 'task_reminders',
            'task_completed'    => 'task_reminders',
            'report_submitted'  => 'report_notifications',
            'report_approved'   => 'report_notifications',
            'revision_requested' => 'report_notifications',
            'note_commented'    => 'note_notifications',
            'project_invitation' => 'project_reminders',
            'member_joined'     => 'project_reminders',
            'role_changed'      => 'project_reminders',
            'deadline'          => 'task_reminders',
            'habit'             => 'habit_reminders',
            'goal'              => 'goal_reminders',
            'exam'              => 'exam_reminders',
        ];

        $prefKey = $typePrefsMap[$type] ?? null;
        if (!$prefKey) {
            return true; // Unknown types: allow by default
        }

        return (bool) ($prefs[$prefKey] ?? true); // Default ON
    }

    /**
     * Check if current time in user's timezone falls within configured quiet hours.
     */
    public function isQuietHours(array $preferences, Carbon $now): bool
    {
        $qStart = $preferences['quiet_hours_start'] ?? null;
        $qEnd = $preferences['quiet_hours_end'] ?? null;

        if (!$qStart || !$qEnd) {
            return false;
        }

        $currentTime = $now->format('H:i');
        if ($qStart <= $qEnd) {
            return ($currentTime >= $qStart && $currentTime <= $qEnd);
        } else {
            // Over midnight range, e.g. 22:00 to 07:00
            return ($currentTime >= $qStart || $currentTime <= $qEnd);
        }
    }

    /**
     * Scan and generate multi-domain automated reminders with strict deduplication.
     */
    public function generateRemindersForUser(User $user): int
    {
        $prefs = $this->getPreferences($user);
        $timezone = $prefs['timezone'];

        try {
            $now = Carbon::now($timezone);
        } catch (\Exception $e) {
            $now = Carbon::now();
        }

        // Respect quiet hours
        if ($this->isQuietHours($prefs, $now)) {
            Log::info("Skipping reminder generation for user {$user->id}: inside quiet hours ({$now->format('H:i')})");
            return 0;
        }

        $createdCount = 0;
        $userId = $user->id;

        // 1. Task Due Reminders (<24 hours)
        if ($prefs['task_reminders']) {
            $in24Hours = $now->copy()->addHours(24);
            $impendingTasks = Task::where('user_id', $userId)
                ->whereIn('status', ['todo', 'in_progress'])
                ->whereNotNull('due_date')
                ->whereBetween('due_date', [$now->toDateTimeString(), $in24Hours->toDateTimeString()])
                ->get();

            foreach ($impendingTasks as $task) {
                $actionUrl = "/tasks?id={$task->id}";
                $already = Notification::where('user_id', $userId)
                    ->where('type', 'deadline')
                    ->where('action_url', $actionUrl)
                    ->where('created_at', '>=', Carbon::now()->subHours(24))
                    ->exists();

                if (!$already) {
                    Notification::create([
                        'user_id' => $userId,
                        'title' => "Tenggat Waktu: {$task->title}",
                        'message' => "Task '{$task->title}' mendekati batas waktu dalam 24 jam ({$task->due_date->format('M d, H:i')}).",
                        'type' => 'deadline',
                        'action_url' => $actionUrl,
                        'is_read' => false,
                    ]);
                    $createdCount++;
                }
            }
        }

        // 2. Project Deadline Reminders (<48 hours)
        if ($prefs['project_reminders']) {
            $in48Hours = $now->copy()->addHours(48)->toDateString();
            $impendingProjects = Project::where('user_id', $userId)
                ->whereIn('status', ['planning', 'in_progress'])
                ->whereNotNull('deadline')
                ->whereBetween('deadline', [$now->toDateString(), $in48Hours])
                ->get();

            foreach ($impendingProjects as $proj) {
                $actionUrl = "/projects?id={$proj->id}";
                $already = Notification::where('user_id', $userId)
                    ->where('type', 'deadline')
                    ->where('action_url', $actionUrl)
                    ->where('created_at', '>=', Carbon::now()->subHours(48))
                    ->exists();

                if (!$already) {
                    Notification::create([
                        'user_id' => $userId,
                        'title' => "Deadline Proyek: {$proj->title}",
                        'message' => "Proyek '{$proj->title}' memiliki target selesai pada {$proj->deadline}. Periksa progres milestone Anda.",
                        'type' => 'deadline',
                        'action_url' => $actionUrl,
                        'is_read' => false,
                    ]);
                    $createdCount++;
                }
            }
        }

        // 3. Habit Reminders (Uncompleted habits for today, sent after 14:00)
        if ($prefs['habit_reminders'] && $now->hour >= 14) {
            $todayStr = $now->toDateString();
            $completedHabitIds = HabitLog::where('user_id', $userId)
                ->whereDate('log_date', $todayStr)
                ->where('is_completed', true)
                ->pluck('habit_id')
                ->all();

            $pendingHabits = Habit::where('user_id', $userId)
                ->where('is_archived', false)
                ->whereNotIn('id', $completedHabitIds)
                ->get();

            if ($pendingHabits->count() > 0) {
                $actionUrl = '/habits';
                $already = Notification::where('user_id', $userId)
                    ->where('type', 'habit')
                    ->where('action_url', $actionUrl)
                    ->where('created_at', '>=', Carbon::now()->subHours(18))
                    ->exists();

                if (!$already) {
                    $firstHabit = $pendingHabits->first();
                    $msg = $pendingHabits->count() === 1
                        ? "Jangan lupa menyelesaikan kebiasaan '{$firstHabit->title}' hari ini untuk menjaga streak Anda!"
                        : "Anda memiliki {$pendingHabits->count()} kebiasaan yang belum dicatat hari ini. Jaga momentum streak Anda!";

                    Notification::create([
                        'user_id' => $userId,
                        'title' => 'Pengingat Kebiasaan Harian',
                        'message' => $msg,
                        'type' => 'habit',
                        'action_url' => $actionUrl,
                        'is_read' => false,
                    ]);
                    $createdCount++;
                }
            }
        }

        // 4. Goal Milestone Reminders (<72 hours)
        if ($prefs['goal_reminders']) {
            $in72Hours = $now->copy()->addHours(72)->toDateString();
            $activeGoals = Goal::where('user_id', $userId)
                ->whereIn('status', ['not_started', 'in_progress'])
                ->with(['milestones' => function ($q) use ($now, $in72Hours) {
                    $q->where('is_completed', false)
                      ->whereNotNull('due_date')
                      ->whereBetween('due_date', [$now->toDateString(), $in72Hours]);
                }])
                ->get();

            foreach ($activeGoals as $goal) {
                foreach ($goal->milestones as $milestone) {
                    $actionUrl = "/goals?id={$goal->id}";
                    $already = Notification::where('user_id', $userId)
                        ->where('type', 'goal')
                        ->where('action_url', $actionUrl)
                        ->where('created_at', '>=', Carbon::now()->subHours(72))
                        ->exists();

                    if (!$already) {
                        Notification::create([
                            'user_id' => $userId,
                            'title' => "Milestone Target: {$milestone->title}",
                            'message' => "Milestone '{$milestone->title}' untuk target '{$goal->title}' jatuh tempo pada {$milestone->due_date}.",
                            'type' => 'goal',
                            'action_url' => $actionUrl,
                            'is_read' => false,
                        ]);
                        $createdCount++;
                    }
                }
            }
        }

        // 5. Examination Upcoming Reminders (<48 hours)
        if ($prefs['exam_reminders']) {
            $in48Hours = $now->copy()->addHours(48)->toDateString();
            $upcomingExams = Examination::where('user_id', $userId)
                ->whereIn('status', ['upcoming', 'preparing'])
                ->whereBetween('examination_date', [$now->toDateString(), $in48Hours])
                ->get();

            foreach ($upcomingExams as $exam) {
                $actionUrl = "/examinations?id={$exam->id}";
                $already = Notification::where('user_id', $userId)
                    ->where('type', 'exam')
                    ->where('action_url', $actionUrl)
                    ->where('created_at', '>=', Carbon::now()->subHours(48))
                    ->exists();

                if (!$already) {
                    Notification::create([
                        'user_id' => $userId,
                        'title' => "Jadwal Ujian: {$exam->title}",
                        'message' => "Ujian '{$exam->title}' ({$exam->subject}) akan berlangsung pada {$exam->examination_date->format('M d, Y')}.",
                        'type' => 'exam',
                        'action_url' => $actionUrl,
                        'is_read' => false,
                    ]);
                    $createdCount++;
                }
            }
        }

        return $createdCount;
    }
}
