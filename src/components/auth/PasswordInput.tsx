'use client';

import React, { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface PasswordInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  error?: string;
  onVisibilityChange?: (isVisible: boolean) => void;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  (
    {
      label,
      error,
      className = '',
      onFocus,
      onBlur,
      onVisibilityChange,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const toggleVisibility = () => {
      const next = !showPassword;
      setShowPassword(next);
      onVisibilityChange?.(next);
    };

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

        <div className="relative flex items-center">
          <input
            ref={ref}
            type={showPassword ? 'text' : 'password'}
            className={`w-full bg-transparent py-1.5 pr-8 text-sm font-medium text-[#19191D] placeholder:text-[#BDBDBD] focus:outline-none border-b transition-colors tracking-normal ${
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

          <button
            type="button"
            onClick={toggleVisibility}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-0 text-[#858585] hover:text-[#19191D] transition p-1 cursor-pointer focus:outline-none"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>

        {error && (
          <p className="text-[11px] font-medium text-rose-500 mt-1">{error}</p>
        )}
      </div>
    );
  }
);

PasswordInput.displayName = 'PasswordInput';

export default PasswordInput;

