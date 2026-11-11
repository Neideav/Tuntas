<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ExamIntegrityLog extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'exam_attempt_id',
        'event_type',
        'details',
        'logged_at',
    ];

    protected $casts = [
        'logged_at' => 'datetime',
    ];

    public function attempt()
    {
        return $this->belongsTo(ExamAttempt::class, 'exam_attempt_id');
    }
}

