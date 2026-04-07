import React from 'react';

export interface AvatarColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

const COLOR_PRESETS = [
  { name: 'Red', value: '#EF4444' },
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Green', value: '#10B981' },
  { name: 'Purple', value: '#8B5CF6' },
  { name: 'Orange', value: '#F97316' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Cyan', value: '#06B6D4' },
  { name: 'Yellow', value: '#FBBF24' },
];

export const AvatarColorPicker: React.FC<AvatarColorPickerProps> = ({ value, onChange }) => {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Avatar Color
      </label>
      <div className="flex gap-2 flex-wrap">
        {COLOR_PRESETS.map((color) => (
          <button
            key={color.value}
            onClick={() => onChange(color.value)}
            className={`w-10 h-10 rounded-lg transition-all border-2 ${
              value === color.value
                ? 'border-gray-900 dark:border-gray-100 ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-950'
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
            }`}
            style={{ backgroundColor: color.value }}
            title={color.name}
            aria-label={`Select ${color.name} color`}
          />
        ))}
      </div>
    </div>
  );
};
