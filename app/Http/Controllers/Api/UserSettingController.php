<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\UserSetting;
use Illuminate\Http\Request;

class UserSettingController extends Controller
{
    public function show(Request $request)
    {
        $settings = UserSetting::firstOrCreate([
            'user_id' => $request->user()->id,
        ], [
            'theme' => 'dark',
            'email_notifications' => true,
            'in_app_notifications' => true,
            'timezone' => 'UTC',
        ]);

        return response()->json([
            'success' => true,
            'data' => $settings,
        ]);
    }

    public function update(Request $request)
    {
        $settings = UserSetting::firstOrCreate([
            'user_id' => $request->user()->id,
        ]);

        $validated = $request->validate([
            'theme' => 'nullable|string|in:dark,light,cyber',
            'email_notifications' => 'nullable|boolean',
            'in_app_notifications' => 'nullable|boolean',
            'daily_digest' => 'nullable|boolean',
            'timezone' => 'nullable|string|max:50',
            'preferences' => 'nullable|array',
        ]);

        $settings->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Pengaturan berhasil disimpan',
            'data' => $settings,
        ]);
    }
}

