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
} from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Tabs } from '@/components/ui/Tabs';

export default function ExaminationsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'schedules' | 'blueprints' | 'banks' | 'history'>('schedules');
  const [loading, setLoading] = useState(true);

  // Data states
  const [examinations, setExaminations] = useState<any[]>([]);
  const [blueprints, setBlueprints] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);

  // Modals
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isBlueprintModalOpen, setIsBlueprintModalOpen] = useState(false);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState<any | null>(null);

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
  const [savingBank, setSavingBank] = useState(false);

  // Question Form
  const [qType, setQType] = useState('multiple_choice_single');
  const [qPrompt, setQPrompt] = useState('');
  const [qExplanation, setQExplanation] = useState('');
  const [qPoints, setQPoints] = useState('5');
  const [qOptions, setQOptions] = useState([
    { option_text: '', is_correct: true },
    { option_text: '', is_correct: false },
    { option_text: '', is_correct: false },
  ]);
  const [savingQuestion, setSavingQuestion] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [examRes, bpRes, bankRes, attemptsRes, coursesRes] = await Promise.all([
        api.get('/examinations'),
        api.get('/exam-blueprints'),
        api.get('/question-banks'),
        api.get('/exam-attempts'),
        api.get('/courses'),
      ]);

      if (examRes.data?.success) setExaminations(examRes.data.data || []);
      if (bpRes.data?.success) setBlueprints(bpRes.data.data || []);
      if (bankRes.data?.success) setBanks(bankRes.data.data || []);
      if (attemptsRes.data?.success) setAttempts(attemptsRes.data.data || []);
      if (coursesRes.data?.success) setCourses(coursesRes.data.data || []);
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
    } catch (err: any) {
      alert(err.response?.data?.message || 'Could not start examination attempt.');
    }
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !subject.trim() || !examinationDate) return;

    try {
      setSavingSchedule(true);
      const res = await api.post('/examinations', {
        title,
        subject,
        examination_date: examinationDate,
        start_time: startTime,
        duration_minutes: parseInt(durationMinutes) || 60,
        location_platform: locationPlatform,
      });

      if (res.data?.success) {
        setIsScheduleModalOpen(false);
        setTitle('');
        setSubject('');
        setExaminationDate('');
        fetchData();
      }
    } catch (err) {
      console.error(err);
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
        duration_minutes: parseInt(bpDuration) || 60,
        passing_score: parseFloat(bpPassingScore) || 70,
        shuffle_questions: true,
        shuffle_options: true,
      });

      if (res.data?.success) {
        setIsBlueprintModalOpen(false);
        setBpTitle('');
        setBpSubject('');
        setBpCourseId(undefined);
        fetchData();
      }
    } catch (err) {
      console.error(err);
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
      });

      if (res.data?.success) {
        setIsBankModalOpen(false);
        setBankTitle('');
        setBankSubject('');
        fetchData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingBank(false);
    }
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isQuestionModalOpen || !qPrompt.trim()) return;

    try {
      setSavingQuestion(true);
      const res = await api.post(`/question-banks/${isQuestionModalOpen.id}/questions`, {
        type: qType,
        prompt: qPrompt,
        explanation: qExplanation,
        points: parseFloat(qPoints) || 5,
        options: qOptions.filter((o) => o.option_text.trim().length > 0),
      });

      if (res.data?.success) {
        setIsQuestionModalOpen(null);
        setQPrompt('');
        setQExplanation('');
        fetchData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingQuestion(false);
    }
  };

  const handleTogglePrep = async (prepId: number) => {
    try {
      await api.patch(`/examinations/preparations/${prepId}/toggle`);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const tabs = [
    { id: 'schedules', label: 'Scheduled Examinations', icon: <Calendar className="h-4 w-4" /> },
    { id: 'blueprints', label: 'Assessment Engine & Tests', icon: <Play className="h-4 w-4" /> },
    { id: 'banks', label: 'Question Banks & Questions', icon: <Layers className="h-4 w-4" /> },
    { id: 'history', label: 'Past Attempts & Scorecards', icon: <History className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 text-[10px] font-bold uppercase tracking-wider">
              Dedicated Examination Subsystem
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Examination System</h2>
          <p className="mt-1 text-xs text-slate-500">
            Schedule external exams, author question banks, and launch auto-graded tests with proctoring integrity.
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
              onClick={() => setIsBankModalOpen(true)}
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
        /* SCHEDULED EXAMINATIONS TAB */
        examinations.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="No scheduled exams"
            description="Add your upcoming certifications, midterms, or standardized tests."
            actionLabel="Schedule Exam"
            onAction={() => setIsScheduleModalOpen(true)}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {examinations.map((exam) => (
              <div
                key={exam.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600">
                      {exam.subject}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 leading-tight">
                      {exam.title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 font-medium">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      {new Date(exam.examination_date).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}{' '}
                      • {exam.start_time || '09:00'} WIB
                    </p>
                  </div>
                  <Badge variant="completed">Upcoming</Badge>
                </div>

                <div className="rounded-xl bg-slate-50 p-3 border border-slate-100 text-xs text-slate-600 space-y-1">
                  <p>
                    <span className="font-semibold text-slate-800">Platform:</span>{' '}
                    {exam.location_platform || 'Online'}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-800">Duration:</span>{' '}
                    {exam.duration_minutes || 60} Minutes
                  </p>
                  <p>
                    <span className="font-semibold text-slate-800">Passing Score:</span>{' '}
                    {exam.passing_score || 70}%
                  </p>
                </div>

                {/* Preparations Checklist */}
                {exam.preparations && exam.preparations.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Study Checklist
                    </p>
                    {exam.preparations.map((prep: any) => (
                      <label
                        key={prep.id}
                        className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-50/70 text-xs text-slate-700 cursor-pointer hover:bg-slate-100 transition"
                      >
                        <input
                          type="checkbox"
                          checked={prep.is_completed}
                          onChange={() => handleTogglePrep(prep.id)}
                          className="h-3.5 w-3.5 rounded text-purple-600 focus:ring-purple-500"
                        />
                        <span className={prep.is_completed ? 'line-through text-slate-400' : ''}>
                          {prep.title}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      ) : activeTab === 'blueprints' ? (
        /* ASSESSMENT ENGINE BLUEPRINTS TAB */
        blueprints.length === 0 ? (
          <EmptyState
            icon={Play}
            title="No exam blueprints"
            description="Create an exam blueprint to configure questions, server timers, and auto-grading."
            actionLabel="Create Blueprint"
            onAction={() => setIsBlueprintModalOpen(true)}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {blueprints.map((bp) => (
              <div
                key={bp.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600">
                      {bp.subject}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                      <ShieldCheck className="h-3 w-3" /> Proctoring Active
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
            description="Create a question bank to organize your question repository."
            actionLabel="Create Bank"
            onAction={() => setIsBankModalOpen(true)}
          />
        ) : (
          <div className="space-y-4">
            {banks.map((bank) => (
              <div
                key={bank.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {bank.subject}
                    </span>
                    <h3 className="text-base font-bold text-slate-900">{bank.title}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {bank.questions_count || bank.questions?.length || 0} Questions Authoring
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setIsQuestionModalOpen(bank)}
                    leftIcon={<Plus className="h-3.5 w-3.5" />}
                  >
                    Add Question
                  </Button>
                </div>
              </div>
            ))}
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
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Examination History</h3>
                <p className="text-xs text-slate-500">Immutable attempt logs and evaluation scorecards.</p>
              </div>
              <Badge variant="outline" size="sm">{attempts.length} Total Attempts</Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Examination</th>
                    <th className="px-4 py-3">Subject</th>
                    <th className="px-4 py-3">Points</th>
                    <th className="px-4 py-3">Score</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attempts.map((att) => (
                    <tr key={att.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-5 py-4 font-bold text-slate-900">
                        {att.blueprint?.title || 'Examination Assessment'}
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {att.blueprint?.subject || 'General'}
                      </td>
                      <td className="px-4 py-4 text-slate-600 font-medium">
                        {att.total_points_earned} / {att.total_points_possible} pts
                      </td>
                      <td className="px-4 py-4 font-bold text-slate-900">
                        {att.score_percentage}%
                      </td>
                      <td className="px-4 py-4">
                        {att.status === 'completed' ? (
                          <Badge variant={att.is_passed ? 'success' : 'danger'} size="sm">
                            {att.is_passed ? 'Passed' : 'Failed'}
                          </Badge>
                        ) : att.status === 'in_progress' ? (
                          <Badge variant="warning" size="sm">In Progress</Badge>
                        ) : (
                          <Badge variant="default" size="sm">{att.status}</Badge>
                        )}
                      </td>
                      <td className="px-4 py-4 text-slate-500">
                        {new Date(att.started_at).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {att.status === 'in_progress' ? (
                          <Link href={`/examinations/take/${att.id}`}>
                            <Button size="sm">Resume Exam</Button>
                          </Link>
                        ) : (
                          <Link href={`/examinations/review/${att.id}`}>
                            <Button size="sm" variant="outline">View Scorecard</Button>
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* SCHEDULE MODAL */}
      <Modal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        title="Schedule Examination"
        description="Add an external certification or exam schedule."
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
            placeholder="e.g. AWS Solutions Architect Professional"
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
              onChange={(e) => setBpCourseId(e.target.value ? parseInt(e.target.value) : undefined)}
              className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm focus:border-sky-500 focus:outline-none"
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
        isOpen={isBankModalOpen}
        onClose={() => setIsBankModalOpen(false)}
        title="Create Question Bank"
        description="Organize questions by subject and curriculum."
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsBankModalOpen(false)}>
              Cancel
            </Button>
            <Button loading={savingBank} onClick={handleCreateBank}>
              Save Bank
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateBank} className="space-y-4">
          <Input
            label="Bank Title"
            placeholder="e.g. System Design Questions"
            value={bankTitle}
            onChange={(e) => setBankTitle(e.target.value)}
            required
          />
          <Input
            label="Subject"
            placeholder="e.g. Architecture"
            value={bankSubject}
            onChange={(e) => setBankSubject(e.target.value)}
            required
          />
        </form>
      </Modal>

      {/* ADD QUESTION MODAL */}
      {isQuestionModalOpen && (
        <Modal
          isOpen={!!isQuestionModalOpen}
          onClose={() => setIsQuestionModalOpen(null)}
          title={`Add Question to "${isQuestionModalOpen.title}"`}
          description="Author multiple-choice or short-answer questions with authoritative key."
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
          <form onSubmit={handleAddQuestion} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Question Type
              </label>
              <select
                value={qType}
                onChange={(e) => setQType(e.target.value)}
                className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm focus:border-sky-500 focus:outline-none"
              >
                <option value="multiple_choice_single">Multiple Choice (Single Answer)</option>
                <option value="true_false">True / False</option>
                <option value="short_answer">Short Answer</option>
              </select>
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
                className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-sky-500 focus:outline-none"
                required
              />
            </div>

            {/* Options */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Options (Mark the correct answer)
              </label>
              {qOptions.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correct_option"
                    checked={opt.is_correct}
                    onChange={() => {
                      const updated = qOptions.map((o, i) => ({
                        ...o,
                        is_correct: i === idx,
                      }));
                      setQOptions(updated);
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

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Explanation (Shown during post-exam review)
              </label>
              <textarea
                rows={2}
                placeholder="Why is this answer correct?"
                value={qExplanation}
                onChange={(e) => setQExplanation(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
