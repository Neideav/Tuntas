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
        'description',
        'start_date',
        'target_date',
        'status',
        'progress',
    ];

    protected $casts = [
        'start_date' => 'date',
        'target_date' => 'date',
        'progress' => 'integer',
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

    public function recalculateProgress(): int
    {
        $milestones = $this->milestones;
        if ($milestones->isEmpty()) {
            return $this->progress;
        }

        $totalRatio = 0;
        foreach ($milestones as $m) {
            if ($m->target_value > 0) {
                $ratio = min(1.0, max(0.0, (float)$m->current_value / (float)$m->target_value));
                $totalRatio += $ratio;
            } elseif ($m->is_completed) {
                $totalRatio += 1.0;
            }
        }

        $newProgress = (int) round(($totalRatio / $milestones->count()) * 100);
        $this->update([
            'progress' => $newProgress,
            'status' => $newProgress >= 100 ? 'achieved' : ($newProgress > 0 ? 'in_progress' : $this->status),
        ]);

        return $newProgress;
    }
}

