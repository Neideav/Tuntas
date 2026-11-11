import React from 'react';

export interface Collaborator {
  id?: string | number;
  name?: string;
  initials?: string;
  avatarUrl?: string | null;
  bgColor?: string;
}

export function AvatarStack({
  users = [],
  max = 2,
  size = 'sm',
}: {
  users?: Collaborator[];
  max?: number;
  size?: 'sm' | 'md';
}) {
  const visible = users.slice(0, max);
  const remaining = users.length - max;

  const sizeClasses = size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-8 w-8 text-xs';

  const defaultColors = [
    'bg-emerald-100 text-emerald-700',
    'bg-sky-100 text-sky-700',
    'bg-amber-100 text-amber-700',
    'bg-purple-100 text-purple-700',
  ];

  return (
    <div className="flex items-center -space-x-1.5 overflow-hidden">
      {visible.map((user, idx) => {
        const color = user.bgColor || defaultColors[idx % defaultColors.length];
        const initials =
          user.initials ||
          (user.name
            ? user.name
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()
            : 'U');

        return (
          <div
            key={user.id || idx}
            title={user.name || 'Collaborator'}
            className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ring-2 ring-white select-none ${sizeClasses} ${color}`}
          >
            {initials}
          </div>
        );
      })}

      {remaining > 0 && (
        <div
          title={`${remaining} more members`}
          className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold bg-slate-100 text-slate-600 ring-2 ring-white select-none ${sizeClasses}`}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
}

