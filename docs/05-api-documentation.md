# 05. RESTful API Reference

## 1. Global Conventions

- **Base URL**: `/api/v1`
- **Content-Type**: `application/json`
- **Accept**: `application/json`
- **Authentication**: `Authorization: Bearer <sanctum_token>`
- **Multi-Tenant Protection**: Every authenticated route scopes queries to the token bearer's `user_id`. Cross-tenant mutations return `403 Forbidden`.
- **Standard Success Envelope**:
  ```json
  {
    "success": true,
    "message": "Resource processed successfully",
    "data": { ... }
  }
  ```
- **Standard Error Envelope**:
  ```json
  {
    "success": false,
    "message": "Validation failed",
    "errors": {
      "field_name": ["The field is required."]
    }
  }
  ```

---

## 2. Authentication & Account Endpoints

### `POST /api/v1/auth/register`
* **Summary**: Registers a new user account and returns a Sanctum Bearer token.
* **Payload**:
  ```json
  {
    "name": "Jane Doe",
    "email": "jane@example.com",
    "password": "password123",
    "password_confirmation": "password123"
  }
  ```
* **Response `201 Created`**:
  ```json
  {
    "success": true,
    "data": {
      "user": { "id": 1, "name": "Jane Doe", "email": "jane@example.com" },
      "token": "1|sanctum_plain_text_token..."
    }
  }
  ```

### `POST /api/v1/auth/login`
* **Summary**: Authenticates credentials and returns a Bearer token.
* **Payload**:
  ```json
  { "email": "jane@example.com", "password": "password123" }
  ```

### `POST /api/v1/auth/logout` *(Auth required)*
* **Summary**: Revokes current Sanctum access token.
* **Response `200 OK`**: `{ "success": true, "message": "Logged out successfully" }`

### `GET /api/v1/auth/me` *(Auth required)*
* **Summary**: Fetches authenticated user profile, settings, and role details.

### `PUT /api/v1/auth/profile` *(Auth required)*
* **Summary**: Updates user display name, timezone, or email.

### `PUT /api/v1/auth/password` *(Auth required)*
* **Summary**: Updates user password with current password verification.

---

## 3. Personal Dashboard & Search

### `GET /api/v1/dashboard`
* **Summary**: Composite dashboard data returning aggregated metrics, today's priorities, active projects, habit check-in, OKRs, and upcoming examinations.
* **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "summary": { "total_tasks": 12, "completed_tasks": 8, "pending_tasks": 4, "overdue_tasks": 1 },
      "metrics": {
        "velocity_trend": [ { "date": "2026-11-10", "completed": 3 } ],
        "today_priorities": [ ... ],
        "active_projects": [ ... ],
        "habits": [ ... ],
        "goals": [ ... ],
        "upcoming_exams": [ ... ]
      }
    }
  }
  ```

### `GET /api/v1/search?q={query}`
* **Summary**: Cross-cutting search across tasks, projects, courses, and examination blueprints.

---

## 4. Tasks & Subtasks

### `GET /api/v1/tasks`
* **Query Parameters**:
  - `status`: Filter by `todo`, `in_progress`, `in_review`, `completed`.
  - `priority`: Filter by `low`, `medium`, `high`, `urgent`.
  - `category_id`: Numeric ID.
  - `project_id`: Numeric ID.
  - `search`: Keyword string.
* **Response `200 OK`**: Array of Task objects with eager-loaded `category`, `tags`, and `subtasks`.

### `POST /api/v1/tasks`
* **Payload**:
  ```json
  {
    "title": "Complete Architecture Audit",
    "description": "Verify all 3NF schema tables and indexes",
    "priority": "high",
    "status": "todo",
    "due_date": "2026-11-15",
    "project_id": 1,
    "category_id": 2,
    "tags": ["architecture", "review"],
    "subtasks": ["Check ERD", "Validate foreign keys"]
  }
  ```

### `PATCH /api/v1/tasks/{id}/toggle`
* **Summary**: Toggles task between completed and previous status. Automatically spawns next instance if `is_recurring` is active.

### `POST /api/v1/tasks/{id}/subtasks`
* **Payload**: `{ "title": "Inspect query plans" }`

### `PATCH /api/v1/subtasks/{id}/toggle`
* **Summary**: Toggles subtask completion state.

---

## 5. Projects & Milestones

### `GET /api/v1/projects`
* **Summary**: Returns active projects with calculated `progress_percentage`.

### `POST /api/v1/projects`
* **Payload**:
  ```json
  {
    "name": "Tuntas 2.0 Release",
    "description": "Full-stack productivity platform launch",
    "color": "#6366F1",
    "deadline": "2026-12-01",
    "category_id": 1
  }
  ```

---

## 6. Calendar Aggregator

### `GET /api/v1/calendar` (or `/api/v1/calendar/events`)
* **Summary**: Aggregates all schedule events within a target month/year window.
* **Query Parameters**: `month=11&year=2026`
* **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": [
      { "id": "task-12", "type": "task", "title": "Submit Milestone", "date": "2026-11-15", "priority": "high" },
      { "id": "exam-3", "type": "examination", "title": "DevOps Certification", "date": "2026-11-20" }
    ]
  }
  ```

