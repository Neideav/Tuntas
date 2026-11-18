<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ExamAttempt extends Model
{
    use HasFactory, HasUuids;

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'id',
        'exam_blueprint_id',
        'user_id',
        'status',
        'started_at',
        'expires_at',
        'submitted_at',
        'total_points_earned',
        'total_points_possible',
        'score_percentage',
        'is_passed',
        'questions_snapshot',
        'answer_key_snapshot',
        'flagged_question_ids',
    ];

    /**
     * Hidden attributes from serialized arrays and JSON responses.
     * Protects answer keys and authoritative evaluation data on the server side.
     */
    protected $hidden = [
        'answer_key_snapshot',
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'expires_at' => 'datetime',
        'submitted_at' => 'datetime',
        'total_points_earned' => 'float',
        'total_points_possible' => 'float',
        'score_percentage' => 'float',
        'is_passed' => 'boolean',
        'questions_snapshot' => 'array',
        'answer_key_snapshot' => 'array',
        'flagged_question_ids' => 'array',
    ];

    public function blueprint()
    {
        return $this->belongsTo(ExamBlueprint::class, 'exam_blueprint_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function answers()
    {
        return $this->hasMany(ExamAnswer::class, 'exam_attempt_id');
    }

    public function integrityLogs()
    {
        return $this->hasMany(ExamIntegrityLog::class, 'exam_attempt_id');
    }
}
