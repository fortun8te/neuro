/**
 * SmartModelSelector — Intelligent model selection UI
 * Allows users to configure model preferences and see auto-escalation behavior
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { FONT_FAMILY } from '../constants/ui';

interface ModelOption {
  id: string;
  name: string;
  tier: 'light' | 'standard' | 'quality' | 'maximum';
  params: number; // in billions
  vram: number; // in GB
  speed: 'fast' | 'moderate' | 'slow';
  bestFor: string[];
}

const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: 'qwen3.5:2b',
    name: 'Qwen 3.5 (2B)',
    tier: 'light',
    params: 2,
    vram: 1.5,
    speed: 'fast',
    bestFor: ['routing', 'classification', 'compression'],
  },
  {
    id: 'qwen3.5:4b',
    name: 'Qwen 3.5 (4B)',
    tier: 'standard',
    params: 4,
    vram: 2.8,
    speed: 'moderate',
    bestFor: ['chat', 'orchestration', 'analysis'],
  },
  {
    id: 'qwen3.5:9b',
    name: 'Qwen 3.5 (9B)',
    tier: 'quality',
    params: 9,
    vram: 6.6,
    speed: 'moderate',
    bestFor: ['research', 'planning', 'quality responses'],
  },
  {
    id: 'qwen3.5:27b',
    name: 'Qwen 3.5 (27B)',
    tier: 'maximum',
    params: 27,
    vram: 18,
    speed: 'slow',
    bestFor: ['creative', 'deep analysis', 'reasoning'],
  },
  {
    id: 'nemotron-3-super:120b',
    name: 'Nemotron 3 Super (120B)',
    tier: 'maximum',
    params: 120,
    vram: 60,
    speed: 'slow',
    bestFor: ['production creative', 'evaluation', 'complex reasoning'],
  },
];

interface SmartModelSelectorProps {
  onModelSelect?: (model: string) => void;
  isDarkMode?: boolean;
}

export function SmartModelSelector({
  onModelSelect,
  isDarkMode: isDarkModeOverride,
}: SmartModelSelectorProps) {
  const { isDarkMode: themeIsDarkMode } = useTheme();
  const isDarkMode = isDarkModeOverride ?? themeIsDarkMode;
  const [selectedModel, setSelectedModel] = useState<string>('qwen3.5:9b');
  const [showDetails, setShowDetails] = useState(false);

  const selectedModelData = useMemo(
    () => AVAILABLE_MODELS.find(m => m.id === selectedModel),
    [selectedModel]
  );

  const handleSelect = (modelId: string) => {
    setSelectedModel(modelId);
    onModelSelect?.(modelId);
  };

  const textColor = isDarkMode ? 'rgba(255,255,255,0.9)' : '#1f2937';
  const bgColor = isDarkMode ? '#0a0a0f' : '#ffffff';
  const borderColor = isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const hoverBg = isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';
  const accentColor = isDarkMode ? '#3b82f6' : '#EA580C';

  return (
    <div style={{
      background: bgColor,
      border: `1px solid ${borderColor}`,
      borderRadius: 8,
      padding: 16,
      fontFamily: FONT_FAMILY,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
      }}>
        <h3 style={{
          margin: 0,
          fontSize: 14,
          fontWeight: 600,
          color: textColor,
        }}>
          Model Selection
        </h3>
        <button
          onClick={() => setShowDetails(!showDetails)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: accentColor,
            fontSize: 12,
            fontFamily: FONT_FAMILY,
          }}
        >
          {showDetails ? 'Hide' : 'Show'} Details
        </button>
      </div>

      {/* Model Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 8,
        marginBottom: 12,
      }}>
        {AVAILABLE_MODELS.map(model => (
          <div
            key={model.id}
            onClick={() => handleSelect(model.id)}
            style={{
              padding: 10,
              borderRadius: 6,
              border: selectedModel === model.id ? `2px solid ${accentColor}` : `1px solid ${borderColor}`,
              background: selectedModel === model.id ? `${accentColor}15` : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
              backgroundColor: selectedModel === model.id ? undefined : hoverBg,
            }}
            onMouseEnter={e => {
              if (selectedModel !== model.id) {
                e.currentTarget.style.background = hoverBg;
              }
            }}
            onMouseLeave={e => {
              if (selectedModel !== model.id) {
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            <div style={{
              fontSize: 12,
              fontWeight: 500,
              color: selectedModel === model.id ? accentColor : textColor,
              marginBottom: 4,
            }}>
              {model.name}
            </div>
            <div style={{
              fontSize: 10,
              color: isDarkMode ? 'rgba(255,255,255,0.5)' : '#9CA3AF',
            }}>
              {model.tier.charAt(0).toUpperCase() + model.tier.slice(1)}
            </div>
          </div>
        ))}
      </div>

      {/* Details Section */}
      {showDetails && selectedModelData && (
        <div style={{
          background: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
          border: `1px solid ${borderColor}`,
          borderRadius: 6,
          padding: 12,
          fontSize: 12,
        }}>
          <div style={{ marginBottom: 8 }}>
            <strong style={{ color: textColor }}>Parameters:</strong>
            <span style={{ color: isDarkMode ? 'rgba(255,255,255,0.6)' : '#6B7280', marginLeft: 6 }}>
              {selectedModelData.params}B
            </span>
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong style={{ color: textColor }}>VRAM Required:</strong>
            <span style={{ color: isDarkMode ? 'rgba(255,255,255,0.6)' : '#6B7280', marginLeft: 6 }}>
              {selectedModelData.vram}GB
            </span>
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong style={{ color: textColor }}>Speed:</strong>
            <span style={{
              color: selectedModelData.speed === 'fast' ? '#10b981' : selectedModelData.speed === 'slow' ? '#ef4444' : '#f59e0b',
              marginLeft: 6,
            }}>
              {selectedModelData.speed.charAt(0).toUpperCase() + selectedModelData.speed.slice(1)}
            </span>
          </div>
          <div>
            <strong style={{ color: textColor }}>Best for:</strong>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              marginTop: 6,
            }}>
              {selectedModelData.bestFor.map(task => (
                <span
                  key={task}
                  style={{
                    background: isDarkMode ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)',
                    color: accentColor,
                    padding: '2px 6px',
                    borderRadius: 3,
                    fontSize: 10,
                  }}
                >
                  {task}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Auto-Escalation Info */}
      <div style={{
        marginTop: 12,
        padding: 10,
        background: isDarkMode ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.05)',
        border: `1px solid ${isDarkMode ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.15)'}`,
        borderRadius: 6,
        fontSize: 11,
        color: isDarkMode ? 'rgba(255,255,255,0.7)' : '#374151',
      }}>
        <strong style={{ color: accentColor }}>Auto-Escalation:</strong>
        {' '}The agent will automatically upgrade to a higher-tier model if task complexity is detected.
      </div>
    </div>
  );
}
