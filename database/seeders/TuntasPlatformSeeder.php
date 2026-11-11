<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Course;
use App\Models\ExamBlueprint;
use App\Models\Examination;
use App\Models\Goal;
use App\Models\Habit;
use App\Models\HabitLog;
use App\Models\Notification;
use App\Models\Project;
use App\Models\QuestionBank;
use App\Models\Tag;
use App\Models\Task;
use App\Models\User;
use App\Models\UserSetting;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class TuntasPlatformSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Primary Demo User
        $user = User::firstOrCreate(
            ['email' => 'demo@tuntas.test'],
            [
                'name' => 'Aditya Pratama',
                'password' => Hash::make('Password123!'),
                'role' => 'student',
                'timezone' => 'Asia/Jakarta',
            ]
        );

        // 2. Settings
        UserSetting::updateOrCreate(
            ['user_id' => $user->id],
            [
                'theme' => 'cyberpunk',
                'email_notifications' => true,
                'in_app_notifications' => true,
                'daily_digest' => true,
                'timezone' => 'Asia/Jakarta',
            ]
        );

        // 3. Categories & Tags
        $techCat = Category::firstOrCreate(
            ['user_id' => $user->id, 'name' => 'Computer Science'],
            ['color' => '#3b82f6', 'icon' => 'code']
        );
        $mathCat = Category::firstOrCreate(
            ['user_id' => $user->id, 'name' => 'Mathematics'],
            ['color' => '#8b5cf6', 'icon' => 'calculator']
        );

        $tagSprint = Tag::firstOrCreate(['user_id' => $user->id, 'name' => 'Sprint 1'], ['color' => '#ec4899']);
        $tagExam = Tag::firstOrCreate(['user_id' => $user->id, 'name' => 'Exam Prep'], ['color' => '#f59e0b']);

        // 4. Project & Tasks
        $project = Project::firstOrCreate(
            ['user_id' => $user->id, 'title' => 'Tuntas Monorepo Architecture'],
            [
                'description' => 'Architecting and delivering Next.js + Laravel monorepo with high integrity assessment engine.',
                'status' => 'in_progress',
                'priority' => 'high',
                'start_date' => Carbon::today()->subDays(5),
                'deadline' => Carbon::today()->addDays(15),
                'category_id' => $techCat->id,
            ]
        );

        $task1 = Task::firstOrCreate(
            ['user_id' => $user->id, 'title' => 'Design Normalized Database Schema'],
            [
                'project_id' => $project->id,
                'category_id' => $techCat->id,
                'description' => 'Implement migrations for advanced assessment, habits, goals, and learning modules.',
                'status' => 'completed',
                'priority' => 'urgent',
                'due_date' => Carbon::today()->subDay(),
                'completed_at' => Carbon::now()->subDay(),
            ]
        );

        $task2 = Task::firstOrCreate(
            ['user_id' => $user->id, 'title' => 'Implement Examination Auto-Grading Engine'],
            [
                'project_id' => $project->id,
                'category_id' => $techCat->id,
                'description' => 'Author authoritative grading service with snapshot integrity and anti-cheat tracking.',
                'status' => 'in_progress',
                'priority' => 'high',
                'due_date' => Carbon::today()->addDays(2),
            ]
        );

        $task2->subtasks()->firstOrCreate(['title' => 'Validate single and multiple choice keys']);
        $task2->subtasks()->firstOrCreate(['title' => 'Implement server expiration guard']);
        $task2->subtasks()->firstOrCreate(['title' => 'Write automated PHPUnit test scenarios']);

        // 5. Operational Examination & Checklist
        $exam = Examination::firstOrCreate(
            ['user_id' => $user->id, 'title' => 'Cloud Architecture Certification'],
            [
                'subject' => 'System Design & Distributed Computing',
                'examination_date' => Carbon::today()->addDays(10),
                'start_time' => '09:00',
                'end_time' => '11:00',
                'duration_minutes' => 120,
                'location_platform' => 'Pearson VUE Online Proctored',
                'category_id' => $techCat->id,
                'status' => 'upcoming',
                'passing_score' => 70.0,
            ]
        );

        $exam->preparations()->firstOrCreate(['title' => 'Review AWS Whitepapers and Well-Architected Framework']);
        $exam->preparations()->firstOrCreate(['title' => 'Complete 3 Practice Exam Sets on Pearson VUE Simulator']);

        // 6. Habit Tracking
        $habit1 = Habit::firstOrCreate(
            ['user_id' => $user->id, 'title' => 'Daily LeetCode Problem'],
            [
                'frequency' => 'daily',
                'target_count' => 1,
                'color' => '#10b981',
                'icon' => 'code',
                'current_streak' => 5,
                'best_streak' => 12,
                'freeze_tokens' => 2,
            ]
        );

        for ($i = 0; $i < 5; $i++) {
            HabitLog::updateOrCreate(
                ['habit_id' => $habit1->id, 'log_date' => Carbon::today()->subDays($i)->toDateString()],
                ['user_id' => $user->id, 'value' => 1, 'is_completed' => true]
            );
        }

        // 7. Goals & Milestones
        $goal = Goal::firstOrCreate(
            ['user_id' => $user->id, 'title' => 'Become Principal Cloud Solutions Architect'],
            [
                'category_id' => $techCat->id,
                'start_date' => Carbon::today()->subMonths(1),
                'target_date' => Carbon::today()->addMonths(5),
                'status' => 'in_progress',
                'progress' => 50,
            ]
        );

        $goal->milestones()->firstOrCreate(
            ['title' => 'Pass AWS Solutions Architect Professional'],
            ['target_value' => 100, 'current_value' => 100, 'unit' => '%', 'is_completed' => true]
        );
        $goal->milestones()->firstOrCreate(
            ['title' => 'Architect & Deploy 3 Multi-Region Terraform Stacks'],
            ['target_value' => 3, 'current_value' => 0, 'unit' => 'stacks', 'is_completed' => false]
        );
        $goal->recalculateProgress();

        // 8. Learning Course & Lessons
        $course = Course::firstOrCreate(
            ['user_id' => $user->id, 'title' => 'Modern Distributed Systems with Go & Docker'],
            [
                'category_id' => $techCat->id,
                'code' => 'CS-501',
                'color' => '#0ea5e9',
                'progress' => 50,
            ]
        );

        $mod = $course->modules()->firstOrCreate(['title' => 'Consensus Protocols', 'order' => 1]);
        $l1 = $mod->lessons()->firstOrCreate(
            ['title' => 'Paxos vs Raft Leader Election', 'order' => 1],
            ['duration_minutes' => 25, 'is_completed' => true, 'completed_at' => Carbon::now()->subDays(2)]
        );
        $l2 = $mod->lessons()->firstOrCreate(
            ['title' => 'Log Replication & State Machine Safety', 'order' => 2],
            ['duration_minutes' => 35, 'is_completed' => false]
        );
        $course->recalculateProgress();

        // 9. Dedicated Assessment Subsystem Engine
        $bank = QuestionBank::firstOrCreate(
            ['user_id' => $user->id, 'title' => 'Distributed Systems Question Bank'],
            ['subject' => 'Computer Science']
        );

        $q1 = $bank->questions()->firstOrCreate(
            ['prompt' => 'Which property in the CAP theorem ensures that every non-failing node returns a response?'],
            [
                'type' => 'multiple_choice_single',
                'explanation' => 'Availability guarantees that every non-failing node returns a response for any received request.',
                'points' => 5.0,
                'difficulty' => 'medium',
            ]
        );

        $q1->options()->firstOrCreate(['option_text' => 'Availability', 'is_correct' => true, 'order' => 1]);
        $q1->options()->firstOrCreate(['option_text' => 'Consistency', 'is_correct' => false, 'order' => 2]);
        $q1->options()->firstOrCreate(['option_text' => 'Partition Tolerance', 'is_correct' => false, 'order' => 3]);

        $blueprint = ExamBlueprint::firstOrCreate(
            ['user_id' => $user->id, 'title' => 'CS-501 Midterm Examination'],
            [
                'subject' => 'Distributed Systems',
                'instructions' => 'Closed-book examination. Anti-cheat integrity tracking enabled.',
                'duration_minutes' => 60,
                'passing_score' => 70.0,
                'is_published' => true,
            ]
        );
        $blueprint->questions()->syncWithoutDetaching([$q1->id => ['points' => 5.0, 'order' => 1]]);

        // 10. Notifications
        Notification::firstOrCreate(
            ['user_id' => $user->id, 'title' => 'Welcome to Tuntas Enterprise Platform'],
            [
                'message' => 'Your workspace has been upgraded with dedicated assessment engine, streak tracking, and OKR goals.',
                'type' => 'info',
                'is_read' => false,
            ]
        );
    }
}
