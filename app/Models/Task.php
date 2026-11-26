<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Task extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'user_id',
        'assigned_to',
        'project_id',
        'category_id',
        'goal_id',
        'title',
        'description',
        'status',
        'priority',
        'due_date',
        'start_date',
        'reminder_at',
        'is_recurring',
        'recurrence_pattern',
        'order',
        'completed_at',
    ];

    protected $casts = [
        'due_date' => 'datetime',
        'start_date' => 'datetime',
        'reminder_at' => 'datetime',
        'completed_at' => 'datetime',
        'is_recurring' => 'boolean',
        'order' => 'integer',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function assignee()
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function notes()
    {
        return $this->hasMany(Note::class);
    }

    public function workReports()
    {
        return $this->hasMany(WorkReport::class);
    }

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    public function goal()
    {
        return $this->belongsTo(Goal::class);
    }

    public function subtasks()
    {
        return $this->hasMany(Subtask::class)->orderBy('order');
    }

    public function tags()
    {
        return $this->morphToMany(Tag::class, 'taggable');
    }

    /**
     * Tasks that this task is blocked by (prerequisites).
     */
    public function dependencies()
    {
        return $this->belongsToMany(Task::class, 'task_dependencies', 'task_id', 'depends_on_task_id');
    }

    /**
     * Tasks that are blocked by this task.
     */
    public function dependents()
    {
        return $this->belongsToMany(Task::class, 'task_dependencies', 'depends_on_task_id', 'task_id');
    }

    /**
     * Check if this task has incomplete prerequisite tasks.
     */
    public function hasUncompletedDependencies(): bool
    {
        return $this->dependencies()->where('status', '!=', 'completed')->exists();
    }
}
