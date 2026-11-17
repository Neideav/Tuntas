'use client';

import React, { forwardRef, useState } from 'react';

interface AuthUnderlineInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const AuthUnderlineInput = forwardRef<
  HTMLInputElement,
  AuthUnderlineInputProps
>(({ label, error, className = '', onFocus, onBlur, ...props }, ref) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className="w-full space-y-1">
      <label
        htmlFor={props.id || props.name}
        className={`block text-[11px] font-semibold tracking-wide transition-colors ${
          error
            ? 'text-rose-500'
            : isFocused
            ? 'text-[#19191D]'
            : 'text-[#858585]'
        }`}
      >
        {label}
      </label>

      <div className="relative">
        <input
          ref={ref}
          className={`w-full bg-transparent py-1.5 text-sm font-medium text-[#19191D] placeholder:text-[#BDBDBD] focus:outline-none border-b transition-colors ${
            error
              ? 'border-rose-500'
              : isFocused
              ? 'border-[#19191D]'
              : 'border-[#D8D8D8]'
          } ${className}`}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          {...props}
        />
      </div>

      {error && (
        <p className="text-[11px] font-medium text-rose-500 mt-1">{error}</p>
      )}
    </div>
  );
});

AuthUnderlineInput.displayName = 'AuthUnderlineInput';

export default AuthUnderlineInput;

