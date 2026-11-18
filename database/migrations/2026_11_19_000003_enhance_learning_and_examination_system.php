<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations for enhanced learning management and examination subsystems.
     */
    public function up(): void
    {
        // 1. Courses enhancements
        Schema::table('courses', function (Blueprint $table) {
            $table->text('overview')->nullable()->after('description');
            $table->json('learning_objectives')->nullable()->after('overview');
            $table->integer('estimated_duration')->default(0)->after('learning_objectives'); // minutes
            $table->string('status')->default('published')->after('estimated_duration');
        });

        // 2. Learning Modules enhancements
        Schema::table('learning_modules', function (Blueprint $table) {
            $table->boolean('is_completed')->default(false)->after('order');
            $table->integer('progress')->default(0)->after('is_completed');
            $table->foreignId('prerequisite_module_id')->nullable()->after('progress')->constrained('learning_modules')->nullOnDelete();
        });

        // 3. Learning Lessons enhancements
        Schema::table('learning_lessons', function (Blueprint $table) {
            $table->string('video_url')->nullable()->after('resource_url');
            $table->string('attachment_url')->nullable()->after('video_url');
            $table->string('lesson_type')->default('text')->after('attachment_url');
            $table->text('notes')->nullable()->after('lesson_type');
        });

        // 4. Learning Sessions study timer lifecycle
        Schema::table('learning_sessions', function (Blueprint $table) {
            $table->timestamp('started_at')->nullable()->after('duration_minutes');
            $table->timestamp('ended_at')->nullable()->after('started_at');
            $table->timestamp('paused_at')->nullable()->after('ended_at');
            $table->string('status')->default('completed')->after('paused_at'); // active, paused, completed
            $table->integer('accumulated_seconds')->default(0)->after('status');
        });

        // 5. Exam Blueprints configuration
        Schema::table('exam_blueprints', function (Blueprint $table) {
            $table->boolean('allow_partial_scoring')->default(true)->after('passing_score');
            $table->decimal('negative_marking', 4, 2)->default(0.0)->after('allow_partial_scoring');
            $table->json('sections')->nullable()->after('negative_marking');
            $table->json('rubrics')->nullable()->after('sections');
        });

        // 6. Exam Attempts flagged questions
        Schema::table('exam_attempts', function (Blueprint $table) {
            $table->json('flagged_question_ids')->nullable()->after('answer_key_snapshot');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('exam_attempts', function (Blueprint $table) {
            $table->dropColumn('flagged_question_ids');
        });

        Schema::table('exam_blueprints', function (Blueprint $table) {
            $table->dropColumn(['allow_partial_scoring', 'negative_marking', 'sections', 'rubrics']);
        });

        Schema::table('learning_sessions', function (Blueprint $table) {
            $table->dropColumn(['started_at', 'ended_at', 'paused_at', 'status', 'accumulated_seconds']);
        });

        Schema::table('learning_lessons', function (Blueprint $table) {
            $table->dropColumn(['video_url', 'attachment_url', 'lesson_type', 'notes']);
        });

        Schema::table('learning_modules', function (Blueprint $table) {
            $table->dropConstrainedForeignId('prerequisite_module_id');
            $table->dropColumn(['is_completed', 'progress']);
        });

        Schema::table('courses', function (Blueprint $table) {
            $table->dropColumn(['overview', 'learning_objectives', 'estimated_duration', 'status']);
        });
    }
};
