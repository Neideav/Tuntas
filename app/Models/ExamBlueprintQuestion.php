<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ExamBlueprintQuestion extends Model
{
    use HasFactory;

    protected $fillable = [
        'exam_blueprint_id',
        'question_id',
        'points',
        'order',
    ];

    protected $casts = [
        'points' => 'float',
        'order' => 'integer',
    ];

    public function blueprint()
    {
        return $this->belongsTo(ExamBlueprint::class, 'exam_blueprint_id');
    }

    public function question()
    {
        return $this->belongsTo(Question::class);
    }
}

