<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class WorkReport extends Model
{
    use HasFactory, SoftDeletes;

    // Report Types
    public const TYPE_TASK_REPORT = 'task_report';
    public const TYPE_PROGRESS_REPORT = 'progress_report';
    public const TYPE_COMPLETION_REPORT = 'completion_report';

    // Report Contexts
    public const CONTEXT_WORKSPACE = 'workspace';
    public const CONTEXT_PROJECT = 'project';
    public const CONTEXT_TASK = 'task';

    // Report Lifecycle Statuses
    public const STATUS_DRAFT = 'draft';
    public const STATUS_SUBMITTED = 'submitted';
    public const STATUS_IN_REVIEW = 'in_review';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_REVISION_REQUESTED = 'revision_requested';
    public const STATUS_REJECTED = 'rejected';

    protected $fillable = [
        'user_id',
        'project_id',
        'task_id',
        'reviewer_id',
        'type',
        'context_type',
        'version',
        'title',
        'summary',
        'content',
        'status',
        'submitted_at',
        'reviewed_at',
        'metrics',
    ];

    protected $casts = [
        'version' => 'integer',
        'submitted_at' => 'datetime',
        'reviewed_at' => 'datetime',
        'metrics' => 'array',
    ];

    public function user()
    {
        return $this->belongsTo(User::class); // Author / Submitter
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewer_id');
    }

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function task()
    {
        return $this->belongsTo(Task::class);
    }

    public function reviews()
    {
        return $this->hasMany(ReportReview::class)->orderBy('id', 'desc');
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
        return $query->where('project_id', $projectId)->whereNull('task_id');
    }

    public function scopeForTask($query, $taskId)
    {
        return $query->where('task_id', $taskId);
    }

    public function scopeByType($query, $type)
    {
        return $query->where('type', $type);
    }

    public function scopeByStatus($query, $status)
    {
        return $query->where('status', $status);
    }

    public function isDraft(): bool
    {
        return $this->status === self::STATUS_DRAFT;
    }

    public function isSubmitted(): bool
    {
        return $this->status === self::STATUS_SUBMITTED;
    }

    public function isInReview(): bool
    {
        return $this->status === self::STATUS_IN_REVIEW;
    }

    public function isApproved(): bool
    {
        return $this->status === self::STATUS_APPROVED;
    }

    public function isRevisionRequested(): bool
    {
        return $this->status === self::STATUS_REVISION_REQUESTED;
    }

    public function isRejected(): bool
    {
        return $this->status === self::STATUS_REJECTED;
    }
}
