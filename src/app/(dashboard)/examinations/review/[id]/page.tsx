'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import {
  Award,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  ShieldAlert,
  ArrowLeft,
  Calendar,
  Clock,
  HelpCircle,
  Check,
  X,
} from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { AnimatedNumber, FadeIn, StaggerContainer, StaggerItem } from '@/components/animations';

export default function ExamReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);
  const attemptId = resolvedParams.id;

  const [reviewData, setReviewData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReview = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/exam-attempts/${attemptId}/review`);
        if (res.data?.success) {
          setReviewData(res.data.data);
        }
      } catch (err: any) {
        alert(err.response?.data?.message || 'Could not load examination review.');
        router.push('/examinations');
      } finally {
        setLoading(false);
      }
    };

    fetchReview();
  }, [attemptId, router]);

  if (loading || !reviewData) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-600 border-t-transparent" />
      </div>
    );
  }

  const { attempt, blueprint, questions, integrity_summary } = reviewData;
  const isPassed = attempt.is_passed;
  const totalIntegrityEvents: number = Object.values(integrity_summary || {}).reduce(
    (acc: number, v: any) => acc + (parseInt(v) || 0),
    0
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Return button */}
      <div>
        <Link href="/examinations">
          <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="h-4 w-4" />}>
            Back to Examination Hub
          </Button>
        </Link>
      </div>

      {/* Scorecard Hero Banner */}
      <FadeIn direction="down">
        <div
          className={`p-6 sm:p-8 rounded-3xl border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6 ${
            isPassed
              ? 'bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-white border-emerald-200'
              : 'bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-white border-rose-200'
          }`}
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  isPassed ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                }`}
              >
                {isPassed ? 'Passed' : 'Not Passed'}
              </span>
              <span className="text-xs font-semibold text-slate-500">
                Submitted: {new Date(attempt.submitted_at || attempt.updated_at).toLocaleString()}
              </span>
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              {blueprint?.title || 'Examination Results'}
            </h2>
            <p className="text-xs text-slate-600">
              Subject: <span className="font-semibold">{blueprint?.subject}</span> • Passing Score:{' '}
              <span className="font-semibold">{blueprint?.passing_score}%</span>
            </p>
          </div>

          {/* Score Metric Circular/Box */}
          <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 sm:border-l border-slate-200/80 pt-4 sm:pt-0 sm:pl-8">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Final Score
            </span>
            <div className="text-3xl sm:text-4xl font-black text-slate-900">
              <AnimatedNumber value={attempt.score_percentage || 0} />%
            </div>
            <p className="text-xs font-semibold text-slate-500">
              <AnimatedNumber value={attempt.total_points_earned || 0} /> / {attempt.total_points_possible} Points
            </p>
          </div>
        </div>
      </FadeIn>

      {/* Proctoring Integrity Summary Box */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {totalIntegrityEvents === 0 ? (
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
            ) : (
              <ShieldAlert className="h-4 w-4 text-amber-600" />
            )}
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Proctoring Integrity Verification
            </h4>
          </div>
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-md ${
              totalIntegrityEvents === 0
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-amber-50 text-amber-700'
            }`}
          >
            {totalIntegrityEvents === 0
              ? 'Clean Session'
              : `${totalIntegrityEvents} Events Flagged`}
          </span>
        </div>

        {totalIntegrityEvents > 0 ? (
          <div className="pt-2 flex flex-wrap gap-2">
            {Object.entries(integrity_summary || {}).map(([event, count]: any) => (
              <span
                key={event}
                className="text-xs bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg text-slate-700 font-medium"
              >
                {event.replace('_', ' ')}: <strong className="text-slate-900">{count}</strong>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            No tab switches, window blurs, or suspicious events were recorded during this session.
          </p>
        )}
      </div>

      {/* Detailed Question Review List */}
      <StaggerContainer className="space-y-4">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
          Detailed Question Analysis ({questions.length} Items)
        </h3>

        {questions.map((q: any, idx: number) => {
          const isCorrect = q.is_correct;

          return (
            <StaggerItem
              key={q.id}
              className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4"
            >
              {/* Question Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                      isCorrect
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    {isCorrect ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                  </span>
                  <span className="text-xs font-bold text-slate-800">Question {idx + 1}</span>
                </div>

                <span className="text-xs font-bold text-slate-600">
                  {q.points_awarded} / {q.points_possible} Pts
                </span>
              </div>

              {/* Prompt */}
              <div>
                <p className="text-sm font-semibold text-slate-900">{q.prompt}</p>
                {q.code_snippet && (
                  <div className="mt-2 rounded-xl bg-slate-900 p-3 text-xs font-mono text-emerald-400 overflow-x-auto">
                    <pre>{q.code_snippet}</pre>
                  </div>
                )}
              </div>

              {/* Options Breakdown */}
              {q.options && q.options.length > 0 ? (
                <div className="space-y-2 pt-1">
                  {q.options.map((opt: any) => {
                    const isSelected = q.selected_option_ids?.includes(opt.id);
                    const isOptionCorrect = opt.is_correct;

                    let optionStyle = 'border-slate-200 bg-white text-slate-700';
                    if (isOptionCorrect && isSelected) {
                      optionStyle = 'border-emerald-500 bg-emerald-50/80 text-emerald-950 font-semibold';
                    } else if (isOptionCorrect && !isSelected) {
                      optionStyle = 'border-emerald-300 bg-emerald-50/40 text-emerald-900 border-dashed';
                    } else if (!isOptionCorrect && isSelected) {
                      optionStyle = 'border-rose-400 bg-rose-50/70 text-rose-950 font-semibold';
                    }

                    return (
                      <div
                        key={opt.id}
                        className={`flex items-center justify-between p-3 rounded-xl border text-xs transition ${optionStyle}`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${
                              isSelected
                                ? isOptionCorrect
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-rose-600 text-white border-rose-600'
                                : 'border-slate-300'
                            }`}
                          >
                            {isSelected && <span className="h-1.5 w-1.5 bg-white rounded-full" />}
                          </span>
                          <span>{opt.option_text}</span>
                        </div>

                        {isOptionCorrect && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                            Correct Key
                          </span>
                        )}
                        {!isOptionCorrect && isSelected && (
                          <span className="text-[10px] font-bold text-rose-700 bg-rose-100/70 px-2 py-0.5 rounded-md">
                            Your Choice
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Text response */
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                  <span className="font-bold text-slate-700 block mb-1">Your Response:</span>
                  <p className="text-slate-800">{q.text_response || 'No response provided.'}</p>
                </div>
              )}

              {/* Authoritative Explanation */}
              {q.explanation && (
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-xs space-y-1">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <HelpCircle className="h-3.5 w-3.5 text-sky-600" /> Explanation
                  </span>
                  <p className="text-slate-600 leading-relaxed pl-5">{q.explanation}</p>
                </div>
              )}
            </StaggerItem>
          );
        })}
      </StaggerContainer>
    </div>
  );
}
