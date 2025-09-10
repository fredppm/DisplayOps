import { useState, useRef, useEffect } from 'react';
import { Clock, ChevronDown, Check } from 'lucide-react';

export interface TimezoneOption {
  value: string;
  label: string;
  region: string;
  offset: string;
}

export const TIMEZONE_OPTIONS: TimezoneOption[] = [
  {
    value: 'America/New_York',
    label: 'Eastern Time (ET)',
    region: 'North America',
    offset: 'UTC-5/-4'
  },
  {
    value: 'America/Chicago',
    label: 'Central Time (CT)',
    region: 'North America',
    offset: 'UTC-6/-5'
  },
  {
    value: 'America/Denver',
    label: 'Mountain Time (MT)',
    region: 'North America',
    offset: 'UTC-7/-6'
  },
  {
    value: 'America/Los_Angeles',
    label: 'Pacific Time (PT)',
    region: 'North America',
    offset: 'UTC-8/-7'
  },
  {
    value: 'America/Sao_Paulo',
    label: 'Brasília Time (BRT)',
    region: 'South America',
    offset: 'UTC-3/-2'
  },
  {
    value: 'Europe/London',
    label: 'Greenwich Mean Time (GMT)',
    region: 'Europe',
    offset: 'UTC+0/+1'
  },
  {
    value: 'Europe/Paris',
    label: 'Central European Time (CET)',
    region: 'Europe',
    offset: 'UTC+1/+2'
  },
  {
    value: 'Europe/Berlin',
    label: 'Central European Time (CET)',
    region: 'Europe',
    offset: 'UTC+1/+2'
  },
  {
    value: 'Asia/Tokyo',
    label: 'Japan Standard Time (JST)',
    region: 'Asia',
    offset: 'UTC+9'
  },
  {
    value: 'Asia/Shanghai',
    label: 'China Standard Time (CST)',
    region: 'Asia',
    offset: 'UTC+8'
  },
  {
    value: 'Asia/Kolkata',
    label: 'India Standard Time (IST)',
    region: 'Asia',
    offset: 'UTC+5:30'
  },
  {
    value: 'Australia/Sydney',
    label: 'Australian Eastern Time (AEST)',
    region: 'Australia',
    offset: 'UTC+10/+11'
  }
];

interface TimezoneComboboxProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export default function TimezoneCombobox({
  value,
  onChange,
  disabled = false,
  placeholder = 'Select timezone...',
  className = ''
}: TimezoneComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const comboboxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = TIMEZONE_OPTIONS.find(option => option.value === value);

  const filteredOptions = query === ''
    ? TIMEZONE_OPTIONS
    : TIMEZONE_OPTIONS.filter((option) =>
        option.label.toLowerCase().includes(query.toLowerCase()) ||
        option.region.toLowerCase().includes(query.toLowerCase()) ||
        option.value.toLowerCase().includes(query.toLowerCase())
      );

  // Group options by region
  const groupedOptions = filteredOptions.reduce((groups, option) => {
    const region = option.region;
    if (!groups[region]) {
      groups[region] = [];
    }
    groups[region].push(option);
    return groups;
  }, {} as Record<string, TimezoneOption[]>);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (comboboxRef.current && !comboboxRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setQuery('');
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsOpen(true);
      setFocusedIndex(prev => Math.min(prev + 1, filteredOptions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && focusedIndex >= 0) {
      e.preventDefault();
      onChange(filteredOptions[focusedIndex].value);
      setIsOpen(false);
      setQuery('');
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setQuery('');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setIsOpen(true);
    setFocusedIndex(-1);
  };

  const handleOptionClick = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setQuery('');
    inputRef.current?.blur();
  };

  const displayValue = query || (selectedOption?.label) || '';

  return (
    <div className={`relative ${className}`} ref={comboboxRef}>
      {/* Input Field */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="block w-full px-4 py-3 text-sm border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors disabled:bg-gray-50 disabled:text-gray-500 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400 dark:focus:ring-blue-500 dark:focus:border-blue-500"
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors disabled:hover:bg-transparent"
        >
          <ChevronDown className={`h-4 w-4 text-gray-400 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-auto">
          {Object.keys(groupedOptions).length === 0 ? (
            <div className="py-3 px-4 text-sm text-gray-500 dark:text-gray-400">
              No timezone found
            </div>
          ) : (
            Object.entries(groupedOptions).map(([region, options]) => (
              <div key={region}>
                {/* Region Header */}
                <div className="sticky top-0 bg-gray-50 dark:bg-gray-700 px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wide border-b border-gray-100 dark:border-gray-600">
                  {region}
                </div>
                
                {/* Options */}
                {options.map((option, optionIndex) => {
                  const globalIndex = filteredOptions.findIndex(o => o.value === option.value);
                  const isSelected = option.value === value;
                  const isFocused = globalIndex === focusedIndex;
                  
                  return (
                    <div
                      key={option.value}
                      onClick={() => handleOptionClick(option.value)}
                      className={`
                        cursor-pointer px-4 py-3 flex items-center justify-between transition-colors
                        ${isFocused ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}
                        ${isSelected ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100' : 'text-gray-900 dark:text-gray-100'}
                      `}
                    >
                      <div className="flex-1">
                        <div className="text-sm font-medium">{option.label}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{option.value} • {option.offset}</div>
                      </div>
                      {isSelected && (
                        <Check className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}