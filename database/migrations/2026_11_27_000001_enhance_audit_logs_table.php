<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            if (!Schema::hasColumn('audit_logs', 'actor_id')) {
                $table->foreignId('actor_id')->nullable()->after('id')->constrained('users')->nullOnDelete();
            }
            if (!Schema::hasColumn('audit_logs', 'resource_type')) {
                $table->string('resource_type')->nullable()->after('action');
            }
            if (!Schema::hasColumn('audit_logs', 'resource_id')) {
                $table->string('resource_id')->nullable()->after('resource_type');
            }
            if (!Schema::hasColumn('audit_logs', 'context_type')) {
                $table->string('context_type')->nullable()->after('resource_id');
            }
            if (!Schema::hasColumn('audit_logs', 'context_id')) {
                $table->unsignedBigInteger('context_id')->nullable()->after('context_type');
            }
            if (!Schema::hasColumn('audit_logs', 'project_id')) {
                $table->foreignId('project_id')->nullable()->after('context_id')->constrained('projects')->nullOnDelete();
            }
            if (!Schema::hasColumn('audit_logs', 'old_values')) {
                $table->json('old_values')->nullable()->after('project_id');
            }
            if (!Schema::hasColumn('audit_logs', 'new_values')) {
                $table->json('new_values')->nullable()->after('old_values');
            }
            if (!Schema::hasColumn('audit_logs', 'metadata')) {
                $table->json('metadata')->nullable()->after('new_values');
            }
        });

        // Add performance indices
        try {
            Schema::table('audit_logs', function (Blueprint $table) {
                $table->index(['project_id', 'created_at']);
                $table->index(['context_type', 'context_id']);
                $table->index(['resource_type', 'resource_id']);
                $table->index(['actor_id', 'created_at']);
                $table->index('action');
            });
        } catch (\Throwable $e) {
            // Indices might already exist
        }
    }

    public function down(): void
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            $table->dropColumn([
                'actor_id',
                'resource_type',
                'resource_id',
                'context_type',
                'context_id',
                'project_id',
                'old_values',
                'new_values',
                'metadata',
            ]);
        });
    }
};
