<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\ExamAnswer;
use App\Models\ExamAttempt;
use App\Models\ExamBlueprint;
use App\Models\ExamIntegrityLog;
use App\Models\Question;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ExaminationAssessmentService
{
    /**
     * Start or resume an examination attempt for a user with immutable snapshot creation.
     */
    public function startAttempt(ExamBlueprint $blueprint, User $user): ExamAttempt
    {
        if (!$blueprint->is_published) {
            throw new \DomainException('This examination is not currently published.');
        }

        if ($blueprint->starts_at && Carbon::now()->lessThan($blueprint->starts_at)) {
            throw new \DomainException('This examination is not yet available.');
        }

        if ($blueprint->ends_at && Carbon::now()->greaterThan($blueprint->ends_at)) {
            throw new \DomainException('This examination availability period has ended.');
        }

        // Check if there is already an active in-progress attempt that hasn't expired
        $activeAttempt = ExamAttempt::where('exam_blueprint_id', $blueprint->id)
            ->where('user_id', $user->id)
            ->where('status', 'in_progress')
            ->first();

        if ($activeAttempt) {
            if (Carbon::now()->lessThanOrEqualTo($activeAttempt->expires_at)) {
                return $activeAttempt;
            } else {
                // Auto-submit expired attempt cleanly
                return $this->submitAndGrade($activeAttempt);
            }
        }

        // Check attempt count
        if ($blueprint->max_attempts > 0) {
            $pastAttempts = ExamAttempt::where('exam_blueprint_id', $blueprint->id)
                ->where('user_id', $user->id)
                ->whereIn('status', ['submitted', 'grading', 'completed', 'expired'])
                ->count();

            if ($pastAttempts >= $blueprint->max_attempts) {
                throw new \DomainException('Maximum attempt limit reached for this examination.');
            }
        }

        // Compile questions
        $blueprintQuestions = $blueprint->questions()->with('options')->get();

        if ($blueprintQuestions->isEmpty()) {
            throw new \DomainException('No questions are associated with this examination blueprint.');
        }

        if ($blueprint->shuffle_questions) {
            $blueprintQuestions = $blueprintQuestions->shuffle();
        }

        $snapshot = [];
        $answerKeySnapshot = [];
        $totalPointsPossible = 0.0;

        foreach ($blueprintQuestions as $q) {
            $points = (float) ($q->pivot->points ?? $q->points);
            $totalPointsPossible += $points;

            $options = $q->options->map(function ($opt) {
                return [
                    'id' => $opt->id,
                    'option_text' => $opt->option_text,
                    'order' => $opt->order,
                    // is_correct is intentionally NOT included in active student snapshot
                ];
            });

            if ($blueprint->shuffle_options) {
                $options = $options->shuffle()->values();
            }

            $snapshot[] = [
                'id' => $q->id,
                'type' => $q->type,
                'prompt' => $q->prompt,
                'code_snippet' => $q->code_snippet,
                'difficulty' => $q->difficulty,
                'points' => $points,
                'options' => $options->all(),
            ];

            // Immutable server-side authoritative snapshot including answer key and explanations
            $answerKeySnapshot[] = [
                'id' => $q->id,
                'type' => $q->type,
                'prompt' => $q->prompt,
                'code_snippet' => $q->code_snippet,
                'difficulty' => $q->difficulty,
                'explanation' => $q->explanation,
                'points' => $points,
                'options' => $q->options->map(function ($opt) {
                    return [
                        'id' => $opt->id,
                        'option_text' => $opt->option_text,
                        'order' => $opt->order,
                        'is_correct' => (bool) $opt->is_correct,
                    ];
                })->all(),
            ];
        }

        $now = Carbon::now();
        $expiresAt = (clone $now)->addMinutes($blueprint->duration_minutes);

        $attempt = ExamAttempt::create([
            'id' => (string) Str::uuid(),
            'exam_blueprint_id' => $blueprint->id,
            'user_id' => $user->id,
            'status' => 'in_progress',
            'started_at' => $now,
            'expires_at' => $expiresAt,
            'total_points_possible' => $totalPointsPossible,
            'questions_snapshot' => $snapshot,
            'answer_key_snapshot' => $answerKeySnapshot,
            'flagged_question_ids' => [],
        ]);

        AuditLog::create([
            'user_id' => $user->id,
            'action' => 'exam.attempt_started',
            'auditable_type' => ExamAttempt::class,
            'auditable_id' => $attempt->id,
            'payload' => [
                'exam_blueprint_id' => $blueprint->id,
                'duration_minutes' => $blueprint->duration_minutes,
                'expires_at' => $expiresAt->toIso8601String(),
            ],
            'created_at' => now(),
        ]);

        return $attempt;
    }

    /**
     * Auto-save answers heartbeat during an active attempt with snapshot validation and optional flagged questions.
     */
    public function syncAnswers(ExamAttempt $attempt, array $answersList, array $flaggedQuestionIds = []): array
    {
        if ($attempt->status !== 'in_progress') {
            throw new \DomainException("Cannot save answers. Attempt status is {$attempt->status}.");
        }

        if (Carbon::now()->greaterThan($attempt->expires_at)) {
            // Automatically submit and grade on expiration
            $this->submitAndGrade($attempt);
            throw new \DomainException('Examination time has expired. Attempt has been automatically submitted.');
        }

        $snapshot = collect($attempt->questions_snapshot ?? []);
        $snapshotMap = $snapshot->keyBy('id');

        // Strictly validate that all question IDs belong to the active attempt snapshot
        $invalidIds = [];
        foreach ($answersList as $answerData) {
            $qId = $answerData['question_id'] ?? null;
            if (!$qId || !$snapshotMap->has($qId)) {
                $invalidIds[] = $qId ?? 'null';
            }
        }

        if (!empty($invalidIds)) {
            throw new \InvalidArgumentException(
                'Satu atau lebih ID soal tidak valid atau tidak termasuk dalam sesi ujian ini: ' . implode(', ', $invalidIds)
            );
        }

        $savedCount = 0;
        DB::transaction(function () use ($attempt, $answersList, $snapshotMap, $flaggedQuestionIds, &$savedCount) {
            foreach ($answersList as $answerData) {
                $qId = $answerData['question_id'];
                $qInfo = $snapshotMap->get($qId);
                $qType = $qInfo['type'] ?? 'multiple_choice_single';

                $selectedOptionIds = null;
                $textResponse = null;

                if (in_array($qType, ['multiple_choice_single', 'multiple_choice_multiple', 'true_false'])) {
                    if (isset($answerData['selected_option_ids']) && is_array($answerData['selected_option_ids'])) {
                        $validOptIds = collect($qInfo['options'] ?? [])->pluck('id')->all();
                        $invalidOpts = array_diff($answerData['selected_option_ids'], $validOptIds);
                        if (!empty($invalidOpts)) {
                            throw new \InvalidArgumentException("Opsi yang dipilih tidak valid untuk soal ID {$qId}.");
                        }
                        $selectedOptionIds = array_values(array_intersect($answerData['selected_option_ids'], $validOptIds));
                    }
                } else {
                    if (isset($answerData['text_response'])) {
                        $textResponse = is_string($answerData['text_response']) ? $answerData['text_response'] : null;
                    }
                }

                ExamAnswer::updateOrCreate(
                    [
                        'exam_attempt_id' => $attempt->id,
                        'question_id' => $qId,
                    ],
                    [
                        'selected_option_ids' => $selectedOptionIds,
                        'text_response' => $textResponse,
                    ]
                );
                $savedCount++;
            }

            if (!empty($flaggedQuestionIds)) {
                $attempt->update(['flagged_question_ids' => array_values(array_unique($flaggedQuestionIds))]);
            }
        });

        $remainingSeconds = max(0, Carbon::now()->diffInSeconds($attempt->expires_at, false));

        return [
            'saved_count' => $savedCount,
            'server_time' => Carbon::now()->toIso8601String(),
            'remaining_seconds' => $remainingSeconds,
            'flagged_question_ids' => $attempt->fresh()->flagged_question_ids ?? [],
        ];
    }

    /**
     * Submit and evaluate attempt with atomic database lock, partial scoring, and immutable snapshots.
     */
    public function submitAndGrade(ExamAttempt $attempt): ExamAttempt
    {
        return DB::transaction(function () use ($attempt) {
            // Lock attempt row to prevent duplicate or concurrent submissions
            $lockedAttempt = ExamAttempt::where('id', $attempt->id)->lockForUpdate()->firstOrFail();

            if (in_array($lockedAttempt->status, ['completed', 'grading', 'submitted'])) {
                return $lockedAttempt->load('answers');
            }

            $blueprint = $lockedAttempt->blueprint;
            $allowPartial = $blueprint ? (bool) $blueprint->allow_partial_scoring : true;
            $negativeMarkingPenalty = $blueprint ? (float) $blueprint->negative_marking : 0.0;

            $totalPointsEarned = 0.0;
            $snapshot = $lockedAttempt->questions_snapshot ?? [];
            $keySnapshotMap = collect($lockedAttempt->answer_key_snapshot ?? [])->keyBy('id');
            $hasPendingManualReview = false;

            foreach ($snapshot as $qData) {
                $qId = $qData['id'];
                $pointsPossible = (float) $qData['points'];

                // Grade strictly using immutable snapshot created at start time
                $authoritative = $keySnapshotMap->get($qId);
                if (!$authoritative) {
                    // Backwards compatibility fallback for legacy attempts
                    $liveQuestion = Question::with('options')->find($qId);
                    if ($liveQuestion) {
                        $authoritative = [
                            'id' => $liveQuestion->id,
                            'type' => $liveQuestion->type,
                            'explanation' => $liveQuestion->explanation,
                            'options' => $liveQuestion->options->map(fn($o) => [
                                'id' => $o->id,
                                'option_text' => $o->option_text,
                                'is_correct' => (bool) $o->is_correct,
                            ])->all(),
                        ];
                    }
                }

                $answer = ExamAnswer::where('exam_attempt_id', $lockedAttempt->id)
                    ->where('question_id', $qId)
                    ->first();

                $isCorrect = false;
                $awardedPoints = 0.0;

                if ($authoritative && $answer) {
                    $qType = $authoritative['type'] ?? 'multiple_choice_single';
                    $authOptions = collect($authoritative['options'] ?? []);

                    if ($qType === 'multiple_choice_single' || $qType === 'true_false') {
                        $correctOpt = $authOptions->firstWhere('is_correct', true);
                        $correctOptId = $correctOpt['id'] ?? null;

                        $selected = $answer->selected_option_ids;
                        if (is_array($selected) && count($selected) === 1 && (int) $selected[0] === (int) $correctOptId) {
                            $isCorrect = true;
                            $awardedPoints = $pointsPossible;
                        }
                    } elseif ($qType === 'multiple_choice_multiple') {
                        $correctOptIds = $authOptions
                            ->where('is_correct', true)
                            ->pluck('id')
                            ->map(fn($v) => (int)$v)
                            ->sort()
                            ->values()
                            ->all();

                        $selected = collect($answer->selected_option_ids ?? [])
                            ->map(fn($v) => (int)$v)
                            ->sort()
                            ->values()
                            ->all();

                        if ($selected === $correctOptIds) {
                            $isCorrect = true;
                            $awardedPoints = $pointsPossible;
                        } elseif ($allowPartial && !empty($correctOptIds)) {
                            // Partial scoring calculation
                            $totalCorrectOptions = count($correctOptIds);
                            $correctSelected = count(array_intersect($selected, $correctOptIds));
                            $incorrectSelected = count(array_diff($selected, $correctOptIds));

                            $penalty = ($negativeMarkingPenalty > 0) ? $negativeMarkingPenalty : 0.5;
                            $netCorrect = max(0.0, $correctSelected - ($incorrectSelected * $penalty));
                            $ratio = min(1.0, $netCorrect / $totalCorrectOptions);

                            $awardedPoints = round($ratio * $pointsPossible, 2);
                            $isCorrect = ($awardedPoints >= $pointsPossible);
                        }
                    } elseif ($qType === 'short_answer') {
                        $expectedAnswers = $authOptions
                            ->where('is_correct', true)
                            ->pluck('option_text')
                            ->map(fn($s) => strtolower(trim($s)))
                            ->all();

                        $studentText = strtolower(trim($answer->text_response ?? ''));
                        if (!empty($studentText) && in_array($studentText, $expectedAnswers)) {
                            $isCorrect = true;
                            $awardedPoints = $pointsPossible;
                        }
                    } else {
                        // Essay / code_analysis require manual grading
                        $isCorrect = null;
                        $awardedPoints = 0.0;
                        $hasPendingManualReview = true;
                    }

                    $answer->update([
                        'is_correct' => $isCorrect,
                        'awarded_points' => $awardedPoints,
                    ]);
                } elseif (!$answer) {
                    // Blank answer
                    ExamAnswer::create([
                        'exam_attempt_id' => $lockedAttempt->id,
                        'question_id' => $qId,
                        'is_correct' => false,
                        'awarded_points' => 0.0,
                    ]);
                }

                $totalPointsEarned += $awardedPoints;
            }

            $scorePercentage = ($lockedAttempt->total_points_possible > 0)
                ? round(($totalPointsEarned / $lockedAttempt->total_points_possible) * 100, 2)
                : 0.0;

            $passingScore = $blueprint ? (float) $blueprint->passing_score : 70.0;
            $isPassed = ($scorePercentage >= $passingScore);

            $attemptStatus = $hasPendingManualReview ? 'grading' : 'completed';

            $lockedAttempt->update([
                'status' => $attemptStatus,
                'submitted_at' => Carbon::now(),
                'total_points_earned' => $totalPointsEarned,
                'score_percentage' => $scorePercentage,
                'is_passed' => $hasPendingManualReview ? false : $isPassed,
            ]);

            AuditLog::create([
                'user_id' => $lockedAttempt->user_id,
                'action' => 'exam.attempt_submitted',
                'auditable_type' => ExamAttempt::class,
                'auditable_id' => $lockedAttempt->id,
                'payload' => [
                    'status' => $attemptStatus,
                    'has_pending_manual_review' => $hasPendingManualReview,
                    'total_points_earned' => $totalPointsEarned,
                    'score_percentage' => $scorePercentage,
                    'is_passed' => $lockedAttempt->is_passed,
                ],
                'created_at' => now(),
            ]);

            return $lockedAttempt->fresh(['answers']);
        });
    }

    /**
     * Get attempts awaiting instructor manual grading.
     */
    public function getGradingQueue(User $instructor)
    {
        return ExamAttempt::whereHas('blueprint', function ($b) use ($instructor) {
                if ($instructor->role !== 'admin') {
                    $b->where('user_id', $instructor->id);
                }
            })
            ->whereIn('status', ['grading', 'submitted'])
            ->with(['blueprint', 'user:id,name,email'])
            ->orderBy('submitted_at', 'asc')
            ->get()
            ->map(function ($attempt) {
                $pendingCount = ExamAnswer::where('exam_attempt_id', $attempt->id)
                    ->whereNull('is_correct')
                    ->count();

                return [
                    'id' => $attempt->id,
                    'student' => $attempt->user,
                    'blueprint' => [
                        'id' => $attempt->blueprint->id,
                        'title' => $attempt->blueprint->title,
                        'subject' => $attempt->blueprint->subject,
                        'passing_score' => (float) $attempt->blueprint->passing_score,
                    ],
                    'status' => $attempt->status,
                    'submitted_at' => $attempt->submitted_at,
                    'total_points_possible' => (float) $attempt->total_points_possible,
                    'total_points_earned' => (float) $attempt->total_points_earned,
                    'score_percentage' => (float) $attempt->score_percentage,
                    'pending_questions_count' => $pendingCount,
                ];
            });
    }

    /**
     * Get specific attempt details formatted for the instructor grading interface.
     */
    public function getAttemptForGrading(ExamAttempt $attempt, User $instructor): array
    {
        if ($attempt->blueprint->user_id !== $instructor->id && $instructor->role !== 'admin') {
            throw new \DomainException('Unauthorized to grade this examination attempt.');
        }

        $answers = ExamAnswer::where('exam_attempt_id', $attempt->id)->get()->keyBy('question_id');
        $snapshot = $attempt->questions_snapshot ?? [];
        $keySnapshotMap = collect($attempt->answer_key_snapshot ?? [])->keyBy('id');

        $questionsList = [];
        foreach ($snapshot as $qData) {
            $ans = $answers->get($qData['id']);
            $authData = $keySnapshotMap->get($qData['id']);
            $explanation = $authData['explanation'] ?? null;
            if (!$explanation) {
                $liveQuestion = Question::find($qData['id']);
                $explanation = $liveQuestion?->explanation;
            }

            $questionsList[] = [
                'question_id' => $qData['id'],
                'type' => $qData['type'],
                'prompt' => $qData['prompt'],
                'code_snippet' => $qData['code_snippet'] ?? null,
                'explanation' => $explanation,
                'points_possible' => (float) $qData['points'],
                'awarded_points' => $ans ? (float) $ans->awarded_points : 0.0,
                'is_correct' => $ans ? $ans->is_correct : null,
                'text_response' => $ans ? $ans->text_response : null,
                'evaluator_feedback' => $ans ? $ans->evaluator_feedback : null,
                'requires_manual_grading' => in_array($qData['type'], ['essay', 'code_analysis']),
            ];
        }

        return [
            'attempt' => [
                'id' => $attempt->id,
                'status' => $attempt->status,
                'started_at' => $attempt->started_at,
                'submitted_at' => $attempt->submitted_at,
                'total_points_possible' => (float) $attempt->total_points_possible,
                'total_points_earned' => (float) $attempt->total_points_earned,
                'score_percentage' => (float) $attempt->score_percentage,
                'is_passed' => (bool) $attempt->is_passed,
            ],
            'student' => $attempt->user()->select('id', 'name', 'email')->first(),
            'blueprint' => $attempt->blueprint()->select('id', 'title', 'subject', 'passing_score')->first(),
            'questions' => $questionsList,
        ];
    }

    /**
     * Save manual grades, compute final score, and transition attempt to 'completed' when all questions are evaluated.
     */
    public function saveManualGrades(ExamAttempt $attempt, array $grades, User $instructor): ExamAttempt
    {
        if ($attempt->blueprint->user_id !== $instructor->id && $instructor->role !== 'admin') {
            throw new \DomainException('Unauthorized to grade this examination attempt.');
        }

        return DB::transaction(function () use ($attempt, $grades, $instructor) {
            $snapshot = collect($attempt->questions_snapshot ?? [])->keyBy('id');

            foreach ($grades as $gradeItem) {
                $qId = $gradeItem['question_id'] ?? null;
                if (!$qId || !$snapshot->has($qId)) {
                    continue;
                }

                $maxPoints = (float) ($snapshot[$qId]['points'] ?? 1.0);
                $awarded = min($maxPoints, max(0.0, (float) ($gradeItem['awarded_points'] ?? 0.0)));
                $feedback = $gradeItem['feedback'] ?? null;

                ExamAnswer::updateOrCreate(
                    [
                        'exam_attempt_id' => $attempt->id,
                        'question_id' => $qId,
                    ],
                    [
                        'awarded_points' => $awarded,
                        'evaluator_feedback' => $feedback,
                        'is_correct' => ($awarded > 0),
                    ]
                );
            }

            // Recalculate total points across all answers
            $allAnswers = ExamAnswer::where('exam_attempt_id', $attempt->id)->get();
            $totalPointsEarned = (float) $allAnswers->sum('awarded_points');
            $totalPointsPossible = (float) $attempt->total_points_possible;

            $scorePercentage = $totalPointsPossible > 0
                ? round(($totalPointsEarned / $totalPointsPossible) * 100, 2)
                : 0.0;

            $passingScore = (float) ($attempt->blueprint->passing_score ?? 70.0);
            $isPassed = ($scorePercentage >= $passingScore);

            // Check if any answers still have null is_correct
            $hasPending = $allAnswers->contains(fn($ans) => $ans->is_correct === null);

            $attempt->update([
                'status' => $hasPending ? 'grading' : 'completed',
                'total_points_earned' => $totalPointsEarned,
                'score_percentage' => $scorePercentage,
                'is_passed' => $isPassed,
            ]);

            AuditLog::create([
                'user_id' => $instructor->id,
                'action' => 'exam.manual_graded',
                'auditable_type' => ExamAttempt::class,
                'auditable_id' => $attempt->id,
                'payload' => [
                    'grades_count' => count($grades),
                    'total_points_earned' => $totalPointsEarned,
                    'score_percentage' => $scorePercentage,
                    'status' => $attempt->fresh()->status,
                ],
                'created_at' => now(),
            ]);

            return $attempt->fresh(['answers']);
        });
    }

    /**
     * Log anti-cheat proctoring integrity event (tab switch, blur, etc.).
     */
    public function logIntegrity(ExamAttempt $attempt, string $eventType, ?string $details = null): ExamIntegrityLog
    {
        $allowed = ['tab_switch', 'window_blur', 'fullscreen_exit', 'paste_detected', 'ip_mismatch'];
        if (!in_array($eventType, $allowed)) {
            $eventType = 'window_blur';
        }

        return ExamIntegrityLog::create([
            'exam_attempt_id' => $attempt->id,
            'event_type' => $eventType,
            'details' => $details,
            'logged_at' => Carbon::now(),
        ]);
    }

    /**
     * Get post-submission detailed review (strictly after submission or completion).
     */
    public function getReview(ExamAttempt $attempt, User $user): array
    {
        if ($attempt->user_id !== $user->id && $user->role !== 'admin' && $attempt->blueprint->user_id !== $user->id) {
            throw new \DomainException('Unauthorized to view this examination attempt review.');
        }

        if ($attempt->status === 'in_progress') {
            throw new \DomainException('Cannot review active examination attempt before submission.');
        }

        $answers = ExamAnswer::where('exam_attempt_id', $attempt->id)->get()->keyBy('question_id');
        $snapshot = $attempt->questions_snapshot ?? [];
        $keySnapshotMap = collect($attempt->answer_key_snapshot ?? [])->keyBy('id');

        $reviewedQuestions = [];
        foreach ($snapshot as $qData) {
            $ans = $answers->get($qData['id']);
            $authData = $keySnapshotMap->get($qData['id']);

            $optionsReview = [];
            $explanation = null;

            if ($authData) {
                $explanation = $authData['explanation'] ?? null;
                foreach ($authData['options'] ?? [] as $opt) {
                    $optionsReview[] = [
                        'id' => $opt['id'],
                        'option_text' => $opt['option_text'],
                        'is_correct' => (bool) ($opt['is_correct'] ?? false),
                    ];
                }
            } else {
                $liveQuestion = Question::with('options')->find($qData['id']);
                if ($liveQuestion) {
                    $explanation = $liveQuestion->explanation;
                    foreach ($liveQuestion->options as $opt) {
                        $optionsReview[] = [
                            'id' => $opt->id,
                            'option_text' => $opt->option_text,
                            'is_correct' => (bool) $opt->is_correct,
                        ];
                    }
                }
            }

            $reviewedQuestions[] = [
                'id' => $qData['id'],
                'type' => $qData['type'],
                'prompt' => $qData['prompt'],
                'code_snippet' => $qData['code_snippet'] ?? null,
                'explanation' => $explanation,
                'points_possible' => $qData['points'],
                'points_awarded' => $ans ? (float) $ans->awarded_points : 0.0,
                'is_correct' => $ans ? $ans->is_correct : false,
                'selected_option_ids' => $ans ? $ans->selected_option_ids : [],
                'text_response' => $ans ? $ans->text_response : null,
                'evaluator_feedback' => $ans ? $ans->evaluator_feedback : null,
                'options' => $optionsReview,
            ];
        }

        $integritySummary = ExamIntegrityLog::where('exam_attempt_id', $attempt->id)
            ->selectRaw('event_type, count(*) as count')
            ->groupBy('event_type')
            ->pluck('count', 'event_type')
            ->all();

        return [
            'attempt' => $attempt,
            'blueprint' => $attempt->blueprint,
            'questions' => $reviewedQuestions,
            'integrity_summary' => $integritySummary,
        ];
    }
}
