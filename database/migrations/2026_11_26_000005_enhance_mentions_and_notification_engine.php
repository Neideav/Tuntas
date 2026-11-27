<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Add idempotency_key + metadata to notifications for queue-safe deduplication
        if (!Schema::hasColumn('notifications', 'idempotency_key')) {
            Schema::table('notifications', function (Blueprint $table) {
                $table->string('idempotency_key', 191)->nullable()->after('type');
                $table->json('meta')->nullable()->after('action_url');
                $table->index(['user_id', 'idempotency_key']);
            });
        }

        // 2. Add project_id + context to mentions (for cross-project isolation)
        if (!Schema::hasColumn('mentions', 'context_type')) {
            Schema::table('mentions', function (Blueprint $table) {
                $table->string('context_type')->nullable()->after('project_id');
                $table->string('fragment')->nullable()->after('context_type');
            });
        }

        // 3. Notification preferences per-type stored as JSON in user_settings.preferences
        // No schema change needed — the preferences JSON column already exists in user_settings.
        // We will seed the keys through the service layer.

        // 4. Add performance index on mentions for faster resolution
        try {
            Schema::table('mentions', function (Blueprint $table) {
                $table->index(['project_id', 'mentioned_role_id']);
            });
        } catch (\Throwable $e) {
            // Index may already exist
        }
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropColumn(['idempotency_key', 'meta']);
        });

        Schema::table('mentions', function (Blueprint $table) {
            $table->dropColumn(['context_type', 'fragment']);
        });
    }
};
