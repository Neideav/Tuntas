<?php

namespace App\Http\Requests\Project;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreProjectRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $userId = $this->user()->id;

        return [
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'category_id' => [
                'nullable',
                Rule::exists('categories', 'id')->where(fn ($q) => $q->where('user_id', $userId)),
            ],
            'goal_id' => [
                'nullable',
                Rule::exists('goals', 'id')->where(fn ($q) => $q->where('user_id', $userId)),
            ],
            'status' => 'nullable|in:planning,in_progress,completed,on_hold',
            'priority' => 'nullable|in:low,medium,high,urgent',
            'health' => 'nullable|in:on_track,at_risk,off_track',
            'start_date' => 'nullable|date',
            'deadline' => 'nullable|date|after_or_equal:start_date',
            'milestones' => 'nullable|array',
            'milestones.*.title' => 'required|string|max:255',
            'milestones.*.due_date' => 'nullable|date',
        ];
    }
}
