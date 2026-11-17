<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Category;
use App\Models\Goal;
use App\Models\GoalMilestone;
use App\Models\Habit;
use App\Models\HabitLog;
use App\Models\Task;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ActivityAndNavigationTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;
    protected User $otherUser;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create([
            'name' => 'Ichih Caroline',
            'email' => 'caroline@tuntas.test',
            'timezone' => 'Asia/Jakarta',
        ]);

        $this->otherUser = User::factory()->create([
            'name' => 'Other Tenant',
            'email' => 'other@tuntas.test',
        ]);
    }

    public function test_activity_endpoint_requires_authentication(): void
    {
        $response = $this->getJson('/api/v1/activity');
        $response->assertStatus(401);
    }

    public function test_activity_endpoint_returns_user_audit_logs_with_proper_isolation(): void
    {
        // 1. Create audit logs for target user
        AuditLog::create([
            'user_id' => $this->user->id,
            'action' => 'goal.created',
            'auditable_type' => Goal::class,
            'auditable_id' => 1,
            'payload' => ['title' => 'Complete System Design'],
            'created_at' => Carbon::now()->subMinutes(10),
        ]);

        AuditLog::create([
            'user_id' => $this->user->id,
            'action' => 'habit.completed',
            'auditable_type' => Habit::class,
            'auditable_id' => 1,
            'payload' => ['title' => 'Daily LeetCode Problem'],
            'created_at' => Carbon::now()->subMinutes(5),
        ]);

        // 2. Create audit log for other tenant
        AuditLog::create([
            'user_id' => $this->otherUser->id,
            'action' => 'exam.attempt_submitted',
            'auditable_type' => 'App\Models\ExamAttempt',
            'auditable_id' => 99,
            'payload' => ['title' => 'Secret Tenant Exam'],
            'created_at' => Carbon::now()->subMinutes(2),
        ]);

        // 3. Query as target user
        $response = $this->actingAs($this->user)
            ->getJson('/api/v1/activity');

        $response->assertStatus(200)
            ->assertJsonPath('success', true);

        $data = $response->json('data');
        $this->assertCount(2, $data);
        $this->assertEquals('habit.completed', $data[0]['action']);
        $this->assertEquals('goal.created', $data[1]['action']);

        // Assert other tenant log is NOT present
        $actions = array_column($data, 'action');
        $this->assertNotContains('exam.attempt_submitted', $actions);
    }

    public function test_category_index_returns_counts_for_navigation_badges(): void
    {
        $cat = Category::create([
            'user_id' => $this->user->id,
            'name' => 'Administrator',
            'color' => '#0284c7',
        ]);

        Task::create([
            'user_id' => $this->user->id,
            'category_id' => $cat->id,
            'title' => 'NDA Documents Templates',
            'status' => 'todo',
            'priority' => 'medium',
        ]);

        Task::create([
            'user_id' => $this->user->id,
            'category_id' => $cat->id,
            'title' => 'Set Up Meeting With Clients',
            'status' => 'in_progress',
            'priority' => 'high',
        ]);

        $response = $this->actingAs($this->user)
            ->getJson('/api/v1/categories');

        $response->assertStatus(200)
            ->assertJsonPath('success', true);

        $data = $response->json('data');
        $this->assertNotEmpty($data);
        $this->assertEquals('Administrator', $data[0]['name']);
        $this->assertEquals(2, $data[0]['tasks_count']);
    }

    public function test_user_profile_update_and_synchronization(): void
    {
        $response = $this->actingAs($this->user)
            ->putJson('/api/v1/auth/profile', [
                'name' => 'Ichih Caroline Updated',
                'timezone' => 'Asia/Makassar',
            ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.name', 'Ichih Caroline Updated');

        $this->assertDatabaseHas('users', [
            'id' => $this->user->id,
            'name' => 'Ichih Caroline Updated',
            'timezone' => 'Asia/Makassar',
        ]);
    }

    public function test_habit_history_and_consistency_analytics(): void
    {
        $habit = Habit::create([
            'user_id' => $this->user->id,
            'title' => 'Daily LeetCode Problem',
            'frequency' => 'daily',
            'current_streak' => 3,
            'best_streak' => 5,
            'freeze_tokens' => 2,
        ]);

        HabitLog::create([
            'user_id' => $this->user->id,
            'habit_id' => $habit->id,
            'log_date' => Carbon::today()->subDays(2)->toDateString(),
            'is_completed' => true,
        ]);

        HabitLog::create([
            'user_id' => $this->user->id,
            'habit_id' => $habit->id,
            'log_date' => Carbon::today()->subDay()->toDateString(),
            'is_completed' => true,
        ]);

        $response = $this->actingAs($this->user)
            ->getJson("/api/v1/habits/{$habit->id}/history?days=30");

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.statistics.current_streak', 3)
            ->assertJsonPath('data.statistics.total_completions', 2);
    }

    public function test_goal_milestone_deletion_and_recalculation(): void
    {
        $goal = Goal::create([
            'user_id' => $this->user->id,
            'title' => 'Master Distributed Systems',
            'start_date' => Carbon::today()->toDateString(),
            'target_date' => Carbon::today()->addMonths(3)->toDateString(),
            'status' => 'in_progress',
            'progress' => 50,
        ]);

        $m1 = GoalMilestone::create([
            'goal_id' => $goal->id,
            'title' => 'Finish Raft Protocol implementation',
            'target_value' => 100,
            'current_value' => 100,
            'unit' => '%',
            'is_completed' => true,
        ]);

        $m2 = GoalMilestone::create([
            'goal_id' => $goal->id,
            'title' => 'Read OSDI Papers',
            'target_value' => 10,
            'current_value' => 0,
            'unit' => 'papers',
            'is_completed' => false,
        ]);

        // Delete m2 -> now m1 is the only milestone and it is 100% completed
        $response = $this->actingAs($this->user)
            ->deleteJson("/api/v1/milestones/{$m2->id}");

        $response->assertStatus(200)
            ->assertJsonPath('success', true);

        $this->assertDatabaseMissing('goal_milestones', ['id' => $m2->id]);

        // Refresh goal and verify progress recalculated to 100%
        $goal->refresh();
        $this->assertEquals(100, $goal->progress);
    }
}
