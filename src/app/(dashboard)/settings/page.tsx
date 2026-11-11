'use client';

import React, { useEffect, useState } from 'react';
import {
  Settings,
  User as UserIcon,
  Lock,
  Globe,
  Bell,
  Save,
  CheckCircle2,
} from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function SettingsPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [timezone, setTimezone] = useState('Asia/Jakarta');
  const [emailNotif, setEmailNotif] = useState(true);
  const [inAppNotif, setInAppNotif] = useState(true);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const [userRes, settingsRes] = await Promise.all([
        api.get('/auth/me'),
        api.get('/settings'),
      ]);

      if (userRes.data?.success) {
        setName(userRes.data.data.name || '');
        setEmail(userRes.data.data.email || '');
        setTimezone(userRes.data.data.timezone || 'Asia/Jakarta');
      }

      if (settingsRes.data?.success) {
        setEmailNotif(settingsRes.data.data.email_notifications ?? true);
        setInAppNotif(settingsRes.data.data.in_app_notifications ?? true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingProfile(true);
      const res = await api.put('/auth/profile', {
        name,
        email,
        timezone,
      });

      if (res.data?.success) {
        // Update user in localStorage
        const stored = localStorage.getItem('tuntas_user');
        if (stored) {
          const user = JSON.parse(stored);
          localStorage.setItem(
            'tuntas_user',
            JSON.stringify({ ...user, name, email, timezone })
          );
        }

        // Also save settings
        await api.put('/settings', {
          email_notifications: emailNotif,
          in_app_notifications: inAppNotif,
          timezone,
        });

        setStatusMsg('Profile and preferences updated successfully.');
        setTimeout(() => setStatusMsg(null), 3500);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Update failed.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      alert('New password and confirmation do not match.');
      return;
    }

    try {
      setSavingPassword(true);
      const res = await api.put('/auth/password', {
        current_password: currentPassword,
        password: newPassword,
        password_confirmation: confirmPassword,
      });

      if (res.data?.success) {
        setStatusMsg('Password changed successfully.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setStatusMsg(null), 3500);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Password update failed.');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Account & Settings</h2>
        <p className="mt-1 text-xs text-slate-500">
          Manage your personal profile, authentication credentials, and notification channels.
        </p>
      </div>

      {statusMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* Profile Form */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <UserIcon className="h-4 w-4 text-sky-600" />
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Profile Details
          </h3>
        </div>

        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <Input
            label="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <Input
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Timezone
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm focus:border-sky-500 focus:outline-none"
            >
              <option value="Asia/Jakarta">Asia/Jakarta (WIB / UTC+7)</option>
              <option value="Asia/Makassar">Asia/Makassar (WITA / UTC+8)</option>
              <option value="Asia/Jayapura">Asia/Jayapura (WIT / UTC+9)</option>
              <option value="UTC">UTC</option>
            </select>
          </div>

          {/* Notification toggles */}
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Notification Preferences
            </h4>

            <label className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50 cursor-pointer">
              <div>
                <span className="text-xs font-bold text-slate-800">Email Notifications</span>
                <p className="text-[11px] text-slate-500">Receive exam reminders and weekly digest reports.</p>
              </div>
              <input
                type="checkbox"
                checked={emailNotif}
                onChange={(e) => setEmailNotif(e.target.checked)}
                className="h-4 w-4 text-sky-600 rounded focus:ring-sky-500"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50 cursor-pointer">
              <div>
                <span className="text-xs font-bold text-slate-800">In-App Alerts</span>
                <p className="text-[11px] text-slate-500">Show notification badge and banner warnings.</p>
              </div>
              <input
                type="checkbox"
                checked={inAppNotif}
                onChange={(e) => setInAppNotif(e.target.checked)}
                className="h-4 w-4 text-sky-600 rounded focus:ring-sky-500"
              />
            </label>
          </div>

          <div className="pt-2 flex justify-end">
            <Button loading={savingProfile} leftIcon={<Save className="h-4 w-4" />}>
              Save Profile
            </Button>
          </div>
        </form>
      </div>

      {/* Password Form */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Lock className="h-4 w-4 text-sky-600" />
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Change Password
          </h3>
        </div>

        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <Input
            label="Current Password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="New Password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            <Input
              label="Confirm New Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <div className="pt-2 flex justify-end">
            <Button
              variant="secondary"
              loading={savingPassword}
              leftIcon={<Save className="h-4 w-4" />}
            >
              Update Password
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
