<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Note extends Model
{
    use HasFactory, SoftDeletes;

    public const CONTEXT_WORKSPACE = 'workspace';
    public const CONTEXT_PROJECT = 'project';
    public const CONTEXT_TASK = 'task';

    public const STATUS_DRAFT = 'draft';
    public const STATUS_PUBLISHED = 'published';
    public const STATUS_ARCHIVED = 'archived';

    public const VISIBILITY_PRIVATE = 'private';
    public const VISIBILITY_TEAM = 'team';
    public const VISIBILITY_PUBLIC = 'public';

    protected $fillable = [
        'user_id',
        'context_type',
        'context_id',
        'project_id',
        'task_id',
        'title',
        'content',
        'status',
        'visibility',
        'version',
        'color',
        'tags',
        'is_pinned',
        'is_archived',
    ];

    protected $casts = [
        'tags' => 'array',
        'version' => 'integer',
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

    public function versions()
    {
        return $this->hasMany(NoteVersion::class)->orderBy('version', 'desc');
    }

    public function comments()
    {
        return $this->hasMany(NoteComment::class)
            ->whereNull('parent_id')
            ->with(['user:id,name,email', 'replies'])
            ->latest();
    }

    public function attachments()
    {
        return $this->hasMany(NoteAttachment::class)->latest();
    }

    public function mentions()
    {
        return $this->morphMany(Mention::class, 'mentionable');
    }

    public function scopeWorkspace($query)
    {
        return $query->where(function ($q) {
            $q->where('context_type', self::CONTEXT_WORKSPACE)
              ->orWhere(function ($sub) {
                  $sub->whereNull('project_id')->whereNull('task_id');
              });
        });
    }

    public function scopeForProject($query, $projectId)
    {
        return $query->where(function ($q) use ($projectId) {
            $q->where(function ($sub) use ($projectId) {
                $sub->where('context_type', self::CONTEXT_PROJECT)
                    ->where('context_id', $projectId);
            })->orWhere('project_id', $projectId);
        });
    }

    public function scopeForTask($query, $taskId)
    {
        return $query->where(function ($q) use ($taskId) {
            $q->where(function ($sub) use ($taskId) {
                $sub->where('context_type', self::CONTEXT_TASK)
                    ->where('context_id', $taskId);
            })->orWhere('task_id', $taskId);
        });
    }

    public function scopeActive($query)
    {
        return $query->where('status', '!=', self::STATUS_ARCHIVED)
                     ->where('is_archived', false);
    }

    public function scopePinnedFirst($query)
    {
        return $query->orderBy('is_pinned', 'desc')->latest('updated_at');
    }
}
