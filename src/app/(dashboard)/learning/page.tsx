'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Plus,
  Clock,
  CheckCircle2,
  PlayCircle,
  FileText,
  Trash2,
  ChevronRight,
  ChevronDown,
  Timer,
  Layers,
  BarChart3,
  ExternalLink,
  Award,
  Sparkles,
} from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Tabs } from '@/components/ui/Tabs';
import { PomodoroTimer } from '@/components/learning/PomodoroTimer';

interface Lesson {
  id: number;
  title: string;
  content?: string;
  resource_url?: string;
  duration_minutes: number;
  is_completed: boolean;
  order: number;
}

interface Module {
  id: number;
  title: string;
  order: number;
  lessons?: Lesson[];
}

interface Course {
  id: number;
  title: string;
  code?: string;
  description?: string;
  color?: string;
  progress: number;
  modules?: Module[];
}

interface LearningSession {
  id: number;
  topic: string;
  duration_minutes: number;
  session_date: string;
  notes?: string;
  course?: { title: string };
}

interface AnalyticsData {
  total_study_minutes: number;
  total_study_hours: number;
  total_sessions: number;
  consistency_days_30: number;
  courses_overview: Array<{
    id: number;
    title: string;
    code?: string;
    progress: number;
    modules_count: number;
    total_lessons: number;
    completed_lessons: number;
  }>;
  recent_exam_results: Array<{
    id: string;
    title: string;
    subject: string;
    score_percentage: number;
    is_passed: boolean;
    submitted_at?: string;
  }>;
}

