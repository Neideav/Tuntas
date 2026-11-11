<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Question extends Model
{
    use HasFactory;

    protected $fillable = [
        'question_bank_id',
        'type',
        'prompt',
        'code_snippet',
        'explanation',
        'points',
        'difficulty',
    ];

    protected $casts = [
        'points' => 'float',
    ];

    public function questionBank()
    {
        return $this->belongsTo(QuestionBank::class);
    }

    public function options()
    {
        return $this->hasMany(QuestionOption::class)->orderBy('order');
    }

    public function blueprints()
    {
        return $this->belongsToMany(ExamBlueprint::class, 'exam_blueprint_questions')
            ->withPivot('points', 'order');
    }
}

