'use client';

import React, { useEffect, useState, use, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  Clock,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Send,
  Save,
  Check,
  Code,
} from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';

export default function ExamTakingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);
  const attemptId = resolvedParams.id;

  const [attempt, setAttempt] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Student Answers Map: { [questionId: number]: { selected_option_ids: number[], text_response: string } }
  const [answers, setAnswers] = useState<Record<number, { selected_option_ids: number[]; text_response: string }>>({});

  // Countdown Timer
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  // Proctoring Warnings
  const [integrityAlert, setIntegrityAlert] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'saving' | 'error'>('synced');

  // Submit Modal
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Load Attempt on Mount
  useEffect(() => {
    const fetchAttempt = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/exam-attempts/${attemptId}`);
        if (res.data?.success) {
          const data = res.data.data;
          setAttempt(data);

          // If already completed, redirect to review
          if (data.status === 'completed' || data.status === 'submitted') {
            router.replace(`/examinations/review/${attemptId}`);
            return;
          }

          // Populate existing answers if any
          if (Array.isArray(data.answers)) {
            const map: Record<number, any> = {};
            data.answers.forEach((ans: any) => {
              map[ans.question_id] = {
                selected_option_ids: ans.selected_option_ids || [],
                text_response: ans.text_response || '',
              };
            });
            setAnswers(map);
          }

          // Compute remaining seconds
          if (data.expires_at) {
            const diff = Math.max(
              0,
              Math.floor((new Date(data.expires_at).getTime() - new Date().getTime()) / 1000)
            );
            setRemainingSeconds(diff);
          }
        }
      } catch (err: any) {
        alert(err.response?.data?.message || 'Failed to load examination.');
        router.push('/examinations');
      } finally {
        setLoading(false);
      }
    };

    fetchAttempt();
  }, [attemptId, router]);

  const answersRef = useRef(answers);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  // Sync answers heartbeat
  const syncAnswers = useCallback(async () => {
    const payload = Object.entries(answersRef.current).map(([qId, val]) => ({
      question_id: parseInt(qId),
      selected_option_ids: val.selected_option_ids,
      text_response: val.text_response,
    }));

    if (payload.length === 0) return;

    try {
      setSyncStatus('saving');
      const res = await api.post(`/exam-attempts/${attemptId}/sync`, { answers: payload });
      if (res.data?.success) {
        setSyncStatus('synced');
        if (res.data.data?.remaining_seconds !== undefined) {
          setRemainingSeconds(res.data.data.remaining_seconds);
        }
      }
    } catch (err: any) {
      if (err.response?.status === 410) {
        alert('Examination time has expired! Auto-submitting answers...');
        router.replace(`/examinations/review/${attemptId}`);
      } else {
        setSyncStatus('error');
      }
    }
  }, [attemptId, router]);

  // Periodic heartbeat sync every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      syncAnswers();
    }, 30000);
    return () => clearInterval(interval);
  }, [syncAnswers]);

  // Countdown ticker
  useEffect(() => {
    if (remainingSeconds === null || remainingSeconds <= 0) return;

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          alert('Time has expired! Submitting examination.');
          handleSubmitExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [remainingSeconds]);

  // Proctoring: Detect Tab Switch / Blur
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIntegrityAlert('Tab switch detected! Your action has been recorded.');
        api.post(`/exam-attempts/${attemptId}/integrity`, {
          event_type: 'tab_switch',
          details: 'User switched browser tabs or minimized window',
        }).catch(() => {});
      }
    };

    const handleWindowBlur = () => {
      setIntegrityAlert('Window focus lost! Please remain on the examination window.');
      api.post(`/exam-attempts/${attemptId}/integrity`, {
        event_type: 'window_blur',
        details: 'User focused away from examination window',
      }).catch(() => {});
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [attemptId]);

  const questions = attempt?.questions_snapshot || [];
  const currentQuestion = questions[currentIndex];

  const handleSelectOption = (questionId: number, optionId: number, isMultiple = false) => {
    setAnswers((prev) => {
      const current = prev[questionId] || { selected_option_ids: [], text_response: '' };
      let updatedIds: number[];

      if (isMultiple) {
        if (current.selected_option_ids.includes(optionId)) {
          updatedIds = current.selected_option_ids.filter((id) => id !== optionId);
        } else {
          updatedIds = [...current.selected_option_ids, optionId];
        }
      } else {
        updatedIds = [optionId];
      }

      return {
        ...prev,
        [questionId]: {
          ...current,
          selected_option_ids: updatedIds,
        },
      };
    });
  };

  const handleTextAnswerChange = (questionId: number, text: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        selected_option_ids: prev[questionId]?.selected_option_ids || [],
        text_response: text,
      },
    }));
  };

  const handleSubmitExam = async () => {
    try {
      setSubmitting(true);
      // Final sync before submission
      await syncAnswers();

      const res = await api.post(`/exam-attempts/${attemptId}/submit`);
      if (res.data?.success) {
        router.replace(`/examinations/review/${attemptId}`);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading || !attempt) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-600 border-t-transparent mx-auto" />
          <p className="text-xs font-semibold text-slate-500">Preparing examination session...</p>
        </div>
      </div>
    );
  }

  const answeredCount = Object.keys(answers).length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Authoritative Exam Header Bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200/80 px-6 py-3 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white font-bold text-xs">
            EX
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900">{attempt.blueprint?.title || 'Examination'}</h1>
            <p className="text-[11px] text-slate-500 font-medium">
              Subject: {attempt.blueprint?.subject || 'Assessment'} • Total Points: {attempt.total_points_possible}
            </p>
          </div>
        </div>

        {/* Sync Status & Server Countdown Timer */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <Save className={`h-3.5 w-3.5 ${syncStatus === 'saving' ? 'animate-spin text-sky-600' : 'text-emerald-500'}`} />
            <span>{syncStatus === 'saving' ? 'Saving...' : 'Auto-Saved'}</span>
          </div>

          {remainingSeconds !== null && (
            <div
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-bold text-xs shadow-xs ${
                remainingSeconds < 300
                  ? 'bg-rose-50 text-rose-600 border border-rose-200 animate-pulse'
                  : 'bg-slate-900 text-white'
              }`}
            >
              <Clock className="h-4 w-4" />
              <span>{formatTimer(remainingSeconds)}</span>
            </div>
          )}

          <Button
            size="sm"
            onClick={() => setIsSubmitModalOpen(true)}
            leftIcon={<Send className="h-3.5 w-3.5" />}
            className="bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
          >
            Finish Exam
          </Button>
        </div>
      </header>

      {/* Proctoring Warning Banner */}
      {integrityAlert && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center justify-between text-xs text-amber-800">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
            <span className="font-semibold">{integrityAlert}</span>
          </div>
          <button
            onClick={() => setIntegrityAlert(null)}
            className="font-bold underline text-amber-900 ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Examination Workspace */}
      <div className="flex-1 max-w-6xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Left Column: Question Viewer */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-6 overflow-hidden">
          {/* Question Header & Points */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-sky-50 text-sky-700 font-bold text-xs uppercase tracking-wider">
                Question {currentIndex + 1} of {questions.length}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                Type: {currentQuestion?.type?.replace(/_/g, ' ')}
              </span>
            </div>
            <span className="text-xs font-bold text-slate-700">
              {currentQuestion?.points || 1} Points
            </span>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.14 }}
              className="space-y-6"
            >
              {/* Question Prompt */}
              <div className="space-y-4">
                <p className="text-base font-semibold text-slate-900 leading-relaxed">
                  {currentQuestion?.prompt}
                </p>

                {/* Code Snippet block if present */}
                {currentQuestion?.code_snippet && (
                  <div className="rounded-xl bg-slate-900 p-4 text-xs font-mono text-emerald-400 overflow-x-auto border border-slate-800">
                    <pre>{currentQuestion.code_snippet}</pre>
                  </div>
                )}
              </div>

              {/* Question Options / Input */}
              <div className="space-y-3 pt-2">
                {currentQuestion?.options && currentQuestion.options.length > 0 ? (
                  <div className="space-y-2.5">
                    {currentQuestion.options.map((opt: any) => {
                      const isSelected =
                        answers[currentQuestion.id]?.selected_option_ids?.includes(opt.id) || false;
                      const isMultiple = currentQuestion.type === 'multiple_choice_multiple';

                      return (
                        <motion.label
                          key={opt.id}
                          whileTap={{ scale: 0.99 }}
                          transition={{ type: "spring", stiffness: 450, damping: 30 }}
                          onClick={() => handleSelectOption(currentQuestion.id, opt.id, isMultiple)}
                          className={`flex items-center gap-3 p-4 rounded-xl border text-sm font-medium transition cursor-pointer ${
                            isSelected
                              ? 'border-sky-500 bg-sky-50/70 text-sky-900 shadow-xs'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type={isMultiple ? 'checkbox' : 'radio'}
                            name={`question_${currentQuestion.id}`}
                            checked={isSelected}
                            onChange={() => {}}
                            className="h-4 w-4 text-sky-600 focus:ring-sky-500"
                          />
                          <span>{opt.option_text}</span>
                        </motion.label>
                      );
                    })}
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                      Your Answer
                    </label>
                    <textarea
                      rows={4}
                      placeholder="Type your response here..."
                      value={answers[currentQuestion?.id]?.text_response || ''}
                      onChange={(e) => handleTextAnswerChange(currentQuestion.id, e.target.value)}
                      className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    />
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-6 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              leftIcon={<ChevronLeft className="h-4 w-4" />}
            >
              Previous
            </Button>

            <span className="text-xs text-slate-400 font-semibold">
              {currentIndex + 1} / {questions.length}
            </span>

            <Button
              variant="outline"
              size="sm"
              disabled={currentIndex === questions.length - 1}
              onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
              rightIcon={<ChevronRight className="h-4 w-4" />}
            >
              Next
            </Button>
          </div>
        </div>

        {/* Right Column: Question Palette Navigation Grid */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Question Palette
            </h4>
            <span className="text-[11px] font-bold text-slate-500">
              {answeredCount}/{questions.length} answered
            </span>
          </div>

          {/* Grid of question numbers */}
          <div className="grid grid-cols-5 gap-2">
            {questions.map((q: any, idx: number) => {
              const isAnswered =
                (answers[q.id]?.selected_option_ids?.length || 0) > 0 ||
                (answers[q.id]?.text_response?.trim().length || 0) > 0;
              const isCurrent = idx === currentIndex;

              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentIndex(idx)}
                  className={`h-9 rounded-xl font-bold text-xs transition flex items-center justify-center ${
                    isCurrent
                      ? 'ring-2 ring-sky-500 ring-offset-2 bg-sky-600 text-white'
                      : isAnswered
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          {/* Palette Legend */}
          <div className="pt-3 border-t border-slate-100 space-y-1.5 text-[11px] text-slate-500 font-medium">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-md bg-emerald-50 border border-emerald-300" />
              <span>Answered</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-md bg-slate-100 border border-slate-300" />
              <span>Unvisited / Pending</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-md bg-sky-600" />
              <span>Current Item</span>
            </div>
          </div>
        </div>
      </div>

      {/* SUBMISSION CONFIRMATION MODAL */}
      <Modal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        title="Submit Examination"
        description="Are you ready to submit your answers for evaluation?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsSubmitModalOpen(false)}>
              Keep Reviewing
            </Button>
            <Button loading={submitting} onClick={handleSubmitExam}>
              Confirm Submission
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-xs text-slate-600">
          <p>
            You have answered <span className="font-bold text-slate-900">{answeredCount}</span> out of{' '}
            <span className="font-bold text-slate-900">{questions.length}</span> questions.
          </p>
          {answeredCount < questions.length && (
            <p className="text-amber-600 font-semibold flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" />
              Warning: You have {questions.length - answeredCount} unanswered questions remaining.
            </p>
          )}
          <p>
            Once submitted, your answers will be automatically graded and the authoritative score will be recorded.
          </p>
        </div>
      </Modal>
    </div>
  );
}

