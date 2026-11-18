'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  BarChart3,
  CheckCircle2,
  Clock,
  Flame,
  FolderKanban,
  GraduationCap,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  Calendar,
  Layers,
  Award,
  BookOpen,
  Download,
  Lightbulb,
  AlertTriangle,
  Info,
  Check,
} from 'lucide-react';
import api, { extractApiErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { AnimatedNumber, StaggerContainer, StaggerItem, FadeIn } from '@/components/animations';
import { EmptyState } from '@/components/ui/EmptyState';

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [learningData, setLearningData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Date Range State
  const [range, setRange] = useState<'today' | 'this_week' | 'this_month' | 'last_30_days' | 'custom'>('this_month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Export State
  const [exporting, setExporting] = useState(false);
  const [exportType, setExportType] = useState<'productivity' | 'tasks' | 'projects' | 'learning' | 'exams'>('productivity');

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = { range };
      if (range === 'custom' && startDate && endDate) {
        params.start_date = startDate;
        params.end_date = endDate;
      }

      const [prodRes, learnRes] = await Promise.all([
        api.get('/analytics/productivity', { params }),
        api.get('/analytics/learning', { params }),
      ]);

      if (prodRes.data?.success) {
        setData(prodRes.data.data);
      }
      if (learnRes.data?.success) {
        setLearningData(learnRes.data.data);
      }
    } catch (err: unknown) {
      setError(extractApiErrorMessage(err, 'Failed to load productivity analytics.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [range]);

  const handleExport = async (type: string) => {
    try {
      setExporting(true);
      const params: any = { type, range };
      if (range === 'custom' && startDate && endDate) {
        params.start_date = startDate;
        params.end_date = endDate;
      }

      const response = await api.get('/analytics/export', {
        params,
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `tuntas-${type}-report-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Gagal mengekspor laporan. Silakan coba beberapa saat lagi.');
    } finally {
      setExporting(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-900 border-t-transparent" />
          <p className="text-xs font-semibold text-slate-500">Menghitung telemetri analitik terverifikasi...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900">Analitik Tidak Tersedia</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">{error || 'Gagal memuat kalkulasi data.'}</p>
        <Button onClick={fetchAnalytics} leftIcon={<RefreshCw className="h-3.5 w-3.5" />}>
          Coba Lagi
        </Button>
      </div>
    );
  }

  const tasks = data.tasks || {};
  const projects = data.projects || {};
  const habits = data.habits || {};
  const learning = data.learning || {};
  const exams = data.examinations || {};
  const insights = data.insights || [];
  const examAnalytics = learningData?.examination_analytics || {};

  const priorityColors: Record<string, string> = {
    urgent: 'bg-rose-500',
    high: 'bg-amber-500',
    medium: 'bg-sky-500',
    low: 'bg-slate-400',
  };

  const statusColors: Record<string, string> = {
    todo: 'bg-slate-300',
    in_progress: 'bg-sky-500',
    in_review: 'bg-amber-500',
    completed: 'bg-emerald-500',
  };

  return (
    <div className="space-y-8">
      {/* Page Header with Date Filter and Export Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Cross-Domain Analytics</h1>
          <p className="mt-1 text-xs text-slate-500">
            Telemetri data aktual dan transparan meliputi Tasks, Projects, Habits, LMS, dan Asesmen Ujian.
          </p>
        </div>

        {/* Filter & Export Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Range Selector */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {(['today', 'this_week', 'this_month', 'last_30_days', 'custom'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  range === r
                    ? 'bg-slate-900 text-white font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {r === 'today'
                  ? 'Hari Ini'
                  : r === 'this_week'
                  ? 'Minggu Ini'
                  : r === 'this_month'
                  ? 'Bulan Ini'
                  : r === 'last_30_days'
                  ? '30 Hari'
                  : 'Kustom'}
              </button>
            ))}
          </div>

          {/* Export CSV Button */}
          <div className="flex items-center gap-1.5">
            <select
              value={exportType}
              onChange={(e) => setExportType(e.target.value as any)}
              className="h-9 px-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700"
            >
              <option value="productivity">Ekspor Produktivitas</option>
              <option value="tasks">Ekspor Task</option>
              <option value="projects">Ekspor Proyek</option>
              <option value="learning">Ekspor Belajar</option>
              <option value="exams">Ekspor Ujian</option>
            </select>
            <Button
              variant="outline"
              size="sm"
              loading={exporting}
              onClick={() => handleExport(exportType)}
              leftIcon={<Download className="h-3.5 w-3.5" />}
            >
              CSV
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchAnalytics}
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Custom Date Inputs if 'custom' is active */}
      {range === 'custom' && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center gap-4 text-xs font-semibold"
        >
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Dari:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Sampai:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white"
            />
          </div>
          <Button size="sm" onClick={fetchAnalytics}>
            Terapkan Filter
          </Button>
        </motion.div>
      )}

      {/* Transparent Deterministic Rule-Based Insights Banner */}
      {insights.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            <span>Insight & Rekomendasi Terukur (Rule-Based)</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {insights.map((ins: any) => (
              <div
                key={ins.id}
                className={`p-4 rounded-2xl border text-xs flex items-start gap-3 transition ${
                  ins.type === 'warning'
                    ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                    : ins.type === 'success'
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                    : 'bg-sky-50/70 border-sky-200 text-sky-950'
                }`}
              >
                <div className="shrink-0 mt-0.5">
                  {ins.type === 'warning' ? (
                    <AlertTriangle className="h-4 w-4 text-rose-600" />
                  ) : ins.type === 'success' ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Info className="h-4 w-4 text-sky-600" />
                  )}
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold">{ins.title}</h4>
                  <p className="leading-relaxed opacity-90">{ins.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top 5 High-Level KPI Cards */}
      <StaggerContainer className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Total Tasks */}
        <StaggerItem className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Total Task</span>
            <CheckCircle2 className="h-4 w-4 text-sky-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            <AnimatedNumber value={tasks.total || 0} />
          </div>
          <p className="text-[11px] text-slate-400">
            {tasks.completed || 0} tuntas ({tasks.completion_rate || 0}%)
          </p>
        </StaggerItem>

        {/* Active Projects */}
        <StaggerItem className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Proyek Aktif</span>
            <FolderKanban className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            <AnimatedNumber value={projects.active || 0} />
          </div>
          <p className="text-[11px] text-slate-400">
            Rata-rata {projects.avg_progress || 0}% progres
          </p>
        </StaggerItem>

        {/* Habit Consistency */}
        <StaggerItem className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Konsistensi Kebiasaan</span>
            <Flame className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            <AnimatedNumber value={habits.completion_rate_30_days || 0} suffix="%" />
          </div>
          <p className="text-[11px] text-slate-400">
            {habits.active_streaks || 0} streak aktif
          </p>
        </StaggerItem>

        {/* Focus Study Duration */}
        <StaggerItem className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Waktu Belajar</span>
            <BookOpen className="h-4 w-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            <AnimatedNumber value={learning.total_hours || 0} suffix="h" />
          </div>
          <p className="text-[11px] text-slate-400">
            {learning.total_sessions || 0} sesi belajar
          </p>
        </StaggerItem>

        {/* Exam Average Score */}
        <StaggerItem className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Rata-rata Ujian</span>
            <Award className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            <AnimatedNumber value={exams.avg_score || 0} suffix="%" />
          </div>
          <p className="text-[11px] text-slate-400">
            {exams.pass_rate || 0}% pass rate ({exams.total_attempts || 0} attempt)
          </p>
        </StaggerItem>
      </StaggerContainer>

      {/* Main Grid: Task Breakdown & Weekly Velocity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Task Priority & Status Breakdown */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Distribusi Status & Prioritas Task
            </h3>
            {tasks.overdue > 0 && (
              <span className="flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md">
                <AlertCircle className="h-3 w-3" /> {tasks.overdue} Terlambat
              </span>
            )}
          </div>

          {/* Status Progress Bars */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-slate-600">Distribusi Berdasarkan Status</p>
            {['todo', 'in_progress', 'in_review', 'completed'].map((st) => {
              const count = tasks.by_status?.[st] || 0;
              const pct = tasks.total > 0 ? Math.round((count / tasks.total) * 100) : 0;
              return (
                <div key={st} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-700 capitalize">
                      {st.replace('_', ' ')}
                    </span>
                    <span className="font-bold text-slate-900">
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6 }}
                      className={`h-full ${statusColors[st]}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Priority Distribution */}
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <p className="text-xs font-bold text-slate-600">Distribusi Berdasarkan Prioritas</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {['urgent', 'high', 'medium', 'low'].map((p) => {
                const count = tasks.by_priority?.[p] || 0;
                return (
                  <div key={p} className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-center">
                    <span className="text-[10px] font-bold uppercase text-slate-400">{p}</span>
                    <p className="text-base font-black text-slate-900 mt-0.5">{count}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Weekly Trend Velocity */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Kecepatan Penyelesaian (7 Hari Terakhir)
              </h3>
              <span className="text-xs font-semibold text-slate-400">Tren Task Tuntas</span>
            </div>

            {/* Weekly Bars Chart */}
            <div className="pt-6 flex items-end justify-between gap-2 h-48">
              {(tasks.weekly_trend || []).map((day: any) => {
                const maxVal = Math.max(1, ...(tasks.weekly_trend || []).map((d: any) => d.count || 0));
                const heightPct = Math.round(((day.count || 0) / maxVal) * 100);

                return (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                    <span className="text-[10px] font-bold text-slate-700">{day.count}</span>
                    <div className="w-full max-w-8 bg-slate-100 rounded-t-lg h-36 flex items-end overflow-hidden">
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${heightPct}%` }}
                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                        className="w-full bg-slate-900 rounded-t-lg"
                      />
                    </div>
                    <span className="text-[10px] font-semibold text-slate-400 truncate max-w-full">
                      {day.day || day.date.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-between text-xs text-slate-900">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-slate-700" />
              <span className="font-semibold">Kalkulasi Database Terverifikasi</span>
            </div>
            <span className="text-[11px] text-slate-600 font-bold">100% Data Aktual</span>
          </div>
        </div>
      </div>

      {/* Domain Multi-Matrix Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Project Matrix */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <FolderKanban className="h-4 w-4 text-indigo-600" />
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Portofolio Proyek</h4>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">Total Proyek</span>
              <span className="font-bold text-slate-900">{projects.total || 0}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">Proyek Aktif</span>
              <span className="font-bold text-indigo-600">{projects.active || 0}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">Proyek Tuntas</span>
              <span className="font-bold text-emerald-600">{projects.completed || 0}</span>
            </div>
            <div className="space-y-1 pt-2">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-600">Rata-rata Progres Portofolio</span>
                <span className="text-slate-900">{projects.avg_progress || 0}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${projects.avg_progress || 0}%` }}
                  className="h-full bg-indigo-600"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Habits Consistency Matrix */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Flame className="h-4 w-4 text-amber-500" />
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Formasi Kebiasaan</h4>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">Total Kebiasaan Terlacak</span>
              <span className="font-bold text-slate-900">{habits.total || 0}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">Streak Aktif</span>
              <span className="font-bold text-amber-600">{habits.active_streaks || 0}</span>
            </div>
            <div className="space-y-1 pt-2">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-600">Kepatuhan Jadwal 30 Hari</span>
                <span className="text-slate-900">{habits.completion_rate_30_days || 0}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${habits.completion_rate_30_days || 0}%` }}
                  className="h-full bg-amber-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Examination & Assessment Matrix */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <GraduationCap className="h-4 w-4 text-emerald-600" />
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Hasil Asesmen Ujian</h4>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">Total Percobaan Ujian</span>
              <span className="font-bold text-slate-900">{exams.total_attempts || 0}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">Rata-rata Skor</span>
              <span className="font-bold text-slate-900">{exams.avg_score || 0}%</span>
            </div>
            <div className="space-y-1 pt-2">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-600">Tingkat Kelulusan (Pass Rate)</span>
                <span className="text-emerald-700">{exams.pass_rate || 0}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${exams.pass_rate || 0}%` }}
                  className="h-full bg-emerald-600"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