export default function LearningPage() {
  const [activeTab, setActiveTab] = useState<'courses' | 'timer' | 'sessions' | 'analytics'>('courses');
  const [courses, setCourses] = useState<Course[]>([]);
  const [sessions, setSessions] = useState<LearningSession[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  // Expanded courses map
  const [expandedCourses, setExpandedCourses] = useState<Record<number, boolean>>({});

  // Modals
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [activeModuleCourseId, setActiveModuleCourseId] = useState<number | null>(null);
  const [activeLessonModuleId, setActiveLessonModuleId] = useState<number | null>(null);

  // Course Form
  const [courseTitle, setCourseTitle] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [courseDescription, setCourseDescription] = useState('');
  const [savingCourse, setSavingCourse] = useState(false);

  // Module Form
  const [moduleTitle, setModuleTitle] = useState('');
  const [savingModule, setSavingModule] = useState(false);

  // Lesson Form
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonContent, setLessonContent] = useState('');
  const [lessonResourceUrl, setLessonResourceUrl] = useState('');
  const [lessonDuration, setLessonDuration] = useState('20');
  const [savingLesson, setSavingLesson] = useState(false);

  // Session Form
  const [sessionTopic, setSessionTopic] = useState('');
  const [sessionDuration, setSessionDuration] = useState('30');
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);
  const [sessionNotes, setSessionNotes] = useState('');
  const [sessionCourseId, setSessionCourseId] = useState<number | undefined>();
  const [savingSession, setSavingSession] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [coursesRes, sessionsRes, analyticsRes] = await Promise.all([
        api.get('/courses'),
        api.get('/learning-sessions'),
        api.get('/learning-analytics'),
      ]);

      if (coursesRes.data?.success) {
        setCourses(coursesRes.data.data || []);
        if (coursesRes.data.data.length > 0 && Object.keys(expandedCourses).length === 0) {
          setExpandedCourses({ [coursesRes.data.data[0].id]: true });
        }
      }

      if (sessionsRes.data?.success) {
        setSessions(sessionsRes.data.data || []);
      }

      if (analyticsRes.data?.success) {
        setAnalytics(analyticsRes.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleLesson = async (lessonId: number) => {
    try {
      const res = await api.patch(`/lessons/${lessonId}/toggle`);
      if (res.data?.success) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseTitle.trim()) return;

    try {
      setSavingCourse(true);
      const res = await api.post('/courses', {
        title: courseTitle,
        code: courseCode,
        description: courseDescription,
      });

      if (res.data?.success) {
        setIsCourseModalOpen(false);
        setCourseTitle('');
        setCourseCode('');
        setCourseDescription('');
        fetchData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingCourse(false);
    }
  };

  const handleCreateModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moduleTitle.trim() || !activeModuleCourseId) return;

    try {
      setSavingModule(true);
      const res = await api.post(`/courses/${activeModuleCourseId}/modules`, {
        title: moduleTitle,
      });

      if (res.data?.success) {
        setActiveModuleCourseId(null);
        setModuleTitle('');
        fetchData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingModule(false);
    }
  };

  const handleDeleteModule = async (moduleId: number) => {
    if (!confirm('Are you sure you want to delete this module and its lessons?')) return;
    try {
      await api.delete(`/modules/${moduleId}`);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lessonTitle.trim() || !activeLessonModuleId) return;

    try {
      setSavingLesson(true);
      const res = await api.post(`/modules/${activeLessonModuleId}/lessons`, {
        title: lessonTitle,
        content: lessonContent,
        resource_url: lessonResourceUrl,
        duration_minutes: parseInt(lessonDuration) || 15,
      });

      if (res.data?.success) {
        setActiveLessonModuleId(null);
        setLessonTitle('');
        setLessonContent('');
        setLessonResourceUrl('');
        setLessonDuration('20');
        fetchData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingLesson(false);
    }
  };

  const handleDeleteLesson = async (lessonId: number) => {
    if (!confirm('Delete this lesson?')) return;
    try {
      await api.delete(`/lessons/${lessonId}`);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionTopic.trim()) return;

    try {
      setSavingSession(true);
      const res = await api.post('/learning-sessions', {
        topic: sessionTopic,
        duration_minutes: parseInt(sessionDuration) || 30,
        session_date: sessionDate,
        notes: sessionNotes,
        course_id: sessionCourseId || null,
      });

      if (res.data?.success) {
        setIsSessionModalOpen(false);
        setSessionTopic('');
        setSessionDuration('30');
        setSessionNotes('');
        setSessionCourseId(undefined);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingSession(false);
    }
  };

  const tabs = [
    { id: 'courses', label: 'Subjects & Curriculum', icon: <BookOpen className="h-4 w-4" /> },
    { id: 'timer', label: 'Pomodoro Focus Timer', icon: <Clock className="h-4 w-4" /> },
    { id: 'sessions', label: 'Study Sessions History', icon: <Timer className="h-4 w-4" /> },
    { id: 'analytics', label: 'Learning & Exam Analytics', icon: <BarChart3 className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 text-[10px] font-bold uppercase tracking-wider">
              Learning Management System
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Learning Management</h2>
          <p className="mt-1 text-xs text-slate-500">
            Structure your course curriculum, track lesson completion, and log deep study sessions.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setIsSessionModalOpen(true)}
            leftIcon={<Timer className="h-4 w-4" />}
          >
            Log Session
          </Button>
          <Button
            size="sm"
            onClick={() => setIsCourseModalOpen(true)}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            New Subject
          </Button>
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
      ) : activeTab === 'courses' ? (
        /* COURSES TAB */
        courses.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No subjects or courses created"
            description="Create your first learning subject to organize modules, materials, and lessons."
            actionLabel="Create Subject"
            onAction={() => setIsCourseModalOpen(true)}
          />
        ) : (
          <div className="space-y-4">
            {courses.map((course) => {
              const isExpanded = !!expandedCourses[course.id];
              const modules = course.modules || [];
              const totalLessons = modules.reduce(
                (acc, m) => acc + (m.lessons?.length || 0),
                0
              );
              const completedLessons = modules.reduce(
                (acc, m) => acc + (m.lessons?.filter((l) => l.is_completed).length || 0),
                0
              );

              return (
                <div
                  key={course.id}
                  className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4"
                >
                  {/* Course Header */}
                  <div
                    onClick={() =>
                      setExpandedCourses((prev) => ({
                        ...prev,
                        [course.id]: !prev[course.id],
                      }))
                    }
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 font-bold text-xs">
                        {course.code || 'CS'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-slate-900">{course.title}</h3>
                          {course.code && (
                            <Badge variant="outline" size="sm">
                              {course.code}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {modules.length} Modules • {completedLessons}/{totalLessons} Lessons Completed
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Progress bar */}
                      <div className="w-32 hidden sm:block">
                        <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
                          <span>Progress</span>
                          <span className="text-sky-600">{course.progress}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-sky-500 rounded-full transition-all"
                            style={{ width: `${course.progress}%` }}
                          />
                        </div>
                      </div>

                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-slate-400" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Accordion Content: Modules and Lessons */}
                  {isExpanded && (
                    <div className="pt-3 border-t border-slate-100 space-y-3">
                      <div className="flex items-center justify-between pb-1">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Course Modules & Lessons
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveModuleCourseId(course.id);
                          }}
                          leftIcon={<Plus className="h-3.5 w-3.5" />}
                        >
                          Add Module
                        </Button>
                      </div>

                      {modules.length > 0 ? (
                        modules.map((module) => (
                          <div
                            key={module.id}
                            className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                <Layers className="h-3.5 w-3.5 text-sky-600" />
                                {module.title}
                              </span>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setActiveLessonModuleId(module.id)}
                                  leftIcon={<Plus className="h-3 w-3" />}
                                >
                                  Add Lesson
                                </Button>
                                <button
                                  onClick={() => handleDeleteModule(module.id)}
                                  className="text-slate-400 hover:text-rose-600 p-1"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Lessons List */}
                            <div className="space-y-1.5 pl-2">
                              {module.lessons && module.lessons.length > 0 ? (
                                module.lessons.map((lesson) => (
                                  <div
                                    key={lesson.id}
                                    className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-100 hover:bg-slate-50/80 transition text-xs"
                                  >
                                    <div className="flex items-center gap-2.5">
                                      <input
                                        type="checkbox"
                                        checked={lesson.is_completed}
                                        onChange={() => handleToggleLesson(lesson.id)}
                                        className="h-4 w-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                                      />
                                      <span
                                        className={`font-medium ${
                                          lesson.is_completed
                                            ? 'line-through text-slate-400'
                                            : 'text-slate-800'
                                        }`}
                                      >
                                        {lesson.title}
                                      </span>
                                      {lesson.resource_url && (
                                        <a
                                          href={lesson.resource_url}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="text-sky-600 hover:text-sky-700 flex items-center gap-1 text-[11px]"
                                        >
                                          <ExternalLink className="h-3 w-3" />
                                          Resource
                                        </a>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {lesson.duration_minutes}m
                                      </span>
                                      <button
                                        onClick={() => handleDeleteLesson(lesson.id)}
                                        className="text-slate-300 hover:text-rose-500 p-0.5"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <p className="text-[11px] text-slate-400 italic">No lessons in this module.</p>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-400 italic">No modules added to this course yet.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : activeTab === 'timer' ? (
        /* POMODORO TIMER TAB */
        <PomodoroTimer courses={courses} onSessionSaved={fetchData} />
      ) : activeTab === 'sessions' ? (
        /* STUDY SESSIONS HISTORY TAB */
        sessions.length === 0 ? (
          <EmptyState
            icon={Timer}
            title="No study sessions logged"
            description="Log your daily learning activities to track study duration over time."
            actionLabel="Log First Session"
            onAction={() => setIsSessionModalOpen(true)}
          />
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Study Topic</th>
                  <th className="px-4 py-3.5">Subject</th>
                  <th className="px-4 py-3.5">Duration</th>
                  <th className="px-4 py-3.5">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sessions.map((session) => (
                  <tr key={session.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-6 py-4 font-bold text-slate-900">{session.topic}</td>
                    <td className="px-4 py-4 text-slate-600">{session.course?.title || '-'}</td>
                    <td className="px-4 py-4 font-semibold text-sky-700">
                      {session.duration_minutes} Minutes
                    </td>
                    <td className="px-4 py-4 text-slate-500">
                      {new Date(session.session_date).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        /* ANALYTICS & PERFORMANCE TAB (Part C Integration) */
        <div className="space-y-6">
          {/* Metrics Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Study Time</p>
                <h4 className="text-xl font-bold text-slate-900 mt-0.5">
                  {analytics?.total_study_hours || 0} Hours
                </h4>
                <p className="text-[11px] text-slate-500">{analytics?.total_study_minutes || 0} minutes logged</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                <BookOpen className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sessions Completed</p>
                <h4 className="text-xl font-bold text-slate-900 mt-0.5">
                  {analytics?.total_sessions || 0} Deep Sessions
                </h4>
                <p className="text-[11px] text-slate-500">Tracked independently</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">30-Day Consistency</p>
                <h4 className="text-xl font-bold text-slate-900 mt-0.5">
                  {analytics?.consistency_days_30 || 0} Active Days
                </h4>
                <p className="text-[11px] text-slate-500">Days with study activity</p>
              </div>
            </div>
          </div>

          {/* Subjects Progress Matrix */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Subject Progress Rollup</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {analytics?.courses_overview.map((c) => (
                <div key={c.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{c.title}</h4>
                      <p className="text-[11px] text-slate-500">
                        {c.modules_count} Modules • {c.completed_lessons}/{c.total_lessons} Lessons
                      </p>
                    </div>
                    <Badge variant={c.progress === 100 ? 'success' : 'default'} size="sm">
                      {c.progress}%
                    </Badge>
                  </div>
                  <div className="h-2 w-full bg-slate-200/70 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sky-500 rounded-full transition-all"
                      style={{ width: `${c.progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Associated Examination Performance */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Associated Examination Results
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Exam performance for subjects linked to your learning roadmap.
                </p>
              </div>
              <Link href="/examinations">
                <Button variant="ghost" size="sm">
                  View All Exams
                </Button>
              </Link>
            </div>

            {analytics?.recent_exam_results && analytics.recent_exam_results.length > 0 ? (
              <div className="overflow-hidden rounded-xl border border-slate-100">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Examination</th>
                      <th className="px-4 py-3">Subject</th>
                      <th className="px-4 py-3">Score</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {analytics.recent_exam_results.map((exam) => (
                      <tr key={exam.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3.5 font-bold text-slate-900">{exam.title}</td>
                        <td className="px-4 py-3.5 text-slate-600">{exam.subject}</td>
                        <td className="px-4 py-3.5 font-bold text-slate-900">{exam.score_percentage}%</td>
                        <td className="px-4 py-3.5">
                          <Badge variant={exam.is_passed ? 'success' : 'danger'} size="sm">
                            {exam.is_passed ? 'Passed' : 'Failed'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <Link href={`/examinations/review/${exam.id}`}>
                            <Button size="sm" variant="outline">
                              Review
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic py-3">No examination results recorded yet.</p>
            )}
          </div>
        </div>
      )}

      {/* CREATE COURSE MODAL */}
      <Modal
        isOpen={isCourseModalOpen}
        onClose={() => setIsCourseModalOpen(false)}
        title="Create New Subject"
        description="Add an academic subject or training course to your learning hub."
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsCourseModalOpen(false)}>
              Cancel
            </Button>
            <Button loading={savingCourse} onClick={handleCreateCourse}>
              Save Subject
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateCourse} className="space-y-4">
          <Input
            label="Subject Title"
            placeholder="e.g. Distributed Systems Architecture"
            value={courseTitle}
            onChange={(e) => setCourseTitle(e.target.value)}
            required
          />

          <Input
            label="Course Code / Subject Code"
            placeholder="e.g. CS-501"
            value={courseCode}
            onChange={(e) => setCourseCode(e.target.value)}
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Description
            </label>
            <textarea
              rows={3}
              placeholder="Syllabus overview or learning objectives..."
              value={courseDescription}
              onChange={(e) => setCourseDescription(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-sky-500 focus:outline-none"
            />
          </div>
        </form>
      </Modal>

      {/* CREATE MODULE MODAL */}
      <Modal
        isOpen={!!activeModuleCourseId}
        onClose={() => setActiveModuleCourseId(null)}
        title="Add Course Module"
        description="Add a structured learning unit or chapter to this subject."
        footer={
          <>
            <Button variant="secondary" onClick={() => setActiveModuleCourseId(null)}>
              Cancel
            </Button>
            <Button loading={savingModule} onClick={handleCreateModule}>
              Add Module
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateModule} className="space-y-4">
          <Input
            label="Module Title"
            placeholder="e.g. Concurrency & Mutexes"
            value={moduleTitle}
            onChange={(e) => setModuleTitle(e.target.value)}
            required
          />
        </form>
      </Modal>

      {/* CREATE LESSON MODAL */}
      <Modal
        isOpen={!!activeLessonModuleId}
        onClose={() => setActiveLessonModuleId(null)}
        title="Add Learning Lesson / Material"
        description="Create a lesson with estimated study time and resource reference."
        footer={
          <>
            <Button variant="secondary" onClick={() => setActiveLessonModuleId(null)}>
              Cancel
            </Button>
            <Button loading={savingLesson} onClick={handleCreateLesson}>
              Save Lesson
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateLesson} className="space-y-4">
          <Input
            label="Lesson Title"
            placeholder="e.g. Peterson Algorithm Analysis"
            value={lessonTitle}
            onChange={(e) => setLessonTitle(e.target.value)}
            required
          />

          <Input
            label="Resource Reference URL (Optional)"
            placeholder="https://mit.edu/notes/mutex.pdf"
            value={lessonResourceUrl}
            onChange={(e) => setLessonResourceUrl(e.target.value)}
          />

          <Input
            label="Estimated Duration (Minutes)"
            type="number"
            min={5}
            value={lessonDuration}
            onChange={(e) => setLessonDuration(e.target.value)}
            required
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Content / Summary
            </label>
            <textarea
              rows={3}
              placeholder="Key concepts or reading instructions..."
              value={lessonContent}
              onChange={(e) => setLessonContent(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-sky-500 focus:outline-none"
            />
          </div>
        </form>
      </Modal>

      {/* LOG STUDY SESSION MODAL */}
      <Modal
        isOpen={isSessionModalOpen}
        onClose={() => setIsSessionModalOpen(false)}
        title="Log Study Session"
        description="Record your study time and topic."
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsSessionModalOpen(false)}>
              Cancel
            </Button>
            <Button loading={savingSession} onClick={handleCreateSession}>
              Log Session
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateSession} className="space-y-4">
          <Input
            label="Topic Studied"
            placeholder="e.g. Raft Consensus Leader Election"
            value={sessionTopic}
            onChange={(e) => setSessionTopic(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Duration (Minutes)"
              type="number"
              min={5}
              value={sessionDuration}
              onChange={(e) => setSessionDuration(e.target.value)}
              required
            />
            <Input
              label="Session Date"
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Related Subject (Optional)
            </label>
            <select
              value={sessionCourseId || ''}
              onChange={(e) => setSessionCourseId(e.target.value ? parseInt(e.target.value) : undefined)}
              className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm focus:border-sky-500 focus:outline-none"
            >
              <option value="">None / General</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
        </form>
      </Modal>
    </div>
  );
}
