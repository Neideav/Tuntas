<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\ProjectRole;
use App\Models\ReportReview;
use App\Models\Task;
use App\Models\User;
use App\Models\WorkReport;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GlobalReportsAndApprovalWorkflowTest extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected User $member;
    protected User $reviewer;
    protected User $outsider;
    protected Project $project;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create(['name' => 'Project Owner', 'email' => 'owner@tuntas.test']);
        $this->member = User::factory()->create(['name' => 'Team Member', 'email' => 'member@tuntas.test']);
        $this->reviewer = User::factory()->create(['name' => 'Lead Reviewer', 'email' => 'reviewer@tuntas.test']);
        $this->outsider = User::factory()->create(['name' => 'Outsider', 'email' => 'outsider@tuntas.test']);

        // Create Project owned by $owner
        $this->project = Project::create([
            'user_id' => $this->owner->id,
            'title' => 'Alpha Engineering',
            'status' => 'in_progress',
        ]);

        // Auto-initialize built-in roles
        ProjectRole::ensureBuiltinRolesForProject($this->project);
        $adminRole = ProjectRole::where('project_id', $this->project->id)->where('slug', ProjectRole::ROLE_ADMIN)->first();
        $memberRole = ProjectRole::where('project_id', $this->project->id)->where('slug', ProjectRole::ROLE_MEMBER)->first();

        // Assign $reviewer as Admin (has reports.review, reports.approve, reports.request_revision)
        ProjectMember::create([
            'project_id' => $this->project->id,
            'user_id' => $this->reviewer->id,
            'role_id' => $adminRole->id,
            'role' => 'admin',
        ]);

        // Assign $member as Member (has reports.view, reports.submit)
        ProjectMember::create([
            'project_id' => $this->project->id,
            'user_id' => $this->member->id,
            'role_id' => $memberRole->id,
            'role' => 'member',
        ]);
    }

    public function test_workspace_project_and_task_report_creation()
    {
        // 1. Workspace Report
        $response = $this->actingAs($this->member, 'sanctum')->postJson('/api/v1/reports', [
            'title' => 'Personal Exploration Notes',
            'content' => 'Completed initial research on containerization.',
            'context_type' => 'workspace',
            'type' => 'progress_report',
            'status' => 'submitted',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.context_type', 'workspace')
            ->assertJsonPath('data.status', 'submitted');

        // 2. Project Report (by authorized member)
        $projectResp = $this->actingAs($this->member, 'sanctum')->postJson('/api/v1/reports', [
            'title' => 'Alpha Sprint 1 Progress',
            'content' => 'Completed database migration and indexing.',
            'context_type' => 'project',
            'project_id' => $this->project->id,
            'type' => 'progress_report',
            'status' => 'submitted',
        ]);

        $projectResp->assertStatus(201)
            ->assertJsonPath('data.context_type', 'project')
            ->assertJsonPath('data.project_id', $this->project->id);

        // 3. Unauthorized user cannot submit report to project
        $outsiderResp = $this->actingAs($this->outsider, 'sanctum')->postJson('/api/v1/reports', [
            'title' => 'Illicit Project Report',
            'content' => 'Attempting submission.',
            'context_type' => 'project',
            'project_id' => $this->project->id,
            'status' => 'submitted',
        ]);

        $outsiderResp->assertStatus(403);
    }

    public function test_author_cannot_approve_their_own_report_self_approval_blocked()
    {
        // Owner submits a report
        $report = WorkReport::create([
            'user_id' => $this->owner->id,
            'project_id' => $this->project->id,
            'context_type' => 'project',
            'title' => 'Architecture Blueprint Finalization',
            'content' => 'Blueprint completed for cloud infrastructure.',
            'status' => WorkReport::STATUS_SUBMITTED,
            'version' => 1,
        ]);

        // Owner attempts to approve their OWN report -> MUST FAIL with 403
        $response = $this->actingAs($this->owner, 'sanctum')
            ->postJson("/api/v1/reports/{$report->id}/approve", [
                'feedback' => 'Self-approving my own brilliant work',
            ]);

        $response->assertStatus(403)
            ->assertJsonPath('success', false);

        // Verify report status remains submitted in database
        $this->assertEquals(WorkReport::STATUS_SUBMITTED, $report->fresh()->status);
    }

    public function test_unauthorized_user_cannot_review_or_approve_report()
    {
        // Member creates a report
        $report = WorkReport::create([
            'user_id' => $this->member->id,
            'project_id' => $this->project->id,
            'context_type' => 'project',
            'title' => 'Member Report',
            'content' => 'Feature development completed.',
            'status' => WorkReport::STATUS_SUBMITTED,
            'version' => 1,
        ]);

        // Outsider attempts to approve -> 403
        $respOutsider = $this->actingAs($this->outsider, 'sanctum')
            ->postJson("/api/v1/reports/{$report->id}/approve", [
                'feedback' => 'Outsider approval',
            ]);
        $respOutsider->assertStatus(403);

        // Another member with only reports.submit (without reports.approve) attempts to approve -> 403
        $anotherMember = User::factory()->create();
        $memberRole = ProjectRole::where('project_id', $this->project->id)->where('slug', ProjectRole::ROLE_MEMBER)->first();
        ProjectMember::create([
            'project_id' => $this->project->id,
            'user_id' => $anotherMember->id,
            'role_id' => $memberRole->id,
            'role' => 'member',
        ]);

        $respNoPerm = $this->actingAs($anotherMember, 'sanctum')
            ->postJson("/api/v1/reports/{$report->id}/approve", [
                'feedback' => 'Peer approval without permission',
            ]);
        $respNoPerm->assertStatus(403);
    }

    public function test_report_lifecycle_and_state_transitions()
    {
        // 1. Author saves draft
        $draftResp = $this->actingAs($this->member, 'sanctum')->postJson('/api/v1/reports', [
            'title' => 'Draft Feature Work',
            'content' => 'Initial draft notes.',
            'context_type' => 'project',
            'project_id' => $this->project->id,
            'status' => 'draft',
        ]);
        $draftResp->assertStatus(201);
        $reportId = $draftResp->json('data.id');

        // Reviewer attempts to approve a draft -> MUST FAIL with 422
        $illegalApprove = $this->actingAs($this->reviewer, 'sanctum')
            ->postJson("/api/v1/reports/{$reportId}/approve");
        $illegalApprove->assertStatus(422);

        // 2. Author submits draft
        $submitResp = $this->actingAs($this->member, 'sanctum')
            ->postJson("/api/v1/reports/{$reportId}/submit");
        $submitResp->assertStatus(200)
            ->assertJsonPath('data.status', 'submitted');

        // Author cannot submit again (duplicate submission) -> 422
        $duplicateSubmit = $this->actingAs($this->member, 'sanctum')
            ->postJson("/api/v1/reports/{$reportId}/submit");
        $duplicateSubmit->assertStatus(422);

        // 3. Reviewer starts review
        $startReview = $this->actingAs($this->reviewer, 'sanctum')
            ->postJson("/api/v1/reports/{$reportId}/start-review");
        $startReview->assertStatus(200)
            ->assertJsonPath('data.status', 'in_review');

        // 4. Reviewer requests revision with feedback
        $revResp = $this->actingAs($this->reviewer, 'sanctum')
            ->postJson("/api/v1/reports/{$reportId}/request-revision", [
                'feedback' => 'Please provide benchmarks and test coverage data.',
            ]);
        $revResp->assertStatus(200)
            ->assertJsonPath('data.status', 'revision_requested');

        // 5. Author revises and resubmits
        $resubmitResp = $this->actingAs($this->member, 'sanctum')
            ->postJson("/api/v1/reports/{$reportId}/resubmit", [
                'content' => 'Updated content with complete benchmark results.',
                'summary' => 'Added 95% test coverage benchmarks.',
            ]);
        $resubmitResp->assertStatus(200)
            ->assertJsonPath('data.status', 'submitted')
            ->assertJsonPath('data.version', 2);

        // 6. Reviewer approves revised version
        $approveResp = $this->actingAs($this->reviewer, 'sanctum')
            ->postJson("/api/v1/reports/{$reportId}/approve", [
                'feedback' => 'Benchmarks verified. Approved!',
            ]);
        $approveResp->assertStatus(200)
            ->assertJsonPath('data.status', 'approved');
    }

    public function test_mandatory_feedback_on_revision_and_rejection()
    {
        $report = WorkReport::create([
            'user_id' => $this->member->id,
            'project_id' => $this->project->id,
            'context_type' => 'project',
            'title' => 'Verification Report',
            'content' => 'Content here',
            'status' => WorkReport::STATUS_SUBMITTED,
            'version' => 1,
        ]);

        // Request revision without feedback -> 422
        $revEmpty = $this->actingAs($this->reviewer, 'sanctum')
            ->postJson("/api/v1/reports/{$report->id}/request-revision", [
                'feedback' => '',
            ]);
        $revEmpty->assertStatus(422);

        // Reject without feedback -> 422
        $rejectEmpty = $this->actingAs($this->reviewer, 'sanctum')
            ->postJson("/api/v1/reports/{$report->id}/reject", [
                'feedback' => '',
            ]);
        $rejectEmpty->assertStatus(422);

        // Reject with valid feedback -> 200
        $rejectValid = $this->actingAs($this->reviewer, 'sanctum')
            ->postJson("/api/v1/reports/{$report->id}/reject", [
                'feedback' => 'Did not meet technical requirements outlined in RFC.',
            ]);
        $rejectValid->assertStatus(200)
            ->assertJsonPath('data.status', 'rejected');
    }

    public function test_approved_report_cannot_be_modified()
    {
        $report = WorkReport::create([
            'user_id' => $this->member->id,
            'project_id' => $this->project->id,
            'context_type' => 'project',
            'title' => 'Final Approved Report',
            'content' => 'Locked content',
            'status' => WorkReport::STATUS_APPROVED,
            'version' => 1,
        ]);

        // Attempting to modify approved report -> MUST FAIL with 422
        $response = $this->actingAs($this->member, 'sanctum')
            ->putJson("/api/v1/reports/{$report->id}", [
                'title' => 'Sneaky Title Modification',
                'content' => 'Sneaky content change',
            ]);

        $response->assertStatus(422)
            ->assertJsonPath('success', false);

        $this->assertEquals('Locked content', $report->fresh()->content);
    }

    public function test_task_requires_report_cannot_be_completed_until_report_is_approved()
    {
        // Create task requiring report
        $task = Task::create([
            'user_id' => $this->owner->id,
            'project_id' => $this->project->id,
            'title' => 'Critical Backend Deployment',
            'status' => 'in_progress',
            'requires_report' => true,
        ]);

        // 1. Direct API update status to completed -> MUST FAIL with 422
        $updateResp = $this->actingAs($this->owner, 'sanctum')
            ->putJson("/api/v1/tasks/{$task->id}", [
                'status' => 'completed',
            ]);

        $updateResp->assertStatus(422)
            ->assertJsonPath('success', false);

        // 2. Toggle status -> MUST FAIL with 422
        $toggleResp = $this->actingAs($this->owner, 'sanctum')
            ->patchJson("/api/v1/tasks/{$task->id}/status");

        $toggleResp->assertStatus(422)
            ->assertJsonPath('success', false);

        // 3. Create a report for this task, but keep it submitted (unapproved)
        $report = WorkReport::create([
            'user_id' => $this->member->id,
            'project_id' => $this->project->id,
            'task_id' => $task->id,
            'context_type' => 'task',
            'title' => 'Deployment Verification Report',
            'content' => 'Verification logs attached.',
            'status' => WorkReport::STATUS_SUBMITTED,
            'version' => 1,
        ]);

        // Task still CANNOT be completed while report is unapproved
        $toggleResp2 = $this->actingAs($this->owner, 'sanctum')
            ->patchJson("/api/v1/tasks/{$task->id}/status");
        $toggleResp2->assertStatus(422);

        // 4. Reviewer approves the task report
        $approveResp = $this->actingAs($this->reviewer, 'sanctum')
            ->postJson("/api/v1/reports/{$report->id}/approve", [
                'feedback' => 'Verified deployment logs.',
            ]);
        $approveResp->assertStatus(200);

        // 5. Task completion is NOT automatic
        $this->assertEquals('in_progress', $task->fresh()->status);

        // 6. Now completing the task SUCCEEDS!
        $toggleResp3 = $this->actingAs($this->owner, 'sanctum')
            ->patchJson("/api/v1/tasks/{$task->id}/status");

        $toggleResp3->assertStatus(200)
            ->assertJsonPath('data.status', 'completed');
    }

    public function test_workspace_report_cannot_satisfy_task_completion_requirement()
    {
        $task = Task::create([
            'user_id' => $this->owner->id,
            'project_id' => $this->project->id,
            'title' => 'Specific Task Requiring Report',
            'status' => 'in_progress',
            'requires_report' => true,
        ]);

        // An approved workspace report exists (not attached to this task)
        WorkReport::create([
            'user_id' => $this->owner->id,
            'context_type' => 'workspace',
            'project_id' => null,
            'task_id' => null,
            'title' => 'General Workspace Report',
            'content' => 'Unrelated work',
            'status' => WorkReport::STATUS_APPROVED,
            'version' => 1,
        ]);

        // Task must STILL fail completion because it has no approved report attached to it
        $response = $this->actingAs($this->owner, 'sanctum')
            ->putJson("/api/v1/tasks/{$task->id}", [
                'status' => 'completed',
            ]);

        $response->assertStatus(422);
    }

    public function test_review_history_and_content_snapshots_are_preserved()
    {
        $report = WorkReport::create([
            'user_id' => $this->member->id,
            'project_id' => $this->project->id,
            'context_type' => 'project',
            'title' => 'Versioned Documentation',
            'summary' => 'Initial Summary',
            'content' => 'Initial Content v1',
            'status' => WorkReport::STATUS_SUBMITTED,
            'version' => 1,
        ]);

        // Reviewer requests revision
        $this->actingAs($this->reviewer, 'sanctum')
            ->postJson("/api/v1/reports/{$report->id}/request-revision", [
                'feedback' => 'Revise paragraph 2.',
            ]);

        // Verify ReportReview record was created with snapshot
        $review = ReportReview::where('work_report_id', $report->id)->first();
        $this->assertNotNull($review);
        $this->assertEquals(WorkReport::STATUS_REVISION_REQUESTED, $review->status);
        $this->assertEquals('Revise paragraph 2.', $review->feedback);
        $this->assertEquals(1, $review->version);
        $this->assertEquals('Initial Content v1', $review->report_snapshot['content']);
        $this->assertEquals('Versioned Documentation', $review->report_snapshot['title']);
    }
}
