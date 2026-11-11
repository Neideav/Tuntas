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
        // 1. Add resource_url to learning_lessons
        if (Schema::hasTable('learning_lessons') && !Schema::hasColumn('learning_lessons', 'resource_url')) {
            Schema::table('learning_lessons', function (Blueprint $table) {
                $table->string('resource_url')->nullable()->after('content');
            });
        }

        // 2. Add course_id and availability window to exam_blueprints
        if (Schema::hasTable('exam_blueprints')) {
            Schema::table('exam_blueprints', function (Blueprint $table) {
                if (!Schema::hasColumn('exam_blueprints', 'course_id')) {
                    $table->foreignId('course_id')->nullable()->after('user_id')->constrained('courses')->nullOnDelete();
                }
                if (!Schema::hasColumn('exam_blueprints', 'starts_at')) {
                    $table->timestamp('starts_at')->nullable()->after('max_attempts');
                }
                if (!Schema::hasColumn('exam_blueprints', 'ends_at')) {
                    $table->timestamp('ends_at')->nullable()->after('starts_at');
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('learning_lessons') && Schema::hasColumn('learning_lessons', 'resource_url')) {
            Schema::table('learning_lessons', function (Blueprint $table) {
                $table->dropColumn('resource_url');
            });
        }

        if (Schema::hasTable('exam_blueprints')) {
            Schema::table('exam_blueprints', function (Blueprint $table) {
                $table->dropConstrainedForeignId('course_id');
                $table->dropColumn(['starts_at', 'ends_at']);
            });
        }
    }
};

