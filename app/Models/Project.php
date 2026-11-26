<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Project extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'user_id',
        'category_id',
        'goal_id',
        'title',
        'description',
        'status',
        'priority',
        'progress',
        'health',
        'start_date',
        'deadline',
        'is_archived',
    ];

    protected $casts = [
        'start_date' => 'date',
        'deadline' => 'date',
        'progress' => 'integer',
        'is_archived' => 'boolean',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    public function goal()
    {
        return $this->belongsTo(Goal::class);
    }

    public function tasks()
    {
        return $this->hasMany(Task::class);
    }

    public function milestones()
    {
        return $this->hasMany(ProjectMilestone::class)->orderBy('order');
    }

    public function members()
    {
        return $this->hasMany(ProjectMember::class);
    }

    public function roles()
    {
        return $this->hasMany(ProjectRole::class);
    }

    public function invitations()
    {
        return $this->hasMany(ProjectInvitation::class);
    }

    public function notes()
    {
        return $this->hasMany(Note::class);
    }

    public function workReports()
    {
        return $this->hasMany(WorkReport::class);
    }

    public function activityLogs()
    {
        return $this->hasMany(AuditLog::class);
    }

    public function tags()
    {
        return $this->morphToMany(Tag::class, 'taggable');
    }

    /**
     * Recalculate and update progress based on linked tasks and milestones.
     */
    public function updateProgress(): void
    {
        $tasksCount = $this->tasks()->count();
        $milestonesCount = $this->milestones()->count();
        $total = $tasksCount + $milestonesCount;

        if ($total === 0) {
            $this->update(['progress' => 0]);
            return;
        }

        $completedTasks = $this->tasks()->where('status', 'completed')->count();
        $completedMilestones = $this->milestones()->where('is_completed', true)->count();
        $completed = $completedTasks + $completedMilestones;

        $newProgress = (int) round(($completed / $total) * 100);
        $this->update([
            'progress' => $newProgress,
            'status' => $newProgress >= 100 ? 'completed' : ($this->status === 'completed' ? 'in_progress' : $this->status),
        ]);

        if ($this->goal_id) {
            $this->goal?->recalculateProgress();
        }
    }
}
