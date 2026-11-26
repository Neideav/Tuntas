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
        Schema::table('work_reports', function (Blueprint $table) {
            if (!Schema::hasColumn('work_reports', 'type')) {
                $table->string('type', 50)->default('progress_report')->after('reviewer_id');
            }
            if (!Schema::hasColumn('work_reports', 'context_type')) {
                $table->string('context_type', 30)->default('workspace')->after('type');
            }
            if (!Schema::hasColumn('work_reports', 'version')) {
                $table->unsignedInteger('version')->default(1)->after('status');
            }
            if (!Schema::hasColumn('work_reports', 'summary')) {
                $table->text('summary')->nullable()->after('content');
            }

            $table->index(['context_type', 'status']);
            $table->index(['type', 'status']);
        });

        Schema::table('report_reviews', function (Blueprint $table) {
            if (!Schema::hasColumn('report_reviews', 'report_snapshot')) {
                $table->json('report_snapshot')->nullable()->after('feedback');
            }
        });

        Schema::table('tasks', function (Blueprint $table) {
            if (!Schema::hasColumn('tasks', 'requires_report')) {
                $table->boolean('requires_report')->default(false)->after('order');
            }
            if (!Schema::hasColumn('tasks', 'requires_review')) {
                $table->boolean('requires_review')->default(false)->after('requires_report');
            }
            if (!Schema::hasColumn('tasks', 'completion_conditions')) {
                $table->json('completion_conditions')->nullable()->after('requires_review');
            }

            $table->index(['requires_report', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->dropIndex(['requires_report', 'status']);
            $table->dropColumn(['requires_report', 'requires_review', 'completion_conditions']);
        });

        Schema::table('report_reviews', function (Blueprint $table) {
            $table->dropColumn(['report_snapshot']);
        });

        Schema::table('work_reports', function (Blueprint $table) {
            $table->dropIndex(['context_type', 'status']);
            $table->dropIndex(['type', 'status']);
            $table->dropColumn(['type', 'context_type', 'version', 'summary']);
        });
    }
};
