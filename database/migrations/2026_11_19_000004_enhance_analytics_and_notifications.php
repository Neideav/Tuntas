<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Add is_archived and archived_at to notifications table if not already added
        if (!Schema::hasColumn('notifications', 'is_archived')) {
            Schema::table('notifications', function (Blueprint $table) {
                $table->boolean('is_archived')->default(false)->after('is_read');
                $table->timestamp('archived_at')->nullable()->after('read_at');
            });
        }

        try {
            Schema::table('notifications', function (Blueprint $table) {
                $table->index(['user_id', 'is_archived']);
                $table->index(['user_id', 'type']);
            });
        } catch (\Throwable $e) {}

        // 2. Add performance indexes for analytics aggregations
        try {
            Schema::table('tasks', function (Blueprint $table) {
                $table->index(['user_id', 'status', 'due_date']);
                $table->index(['user_id', 'completed_at']);
            });
        } catch (\Throwable $e) {}

        try {
            Schema::table('learning_sessions', function (Blueprint $table) {
                $table->index(['user_id', 'status']);
            });
        } catch (\Throwable $e) {}

        try {
            Schema::table('exam_attempts', function (Blueprint $table) {
                $table->index(['user_id', 'status', 'submitted_at']);
            });
        } catch (\Throwable $e) {}
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('notifications', 'is_archived')) {
            Schema::table('notifications', function (Blueprint $table) {
                $table->dropColumn(['is_archived', 'archived_at']);
            });
        }
    }
};
