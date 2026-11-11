# Dedicated Examination Subsystem Design Specification

## 1. Domain Boundary & Rationale

In strict accordance with the **Architectural Decision**, the Examination System is engineered as an autonomous bounded context. It has its own dedicated database schema, business logic services, state machine, and API endpoints.

**Anti-Pattern Explicitly Prohibited:** Examination questions and answers must NEVER be modeled as special categories or columns inside the `todos` table.

## 2. Core Entities & Data Architecture

```mermaid
erDiagram
    QUESTION_BANK ||--o{ QUESTION : contains
    QUESTION ||--o{ QUESTION_OPTION : defines
    EXAM ||--o{ EXAM_QUESTION : includes
    QUESTION ||--o{ EXAM_QUESTION : references
    EXAM ||--o{ EXAM_SESSION : stages
    EXAM_SESSION ||--o{ EXAM_ANSWER : records
    EXAM_SESSION ||--o{ EXAM_INTEGRITY_LOG : monitors

    QUESTION_BANK {
        bigint id PK
        bigint user_id FK
        string title
        string subject
    }

    QUESTION {
        bigint id PK
        bigint bank_id FK
        string type
        text prompt
        text code_snippet
        int points
        text explanation
    }

    QUESTION_OPTION {
        bigint id PK
        bigint question_id FK
        text option_text
        boolean is_correct
        int order
    }

    EXAM {
        bigint id PK
        bigint user_id FK
        string title
        int duration_minutes
        decimal passing_score
        boolean shuffle_questions
        boolean shuffle_options
        int max_attempts
    }

    EXAM_SESSION {
        uuid id PK
        bigint exam_id FK
        bigint user_id FK
        string status
        timestamp started_at
        timestamp expires_at
        timestamp submitted_at
        decimal score
        boolean passed
    }

    EXAM_ANSWER {
        bigint id PK
        uuid session_id FK
        bigint question_id FK
        json selected_option_ids
        text text_answer
        boolean is_correct
        decimal awarded_points
    }
```

## 3. Session State Machine

```mermaid
stateDiagram-v2
    [*] --> Scheduled
    Scheduled --> Ready : Examinee enters lobby
    Ready --> InProgress : Start exam (Server timer starts)
    InProgress --> InProgress : Heartbeat / Auto-save (Every 15s)
    InProgress --> Submitted : Student manual submit
    InProgress --> Expired : Server timer reaches zero
    Submitted --> Grading : Auto-grading objective questions
    Expired --> Grading : Auto-grading objective questions
    Grading --> Completed : Scores finalized
    Completed --> [*]
```

## 4. Proctoring & Anti-Cheat Heuristics

The subsystem incorporates non-invasive browser-level integrity monitoring:
1. `visibilitychange` listener logs when the examinee navigates away or switches tabs.
2. `fullscreenchange` listener logs unauthorized full-screen exits.
3. Every anomaly is dispatched to `/api/v1/exam-sessions/:id/log-integrity` and stored in `exam_integrity_logs` for instructor audit.

## 5. Network Resiliency & Offline Auto-Save

- Examinee client uses local browser storage (`IndexedDB`) as an append-only store.
- Every selection immediately writes to `IndexedDB` and queues a debounced sync request to the backend.
- In the event of a temporary network outage, questions can still be answered and navigated. As soon as connection restores, all cached answers synchronize seamlessly.

