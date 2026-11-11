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
        'project_id',
        'category_id',
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

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    public function subtasks()
    {
        return $this->hasMany(Subtask::class)->orderBy('order');
    }

    public function tags()
    {
        return $this->morphToMany(Tag::class, 'taggable');
    }
}

