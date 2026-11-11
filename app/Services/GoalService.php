<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Goal;
use App\Models\GoalMilestone;
use Illuminate\Support\Facades\DB;

class GoalService
{
    public function addMilestone(Goal $goal, array $data): GoalMilestone
    {
        return DB::transaction(function () use ($goal, $data) {
            $maxOrder = $goal->milestones()->max('order') ?? 0;
            $data['order'] = $data['order'] ?? ($maxOrder + 1);

            $milestone = $goal->milestones()->create($data);
            $goal->recalculateProgress();

            AuditLog::create([
                'user_id' => $goal->user_id,
                'action' => 'goal.milestone_added',
                'auditable_type' => Goal::class,
                'auditable_id' => (string) $goal->id,
                'payload' => ['milestone_id' => $milestone->id, 'title' => $milestone->title],
                'created_at' => now(),
            ]);

            return $milestone;
        });
    }

    public function updateMilestone(GoalMilestone $milestone, array $data): GoalMilestone
    {
        return DB::transaction(function () use ($milestone, $data) {
            // Auto-check is_completed if current_value reaches target_value
            if (isset($data['current_value']) && !isset($data['is_completed'])) {
                $target = $data['target_value'] ?? $milestone->target_value;
                if ($target > 0 && $data['current_value'] >= $target) {
                    $data['is_completed'] = true;
                }
            }

            $milestone->update($data);
            $goal = $milestone->goal;
            $goal->recalculateProgress();

            return $milestone->fresh();
        });
    }

    public function deleteMilestone(GoalMilestone $milestone): void
    {
        DB::transaction(function () use ($milestone) {
            $goal = $milestone->goal;
            $milestone->delete();
            $goal->recalculateProgress();
        });
    }
}

