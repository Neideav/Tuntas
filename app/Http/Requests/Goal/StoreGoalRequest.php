<?php

namespace App\Http\Requests\Goal;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreGoalRequest extends FormRequest
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
            'type' => 'nullable|in:standard,okr',
            'description' => 'nullable|string',
            'category_id' => [
                'nullable',
                Rule::exists('categories', 'id')->where(fn ($q) => $q->where('user_id', $userId)),
            ],
            'confidence_level' => 'nullable|in:low,medium,high',
            'start_date' => 'required|date',
            'target_date' => 'required|date|after_or_equal:start_date',
            'status' => 'nullable|in:not_started,in_progress,achieved,abandoned',
            'key_results' => 'nullable|array',
            'key_results.*.title' => 'required|string|max:255',
            'key_results.*.target_value' => 'required|numeric|min:0.01',
            'key_results.*.current_value' => 'nullable|numeric|min:0',
            'key_results.*.unit' => 'nullable|string|max:50',
            'key_results.*.weight' => 'nullable|numeric|min:0.1|max:10',
        ];
    }
}
