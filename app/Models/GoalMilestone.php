<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class GoalMilestone extends Model
{
    use HasFactory;

    protected $fillable = [
        'goal_id',
        'title',
        'target_value',
        'current_value',
        'unit',
        'weight',
        'is_completed',
        'due_date',
        'order',
    ];

    protected $casts = [
        'target_value' => 'float',
        'current_value' => 'float',
        'weight' => 'float',
        'is_completed' => 'boolean',
        'due_date' => 'date',
        'order' => 'integer',
    ];

    public function goal()
    {
        return $this->belongsTo(Goal::class);
    }
}
