import React from 'react';
import { useTheme, Theme } from '@/contexts/ThemeContext';
import { Sun, Moon, Monitor } from 'lucide-react';

const ThemeToggle: React.FC = () => {
  const { theme, setTheme } = useTheme();

  const getThemeIcon = (themeType: Theme) => {
    switch (themeType) {
      case 'light':
        return <Sun className="h-4 w-4" />;
      case 'dark':
        return <Moon className="h-4 w-4" />;
      case 'system':
        return <Monitor className="h-4 w-4" />;
    }
  };

  const themes: Theme[] = ['light', 'system', 'dark'];

  const cycleTheme = () => {
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  return (
    <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
      {themes.map((themeOption) => (
        <button
          key={themeOption}
          onClick={() => setTheme(themeOption)}
          className={`relative flex items-center justify-center w-8 h-8 rounded-md transition-all duration-200 ${
            theme === themeOption
              ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-white/50 dark:hover:bg-gray-600/50'
          }`}
          aria-label={`Switch to ${themeOption} theme`}
          title={`${themeOption.charAt(0).toUpperCase() + themeOption.slice(1)} theme`}
        >
          {getThemeIcon(themeOption)}
        </button>
      ))}
    </div>
  );
};

export default ThemeToggle;