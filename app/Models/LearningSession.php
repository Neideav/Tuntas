<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LearningSession extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'course_id',
        'lesson_id',
        'topic',
        'duration_minutes',
        'started_at',
        'ended_at',
        'paused_at',
        'status',
        'accumulated_seconds',
        'notes',
        'session_date',
    ];

    protected $casts = [
        'duration_minutes' => 'integer',
        'accumulated_seconds' => 'integer',
        'session_date' => 'date',
        'started_at' => 'datetime',
        'ended_at' => 'datetime',
        'paused_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function course()
    {
        return $this->belongsTo(Course::class);
    }

    public function lesson()
    {
        return $this->belongsTo(LearningLesson::class);
    }
}