---

## 7. Habits & Consistency Tracking

### `GET /api/v1/habits`
* **Summary**: Lists habits with `current_streak`, `best_streak`, and `freeze_tokens`.

### `POST /api/v1/habits/{id}/toggle`
* **Payload**: `{ "date": "2026-11-12" }`
* **Summary**: Toggles execution for target date and recalculates continuous streak length.

### `POST /api/v1/habits/{id}/freeze`
* **Payload**: `{ "date": "2026-11-11" }`
* **Summary**: Redeems one freeze token to preserve streak across an unavoidable missed day.

---

## 8. Goals & OKRs

### `GET /api/v1/goals`
* **Summary**: Lists active OKRs with target values, measurement units, and progress.

### `POST /api/v1/goals/{id}/milestones`
* **Payload**: `{ "title": "Complete 5 Mock Exams", "target_value": 5 }`

---

## 9. Learning Management (LMS)

### `GET /api/v1/courses` / `POST /api/v1/courses`
* **Summary**: Course subject taxonomy management.

### `POST /api/v1/courses/{id}/modules` / `POST /api/v1/modules/{id}/lessons`
* **Summary**: Hierarchical module and lesson content authoring with reference URLs.

### `POST /api/v1/learning-sessions`
* **Payload**: `{ "course_id": 1, "duration_minutes": 45, "notes": "Deep work on concurrency" }`

---

## 10. Dedicated Examination Assessment Engine

### `POST /api/v1/question-banks/{id}/questions`
* **Payload**:
  ```json
  {
    "question_text": "What does WAL stand for in database architecture?",
    "question_type": "multiple_choice",
    "points": 10,
    "explanation": "Write-Ahead Logging provides atomicity and durability.",
    "options": [
      { "option_text": "Write-Ahead Logging", "is_correct": true },
      { "option_text": "Web Access Layer", "is_correct": false }
    ]
  }
  ```

### `POST /api/v1/exam-blueprints/{id}/start`
* **Summary**: Starts a new test attempt. Initializes timer countdown and produces sanitized question snapshots (anti-leak protection: `is_correct` and `explanation` removed).
* **Response `201 Created`**:
  ```json
  {
    "success": true,
    "data": {
      "attempt": { "id": 42, "status": "in_progress", "started_at": "2026-11-12T01:30:00Z" },
      "questions": [
        {
          "id": 101,
          "question_text": "What does WAL stand for?",
          "options": [
            { "id": 501, "option_text": "Write-Ahead Logging" },
            { "id": 502, "option_text": "Web Access Layer" }
          ]
        }
      ]
    }
  }
  ```

### `POST /api/v1/exam-attempts/{id}/sync`
* **Summary**: Periodic heartbeat syncing draft answers without submitting the exam.
* **Payload**:
  ```json
  {
    "answers": [ { "question_id": 101, "selected_option_id": 501 } ]
  }
  ```

### `POST /api/v1/exam-attempts/{id}/integrity`
* **Payload**: `{ "event": "blur", "details": "Window lost focus (tab switch)" }`
* **Summary**: Increments violation counter and logs proctoring alert.

### `POST /api/v1/exam-attempts/{id}/submit`
* **Summary**: Concludes the attempt, runs server-side auto-grading algorithm, and transitions status to `completed`.

### `GET /api/v1/exam-attempts/{id}/review`
* **Summary**: Review guard. Returns questions with correct answers, student choices, earned points, and explanations. **Returns 403 if attempt is still in progress**.

---

## 11. Notifications & Deadline Scanner

### `GET /api/v1/notifications`
* **Summary**: Fetches user notifications with category badges (`deadlines`, `exams`, `habits`, `system`).

### `POST /api/v1/notifications/check-reminders`
* **Summary**: Automated scanner checking tasks due in $<24\text{h}$ and exams scheduled in $<48\text{h}$. Prevents duplicate spam via a 1-hour event hash filter.

