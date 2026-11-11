<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations for Tuntas platform core modules.
     */
    public function up(): void
    {
        // 1. Categories
        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('color')->default('#06b6d4');
            $table->string('icon')->default('folder');
            $table->enum('type', ['task', 'project', 'examination', 'general'])->default('general');
            $table->timestamps();
        });

        // 2. Projects
        Schema::create('projects', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('category_id')->nullable()->constrained()->nullOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->enum('status', ['planning', 'in_progress', 'completed', 'on_hold'])->default('planning');
            $table->enum('priority', ['low', 'medium', 'high', 'urgent'])->default('medium');
            $table->integer('progress')->default(0);
            $table->date('start_date')->nullable();
            $table->date('deadline')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        // 3. Tasks (Advanced Task Management)
        Schema::create('tasks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('project_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignId('category_id')->nullable()->constrained()->nullOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->enum('status', ['todo', 'in_progress', 'completed', 'cancelled'])->default('todo');
            $table->enum('priority', ['low', 'medium', 'high', 'urgent'])->default('medium');
            $table->dateTime('due_date')->nullable();
            $table->dateTime('start_date')->nullable();
            $table->dateTime('reminder_at')->nullable();
            $table->boolean('is_recurring')->default(false);
            $table->string('recurrence_pattern')->nullable();
            $table->integer('order')->default(0);
            $table->dateTime('completed_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['user_id', 'status']);
            $table->index(['user_id', 'due_date']);
        });

        // 4. Subtasks
        Schema::create('subtasks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('task_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->boolean('is_completed')->default(false);
            $table->integer('order')->default(0);
            $table->timestamps();
        });

        // 5. Dedicated Examination Subsystem
        Schema::create('examinations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('category_id')->nullable()->constrained()->nullOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('subject');
            $table->date('examination_date');
            $table->string('start_time')->nullable();
            $table->string('end_time')->nullable();
            $table->integer('duration_minutes')->nullable();
            $table->string('location_platform')->nullable();
            $table->enum('status', ['upcoming', 'preparing', 'completed', 'missed', 'cancelled'])->default('upcoming');
            $table->text('notes')->nullable();
            $table->text('related_materials')->nullable();
            $table->decimal('score', 5, 2)->nullable();
            $table->decimal('passing_score', 5, 2)->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['user_id', 'examination_date']);
            $table->index(['user_id', 'status']);
        });

        // 6. Examination Preparations (Study Tasks/Schedule)
        Schema::create('examination_preparations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('examination_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->boolean('is_completed')->default(false);
            $table->date('due_date')->nullable();
            $table->integer('order')->default(0);
            $table->timestamps();
        });

        // 7. Tags & Polymorphic Relations
        Schema::create('tags', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('color')->default('#06b6d4');
            $table->timestamps();
        });

        Schema::create('taggables', function (Blueprint $table) {
            $table->foreignId('tag_id')->constrained()->cascadeOnDelete();
            $table->morphs('taggable');
            $table->primary(['tag_id', 'taggable_id', 'taggable_type']);
        });

        // 8. Notifications
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->text('message');
            $table->string('type')->default('system');
            $table->string('action_url')->nullable();
            $table->boolean('is_read')->default(false);
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'is_read']);
        });

        // 9. User Settings
        Schema::create('user_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('theme')->default('dark');
            $table->boolean('email_notifications')->default(true);
            $table->boolean('in_app_notifications')->default(true);
            $table->boolean('daily_digest')->default(false);
            $table->string('timezone')->default('UTC');
            $table->json('preferences')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('user_settings');
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('taggables');
        Schema::dropIfExists('tags');
        Schema::dropIfExists('examination_preparations');
        Schema::dropIfExists('examinations');
        Schema::dropIfExists('subtasks');
        Schema::dropIfExists('tasks');
        Schema::dropIfExists('projects');
        Schema::dropIfExists('categories');
    }
};

