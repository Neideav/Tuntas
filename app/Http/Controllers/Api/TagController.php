<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Tag;
use Illuminate\Http\Request;

class TagController extends Controller
{
    public function index(Request $request)
    {
        $tags = Tag::where('user_id', $request->user()->id)->get();

        return response()->json([
            'success' => true,
            'data' => $tags,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:50',
            'color' => 'nullable|string|max:20',
        ]);

        $tag = Tag::firstOrCreate([
            'user_id' => $request->user()->id,
            'name' => $validated['name'],
        ], [
            'color' => $validated['color'] ?? '#06b6d4',
        ]);

        return response()->json([
            'success' => true,
            'data' => $tag,
        ], 201);
    }

    public function update(Request $request, Tag $tag)
    {
        if ($tag->user_id !== $request->user()->id) {
            abort(403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:50',
            'color' => 'nullable|string|max:20',
        ]);

        $tag->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Tag berhasil diperbarui',
            'data' => $tag,
        ]);
    }

    public function destroy(Request $request, Tag $tag)
    {
        if ($tag->user_id !== $request->user()->id) {
            abort(403);
        }

        $tag->delete();

        return response()->json([
            'success' => true,
            'message' => 'Tag berhasil dihapus',
        ]);
    }
}
