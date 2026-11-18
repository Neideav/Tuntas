<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Goal extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'user_id',
        'category_id',
        'title',
        'type',
        'description',
        'start_date',
        'target_date',
        'status',
        'progress',
        'confidence_level',
        'is_archived',
    ];

    protected $casts = [
        'start_date' => 'date',
        'target_date' => 'date',
        'progress' => 'integer',
        'is_archived' => 'boolean',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    public function milestones()
    {
        return $this->hasMany(GoalMilestone::class)->orderBy('order');
    }

    public function tasks()
    {
        return $this->hasMany(Task::class);
    }

    public function projects()
    {
        return $this->hasMany(Project::class);
    }

    /**
     * Recalculate OKR progress from Key Results (milestones) and linked tasks/projects.
     */
    public function recalculateProgress(): int
    {
        $milestones = $this->milestones()->get();
        $tasksCount = $this->tasks()->count();

        if ($milestones->isEmpty() && $tasksCount === 0) {
            return $this->progress;
        }

        $scores = [];
        $weights = [];

        if ($milestones->isNotEmpty()) {
            $milestoneWeightSum = 0;
            $milestoneRatioSum = 0;
            foreach ($milestones as $m) {
                $w = max(0.1, (float)($m->weight ?? 1.0));
                $ratio = $m->target_value > 0
                    ? min(1.0, max(0.0, (float)$m->current_value / (float)$m->target_value))
                    : ($m->is_completed ? 1.0 : 0.0);
                $milestoneRatioSum += $ratio * $w;
                $milestoneWeightSum += $w;
            }
            $milestoneAvg = $milestoneWeightSum > 0 ? ($milestoneRatioSum / $milestoneWeightSum) : 0;
            $scores[] = $milestoneAvg;
            $weights[] = $tasksCount > 0 ? 0.7 : 1.0;
        }

        if ($tasksCount > 0) {
            $completedTasks = $this->tasks()->where('status', 'completed')->count();
            $taskScore = $completedTasks / $tasksCount;
            $scores[] = $taskScore;
            $weights[] = $milestones->isNotEmpty() ? 0.3 : 1.0;
        }

        $finalScore = 0;
        $totalWeight = array_sum($weights);
        foreach ($scores as $idx => $s) {
            $finalScore += $s * ($weights[$idx] / $totalWeight);
        }

        $newProgress = (int) round($finalScore * 100);
        $this->update([
            'progress' => $newProgress,
            'status' => $newProgress >= 100 ? 'achieved' : ($newProgress > 0 ? 'in_progress' : $this->status),
        ]);

        return $newProgress;
    }
}
