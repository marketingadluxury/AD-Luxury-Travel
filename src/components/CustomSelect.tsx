import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface CustomSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  buttonClassName?: string;
  icon?: React.ReactNode;
  align?: 'left' | 'right';
  disabled?: boolean;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Chọn...',
  label,
  className = '',
  buttonClassName = '',
  icon,
  align = 'left',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={`relative inline-flex flex-col gap-1 ${className}`}>
      {label && (
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
          {label}
        </label>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`flex items-center justify-between gap-2 text-left whitespace-nowrap transition-all cursor-pointer h-[38px] ${
          buttonClassName ||
          `w-full px-3 py-2 border rounded-xl text-xs font-semibold shadow-2xs ${
            disabled
              ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
              : isOpen
              ? 'bg-white border-blue-500 ring-2 ring-blue-500/20 text-slate-900'
              : 'bg-gray-50/50 hover:bg-white border-gray-200 text-slate-800'
          }`
        }`}
      >
        <span className="truncate flex items-center gap-2 min-w-0">
          {icon && <span className="text-slate-500 shrink-0">{icon}</span>}
          {selectedOption?.icon && <span className="shrink-0">{selectedOption.icon}</span>}
          <span className="truncate" title={selectedOption ? selectedOption.label : placeholder}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-blue-600' : ''
          }`}
        />
      </button>

      {isOpen && !disabled && (
        <div
          className={`absolute top-full ${
            align === 'right' ? 'right-0' : 'left-0'
          } mt-1.5 z-50 bg-white border border-slate-200 shadow-xl rounded-xl p-1 text-xs min-w-full w-max max-w-xs sm:max-w-md max-h-64 overflow-y-auto flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-150`}
        >
          {options.map((opt) => {
            const isSelected = value === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg font-medium flex items-center justify-between transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-blue-50 text-blue-700 font-bold'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
                title={opt.label}
              >
                <span className="truncate flex items-center gap-2 min-w-0 pr-2">
                  {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                  <span className="truncate">{opt.label}</span>
                </span>
                {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0 ml-1" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
