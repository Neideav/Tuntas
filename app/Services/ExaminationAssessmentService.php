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
     * Start or resume an examination attempt for a user.
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
                // Mark expired
                $activeAttempt->update(['status' => 'expired']);
            }
        }

        // Check attempt count
        if ($blueprint->max_attempts > 0) {
            $pastAttempts = ExamAttempt::where('exam_blueprint_id', $blueprint->id)
                ->where('user_id', $user->id)
                ->whereIn('status', ['submitted', 'completed', 'expired'])
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
        $totalPointsPossible = 0.0;

        foreach ($blueprintQuestions as $q) {
            $points = (float) ($q->pivot->points ?? $q->points);
            $totalPointsPossible += $points;

            $options = $q->options->map(function ($opt) {
                return [
                    'id' => $opt->id,
                    'option_text' => $opt->option_text,
                    'order' => $opt->order,
                    // is_correct is intentionally NOT included in active snapshot
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
                // explanation is intentionally NOT included in active snapshot
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
     * Auto-save answers heartbeat during an active attempt.
     */
    public function syncAnswers(ExamAttempt $attempt, array $answersList): array
    {
        if ($attempt->status !== 'in_progress') {
            throw new \DomainException("Cannot save answers. Attempt status is {$attempt->status}.");
        }

        if (Carbon::now()->greaterThan($attempt->expires_at)) {
            $attempt->update(['status' => 'expired']);
            throw new \DomainException('Examination time has expired.');
        }

        $savedCount = 0;
        DB::transaction(function () use ($attempt, $answersList, &$savedCount) {
            foreach ($answersList as $answerData) {
                $qId = $answerData['question_id'] ?? null;
                if (!$qId) {
                    continue;
                }

                ExamAnswer::updateOrCreate(
                    [
                        'exam_attempt_id' => $attempt->id,
                        'question_id' => $qId,
                    ],
                    [
                        'selected_option_ids' => $answerData['selected_option_ids'] ?? null,
                        'text_response' => $answerData['text_response'] ?? null,
                    ]
                );
                $savedCount++;
            }
        });

        $remainingSeconds = max(0, Carbon::now()->diffInSeconds($attempt->expires_at, false));

        return [
            'saved_count' => $savedCount,
            'server_time' => Carbon::now()->toIso8601String(),
            'remaining_seconds' => $remainingSeconds,
        ];
    }

    /**
     * Submit and auto-grade attempt.
     */
    public function submitAndGrade(ExamAttempt $attempt): ExamAttempt
    {
        if ($attempt->status === 'completed') {
            return $attempt->load('answers');
        }

        return DB::transaction(function () use ($attempt) {
            $totalPointsEarned = 0.0;
            $snapshot = $attempt->questions_snapshot ?? [];

            foreach ($snapshot as $qData) {
                $qId = $qData['id'];
                $pointsPossible = (float) $qData['points'];

                $authoritativeQuestion = Question::with('options')->find($qId);
                $answer = ExamAnswer::where('exam_attempt_id', $attempt->id)
                    ->where('question_id', $qId)
                    ->first();

                $isCorrect = false;
                $awardedPoints = 0.0;

                if ($authoritativeQuestion && $answer) {
                    $qType = $authoritativeQuestion->type;

                    if ($qType === 'multiple_choice_single' || $qType === 'true_false') {
                        $correctOptId = $authoritativeQuestion->options
                            ->where('is_correct', true)
                            ->value('id');

                        $selected = $answer->selected_option_ids;
                        if (is_array($selected) && count($selected) === 1 && (int) $selected[0] === (int) $correctOptId) {
                            $isCorrect = true;
                            $awardedPoints = $pointsPossible;
                        }
                    } elseif ($qType === 'multiple_choice_multiple') {
                        $correctOptIds = $authoritativeQuestion->options
                            ->where('is_correct', true)
                            ->pluck('id')
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
                        }
                    } elseif ($qType === 'short_answer') {
                        // Check if any correct option matches trimmed lowercase response
                        $expectedAnswers = $authoritativeQuestion->options
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
                        // Essay / code_analysis default to pending manual review
                        $isCorrect = null;
                        $awardedPoints = 0.0;
                    }

                    $answer->update([
                        'is_correct' => $isCorrect,
                        'awarded_points' => $awardedPoints,
                    ]);
                } elseif (!$answer) {
                    // Blank answer
                    ExamAnswer::create([
                        'exam_attempt_id' => $attempt->id,
                        'question_id' => $qId,
                        'is_correct' => false,
                        'awarded_points' => 0.0,
                    ]);
                }

                $totalPointsEarned += $awardedPoints;
            }

            $scorePercentage = ($attempt->total_points_possible > 0)
                ? round(($totalPointsEarned / $attempt->total_points_possible) * 100, 2)
                : 0.0;

            $blueprint = $attempt->blueprint;
            $passingScore = $blueprint ? (float) $blueprint->passing_score : 70.0;
            $isPassed = ($scorePercentage >= $passingScore);

            $attempt->update([
                'status' => 'completed',
                'submitted_at' => Carbon::now(),
                'total_points_earned' => $totalPointsEarned,
                'score_percentage' => $scorePercentage,
                'is_passed' => $isPassed,
            ]);

            AuditLog::create([
                'user_id' => $attempt->user_id,
                'action' => 'exam.attempt_submitted',
                'auditable_type' => ExamAttempt::class,
                'auditable_id' => $attempt->id,
                'payload' => [
                    'total_points_earned' => $totalPointsEarned,
                    'score_percentage' => $scorePercentage,
                    'is_passed' => $isPassed,
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
     * Get post-submission detailed review (only after submission or completion).
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

        $reviewedQuestions = [];
        foreach ($snapshot as $qData) {
            $authoritative = Question::with('options')->find($qData['id']);
            $ans = $answers->get($qData['id']);

            $optionsReview = [];
            if ($authoritative) {
                foreach ($authoritative->options as $opt) {
                    $optionsReview[] = [
                        'id' => $opt->id,
                        'option_text' => $opt->option_text,
                        'is_correct' => $opt->is_correct,
                    ];
                }
            }

            $reviewedQuestions[] = [
                'id' => $qData['id'],
                'type' => $qData['type'],
                'prompt' => $qData['prompt'],
                'code_snippet' => $qData['code_snippet'] ?? null,
                'explanation' => $authoritative ? $authoritative->explanation : null,
                'points_possible' => $qData['points'],
                'points_awarded' => $ans ? (float) $ans->awarded_points : 0.0,
                'is_correct' => $ans ? $ans->is_correct : false,
                'selected_option_ids' => $ans ? $ans->selected_option_ids : [],
                'text_response' => $ans ? $ans->text_response : null,
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

