<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class WorkReport extends Model
{
    use HasFactory, SoftDeletes;

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
        'title',
        'content',
        'status',
        'submitted_at',
        'reviewed_at',
        'metrics',
    ];

    protected $casts = [
        'submitted_at' => 'datetime',
        'reviewed_at' => 'datetime',
        'metrics' => 'array',
    ];

    public function user()
    {
        return $this->belongsTo(User::class); // Submitter
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
        return $this->hasMany(ReportReview::class)->orderBy('version', 'desc');
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
