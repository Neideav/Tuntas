/**
 * Tuntas Shared Domain Types and API Contracts
 * Single source of truth across the monorepo application.
 * Directly aligned with Laravel 12 models, schema constraints, and API envelopes.
 */

// ==========================================
// 1. Common & API Response Envelopes
// ==========================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data: T;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ApiErrorResponse {
  success?: boolean;
  message: string;
  errors?: Record<string, string[]>;
}

// ==========================================
// 2. Identity & User Management
// ==========================================

export type UserRole = 'admin' | 'instructor' | 'student';

export interface UserSetting {
  id: number;
  user_id: number;
  theme: string;
  timezone: string;
  sound_effects: boolean;
  email_notifications: boolean;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  timezone?: string;
  settings?: UserSetting;
  created_at: string;
  updated_at: string;
}

export interface AuthTokens {
  token_type: 'Bearer';
  token: string;
  user: User;
}

// ==========================================
// 3. Categories & Tags
// ==========================================

export interface Category {
  id: number;
  user_id: number;
  name: string;
  color?: string;
  description?: string | null;
  tasks_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Tag {
  id: number;
  user_id: number;
  name: string;
  color?: string;
  created_at?: string;
  updated_at?: string;
}

// ==========================================
// 4. Task Management
// ==========================================

export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'completed' | 'cancelled';
export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low';

export interface Subtask {
  id: number;
  task_id: number;
  title: string;
  is_completed: boolean;
  order: number;
  created_at?: string;
  updated_at?: string;
}

export interface Task {
  id: number;
  user_id: number;
  project_id?: number | null;
  category_id?: number | null;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date?: string | null;
  start_date?: string | null;
  reminder_at?: string | null;
  is_recurring?: boolean;
  recurrence_pattern?: 'daily' | 'weekly' | 'monthly' | null;
  completed_at?: string | null;
  subtasks?: Subtask[];
  tags?: Tag[];
  project?: Project;
  category?: Category;
  created_at: string;
  updated_at: string;
}

// ==========================================
// 5. Project Management
// ==========================================

export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'archived';

export interface Milestone {
  id: number;
  project_id: number;
  title: string;
  due_date?: string | null;
  order: number;
  is_completed: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Project {
  id: number;
  user_id: number;
  title: string;
  description?: string | null;
  color?: string;
  priority?: TaskPriority;
  status: ProjectStatus;
  deadline?: string | null;
  progress: number; // 0 to 100 percentage
  tasks_count?: number;
  completed_tasks_count?: number;
  milestones?: Milestone[];
  created_at: string;
  updated_at: string;
}

// ==========================================
// 6. Calendar & Scheduling
// ==========================================

export type CalendarEventType = 'task' | 'project' | 'examination' | 'habit' | 'learning_session';

export interface CalendarEvent {
  id: string;
  title: string;
  type: CalendarEventType;
  start: string;
  end?: string | null;
  status?: string;
  priority?: string;
  duration_minutes?: number;
  color?: string;
  reference_id: number;
  category?: string;
  project?: string;
}

// ==========================================
// 7. Habit Tracking & Streak Engine
// ==========================================

export type HabitFrequency = 'daily' | 'weekdays' | 'custom';

export interface HabitLog {
  id: number;
  habit_id: number;
  user_id: number;
  log_date: string;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Habit {
  id: number;
  user_id: number;
  title: string;
  description?: string | null;
  frequency: HabitFrequency;
  target_days_per_week: number;
  current_streak: number;
  longest_streak: number;
  freeze_tokens_available: number;
  is_active: boolean;
  completed_today?: boolean;
  recent_logs?: HabitLog[];
  created_at: string;
  updated_at: string;
}

// ==========================================
// 8. Goal Management
// ==========================================

export interface KeyResult {
  id: number;
  goal_id: number;
  title: string;
  current_value: number;
  target_value: number;
  unit: string;
  is_completed: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Goal {
  id: number;
  user_id: number;
  title: string;
  description?: string | null;
  category?: string | null;
  deadline?: string | null;
  progress: number;
  status: 'in_progress' | 'completed' | 'abandoned';
  key_results?: KeyResult[];
  created_at: string;
  updated_at: string;
}

// ==========================================
// 9. Learning Management System (LMS)
// ==========================================

export interface Lesson {
  id: number;
  module_id: number;
  title: string;
  content?: string | null;
  resource_url?: string | null;
  duration_minutes: number;
  is_completed: boolean;
  order: number;
  created_at?: string;
  updated_at?: string;
}

export interface CourseModule {
  id: number;
  course_id: number;
  title: string;
  order: number;
  lessons?: Lesson[];
  created_at?: string;
  updated_at?: string;
}

export interface Course {
  id: number;
  user_id: number;
  title: string;
  code?: string | null;
  description?: string | null;
  progress?: number;
  modules_count?: number;
  lessons_count?: number;
  modules?: CourseModule[];
  created_at?: string;
  updated_at?: string;
}

export interface LearningSession {
  id: number;
  user_id: number;
  course_id?: number | null;
  lesson_id?: number | null;
  topic: string;
  duration_minutes: number;
  session_date: string;
  notes?: string | null;
  course?: { id: number; title: string };
  created_at?: string;
  updated_at?: string;
}

// ==========================================
// 10. DEDICATED EXAMINATION SUBSYSTEM
// ==========================================

export type QuestionType =
  | 'multiple_choice_single'
  | 'multiple_choice_multiple'
  | 'true_false'
  | 'short_answer'
  | 'essay'
  | 'code_analysis';

export interface QuestionOption {
  id: number;
  question_id: number;
  option_text: string;
  is_correct?: boolean; // Stripped in active student sessions and non-owner views
  order: number;
}

export interface Question {
  id: number;
  question_bank_id: number;
  type: QuestionType;
  prompt: string;
  code_snippet?: string | null;
  points: number;
  difficulty: 'easy' | 'medium' | 'hard';
  explanation?: string | null;
  options?: QuestionOption[];
}

export interface QuestionBank {
  id: number;
  user_id: number;
  title: string;
  subject: string;
  description?: string | null;
  questions_count?: number;
  questions?: Question[];
  created_at?: string;
  updated_at?: string;
}

export interface ExamBlueprint {
  id: number;
  user_id: number;
  course_id?: number | null;
  title: string;
  subject: string;
  instructions?: string | null;
  duration_minutes: number;
  passing_score: number;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  max_attempts: number;
  is_published: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  questions_count?: number;
  attempts_count?: number;
  questions?: Question[];
  course?: Course;
  created_at?: string;
  updated_at?: string;
}

export type ExamAttemptStatus =
  | 'scheduled'
  | 'ready'
  | 'in_progress'
  | 'submitted'
  | 'grading'
  | 'completed'
  | 'expired';

export interface ExamAnswer {
  id?: number;
  exam_attempt_id: string;
  question_id: number;
  selected_option_ids?: number[] | null;
  text_response?: string | null;
  is_correct?: boolean | null;
  awarded_points?: number;
  evaluator_feedback?: string | null;
  is_flagged?: boolean;
}

export interface ExamAttempt {
  id: string; // UUID
  exam_blueprint_id: number;
  user_id: number;
  status: ExamAttemptStatus;
  started_at?: string;
  expires_at?: string;
  submitted_at?: string | null;
  total_points_earned: number;
  total_points_possible: number;
  score_percentage: number;
  is_passed: boolean;
  questions_snapshot: any[];
  blueprint?: ExamBlueprint;
  answers?: ExamAnswer[];
}

export interface ExamIntegrityLog {
  id: number;
  exam_attempt_id: string;
  event_type: 'tab_switch' | 'window_blur' | 'fullscreen_exit' | 'paste_detected' | 'ip_mismatch';
  details?: string | null;
  logged_at: string;
}

export interface GradingQueueItem {
  id: string;
  student: { id: number; name: string; email: string };
  blueprint: { id: number; title: string; subject: string; passing_score: number };
  status: ExamAttemptStatus;
  submitted_at: string;
  total_points_possible: number;
  total_points_earned: number;
  score_percentage: number;
  pending_questions_count: number;
}

// ==========================================
// 11. Notification System
// ==========================================

export type NotificationType = 'system' | 'deadline' | 'exam' | 'habit' | 'achievement';

export interface NotificationItem {
  id: number;
  user_id: number;
  type: NotificationType;
  title: string;
  message: string;
  action_url?: string | null;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
}
