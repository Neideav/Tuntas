<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LearningModule extends Model
{
    use HasFactory;

    protected $fillable = [
        'course_id',
        'title',
        'description',
        'order',
        'is_completed',
        'progress',
        'prerequisite_module_id',
    ];

    protected $casts = [
        'order' => 'integer',
        'is_completed' => 'boolean',
        'progress' => 'integer',
    ];

    public function course()
    {
        return $this->belongsTo(Course::class);
    }

    public function prerequisite()
    {
        return $this->belongsTo(LearningModule::class, 'prerequisite_module_id');
    }

    public function lessons()
    {
        return $this->hasMany(LearningLesson::class, 'module_id')->orderBy('order');
    }

    public function recalculateProgress(): int
    {
        $lessons = $this->lessons()->get();
        if ($lessons->isEmpty()) {
            $this->update(['progress' => 0, 'is_completed' => false]);
            return 0;
        }

        $completed = $lessons->where('is_completed', true)->count();
        $progress = (int) round(($completed / $lessons->count()) * 100);
        $this->update([
            'progress' => $progress,
            'is_completed' => ($progress >= 100),
        ]);

        return $progress;
    }
}
