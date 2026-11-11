<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Examination;
use App\Models\ExaminationPreparation;
use Illuminate\Http\Request;

class ExaminationController extends Controller
{
    /**
     * List user examinations (Dedicated Subsystem).
     */
    public function index(Request $request)
    {
        $query = Examination::where('user_id', $request->user()->id)
            ->with(['category', 'preparations']);

        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        if ($request->filled('subject')) {
            $query->where('subject', 'like', "%{$request->subject}%");
        }

        if ($request->filled('q')) {
            $q = $request->q;
            $query->where(function ($sub) use ($q) {
                $sub->where('title', 'like', "%{$q}%")
                    ->orWhere('subject', 'like', "%{$q}%")
                    ->orWhere('description', 'like', "%{$q}%");
            });
        }

        $examinations = $query->orderBy('examination_date', 'asc')->get();

        return response()->json([
            'success' => true,
            'data' => $examinations,
        ]);
    }

    /**
     * Create a new examination.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'subject' => 'required|string|max:100',
            'examination_date' => 'required|date',
            'start_time' => 'nullable|string',
            'end_time' => 'nullable|string',
            'duration_minutes' => 'nullable|integer|min:1',
            'location_platform' => 'nullable|string|max:255',
            'description' => 'nullable|string',
            'notes' => 'nullable|string',
            'category_id' => 'nullable|exists:categories,id',
            'status' => 'nullable|in:upcoming,preparing,completed,missed,cancelled',
            'passing_score' => 'nullable|numeric|min:0|max:100',
            'score' => 'nullable|numeric|min:0|max:100',
            'preparations' => 'nullable|array',
            'preparations.*.title' => 'required|string|max:255',
            'preparations.*.due_date' => 'nullable|date',
        ]);

        $exam = Examination::create([
            'user_id' => $request->user()->id,
            'category_id' => $validated['category_id'] ?? null,
            'title' => $validated['title'],
            'subject' => $validated['subject'],
            'examination_date' => $validated['examination_date'],
            'start_time' => $validated['start_time'] ?? null,
            'end_time' => $validated['end_time'] ?? null,
            'duration_minutes' => $validated['duration_minutes'] ?? null,
            'location_platform' => $validated['location_platform'] ?? null,
            'description' => $validated['description'] ?? null,
            'notes' => $validated['notes'] ?? null,
            'status' => $validated['status'] ?? 'upcoming',
            'passing_score' => $validated['passing_score'] ?? null,
            'score' => $validated['score'] ?? null,
        ]);

        if (! empty($validated['preparations'])) {
            foreach ($validated['preparations'] as $index => $prep) {
                $exam->preparations()->create([
                    'title' => $prep['title'],
                    'due_date' => $prep['due_date'] ?? null,
                    'order' => $index,
                ]);
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'Ujian berhasil dijadwalkan',
            'data' => $exam->load(['category', 'preparations']),
        ], 201);
    }

    /**
     * Show a specific examination and its study preparation items.
     */
    public function show(Request $request, Examination $examination)
    {
        $this->authorizeOwner($request, $examination);

        return response()->json([
            'success' => true,
            'data' => $examination->load(['category', 'preparations']),
        ]);
    }

    /**
     * Update an examination.
     */
    public function update(Request $request, Examination $examination)
    {
        $this->authorizeOwner($request, $examination);

        $validated = $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'subject' => 'sometimes|required|string|max:100',
            'examination_date' => 'sometimes|required|date',
            'start_time' => 'nullable|string',
            'end_time' => 'nullable|string',
            'duration_minutes' => 'nullable|integer|min:1',
            'location_platform' => 'nullable|string|max:255',
            'description' => 'nullable|string',
            'notes' => 'nullable|string',
            'category_id' => 'nullable|exists:categories,id',
            'status' => 'nullable|in:upcoming,preparing,completed,missed,cancelled',
            'passing_score' => 'nullable|numeric|min:0|max:100',
            'score' => 'nullable|numeric|min:0|max:100',
        ]);

        $examination->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Ujian berhasil diperbarui',
            'data' => $examination->load(['category', 'preparations']),
        ]);
    }

    /**
     * Delete an examination.
     */
    public function destroy(Request $request, Examination $examination)
    {
        $this->authorizeOwner($request, $examination);

        $examination->delete();

        return response()->json([
            'success' => true,
            'message' => 'Ujian berhasil dihapus',
        ]);
    }

    /**
     * Add a preparation study task to an examination.
     */
    public function addPreparation(Request $request, Examination $examination)
    {
        $this->authorizeOwner($request, $examination);

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'due_date' => 'nullable|date',
        ]);

        $maxOrder = $examination->preparations()->max('order') ?? -1;

        $prep = $examination->preparations()->create([
            'title' => $validated['title'],
            'due_date' => $validated['due_date'] ?? null,
            'order' => $maxOrder + 1,
            'is_completed' => false,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Persiapan ujian ditambahkan',
            'data' => $prep,
        ], 201);
    }

    /**
     * Toggle a preparation task.
     */
    public function togglePreparation(Request $request, ExaminationPreparation $preparation)
    {
        if ($preparation->examination->user_id !== $request->user()->id) {
            abort(403);
        }

        $preparation->update([
            'is_completed' => ! $preparation->is_completed,
        ]);

        return response()->json([
            'success' => true,
            'data' => $preparation,
        ]);
    }

    private function authorizeOwner(Request $request, Examination $examination): void
    {
        if ($examination->user_id !== $request->user()->id) {
            abort(403, 'Akses ditolak.');
        }
    }
}

