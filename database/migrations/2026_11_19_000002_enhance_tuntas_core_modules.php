<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations for enhanced core productivity modules.
     */
    public function up(): void
    {
        // 1. Tasks: goal_id link
        Schema::table('tasks', function (Blueprint $table) {
            $table->foreignId('goal_id')->nullable()->after('category_id')->constrained('goals')->nullOnDelete();
        });

        // 2. Task dependencies (blocked_by / blocking)
        Schema::create('task_dependencies', function (Blueprint $table) {
            $table->foreignId('task_id')->constrained('tasks')->cascadeOnDelete();
            $table->foreignId('depends_on_task_id')->constrained('tasks')->cascadeOnDelete();
            $table->timestamps();

            $table->primary(['task_id', 'depends_on_task_id']);
            $table->index('depends_on_task_id');
        });

        // 3. Projects: goal_id, is_archived, health
        Schema::table('projects', function (Blueprint $table) {
            $table->foreignId('goal_id')->nullable()->after('category_id')->constrained('goals')->nullOnDelete();
            $table->string('health')->default('on_track')->after('progress');
            $table->boolean('is_archived')->default(false)->after('deadline');
        });

        // 4. Project Milestones
        Schema::create('project_milestones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->date('due_date')->nullable();
            $table->boolean('is_completed')->default(false);
            $table->integer('order')->default(0);
            $table->timestamps();

            $table->index(['project_id', 'is_completed']);
        });

        // 5. Habits: habit_type, target_value, selected_days
        Schema::table('habits', function (Blueprint $table) {
            $table->string('habit_type')->default('boolean')->after('frequency');
            $table->decimal('target_value', 10, 2)->default(1.0)->after('target_count');
            $table->json('selected_days')->nullable()->after('target_value');
        });

        // 6. Goals: type, confidence_level, is_archived
        Schema::table('goals', function (Blueprint $table) {
            $table->string('type')->default('standard')->after('title');
            $table->string('confidence_level')->default('medium')->after('progress');
            $table->boolean('is_archived')->default(false)->after('confidence_level');
        });

        // 7. Goal Milestones: weight
        Schema::table('goal_milestones', function (Blueprint $table) {
            $table->decimal('weight', 5, 2)->default(1.0)->after('unit');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('goal_milestones', function (Blueprint $table) {
            $table->dropColumn('weight');
        });

        Schema::table('goals', function (Blueprint $table) {
            $table->dropColumn(['type', 'confidence_level', 'is_archived']);
        });

        Schema::table('habits', function (Blueprint $table) {
            $table->dropColumn(['habit_type', 'target_value', 'selected_days']);
        });

        Schema::dropIfExists('project_milestones');

        Schema::table('projects', function (Blueprint $table) {
            $table->dropConstrainedForeignId('goal_id');
            $table->dropColumn(['health', 'is_archived']);
        });

        Schema::dropIfExists('task_dependencies');

        Schema::table('tasks', function (Blueprint $table) {
            $table->dropConstrainedForeignId('goal_id');
        });
    }
};
