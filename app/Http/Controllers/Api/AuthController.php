<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use App\Models\UserSetting;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Register a new user and generate a Sanctum API token.
     */
    public function register(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'timezone' => 'UTC',
        ]);

        $user->email_verified_at = now();
        // Role assigned explicitly, bukan via mass-assignment, untuk mencegah privilege escalation
        $user->role = 'student';
        $user->save();

        // Initialize default user settings
        UserSetting::create([
            'user_id' => $user->id,
            'theme' => 'dark',
            'email_notifications' => true,
            'in_app_notifications' => true,
            'timezone' => 'UTC',
        ]);

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'Registrasi berhasil',
            'data' => [
                'user' => $user,
                'token' => $token,
                'token_type' => 'Bearer',
            ],
        ], 201);
    }

    /**
     * Authenticate user and issue Sanctum token.
     */
    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        $user = User::where('email', $credentials['email'])->first();

        if (! $user) {
            throw ValidationException::withMessages([
                'email' => ['Email belum terdaftar. Silakan buat akun terlebih dahulu.'],
            ]);
        }

        if (! Hash::check($credentials['password'], $user->password)) {
            throw ValidationException::withMessages([
                'password' => ['Kata sandi yang Anda masukkan salah. Silakan coba lagi.'],
            ]);
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'Login berhasil',
            'data' => [
                'user' => $user->load('settings'),
                'token' => $token,
                'token_type' => 'Bearer',
            ],
        ]);
    }

    /**
     * Terminate session and revoke current token.
     */
    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'success' => true,
            'message' => 'Logout berhasil',
        ]);
    }

    /**
     * Get the authenticated user profile.
     */
    public function me(Request $request)
    {
        return response()->json([
            'success' => true,
            'data' => $request->user()->load('settings'),
        ]);
    }

    /**
     * Update user profile information.
     */
    public function updateProfile(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'timezone' => 'nullable|string|max:50',
            'avatar' => 'nullable|url|max:500',
        ]);

        $user->update($validated);

        if (isset($validated['timezone'])) {
            UserSetting::updateOrCreate(['user_id' => $user->id], ['timezone' => $validated['timezone']]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Profil berhasil diperbarui',
            'data' => $user,
        ]);
    }

    /**
     * Update user password.
     */
    public function updatePassword(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'current_password' => 'required|string',
            'password' => 'required|string|min:8|confirmed',
        ]);

        if (! Hash::check($validated['current_password'], $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['Kata sandi saat ini tidak cocok.'],
            ]);
        }

        $user->update([
            'password' => Hash::make($validated['password']),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Kata sandi berhasil diperbarui',
        ]);
    }

    /**
     * Send password recovery link/token.
     */
    public function forgotPassword(Request $request)
    {
        $validated = $request->validate([
            'email' => 'required|email|exists:users,email',
        ], [
            'email.exists' => 'Email belum terdaftar di sistem kami.',
        ]);

        $user = User::where('email', $validated['email'])->first();

        // Generate cryptographically secure token
        $plainToken = Str::random(64);

        // Store hashed token in password_reset_tokens table
        DB::table('password_reset_tokens')->updateOrInsert(
            ['email' => $user->email],
            [
                'token' => Hash::make($plainToken),
                'created_at' => Carbon::now(),
            ]
        );

        Log::info("Password reset token generated for user [{$user->email}]");

        AuditLog::create([
            'user_id' => $user->id,
            'action' => 'auth.forgot_password_requested',
            'auditable_type' => User::class,
            'auditable_id' => $user->id,
            'payload' => ['email' => $user->email],
            'created_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Jika email terdaftar, tautan pemulihan kata sandi telah dikirim.',
            'data' => [
                'reset_token' => $plainToken,
            ],
        ]);
    }

    /**
     * Reset user password using valid token.
     */
    public function resetPassword(Request $request)
    {
        $validated = $request->validate([
            'email' => 'required|email|exists:users,email',
            'token' => 'required|string',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $record = DB::table('password_reset_tokens')->where('email', $validated['email'])->first();

        if (! $record) {
            throw ValidationException::withMessages([
                'token' => ['Token pemulihan kata sandi tidak valid atau belum pernah diajukan.'],
            ]);
        }

        // Expiration check (60 minutes)
        if (Carbon::parse($record->created_at)->addMinutes(60)->isPast()) {
            DB::table('password_reset_tokens')->where('email', $validated['email'])->delete();
            throw ValidationException::withMessages([
                'token' => ['Token pemulihan kata sandi telah kedaluwarsa. Silakan ajukan ulang.'],
            ]);
        }

        // Verify token match
        if (! Hash::check($validated['token'], $record->token)) {
            throw ValidationException::withMessages([
                'token' => ['Token pemulihan kata sandi tidak sesuai.'],
            ]);
        }

        $user = User::where('email', $validated['email'])->firstOrFail();

        // Update password
        $user->update([
            'password' => Hash::make($validated['password']),
        ]);

        // Invalidate used reset token
        DB::table('password_reset_tokens')->where('email', $validated['email'])->delete();

        // Revoke all existing Sanctum session tokens for security
        $user->tokens()->delete();

        AuditLog::create([
            'user_id' => $user->id,
            'action' => 'auth.password_reset_completed',
            'auditable_type' => User::class,
            'auditable_id' => $user->id,
            'payload' => ['email' => $user->email],
            'created_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Kata sandi Anda berhasil diperbarui. Silakan masuk menggunakan kata sandi baru.',
        ]);
    }
}

