<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations for advanced Tuntas modules:
     * Habits, Goals, Learning Management, Dedicated Examination Assessment Engine, and Audit Logs.
     */
    public function up(): void
    {
        // ==========================================
        // 1. Habits & Habit Logs (Streak Engine)
        // ==========================================
        Schema::create('habits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->enum('frequency', ['daily', 'weekdays', 'weekly'])->default('daily');
            $table->integer('target_count')->default(1);
            $table->string('unit')->nullable();
            $table->string('color')->default('#10b981');
            $table->string('icon')->default('check');
            $table->integer('current_streak')->default(0);
            $table->integer('best_streak')->default(0);
            $table->integer('freeze_tokens')->default(0);
            $table->boolean('is_archived')->default(false);
            $table->timestamps();

            $table->index(['user_id', 'is_archived']);
        });

        Schema::create('habit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('habit_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->date('log_date');
            $table->integer('value')->default(1);
            $table->boolean('is_completed')->default(true);
            $table->boolean('used_freeze')->default(false);
            $table->string('notes')->nullable();
            $table->timestamps();

            $table->unique(['habit_id', 'log_date']);
            $table->index(['user_id', 'log_date']);
        });

        // ==========================================
        // 2. Goals & Goal Milestones (OKRs)
        // ==========================================
        Schema::create('goals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('category_id')->nullable()->constrained()->nullOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->date('start_date');
            $table->date('target_date');
            $table->enum('status', ['not_started', 'in_progress', 'achieved', 'abandoned'])->default('not_started');
            $table->integer('progress')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['user_id', 'status']);
        });

        Schema::create('goal_milestones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('goal_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->decimal('target_value', 10, 2)->default(100.0);
            $table->decimal('current_value', 10, 2)->default(0.0);
            $table->string('unit')->default('%');
            $table->boolean('is_completed')->default(false);
            $table->date('due_date')->nullable();
            $table->integer('order')->default(0);
            $table->timestamps();
        });

        // ==========================================
        // 3. Learning Management (LMS)
        // ==========================================
        Schema::create('courses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('category_id')->nullable()->constrained()->nullOnDelete();
            $table->string('title');
            $table->string('code')->nullable();
            $table->text('description')->nullable();
            $table->string('color')->default('#3b82f6');
            $table->boolean('is_published')->default(true);
            $table->integer('progress')->default(0);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('learning_modules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('course_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->integer('order')->default(0);
            $table->timestamps();
        });

        Schema::create('learning_lessons', function (Blueprint $table) {
            $table->id();
            $table->foreignId('module_id')->constrained('learning_modules')->cascadeOnDelete();
            $table->string('title');
            $table->longText('content')->nullable();
            $table->integer('duration_minutes')->default(15);
            $table->integer('order')->default(0);
            $table->boolean('is_completed')->default(false);
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('learning_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('course_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('lesson_id')->nullable()->constrained('learning_lessons')->nullOnDelete();
            $table->string('topic');
            $table->integer('duration_minutes');
            $table->text('notes')->nullable();
            $table->date('session_date');
            $table->timestamps();

            $table->index(['user_id', 'session_date']);
        });

        // ==========================================
        // 4. Dedicated Examination Subsystem Engine
        // ==========================================
        Schema::create('question_banks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->string('subject');
            $table->text('description')->nullable();
            $table->timestamps();
        });

        Schema::create('questions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('question_bank_id')->constrained()->cascadeOnDelete();
            $table->enum('type', [
                'multiple_choice_single',
                'multiple_choice_multiple',
                'true_false',
                'short_answer',
                'essay',
                'code_analysis'
            ])->default('multiple_choice_single');
            $table->text('prompt');
            $table->text('code_snippet')->nullable();
            $table->text('explanation')->nullable();
            $table->decimal('points', 5, 2)->default(1.0);
            $table->enum('difficulty', ['easy', 'medium', 'hard'])->default('medium');
            $table->timestamps();
        });

        Schema::create('question_options', function (Blueprint $table) {
            $table->id();
            $table->foreignId('question_id')->constrained()->cascadeOnDelete();
            $table->text('option_text');
            $table->boolean('is_correct')->default(false); // Evaluated securely on backend
            $table->integer('order')->default(0);
            $table->timestamps();
        });

        Schema::create('exam_blueprints', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->string('subject');
            $table->text('instructions')->nullable();
            $table->integer('duration_minutes')->default(60);
            $table->decimal('passing_score', 5, 2)->default(70.0);
            $table->boolean('shuffle_questions')->default(true);
            $table->boolean('shuffle_options')->default(true);
            $table->integer('max_attempts')->default(1);
            $table->boolean('is_published')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('exam_blueprint_questions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('exam_blueprint_id')->constrained()->cascadeOnDelete();
            $table->foreignId('question_id')->constrained()->cascadeOnDelete();
            $table->decimal('points', 5, 2)->default(1.0);
            $table->integer('order')->default(0);
            $table->timestamps();
        });

        Schema::create('exam_attempts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('exam_blueprint_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->enum('status', [
                'scheduled',
                'ready',
                'in_progress',
                'submitted',
                'grading',
                'completed',
                'expired'
            ])->default('ready');
            $table->timestamp('started_at')->nullable();
            $table->timestamp('expires_at')->nullable(); // Authoritative server timer
            $table->timestamp('submitted_at')->nullable();
            $table->decimal('total_points_earned', 6, 2)->default(0.0);
            $table->decimal('total_points_possible', 6, 2)->default(0.0);
            $table->decimal('score_percentage', 5, 2)->default(0.0);
            $table->boolean('is_passed')->default(false);
            $table->json('questions_snapshot'); // Immutable snapshot ensuring historical accuracy
            $table->timestamps();

            $table->index(['user_id', 'status']);
            $table->index(['exam_blueprint_id', 'user_id']);
        });

        Schema::create('exam_answers', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('exam_attempt_id')->constrained('exam_attempts')->cascadeOnDelete();
            $table->unsignedBigInteger('question_id');
            $table->json('selected_option_ids')->nullable();
            $table->text('text_response')->nullable();
            $table->boolean('is_correct')->nullable();
            $table->decimal('awarded_points', 5, 2)->default(0.0);
            $table->text('evaluator_feedback')->nullable();
            $table->boolean('is_flagged')->default(false);
            $table->timestamps();

            $table->unique(['exam_attempt_id', 'question_id']);
        });

        Schema::create('exam_integrity_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('exam_attempt_id')->constrained('exam_attempts')->cascadeOnDelete();
            $table->enum('event_type', [
                'tab_switch',
                'window_blur',
                'fullscreen_exit',
                'paste_detected',
                'ip_mismatch'
            ]);
            $table->string('details')->nullable();
            $table->timestamp('logged_at');
        });

        // ==========================================
        // 5. Audit & Activity Logs
        // ==========================================
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('action');
            $table->string('auditable_type');
            $table->string('auditable_id');
            $table->json('payload')->nullable();
            $table->string('ip_address')->nullable();
            $table->string('user_agent')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['user_id', 'action']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('exam_integrity_logs');
        Schema::dropIfExists('exam_answers');
        Schema::dropIfExists('exam_attempts');
        Schema::dropIfExists('exam_blueprint_questions');
        Schema::dropIfExists('exam_blueprints');
        Schema::dropIfExists('question_options');
        Schema::dropIfExists('questions');
        Schema::dropIfExists('question_banks');
        Schema::dropIfExists('learning_sessions');
        Schema::dropIfExists('learning_lessons');
        Schema::dropIfExists('learning_modules');
        Schema::dropIfExists('courses');
        Schema::dropIfExists('goal_milestones');
        Schema::dropIfExists('goals');
        Schema::dropIfExists('habit_logs');
        Schema::dropIfExists('habits');
    }
};
