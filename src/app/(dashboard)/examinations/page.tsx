'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  GraduationCap,
  Plus,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  Trash2,
  BookOpen,
  Award,
  Play,
  Layers,
  History,
  FileQuestion,
  ChevronRight,
  ShieldCheck,
  FileCheck,
  Edit2,
  Code2,
  HelpCircle,
} from 'lucide-react';
import api, { extractApiErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Tabs } from '@/components/ui/Tabs';

export default function ExaminationsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'schedules' | 'blueprints' | 'banks' | 'grading' | 'history'>('schedules');
  const [loading, setLoading] = useState(true);

  // Data states
  const [examinations, setExaminations] = useState<any[]>([]);
  const [blueprints, setBlueprints] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [gradingQueue, setGradingQueue] = useState<any[]>([]);

  // Modals
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isBlueprintModalOpen, setIsBlueprintModalOpen] = useState(false);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [isEditBankModalOpen, setIsEditBankModalOpen] = useState<any | null>(null);
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState<any | null>(null);
  const [activeGradingAttempt, setActiveGradingAttempt] = useState<any | null>(null);

  // Schedule Form
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [examinationDate, setExaminationDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [durationMinutes, setDurationMinutes] = useState('60');
  const [locationPlatform, setLocationPlatform] = useState('');
  const [savingSchedule, setSavingSchedule] = useState(false);

  // Blueprint Form
  const [bpTitle, setBpTitle] = useState('');
  const [bpSubject, setBpSubject] = useState('');
  const [bpCourseId, setBpCourseId] = useState<number | undefined>();
  const [bpDuration, setBpDuration] = useState('60');
  const [bpPassingScore, setBpPassingScore] = useState('70');
  const [savingBp, setSavingBp] = useState(false);

  // Bank Form
  const [bankTitle, setBankTitle] = useState('');
  const [bankSubject, setBankSubject] = useState('');
  const [bankDescription, setBankDescription] = useState('');
  const [savingBank, setSavingBank] = useState(false);

  // Question Form (All 6 question types)
  const [qType, setQType] = useState('multiple_choice_single');
  const [qPrompt, setQPrompt] = useState('');
  const [qCodeSnippet, setQCodeSnippet] = useState('');
  const [qExplanation, setQExplanation] = useState('');
  const [qPoints, setQPoints] = useState('5');
  const [qDifficulty, setQDifficulty] = useState('medium');
  const [qOptions, setQOptions] = useState([
    { option_text: '', is_correct: true },
    { option_text: '', is_correct: false },
    { option_text: '', is_correct: false },
  ]);
  const [savingQuestion, setSavingQuestion] = useState(false);

  // Grading Form State
  const [gradesInput, setGradesInput] = useState<Record<number, { awarded_points: number; feedback: string }>>({});
  const [submittingGrade, setSubmittingGrade] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [examRes, bpRes, bankRes, attemptsRes, coursesRes, gradingRes] = await Promise.all([
        api.get('/examinations'),
        api.get('/exam-blueprints'),
        api.get('/question-banks'),
        api.get('/exam-attempts'),
        api.get('/courses'),
        api.get('/exam-grading'),
      ]);

      if (examRes.data?.success) setExaminations(examRes.data.data || []);
      if (bpRes.data?.success) setBlueprints(bpRes.data.data || []);
      if (bankRes.data?.success) setBanks(bankRes.data.data || []);
      if (attemptsRes.data?.success) setAttempts(attemptsRes.data.data || []);
      if (coursesRes.data?.success) setCourses(coursesRes.data.data || []);
      if (gradingRes.data?.success) setGradingQueue(gradingRes.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleStartExam = async (blueprintId: number) => {
    try {
      const res = await api.post(`/exam-blueprints/${blueprintId}/start`);
      if (res.data?.success && res.data.data?.id) {
        router.push(`/examinations/take/${res.data.data.id}`);
      }
    } catch (err: unknown) {
      alert(extractApiErrorMessage(err, 'Could not start examination attempt.'));
    }
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !examinationDate) return;

    try {
      setSavingSchedule(true);
      const res = await api.post('/examinations', {
        title,
        subject,
        examination_date: examinationDate,
        start_time: startTime,
        duration_minutes: parseInt(durationMinutes, 10) || 60,
        location_platform: locationPlatform,
        status: 'upcoming',
      });

      if (res.data?.success) {
        setIsScheduleModalOpen(false);
        setTitle('');
        setSubject('');
        setLocationPlatform('');
        fetchData();
      }
    } catch (err: unknown) {
      alert(extractApiErrorMessage(err));
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleCreateBlueprint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bpTitle.trim() || !bpSubject.trim()) return;

    try {
      setSavingBp(true);
      const res = await api.post('/exam-blueprints', {
        title: bpTitle,
        subject: bpSubject,
        course_id: bpCourseId || null,
        duration_minutes: parseInt(bpDuration, 10) || 60,
        passing_score: parseFloat(bpPassingScore) || 70,
        shuffle_questions: true,
        shuffle_options: true,
        max_attempts: 3,
      });

      if (res.data?.success) {
        setIsBlueprintModalOpen(false);
        setBpTitle('');
        setBpSubject('');
        fetchData();
      }
    } catch (err: unknown) {
      alert(extractApiErrorMessage(err));
    } finally {
      setSavingBp(false);
    }
  };

  const handleCreateBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankTitle.trim() || !bankSubject.trim()) return;

    try {
      setSavingBank(true);
      const res = await api.post('/question-banks', {
        title: bankTitle,
        subject: bankSubject,
        description: bankDescription,
      });

      if (res.data?.success) {
        setIsBankModalOpen(false);
        setBankTitle('');
        setBankSubject('');
        setBankDescription('');
        fetchData();
      }
    } catch (err: unknown) {
      alert(extractApiErrorMessage(err));
    } finally {
      setSavingBank(false);
    }
  };

  const handleUpdateBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditBankModalOpen) return;

    try {
      setSavingBank(true);
      const res = await api.put(`/question-banks/${isEditBankModalOpen.id}`, {
        title: bankTitle,
        subject: bankSubject,
        description: bankDescription,
      });

      if (res.data?.success) {
        setIsEditBankModalOpen(null);
        setBankTitle('');
        setBankSubject('');
        setBankDescription('');
        fetchData();
      }
    } catch (err: unknown) {
      alert(extractApiErrorMessage(err));
    } finally {
      setSavingBank(false);
    }
  };

  const handleDeleteBank = async (bankId: number) => {
    if (!confirm('Are you sure you want to delete this question bank? All associated questions will be removed.')) return;
    try {
      await api.delete(`/question-banks/${bankId}`);
      fetchData();
    } catch (err: unknown) {
      alert(extractApiErrorMessage(err));
    }
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isQuestionModalOpen || !qPrompt.trim()) return;

    try {
      setSavingQuestion(true);
      const payload: any = {
        type: qType,
        prompt: qPrompt,
        explanation: qExplanation,
        points: parseFloat(qPoints) || 5,
        difficulty: qDifficulty,
      };

      if (qType === 'code_analysis' && qCodeSnippet.trim()) {
        payload.code_snippet = qCodeSnippet.trim();
      }

      if (['multiple_choice_single', 'multiple_choice_multiple', 'true_false', 'short_answer'].includes(qType)) {
        payload.options = qOptions.filter((o) => o.option_text.trim().length > 0);
      }

      const res = await api.post(`/question-banks/${isQuestionModalOpen.id}/questions`, payload);

      if (res.data?.success) {
        setIsQuestionModalOpen(null);
        setQPrompt('');
        setQCodeSnippet('');
        setQExplanation('');
        fetchData();
      }
    } catch (err: unknown) {
      alert(extractApiErrorMessage(err));
    } finally {
      setSavingQuestion(false);
    }
  };

  const handleOpenGrading = async (attemptId: string) => {
    try {
      const res = await api.get(`/exam-grading/${attemptId}`);
      if (res.data?.success) {
        setActiveGradingAttempt(res.data.data);
        const initialGrades: Record<number, { awarded_points: number; feedback: string }> = {};
        (res.data.data.questions || []).forEach((q: any) => {
          initialGrades[q.question_id] = {
            awarded_points: q.awarded_points || 0,
            feedback: q.evaluator_feedback || '',
          };
        });
        setGradesInput(initialGrades);
      }
    } catch (err: unknown) {
      alert(extractApiErrorMessage(err, 'Failed to load attempt details for grading.'));
    }
  };

  const handleSubmitEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGradingAttempt) return;

    try {
      setSubmittingGrade(true);
      const gradesArray = Object.entries(gradesInput).map(([qId, val]) => ({
        question_id: Number(qId),
        awarded_points: val.awarded_points,
        feedback: val.feedback,
      }));

      const res = await api.post(`/exam-grading/${activeGradingAttempt.attempt.id}`, {
        grades: gradesArray,
      });

      if (res.data?.success) {
        setActiveGradingAttempt(null);
        fetchData();
      }
    } catch (err: unknown) {
      alert(extractApiErrorMessage(err, 'Failed to submit evaluation.'));
    } finally {
      setSubmittingGrade(false);
    }
  };

  const tabs = [
    { id: 'schedules', label: 'Scheduled Examinations', icon: <Calendar className="h-4 w-4" /> },
    { id: 'blueprints', label: 'Assessment Engine & Tests', icon: <Play className="h-4 w-4" /> },
    { id: 'banks', label: 'Question Banks & Repository', icon: <Layers className="h-4 w-4" /> },
    {
      id: 'grading',
      label: `Grading Queue ${gradingQueue.length > 0 ? `(${gradingQueue.length})` : ''}`,
      icon: <FileCheck className="h-4 w-4" />,
    },
    { id: 'history', label: 'Past Attempts & Scorecards', icon: <History className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 text-[10px] font-bold uppercase tracking-wider">
              Dedicated Examination Subsystem
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Examination Platform</h2>
          <p className="mt-1 text-xs text-slate-500">
            Author multi-type question banks, configure proctored exam blueprints, and evaluate student essay submissions.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {activeTab === 'schedules' && (
            <Button
              size="sm"
              onClick={() => setIsScheduleModalOpen(true)}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Schedule Exam
            </Button>
          )}
          {activeTab === 'blueprints' && (
            <Button
              size="sm"
              onClick={() => setIsBlueprintModalOpen(true)}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              New Blueprint
            </Button>
          )}
          {activeTab === 'banks' && (
            <Button
              size="sm"
              onClick={() => {
                setBankTitle('');
                setBankSubject('');
                setBankDescription('');
                setIsBankModalOpen(true);
              }}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              New Question Bank
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as any)}
      />

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-600 border-t-transparent" />
        </div>
      ) : activeTab === 'schedules' ? (
        /* SCHEDULES TAB */
        examinations.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="No scheduled examinations"
            description="Add your upcoming certifications, school exams, or university tests."
            actionLabel="Schedule Exam"
            onAction={() => setIsScheduleModalOpen(true)}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {examinations.map((exam) => (
              <div
                key={exam.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {exam.subject}
                  </span>
                  <Badge variant={exam.status === 'completed' ? 'success' : 'default'}>
                    {exam.status}
                  </Badge>
                </div>
                <h3 className="text-base font-bold text-slate-900 leading-tight">{exam.title}</h3>
                <div className="space-y-1.5 text-xs text-slate-500 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span>{exam.examination_date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    <span>{exam.start_time} ({exam.duration_minutes} mins)</span>
                  </div>
                  {exam.location_platform && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      <span>{exam.location_platform}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : activeTab === 'blueprints' ? (
        /* BLUEPRINTS TAB */
        blueprints.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="No exam blueprints created"
            description="Create an exam blueprint to configure questions, duration, and launch tests."
            actionLabel="Create Blueprint"
            onAction={() => setIsBlueprintModalOpen(true)}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {blueprints.map((bp) => (
              <div
                key={bp.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600">
                      {bp.subject}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                      <ShieldCheck className="h-3 w-3" /> Anti-Leak Snapshot
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 leading-tight">{bp.title}</h3>

                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">Duration</p>
                      <p className="font-bold text-slate-800">{bp.duration_minutes} Mins</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">Passing Score</p>
                      <p className="font-bold text-slate-800">{bp.passing_score}%</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">Questions</p>
                      <p className="font-bold text-slate-800">{bp.questions_count || 1} Items</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">Attempts</p>
                      <p className="font-bold text-slate-800">{bp.attempts_count || 0} Taken</p>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => handleStartExam(bp.id)}
                  leftIcon={<Play className="h-4 w-4" />}
                  className="w-full font-bold"
                >
                  Start Examination
                </Button>
              </div>
            ))}
          </div>
        )
      ) : activeTab === 'banks' ? (
        /* QUESTION BANKS TAB */
        banks.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No question banks"
            description="Create a question bank to organize multiple-choice and subjective questions."
            actionLabel="Create Bank"
            onAction={() => {
              setBankTitle('');
              setBankSubject('');
              setBankDescription('');
              setIsBankModalOpen(true);
            }}
          />
        ) : (
          <div className="space-y-4">
            {banks.map((bank) => (
              <div
                key={bank.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {bank.subject}
                    </span>
                    <h3 className="text-base font-bold text-slate-900">{bank.title}</h3>
                    {bank.description && (
                      <p className="text-xs text-slate-500 mt-0.5">{bank.description}</p>
                    )}
                    <p className="text-[11px] font-semibold text-sky-600 mt-1">
                      {bank.questions_count || bank.questions?.length || 0} Questions in Repository
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setIsEditBankModalOpen(bank);
                        setBankTitle(bank.title);
                        setBankSubject(bank.subject);
                        setBankDescription(bank.description || '');
                      }}
                      leftIcon={<Edit2 className="h-3.5 w-3.5" />}
                    >
                      Edit Bank
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setIsQuestionModalOpen(bank)}
                      leftIcon={<Plus className="h-3.5 w-3.5" />}
                    >
                      Add Question
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleDeleteBank(bank.id)}
                      title="Delete Bank"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : activeTab === 'grading' ? (
        /* INSTRUCTOR MANUAL GRADING QUEUE TAB */
        gradingQueue.length === 0 ? (
          <EmptyState
            icon={FileCheck}
            title="Grading Queue is Clear"
            description="No examination attempts are currently pending manual evaluation. Objective questions are auto-graded immediately."
          />
        ) : (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center justify-between">
              <span className="font-semibold">
                {gradingQueue.length} student submission(s) awaiting subjective answer review (Essay / Code Analysis).
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {gradingQueue.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600">
                        {item.blueprint?.subject}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                        Pending Evaluation
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900">{item.blueprint?.title}</h3>
                    <p className="text-xs text-slate-600">
                      Student: <span className="font-semibold text-slate-800">{item.student?.name}</span> ({item.student?.email})
                    </p>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold">Submitted</span>
                        <span className="font-bold text-slate-700">{item.submitted_at?.slice(0, 16)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold">Pending Questions</span>
                        <span className="font-bold text-amber-600">{item.pending_questions_count} Items</span>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={() => handleOpenGrading(item.id)}
                    leftIcon={<FileCheck className="h-4 w-4" />}
                    className="w-full font-bold"
                  >
                    Grade Student Attempt
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )
      ) : (
        /* PAST ATTEMPTS & SCORECARDS TAB */
        attempts.length === 0 ? (
          <EmptyState
            icon={History}
            title="No past examination attempts"
            description="Start an assessment from the Assessment Engine tab to record your results and scorecards."
            actionLabel="Browse Blueprints"
            onAction={() => setActiveTab('blueprints')}
          />
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Examination History</h3>
                <p className="text-xs text-slate-500">Authoritative attempt records and evaluation scorecards.</p>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {attempts.map((att) => (
                <div key={att.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900">{att.blueprint?.title}</h4>
                      <Badge variant={att.status === 'completed' ? (att.is_passed ? 'success' : 'danger') : 'warning'}>
                        {att.status === 'grading' ? 'Under Review' : att.is_passed ? 'Passed' : 'Not Passed'}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500">
                      Score: <span className="font-bold text-slate-800">{att.score_percentage}%</span> ({att.total_points_earned} / {att.total_points_possible} Pts) • {att.started_at?.slice(0, 10)}
                    </p>
                  </div>

                  {att.status === 'completed' && (
                    <Link href={`/examinations/review/${att.id}`}>
                      <Button size="sm" variant="outline" rightIcon={<ChevronRight className="h-3.5 w-3.5" />}>
                        View Scorecard & Review
                      </Button>
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {/* SCHEDULE MODAL */}
      <Modal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        title="Schedule New Examination"
        description="Add a date for an upcoming certification or examination."
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsScheduleModalOpen(false)}>
              Cancel
            </Button>
            <Button loading={savingSchedule} onClick={handleCreateSchedule}>
              Save Schedule
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateSchedule} className="space-y-4">
          <Input
            label="Examination Title"
            placeholder="e.g. AWS Certified Solutions Architect"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <Input
            label="Subject / Topic"
            placeholder="e.g. Cloud Architecture"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Examination Date"
              type="date"
              value={examinationDate}
              onChange={(e) => setExaminationDate(e.target.value)}
              required
            />
            <Input
              label="Start Time"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Duration (Minutes)"
              type="number"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
            />
            <Input
              label="Platform / Location"
              placeholder="e.g. Pearson VUE"
              value={locationPlatform}
              onChange={(e) => setLocationPlatform(e.target.value)}
            />
          </div>
        </form>
      </Modal>

      {/* BLUEPRINT MODAL */}
      <Modal
        isOpen={isBlueprintModalOpen}
        onClose={() => setIsBlueprintModalOpen(false)}
        title="Create Exam Blueprint"
        description="Configure duration, passing percentage, and question shuffling."
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsBlueprintModalOpen(false)}>
              Cancel
            </Button>
            <Button loading={savingBp} onClick={handleCreateBlueprint}>
              Save Blueprint
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateBlueprint} className="space-y-4">
          <Input
            label="Exam Title"
            placeholder="e.g. Distributed Systems Midterm"
            value={bpTitle}
            onChange={(e) => setBpTitle(e.target.value)}
            required
          />
          <Input
            label="Subject"
            placeholder="e.g. Computer Science"
            value={bpSubject}
            onChange={(e) => setBpSubject(e.target.value)}
            required
          />
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Associated Learning Subject (Optional)
            </label>
            <select
              value={bpCourseId || ''}
              onChange={(e) => setBpCourseId(e.target.value ? parseInt(e.target.value, 10) : undefined)}
              className="w-full h-10 rounded-xl border border-slate-200 px-3 text-xs focus:border-sky-500 focus:outline-hidden"
            >
              <option value="">None / Standalone Certification</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} {c.code ? `(${c.code})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Duration (Minutes)"
              type="number"
              value={bpDuration}
              onChange={(e) => setBpDuration(e.target.value)}
              required
            />
            <Input
              label="Passing Score (%)"
              type="number"
              value={bpPassingScore}
              onChange={(e) => setBpPassingScore(e.target.value)}
              required
            />
          </div>
        </form>
      </Modal>

      {/* QUESTION BANK MODAL */}
      <Modal
        isOpen={isBankModalOpen || !!isEditBankModalOpen}
        onClose={() => {
          setIsBankModalOpen(false);
          setIsEditBankModalOpen(null);
        }}
        title={isEditBankModalOpen ? 'Edit Question Bank' : 'Create Question Bank'}
        description="Organize questions by subject and curriculum."
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setIsBankModalOpen(false);
                setIsEditBankModalOpen(null);
              }}
            >
              Cancel
            </Button>
            <Button
              loading={savingBank}
              onClick={isEditBankModalOpen ? handleUpdateBank : handleCreateBank}
            >
              {isEditBankModalOpen ? 'Update Bank' : 'Save Bank'}
            </Button>
          </>
        }
      >
        <form onSubmit={isEditBankModalOpen ? handleUpdateBank : handleCreateBank} className="space-y-4">
          <Input
            label="Bank Title"
            placeholder="e.g. Distributed System Design Bank"
            value={bankTitle}
            onChange={(e) => setBankTitle(e.target.value)}
            required
          />
          <Input
            label="Subject"
            placeholder="e.g. Computer Science"
            value={bankSubject}
            onChange={(e) => setBankSubject(e.target.value)}
            required
          />
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Overview of questions in this bank..."
              value={bankDescription}
              onChange={(e) => setBankDescription(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-3 text-xs focus:border-sky-500 focus:outline-hidden"
            />
          </div>
        </form>
      </Modal>

      {/* ADD QUESTION MODAL (ALL 6 TYPES SUPPORTED) */}
      {isQuestionModalOpen && (
        <Modal
          isOpen={!!isQuestionModalOpen}
          onClose={() => setIsQuestionModalOpen(null)}
          title={`Add Question to "${isQuestionModalOpen.title}"`}
          description="Supports Single Choice, Multiple Choice, True/False, Short Answer, Essay, and Code Analysis."
          footer={
            <>
              <Button variant="secondary" onClick={() => setIsQuestionModalOpen(null)}>
                Cancel
              </Button>
              <Button loading={savingQuestion} onClick={handleAddQuestion}>
                Save Question
              </Button>
            </>
          }
        >
          <form onSubmit={handleAddQuestion} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Question Type
                </label>
                <select
                  value={qType}
                  onChange={(e) => setQType(e.target.value)}
                  className="w-full h-10 rounded-xl border border-slate-200 px-3 text-xs focus:border-sky-500 focus:outline-hidden"
                >
                  <option value="multiple_choice_single">Single Choice MCQ</option>
                  <option value="multiple_choice_multiple">Multiple Choice (Multiple Key)</option>
                  <option value="true_false">True / False</option>
                  <option value="short_answer">Short Answer</option>
                  <option value="essay">Essay (Instructor Evaluation)</option>
                  <option value="code_analysis">Code Analysis (Instructor Evaluation)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Points Possible
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={qPoints}
                  onChange={(e) => setQPoints(e.target.value)}
                  className="w-full h-10 rounded-xl border border-slate-200 px-3 text-xs focus:border-sky-500 focus:outline-hidden"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Question Prompt
              </label>
              <textarea
                rows={3}
                placeholder="What is the prompt for this question?"
                value={qPrompt}
                onChange={(e) => setQPrompt(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-3 text-xs focus:border-sky-500 focus:outline-hidden"
                required
              />
            </div>

            {/* Code Snippet for code analysis */}
            {qType === 'code_analysis' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Code Snippet to Analyze
                </label>
                <textarea
                  rows={4}
                  placeholder="Paste snippet (e.g., Python, TypeScript, SQL, etc.)..."
                  value={qCodeSnippet}
                  onChange={(e) => setQCodeSnippet(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 p-3 font-mono text-xs text-emerald-400 focus:border-sky-500 focus:outline-hidden"
                />
              </div>
            )}

            {/* Multiple Choice / Options Configuration */}
            {['multiple_choice_single', 'multiple_choice_multiple', 'true_false', 'short_answer'].includes(qType) && (
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Options (Mark the authoritative correct key)
                </label>
                {qOptions.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type={qType === 'multiple_choice_multiple' ? 'checkbox' : 'radio'}
                      name="correct_option"
                      checked={opt.is_correct}
                      onChange={(e) => {
                        if (qType === 'multiple_choice_multiple') {
                          const updated = [...qOptions];
                          updated[idx].is_correct = e.target.checked;
                          setQOptions(updated);
                        } else {
                          const updated = qOptions.map((o, i) => ({
                            ...o,
                            is_correct: i === idx,
                          }));
                          setQOptions(updated);
                        }
                      }}
                      className="h-4 w-4 text-sky-600 focus:ring-sky-500 cursor-pointer"
                    />
                    <Input
                      placeholder={`Option ${idx + 1}`}
                      value={opt.option_text}
                      onChange={(e) => {
                        const updated = [...qOptions];
                        updated[idx].option_text = e.target.value;
                        setQOptions(updated);
                      }}
                      required
                    />
                  </div>
                ))}
              </div>
            )}

            {['essay', 'code_analysis'].includes(qType) && (
              <div className="p-3 rounded-xl bg-purple-50 border border-purple-100 text-xs text-purple-900">
                <p className="font-semibold">Subjective Question</p>
                <p className="mt-0.5 text-purple-700 text-[11px]">
                  Students will provide a free-text response. This question will be automatically queued in the Instructor Grading Queue upon test submission.
                </p>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Explanation (Shown during post-exam review)
              </label>
              <textarea
                rows={2}
                placeholder="Authoritative explanation and scoring guide..."
                value={qExplanation}
                onChange={(e) => setQExplanation(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-3 text-xs focus:border-sky-500 focus:outline-hidden"
              />
            </div>
          </form>
        </Modal>
      )}

      {/* INSTRUCTOR MANUAL GRADING MODAL */}
      {activeGradingAttempt && (
        <Modal
          isOpen={!!activeGradingAttempt}
          onClose={() => setActiveGradingAttempt(null)}
          title={`Evaluating ${activeGradingAttempt.student?.name}'s Attempt`}
          description={`Exam: ${activeGradingAttempt.blueprint?.title} (Passing Score: ${activeGradingAttempt.blueprint?.passing_score}%)`}
          footer={
            <>
              <Button variant="secondary" onClick={() => setActiveGradingAttempt(null)}>
                Cancel
              </Button>
              <Button loading={submittingGrade} onClick={handleSubmitEvaluation}>
                Finalize & Save Grades
              </Button>
            </>
          }
        >
          <form onSubmit={handleSubmitEvaluation} className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">
            {(activeGradingAttempt.questions || []).map((q: any, idx: number) => {
              const currentGrade = gradesInput[q.question_id] || { awarded_points: 0, feedback: '' };

              return (
                <div key={q.question_id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="text-xs font-bold text-slate-800">
                      Question {idx + 1} ({q.type.replace('_', ' ').toUpperCase()})
                    </span>
                    <span className="text-xs font-bold text-sky-700">
                      Max Possible: {q.points_possible} Pts
                    </span>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-slate-900">{q.prompt}</p>
                    {q.code_snippet && (
                      <div className="mt-2 p-3 bg-slate-900 rounded-xl font-mono text-xs text-emerald-400 overflow-x-auto">
                        <pre>{q.code_snippet}</pre>
                      </div>
                    )}
                  </div>

                  {/* Student response */}
                  <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Student Submitted Response:
                    </span>
                    <p className="text-slate-800 leading-relaxed font-medium">
                      {q.text_response || 'No response submitted.'}
                    </p>
                  </div>

                  {/* Instructor evaluation inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        Awarded Points (0 - {q.points_possible})
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max={q.points_possible}
                        value={currentGrade.awarded_points}
                        onChange={(e) => {
                          const val = Math.min(q.points_possible, Math.max(0, parseFloat(e.target.value) || 0));
                          setGradesInput({
                            ...gradesInput,
                            [q.question_id]: {
                              ...currentGrade,
                              awarded_points: val,
                            },
                          });
                        }}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-sky-500 focus:outline-hidden"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        Evaluator Feedback
                      </label>
                      <input
                        type="text"
                        placeholder="Constructive feedback for student..."
                        value={currentGrade.feedback}
                        onChange={(e) => {
                          setGradesInput({
                            ...gradesInput,
                            [q.question_id]: {
                              ...currentGrade,
                              feedback: e.target.value,
                            },
                          });
                        }}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-sky-500 focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </form>
        </Modal>
      )}
    </div>
  );
}
