<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use Illuminate\Http\Request;

class ProjectController extends Controller
{
    /**
     * List user projects.
     */
    public function index(Request $request)
    {
        $query = Project::where('user_id', $request->user()->id)
            ->with(['category'])
            ->withCount(['tasks', 'tasks as completed_tasks_count' => function ($q) {
                $q->where('status', 'completed');
            }]);

        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        if ($request->filled('q')) {
            $q = $request->q;
            $query->where('title', 'like', "%{$q}%");
        }

        $projects = $query->latest()->get();

        return response()->json([
            'success' => true,
            'data' => $projects,
        ]);
    }

    /**
     * Create a new project.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'category_id' => 'nullable|exists:categories,id',
            'status' => 'nullable|in:planning,in_progress,completed,on_hold',
            'priority' => 'nullable|in:low,medium,high,urgent',
            'start_date' => 'nullable|date',
            'deadline' => 'nullable|date',
        ]);

        $project = Project::create([
            'user_id' => $request->user()->id,
            'category_id' => $validated['category_id'] ?? null,
            'title' => $validated['title'],
            'description' => $validated['description'] ?? null,
            'status' => $validated['status'] ?? 'planning',
            'priority' => $validated['priority'] ?? 'medium',
            'start_date' => $validated['start_date'] ?? null,
            'deadline' => $validated['deadline'] ?? null,
            'progress' => 0,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Proyek berhasil dibuat',
            'data' => $project->load('category'),
        ], 201);
    }

    /**
     * Show a project with its tasks.
     */
    public function show(Request $request, Project $project)
    {
        if ($project->user_id !== $request->user()->id) {
            abort(403);
        }

        return response()->json([
            'success' => true,
            'data' => $project->load(['category', 'tasks.subtasks']),
        ]);
    }

    /**
     * Update an existing project.
     */
    public function update(Request $request, Project $project)
    {
        if ($project->user_id !== $request->user()->id) {
            abort(403);
        }

        $validated = $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'category_id' => 'nullable|exists:categories,id',
            'status' => 'nullable|in:planning,in_progress,completed,on_hold',
            'priority' => 'nullable|in:low,medium,high,urgent',
            'start_date' => 'nullable|date',
            'deadline' => 'nullable|date',
        ]);

        $project->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Proyek berhasil diperbarui',
            'data' => $project->load('category'),
        ]);
    }

    /**
     * Delete a project.
     */
    public function destroy(Request $request, Project $project)
    {
        if ($project->user_id !== $request->user()->id) {
            abort(403);
        }

        $project->delete();

        return response()->json([
            'success' => true,
            'message' => 'Proyek berhasil dihapus',
        ]);
    }
}

