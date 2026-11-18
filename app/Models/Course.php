<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Course extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'user_id',
        'category_id',
        'title',
        'code',
        'description',
        'overview',
        'learning_objectives',
        'estimated_duration',
        'status',
        'color',
        'is_published',
        'progress',
    ];

    protected $casts = [
        'is_published' => 'boolean',
        'progress' => 'integer',
        'learning_objectives' => 'array',
        'estimated_duration' => 'integer',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    public function modules()
    {
        return $this->hasMany(LearningModule::class)->orderBy('order');
    }

    public function sessions()
    {
        return $this->hasMany(LearningSession::class);
    }

    public function learningSessions()
    {
        return $this->sessions();
    }

    public function examBlueprints()
    {
        return $this->hasMany(ExamBlueprint::class);
    }

    public function recalculateProgress(): int
    {
        $modules = $this->modules()->get();
        if ($modules->isEmpty()) {
            $this->update(['progress' => 0]);
            return 0;
        }

        // Recalculate each module's progress
        foreach ($modules as $mod) {
            $mod->recalculateProgress();
        }

        $lessons = LearningLesson::whereHas('module', function ($q) {
            $q->where('course_id', $this->id);
        })->get();

        if ($lessons->isEmpty()) {
            $this->update(['progress' => 0]);
            return 0;
        }

        $completed = $lessons->where('is_completed', true)->count();
        $progress = (int) round(($completed / $lessons->count()) * 100);
        $this->update(['progress' => $progress]);
        return $progress;
    }
}
