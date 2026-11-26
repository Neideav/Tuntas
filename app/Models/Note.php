<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Note extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'user_id',
        'project_id',
        'task_id',
        'title',
        'content',
        'color',
        'is_pinned',
        'is_archived',
    ];

    protected $casts = [
        'is_pinned' => 'boolean',
        'is_archived' => 'boolean',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function task()
    {
        return $this->belongsTo(Task::class);
    }

    public function mentions()
    {
        return $this->morphMany(Mention::class, 'mentionable');
    }

    public function scopeWorkspace($query)
    {
        return $query->whereNull('project_id')->whereNull('task_id');
    }

    public function scopeForProject($query, $projectId)
    {
        return $query->where('project_id', $projectId)->whereNull('task_id');
    }

    public function scopeForTask($query, $taskId)
    {
        return $query->where('task_id', $taskId);
    }
}
