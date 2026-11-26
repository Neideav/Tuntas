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
        // 1. Enhance notes table with context_type, context_id, status, visibility, version, tags
        Schema::table('notes', function (Blueprint $table) {
            if (!Schema::hasColumn('notes', 'context_type')) {
                $table->enum('context_type', ['workspace', 'project', 'task'])->default('workspace')->after('user_id');
            }
            if (!Schema::hasColumn('notes', 'context_id')) {
                $table->unsignedBigInteger('context_id')->nullable()->after('context_type');
            }
            if (!Schema::hasColumn('notes', 'status')) {
                $table->enum('status', ['draft', 'published', 'archived'])->default('published')->after('content');
            }
            if (!Schema::hasColumn('notes', 'visibility')) {
                $table->enum('visibility', ['private', 'team', 'public'])->default('team')->after('status');
            }
            if (!Schema::hasColumn('notes', 'version')) {
                $table->unsignedInteger('version')->default(1)->after('visibility');
            }
            if (!Schema::hasColumn('notes', 'tags')) {
                $table->json('tags')->nullable()->after('color');
            }

            $table->index(['context_type', 'context_id']);
            $table->index(['status', 'is_pinned']);
        });

        // 2. Note Versions Table (Historical snapshots & conflict resolution)
        if (!Schema::hasTable('note_versions')) {
            Schema::create('note_versions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('note_id')->constrained('notes')->cascadeOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->unsignedInteger('version');
                $table->string('title')->nullable();
                $table->longText('content');
                $table->string('summary')->nullable(); // e.g. "Auto-saved snapshot", "Converted to task", etc.
                $table->timestamps();

                $table->index(['note_id', 'version']);
            });
        }

        // 3. Note Comments Table (Threaded discussion with parent_id)
        if (!Schema::hasTable('note_comments')) {
            Schema::create('note_comments', function (Blueprint $table) {
                $table->id();
                $table->foreignId('note_id')->constrained('notes')->cascadeOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->foreignId('parent_id')->nullable()->constrained('note_comments')->cascadeOnDelete();
                $table->text('content');
                $table->timestamps();

                $table->index(['note_id', 'created_at']);
                $table->index(['parent_id']);
            });
        }

        // 4. Note Attachments Table
        if (!Schema::hasTable('note_attachments')) {
            Schema::create('note_attachments', function (Blueprint $table) {
                $table->id();
                $table->foreignId('note_id')->constrained('notes')->cascadeOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->string('file_name');
                $table->string('file_path');
                $table->unsignedBigInteger('file_size');
                $table->string('file_type')->nullable();
                $table->timestamps();

                $table->index(['note_id', 'created_at']);
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('note_attachments');
        Schema::dropIfExists('note_comments');
        Schema::dropIfExists('note_versions');

        Schema::table('notes', function (Blueprint $table) {
            $table->dropIndex(['context_type', 'context_id']);
            $table->dropIndex(['status', 'is_pinned']);

            $table->dropColumn(['context_type', 'context_id', 'status', 'visibility', 'version', 'tags']);
        });
    }
};
