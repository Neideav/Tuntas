<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations for collaboration, role-based access control,
     * global notes, work reports with approval workflow, mentions, and activity tracking.
     */
    public function up(): void
    {
        // 1. Project Roles (Built-in + Custom Roles)
        Schema::create('project_roles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->nullable()->constrained('projects')->cascadeOnDelete();
            $table->string('name');
            $table->string('slug');
            $table->text('description')->nullable();
            $table->boolean('is_builtin')->default(false);
            $table->json('permissions')->nullable();
            $table->timestamps();

            $table->index(['project_id', 'slug']);
        });

        // 2. Project Members (Pivot with Roles)
        Schema::create('project_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('role_id')->nullable()->constrained('project_roles')->nullOnDelete();
            $table->string('role')->default('member'); // owner, admin, member, viewer, or custom slug
            $table->timestamp('joined_at')->useCurrent();
            $table->timestamps();

            $table->unique(['project_id', 'user_id']);
            $table->index(['user_id', 'role']);
        });

        // 3. Project Invitations
        Schema::create('project_invitations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->foreignId('inviter_id')->constrained('users')->cascadeOnDelete();
            $table->string('email');
            $table->foreignId('role_id')->nullable()->constrained('project_roles')->nullOnDelete();
            $table->string('role')->default('member');
            $table->string('token', 64)->unique();
            $table->enum('status', ['pending', 'accepted', 'declined', 'expired'])->default('pending');
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();

            $table->index(['project_id', 'email']);
            $table->index(['token', 'status']);
        });

        // 4. Tasks: Add assigned_to for task delegation in collaborative projects
        if (!Schema::hasColumn('tasks', 'assigned_to')) {
            Schema::table('tasks', function (Blueprint $table) {
                $table->foreignId('assigned_to')->nullable()->after('user_id')->constrained('users')->nullOnDelete();
            });
        }

        // 5. Global Notes (Workspace context, Project context, Task context)
        Schema::create('notes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('project_id')->nullable()->constrained('projects')->cascadeOnDelete();
            $table->foreignId('task_id')->nullable()->constrained('tasks')->cascadeOnDelete();
            $table->string('title')->nullable();
            $table->longText('content');
            $table->string('color', 30)->default('#ffffff');
            $table->boolean('is_pinned')->default(false);
            $table->boolean('is_archived')->default(false);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['user_id', 'project_id']);
            $table->index(['project_id', 'task_id']);
            $table->index(['user_id', 'is_pinned']);
        });

        // 6. Global Reports (Workspace, Project, Task contexts with Review/Approval Workflow)
        Schema::create('work_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete(); // Author/Submitter
            $table->foreignId('project_id')->nullable()->constrained('projects')->cascadeOnDelete();
            $table->foreignId('task_id')->nullable()->constrained('tasks')->cascadeOnDelete();
            $table->foreignId('reviewer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('title');
            $table->longText('content');
            $table->enum('status', [
                'draft',
                'submitted',
                'in_review',
                'approved',
                'revision_requested',
                'rejected'
            ])->default('submitted');
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->json('metrics')->nullable(); // e.g. hours_spent, deliverables, attachments
            $table->timestamps();
            $table->softDeletes();

            $table->index(['user_id', 'status']);
            $table->index(['project_id', 'status']);
            $table->index(['task_id', 'status']);
        });

        // 7. Report Reviews (Historical audit trail of approval/revision decisions)
        Schema::create('report_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('work_report_id')->constrained('work_reports')->cascadeOnDelete();
            $table->foreignId('reviewer_id')->constrained('users')->cascadeOnDelete();
            $table->enum('status', ['approved', 'revision_requested', 'rejected']);
            $table->text('feedback')->nullable();
            $table->integer('version')->default(1);
            $table->timestamps();

            $table->index(['work_report_id', 'version']);
        });

        // 8. User & Role Mentions
        Schema::create('mentions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('mentioner_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('mentioned_user_id')->nullable()->constrained('users')->cascadeOnDelete();
            $table->foreignId('mentioned_role_id')->nullable()->constrained('project_roles')->cascadeOnDelete();
            $table->string('mentionable_type');
            $table->unsignedBigInteger('mentionable_id');
            $table->foreignId('project_id')->nullable()->constrained('projects')->cascadeOnDelete();
            $table->timestamps();

            $table->index(['mentionable_type', 'mentionable_id']);
            $table->index(['mentioned_user_id', 'created_at']);
            $table->index(['mentioned_role_id', 'created_at']);
        });

        // 9. Audit Logs: Add project_id to enable project-scoped activity timeline
        if (!Schema::hasColumn('audit_logs', 'project_id')) {
            Schema::table('audit_logs', function (Blueprint $table) {
                $table->foreignId('project_id')->nullable()->after('user_id')->constrained('projects')->nullOnDelete();
                $table->index(['project_id', 'created_at']);
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('audit_logs', 'project_id')) {
            Schema::table('audit_logs', function (Blueprint $table) {
                $table->dropConstrainedForeignId('project_id');
            });
        }

        Schema::dropIfExists('mentions');
        Schema::dropIfExists('report_reviews');
        Schema::dropIfExists('work_reports');
        Schema::dropIfExists('notes');

        if (Schema::hasColumn('tasks', 'assigned_to')) {
            Schema::table('tasks', function (Blueprint $table) {
                $table->dropConstrainedForeignId('assigned_to');
            });
        }

        Schema::dropIfExists('project_invitations');
        Schema::dropIfExists('project_members');
        Schema::dropIfExists('project_roles');
    }
};
