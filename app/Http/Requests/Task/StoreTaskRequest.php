<?php

namespace App\Http\Requests\Task;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreTaskRequest extends FormRequest
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
            'status' => 'nullable|in:todo,in_progress,in_review,completed,cancelled',
            'priority' => 'nullable|in:low,medium,high,urgent',
            'project_id' => [
                'nullable',
                Rule::exists('projects', 'id')->where(fn ($query) => $query->where('user_id', $userId)),
            ],
            'category_id' => [
                'nullable',
                Rule::exists('categories', 'id')->where(fn ($query) => $query->where('user_id', $userId)),
            ],
            'goal_id' => [
                'nullable',
                Rule::exists('goals', 'id')->where(fn ($query) => $query->where('user_id', $userId)),
            ],
            'start_date' => 'nullable|date',
            'due_date' => 'nullable|date|after_or_equal:start_date',
            'reminder_at' => 'nullable|date',
            'is_recurring' => 'nullable|boolean',
            'recurrence_pattern' => 'nullable|in:daily,weekly,monthly',
            'subtasks' => 'nullable|array',
            'subtasks.*.title' => 'required|string|max:255',
            'tags' => 'nullable|array',
            'tags.*' => 'string|max:50',
            'dependencies' => 'nullable|array',
            'dependencies.*' => [
                'integer',
                Rule::exists('tasks', 'id')->where(fn ($query) => $query->where('user_id', $userId)),
            ],
        ];
    }
}
