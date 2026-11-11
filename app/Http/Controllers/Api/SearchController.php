<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Examination;
use App\Models\Project;
use App\Models\Task;
use Illuminate\Http\Request;

class SearchController extends Controller
{
    /**
     * Unified Global Search across Tasks, Projects, Examinations, and Categories.
     */
    public function search(Request $request)
    {
        $q = $request->get('q', '');
        $userId = $request->user()->id;

        if (empty(trim($q))) {
            return response()->json([
                'success' => true,
                'data' => [
                    'tasks' => [],
                    'projects' => [],
                    'examinations' => [],
                    'categories' => [],
                ],
            ]);
        }

        $tasks = Task::where('user_id', $userId)
            ->where(function ($query) use ($q) {
                $query->where('title', 'like', "%{$q}%")
                      ->orWhere('description', 'like', "%{$q}%");
            })
            ->limit(10)
            ->get();

        $projects = Project::where('user_id', $userId)
            ->where(function ($query) use ($q) {
                $query->where('title', 'like', "%{$q}%")
                      ->orWhere('description', 'like', "%{$q}%");
            })
            ->limit(10)
            ->get();

        $examinations = Examination::where('user_id', $userId)
            ->where(function ($query) use ($q) {
                $query->where('title', 'like', "%{$q}%")
                      ->orWhere('subject', 'like', "%{$q}%")
                      ->orWhere('description', 'like', "%{$q}%");
            })
            ->limit(10)
            ->get();

        $categories = Category::where('user_id', $userId)
            ->where('name', 'like', "%{$q}%")
            ->limit(5)
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'tasks' => $tasks,
                'projects' => $projects,
                'examinations' => $examinations,
                'categories' => $categories,
            ],
        ]);
    }
}

