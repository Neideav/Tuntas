/**
 * Tuntas Shared Domain Types and API Contracts
 * Central source of truth across all monorepo applications
 */

// ==========================================
// 1. Common & API Types
// ==========================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data: T;
  meta?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
  status_code: number;
}

// ==========================================
// 2. Identity & User Management
// ==========================================

export type UserRole = 'admin' | 'instructor' | 'student';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  timezone: string;
  avatar_url?: string | null;
  preferences?: UserPreferences;
  created_at: string;
  updated_at: string;
}

export interface UserPreferences {
  theme?: 'cyber_dark' | 'high_contrast';
  sound_effects?: boolean;
  lock_completed_tasks?: boolean;
  daily_reminder_time?: string;
}

export interface AuthTokens {
  token_type: 'Bearer';
  access_token: string;
  expires_at?: string;
}

// ==========================================
// 3. Task Management
// ==========================================

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low';

export interface Subtask {
  id: number;
  task_id: number;
  title: string;
  is_completed: boolean;
  order: number;
}

export interface Task {
  id: number;
  user_id: number;
  project_id?: number | null;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date?: string | null;
  completed_at?: string | null;
  tags?: string[];
  subtasks?: Subtask[];
  created_at: string;
  updated_at: string;
}

// ==========================================
// 4. Project Management
// ==========================================

export type ProjectStatus = 'active' | 'on_hold' | 'completed' | 'archived';

export interface Milestone {
  id: number;
  project_id: number;
  title: string;
  due_date?: string | null;
  order: number;
  is_completed: boolean;
}

export interface Project {
  id: number;
  user_id: number;
  name: string;
  slug: string;
  description?: string | null;
  color_hex: string;
  icon?: string | null;
  status: ProjectStatus;
  deadline?: string | null;
  progress_percentage: number;
  milestones?: Milestone[];
  created_at: string;
  updated_at: string;
}

// ==========================================
// 5. Calendar & Scheduling
// ==========================================

export type CalendarEventType = 'task' | 'exam' | 'study_session' | 'habit';

export interface CalendarEvent {
  id: string;
  title: string;
  type: CalendarEventType;
  start: string;
  end?: string | null;
  is_all_day?: boolean;
  status?: string;
  reference_id: number;
  color?: string;
}

// ==========================================
// 6. Habit Tracking
// ==========================================

export type HabitFrequency = 'daily' | 'weekdays' | 'custom';

export interface HabitLog {
  id: number;
  habit_id: number;
  log_date: string;
  completed: boolean;
  used_freeze: boolean;
  value?: number | null;
}

export interface Habit {
  id: number;
  user_id: number;
  title: string;
  description?: string | null;
  frequency: HabitFrequency;
  target_value: number;
  unit?: string | null;
  icon?: string | null;
  color?: string | null;
  current_streak: number;
  best_streak: number;
  freeze_tokens: number;
  today_completed?: boolean;
  created_at: string;
  updated_at: string;
}

// ==========================================
// 7. Goal Management
// ==========================================

export type GoalStatus = 'not_started' | 'in_progress' | 'achieved' | 'abandoned';

export interface KeyResult {
  id: number;
  goal_id: number;
  title: string;
  current_value: number;
  target_value: number;
  unit: string;
  progress_percentage: number;
}

export interface Goal {
  id: number;
  user_id: number;
  title: string;
  category?: string | null;
  start_date: string;
  target_date: string;
  status: GoalStatus;
  progress_percentage: number;
  key_results?: KeyResult[];
}

// ==========================================
// 8. Learning Management (LMS)
// ==========================================

export interface CourseLesson {
  id: number;
  module_id: number;
  title: string;
  content_markdown: string;
  duration_minutes: number;
  order: number;
  is_completed?: boolean;
}

export interface CourseModule {
  id: number;
  course_id: number;
  title: string;
  order: number;
  lessons?: CourseLesson[];
}

export interface Course {
  id: number;
  user_id: number;
  title: string;
  description?: string | null;
  cover_image?: string | null;
  is_published: boolean;
  progress_percentage?: number;
  modules?: CourseModule[];
}

// ==========================================
// 9. DEDICATED EXAMINATION SUBSYSTEM
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
  is_correct?: boolean; // Stripped in active student sessions
  order: number;
}

export interface Question {
  id: number;
  bank_id: number;
  type: QuestionType;
  prompt: string;
  code_snippet?: string | null;
  points: number;
  explanation?: string | null;
  options?: QuestionOption[];
}

export interface QuestionBank {
  id: number;
  user_id: number;
  title: string;
  subject: string;
  questions_count?: number;
  questions?: Question[];
}

export interface Exam {
  id: number;
  user_id: number;
  title: string;
  description?: string | null;
  duration_minutes: number;
  passing_score: number;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  max_attempts: number;
  is_published: boolean;
  questions_count?: number;
}

export type ExamSessionStatus =
  | 'scheduled'
  | 'ready'
  | 'in_progress'
  | 'submitted'
  | 'grading'
  | 'completed'
  | 'expired';

export interface ExamAnswer {
  question_id: number;
  selected_option_ids?: number[];
  text_answer?: string;
  is_flagged?: boolean;
}

export interface ExamSession {
  id: string; // UUID
  exam_id: number;
  user_id: number;
  status: ExamSessionStatus;
  started_at: string;
  expires_at: string;
  submitted_at?: string | null;
  score?: number | null;
  passed?: boolean | null;
  answers?: Record<number, ExamAnswer>;
}

export interface ExamIntegrityLog {
  id: number;
  session_id: string;
  event_type: 'tab_switch' | 'blur' | 'fullscreen_exit' | 'ip_change';
  details?: string;
  logged_at: string;
}

// ==========================================
// 10. Analytics & Reporting
// ==========================================

export interface ProductivityMetrics {
  tasks_completed_count: number;
  tasks_created_count: number;
  active_habit_streaks: number;
  total_study_minutes: number;
  completion_rate_percentage: number;
}

export interface ExamMasteryMetric {
  subject: string;
  average_score_percentage: number;
  total_exams_taken: number;
}

// ==========================================
// 11. Notification System
// ==========================================

export type NotificationType = 'task_deadline' | 'exam_alert' | 'habit_risk' | 'system';

export interface NotificationItem {
  id: string;
  user_id: number;
  type: NotificationType;
  title: string;
  message: string;
  action_url?: string | null;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
}

