<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ExamBlueprint extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'user_id',
        'course_id',
        'title',
        'subject',
        'instructions',
        'duration_minutes',
        'passing_score',
        'allow_partial_scoring',
        'negative_marking',
        'sections',
        'rubrics',
        'shuffle_questions',
        'shuffle_options',
        'max_attempts',
        'starts_at',
        'ends_at',
        'is_published',
    ];

    protected $casts = [
        'duration_minutes' => 'integer',
        'passing_score' => 'float',
        'allow_partial_scoring' => 'boolean',
        'negative_marking' => 'float',
        'sections' => 'array',
        'rubrics' => 'array',
        'shuffle_questions' => 'boolean',
        'shuffle_options' => 'boolean',
        'max_attempts' => 'integer',
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
        'is_published' => 'boolean',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function course()
    {
        return $this->belongsTo(Course::class);
    }

    public function questions()
    {
        return $this->belongsToMany(Question::class, 'exam_blueprint_questions')
            ->withPivot('points', 'order')
            ->orderBy('exam_blueprint_questions.order');
    }

    public function attempts()
    {
        return $this->hasMany(ExamAttempt::class);
    }
}
