<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ExamAttempt;
use App\Models\ExamBlueprint;
use App\Models\Question;
use App\Models\QuestionBank;
use App\Services\ExaminationAssessmentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ExamAssessmentController extends Controller
{
    protected ExaminationAssessmentService $assessmentService;

    public function __construct(ExaminationAssessmentService $assessmentService)
    {
        $this->assessmentService = $assessmentService;
    }

    // ==========================================
    // 1. Question Banks
    // ==========================================
    public function banksIndex(Request $request)
    {
        $banks = QuestionBank::where('user_id', $request->user()->id)
            ->withCount('questions')
            ->orderBy('id', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $banks,
        ]);
    }

    public function banksStore(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'subject' => 'required|string|max:100',
            'description' => 'nullable|string',
        ]);

        $bank = QuestionBank::create(array_merge($validated, [
            'user_id' => $request->user()->id,
        ]));

        return response()->json([
            'success' => true,
            'message' => 'Question bank created successfully',
            'data' => $bank,
        ], 201);
    }

    public function banksShow(Request $request, QuestionBank $bank)
    {
        if ($bank->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $bank->load(['questions.options']);

        return response()->json([
            'success' => true,
            'data' => $bank,
        ]);
    }

    public function banksDestroy(Request $request, QuestionBank $bank)
    {
        if ($bank->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $bank->delete();

        return response()->json([
            'success' => true,
            'message' => 'Question bank deleted successfully',
        ]);
    }

    // ==========================================
    // 2. Questions & Options
    // ==========================================
    public function questionsStore(Request $request, QuestionBank $bank)
    {
        if ($bank->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'type' => 'required|in:multiple_choice_single,multiple_choice_multiple,true_false,short_answer,essay,code_analysis',
            'prompt' => 'required|string',
            'code_snippet' => 'nullable|string',
            'explanation' => 'nullable|string',
            'points' => 'nullable|numeric|min:0.5',
            'difficulty' => 'nullable|in:easy,medium,hard',
            'options' => 'nullable|array',
            'options.*.option_text' => 'required_with:options|string',
            'options.*.is_correct' => 'required_with:options|boolean',
        ]);

        $question = DB::transaction(function () use ($bank, $validated) {
            $q = $bank->questions()->create([
                'type' => $validated['type'],
                'prompt' => $validated['prompt'],
                'code_snippet' => $validated['code_snippet'] ?? null,
                'explanation' => $validated['explanation'] ?? null,
                'points' => $validated['points'] ?? 1.0,
                'difficulty' => $validated['difficulty'] ?? 'medium',
            ]);

            if (!empty($validated['options'])) {
                foreach ($validated['options'] as $idx => $opt) {
                    $q->options()->create([
                        'option_text' => $opt['option_text'],
                        'is_correct' => (bool) $opt['is_correct'],
                        'order' => $idx + 1,
                    ]);
                }
            }

            return $q->load('options');
        });

        return response()->json([
            'success' => true,
            'message' => 'Question added successfully',
            'data' => $question,
        ], 201);
    }

    public function questionsUpdate(Request $request, Question $question)
    {
        if ($question->questionBank->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'type' => 'sometimes|in:multiple_choice_single,multiple_choice_multiple,true_false,short_answer,essay,code_analysis',
            'prompt' => 'sometimes|string',
            'code_snippet' => 'nullable|string',
            'explanation' => 'nullable|string',
            'points' => 'nullable|numeric|min:0.5',
            'difficulty' => 'nullable|in:easy,medium,hard',
            'options' => 'nullable|array',
            'options.*.option_text' => 'required_with:options|string',
            'options.*.is_correct' => 'required_with:options|boolean',
        ]);

        $updatedQuestion = DB::transaction(function () use ($question, $validated) {
            $question->update(collect($validated)->except('options')->all());

            if (isset($validated['options'])) {
                $question->options()->delete();
                foreach ($validated['options'] as $idx => $opt) {
                    $question->options()->create([
                        'option_text' => $opt['option_text'],
                        'is_correct' => (bool) $opt['is_correct'],
                        'order' => $idx + 1,
                    ]);
                }
            }

            return $question->load('options');
        });

        return response()->json([
            'success' => true,
            'message' => 'Question updated successfully',
            'data' => $updatedQuestion,
        ]);
    }

    public function questionsDestroy(Request $request, Question $question)
    {
        if ($question->questionBank->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $question->delete();

        return response()->json([
            'success' => true,
            'message' => 'Question deleted successfully',
        ]);
    }

    // ==========================================
    // 3. Exam Blueprints
    // ==========================================
    public function blueprintsIndex(Request $request)
    {
        $blueprints = ExamBlueprint::where('user_id', $request->user()->id)
            ->withCount(['questions', 'attempts'])
            ->orderBy('id', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $blueprints,
        ]);
    }

    public function blueprintsStore(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'subject' => 'required|string|max:100',
            'instructions' => 'nullable|string',
            'duration_minutes' => 'required|integer|min:1',
            'passing_score' => 'nullable|numeric|min:0|max:100',
            'shuffle_questions' => 'nullable|boolean',
            'shuffle_options' => 'nullable|boolean',
            'max_attempts' => 'nullable|integer|min:0',
            'course_id' => 'nullable|exists:courses,id',
            'starts_at' => 'nullable|date',
            'ends_at' => 'nullable|date',
            'question_ids' => 'nullable|array',
            'question_ids.*' => 'exists:questions,id',
        ]);

        $blueprint = DB::transaction(function () use ($request, $validated) {
            $bp = ExamBlueprint::create([
                'user_id' => $request->user()->id,
                'course_id' => $validated['course_id'] ?? null,
                'title' => $validated['title'],
                'subject' => $validated['subject'],
                'instructions' => $validated['instructions'] ?? null,
                'duration_minutes' => $validated['duration_minutes'],
                'passing_score' => $validated['passing_score'] ?? 70.0,
                'shuffle_questions' => $validated['shuffle_questions'] ?? true,
                'shuffle_options' => $validated['shuffle_options'] ?? true,
                'max_attempts' => $validated['max_attempts'] ?? 1,
                'starts_at' => $validated['starts_at'] ?? null,
                'ends_at' => $validated['ends_at'] ?? null,
                'is_published' => true,
            ]);

            if (!empty($validated['question_ids'])) {
                foreach ($validated['question_ids'] as $idx => $qId) {
                    $q = Question::find($qId);
                    $bp->questions()->attach($qId, [
                        'points' => $q ? $q->points : 1.0,
                        'order' => $idx + 1,
                    ]);
                }
            }

            return $bp->load(['questions', 'course']);
        });

        return response()->json([
            'success' => true,
            'message' => 'Exam blueprint created successfully',
            'data' => $blueprint,
        ], 201);
    }

    public function blueprintsShow(Request $request, ExamBlueprint $blueprint)
    {
        $blueprint->load(['questions.options', 'course']);

        return response()->json([
            'success' => true,
            'data' => $blueprint,
        ]);
    }

    public function blueprintsUpdate(Request $request, ExamBlueprint $blueprint)
    {
        if ($blueprint->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'title' => 'sometimes|string|max:255',
            'subject' => 'sometimes|string|max:100',
            'instructions' => 'nullable|string',
            'duration_minutes' => 'sometimes|integer|min:1',
            'passing_score' => 'nullable|numeric|min:0|max:100',
            'shuffle_questions' => 'nullable|boolean',
            'shuffle_options' => 'nullable|boolean',
            'max_attempts' => 'nullable|integer|min:0',
            'course_id' => 'nullable|exists:courses,id',
            'starts_at' => 'nullable|date',
            'ends_at' => 'nullable|date',
            'is_published' => 'nullable|boolean',
            'question_ids' => 'nullable|array',
            'question_ids.*' => 'exists:questions,id',
        ]);

        $updated = DB::transaction(function () use ($blueprint, $validated) {
            $blueprint->update(collect($validated)->except('question_ids')->all());

            if (isset($validated['question_ids'])) {
                $attachData = [];
                foreach ($validated['question_ids'] as $idx => $qId) {
                    $q = Question::find($qId);
                    $attachData[$qId] = [
                        'points' => $q ? $q->points : 1.0,
                        'order' => $idx + 1,
                    ];
                }
                $blueprint->questions()->sync($attachData);
            }

            return $blueprint->load(['questions.options', 'course']);
        });

        return response()->json([
            'success' => true,
            'message' => 'Exam blueprint updated successfully',
            'data' => $updated,
        ]);
    }

    public function blueprintsDestroy(Request $request, ExamBlueprint $blueprint)
    {
        if ($blueprint->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $blueprint->delete();

        return response()->json([
            'success' => true,
            'message' => 'Exam blueprint deleted successfully',
        ]);
    }

    public function attachQuestions(Request $request, ExamBlueprint $blueprint)
    {
        if ($blueprint->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'question_ids' => 'required|array',
            'question_ids.*' => 'exists:questions,id',
        ]);

        $maxOrder = $blueprint->questions()->max('exam_blueprint_questions.order') ?? 0;
        foreach ($validated['question_ids'] as $idx => $qId) {
            $q = Question::find($qId);
            $blueprint->questions()->syncWithoutDetaching([
                $qId => [
                    'points' => $q ? $q->points : 1.0,
                    'order' => $maxOrder + $idx + 1,
                ],
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Questions linked to blueprint',
            'data' => $blueprint->fresh('questions'),
        ]);
    }

    // ==========================================
    // 4. Assessment Session Execution Engine
    // ==========================================
    public function startAttempt(Request $request, ExamBlueprint $blueprint)
    {
        try {
            $attempt = $this->assessmentService->startAttempt($blueprint, $request->user());
            return response()->json([
                'success' => true,
                'message' => 'Examination session started',
                'data' => $attempt,
            ]);
        } catch (\DomainException $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 400);
        }
    }

    public function showAttempt(Request $request, ExamAttempt $attempt)
    {
        if ($attempt->user_id !== $request->user()->id && $request->user()->role !== 'admin') {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $attempt->load(['blueprint', 'answers']);

        return response()->json([
            'success' => true,
            'data' => $attempt,
        ]);
    }

    public function syncAnswers(Request $request, ExamAttempt $attempt)
    {
        if ($attempt->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'answers' => 'required|array',
            'answers.*.question_id' => 'required|integer',
            'answers.*.selected_option_ids' => 'nullable|array',
            'answers.*.text_response' => 'nullable|string',
        ]);

        try {
            $result = $this->assessmentService->syncAnswers($attempt, $validated['answers']);
            return response()->json([
                'success' => true,
                'message' => 'Answers synced successfully',
                'data' => $result,
            ]);
        } catch (\DomainException $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 410);
        }
    }

    public function logIntegrity(Request $request, ExamAttempt $attempt)
    {
        if ($attempt->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'event_type' => 'required|string|in:tab_switch,window_blur,fullscreen_exit,paste_detected,ip_mismatch',
            'details' => 'nullable|string|max:255',
        ]);

        $log = $this->assessmentService->logIntegrity(
            $attempt,
            $validated['event_type'],
            $validated['details'] ?? null
        );

        return response()->json([
            'success' => true,
            'message' => 'Integrity event recorded',
            'data' => $log,
        ]);
    }

    public function submitAttempt(Request $request, ExamAttempt $attempt)
    {
        if ($attempt->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        try {
            $completedAttempt = $this->assessmentService->submitAndGrade($attempt);
            return response()->json([
                'success' => true,
                'message' => 'Examination submitted and evaluated successfully',
                'data' => $completedAttempt,
            ]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 400);
        }
    }

    public function getReview(Request $request, ExamAttempt $attempt)
    {
        try {
            $review = $this->assessmentService->getReview($attempt, $request->user());
            return response()->json([
                'success' => true,
                'data' => $review,
            ]);
        } catch (\DomainException $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 403);
        }
    }

    public function attemptsIndex(Request $request)
    {
        $attempts = ExamAttempt::where('user_id', $request->user()->id)
            ->with(['blueprint'])
            ->orderBy('started_at', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $attempts,
        ]);
    }
}

