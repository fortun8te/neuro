import React, { useState, useCallback } from 'react';

export interface SliderState {
  tamEstimate: number; // 0-1000000000
  budgetAllocation: {
    [channel: string]: number;
  };
  campaignDuration: number; // days
}

export interface InteractiveSlidersProps {
  onStateChange?: (state: SliderState) => void;
  initialState?: Partial<SliderState>;
  channels?: string[];
  showPercentages?: boolean;
}

export const InteractiveSliders: React.FC<InteractiveSlidersProps> = ({
  onStateChange,
  initialState = {},
  channels = ['Paid Search', 'Social Media', 'Email', 'Content', 'Partnerships'],
  showPercentages = true,
}) => {
  const defaultState: SliderState = {
    tamEstimate: initialState.tamEstimate || 50000000,
    budgetAllocation: initialState.budgetAllocation || {
      'Paid Search': 40,
      'Social Media': 30,
      Email: 15,
      Content: 10,
      Partnerships: 5,
    },
    campaignDuration: initialState.campaignDuration || 90,
  };

  const [state, setState] = useState<SliderState>(defaultState);
  const isDark = () => document.documentElement.classList.contains('dark');

  const updateState = useCallback((newState: SliderState) => {
    setState(newState);
    onStateChange?.(newState);
  }, [onStateChange]);

  const handleTamChange = (value: number) => {
    updateState({ ...state, tamEstimate: value });
  };

  const handleBudgetChange = (channel: string, percentage: number) => {
    const newAllocation = { ...state.budgetAllocation };
    newAllocation[channel] = percentage;

    // Normalize other channels if needed
    const total = Object.values(newAllocation).reduce((a, b) => a + b, 0);
    if (total !== 100) {
      // Distribute remaining percentage
      const remaining = 100 - percentage;
      const otherChannels = Object.keys(newAllocation).filter(c => c !== channel);
      const otherTotal = otherChannels.reduce((sum, c) => sum + newAllocation[c], 0);

      if (otherTotal > 0) {
        const scaleFactor = remaining / otherTotal;
        otherChannels.forEach(c => {
          newAllocation[c] = Math.round(newAllocation[c] * scaleFactor);
        });
      }
    }

    updateState({ ...state, budgetAllocation: newAllocation });
  };

  const handleDurationChange = (value: number) => {
    updateState({ ...state, campaignDuration: value });
  };

  // Calculate metrics
  const totalBudget = 1000000; // $1M default budget
  const channelBudgets = Object.entries(state.budgetAllocation).reduce(
    (acc, [channel, percentage]) => {
      acc[channel] = (totalBudget * percentage) / 100;
      return acc;
    },
    {} as Record<string, number>
  );

  const tamPercentage = (totalBudget / state.tamEstimate) * 100;
  const projectedReach = Math.round(state.tamEstimate * (tamPercentage / 100));

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#10b981'];

  return (
    <div style={{
      background: isDark() ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)',
      borderRadius: 8,
      padding: 24,
      color: isDark() ? '#fff' : '#000',
    }}>
      <div style={{ display: 'grid', gap: 32 }}>
        {/* TAM Estimation Slider */}
        <div>
          <div style={{
            fontSize: 16,
            fontWeight: 600,
            marginBottom: 8,
          }}>
            Total Addressable Market (TAM)
          </div>
          <div style={{
            fontSize: 12,
            color: isDark() ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
            marginBottom: 16,
          }}>
            Estimated market size to target
          </div>

          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
            <input
              type="range"
              min="1000000"
              max="1000000000"
              step="1000000"
              value={state.tamEstimate}
              onChange={(e) => handleTamChange(Number(e.target.value))}
              style={{ flex: 1, cursor: 'pointer' }}
            />
            <div style={{
              fontSize: 14,
              fontWeight: 600,
              minWidth: 150,
              textAlign: 'right',
            }}>
              {formatCurrency(state.tamEstimate)}
            </div>
          </div>

          {/* Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            <MetricBox
              label="Budget % of TAM"
              value={`${tamPercentage.toFixed(2)}%`}
              isDark={isDark()}
            />
            <MetricBox
              label="Projected Reach"
              value={`${(projectedReach / 1000000).toFixed(1)}M`}
              isDark={isDark()}
            />
            <MetricBox
              label="Budget Allocation"
              value={formatCurrency(totalBudget)}
              isDark={isDark()}
            />
          </div>
        </div>

        {/* Budget Allocation Sliders */}
        <div>
          <div style={{
            fontSize: 16,
            fontWeight: 600,
            marginBottom: 8,
          }}>
            Budget Allocation by Channel
          </div>
          <div style={{
            fontSize: 12,
            color: isDark() ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
            marginBottom: 16,
          }}>
            Distribute {formatCurrency(totalBudget)} across marketing channels
          </div>

          <div style={{ display: 'grid', gap: 16 }}>
            {channels.map((channel, idx) => {
              const percentage = state.budgetAllocation[channel] || 0;
              const budget = channelBudgets[channel] || 0;
              const color = colors[idx % colors.length];

              return (
                <div key={channel}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 8,
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}>
                      <div style={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        background: color,
                      }} />
                      <span style={{ fontWeight: 500 }}>{channel}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        fontWeight: 600,
                        fontSize: 13,
                      }}>
                        {formatCurrency(budget)}
                      </div>
                      {showPercentages && (
                        <div style={{
                          fontSize: 11,
                          color: isDark() ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
                        }}>
                          {percentage.toFixed(1)}%
                        </div>
                      )}
                    </div>
                  </div>

                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={percentage}
                    onChange={(e) => handleBudgetChange(channel, Number(e.target.value))}
                    style={{
                      width: '100%',
                      cursor: 'pointer',
                      accentColor: color,
                    }}
                  />

                  {/* Progress bar */}
                  <div style={{
                    marginTop: 8,
                    height: 4,
                    background: isDark() ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${percentage}%`,
                      background: color,
                      transition: 'width 0.2s ease-out',
                    }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Budget verification */}
          <div style={{
            marginTop: 16,
            padding: 12,
            background: isDark() ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
            borderRadius: 6,
            fontSize: 12,
            display: 'flex',
            justifyContent: 'space-between',
          }}>
            <span>Total Allocation:</span>
            <span style={{ fontWeight: 600 }}>
              {Object.values(state.budgetAllocation).reduce((a, b) => a + b, 0).toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Campaign Duration Slider */}
        <div>
          <div style={{
            fontSize: 16,
            fontWeight: 600,
            marginBottom: 8,
          }}>
            Campaign Duration
          </div>
          <div style={{
            fontSize: 12,
            color: isDark() ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
            marginBottom: 16,
          }}>
            How long to run this campaign
          </div>

          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
            <input
              type="range"
              min="7"
              max="365"
              step="1"
              value={state.campaignDuration}
              onChange={(e) => handleDurationChange(Number(e.target.value))}
              style={{ flex: 1, cursor: 'pointer' }}
            />
            <div style={{
              fontSize: 14,
              fontWeight: 600,
              minWidth: 150,
              textAlign: 'right',
            }}>
              {state.campaignDuration} days
            </div>
          </div>

          {/* Duration metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            <MetricBox
              label="Weeks"
              value={(state.campaignDuration / 7).toFixed(1)}
              isDark={isDark()}
            />
            <MetricBox
              label="Months"
              value={(state.campaignDuration / 30).toFixed(1)}
              isDark={isDark()}
            />
            <MetricBox
              label="Budget/Day"
              value={formatCurrency(totalBudget / state.campaignDuration)}
              isDark={isDark()}
            />
          </div>
        </div>

        {/* Summary */}
        <div style={{
          padding: 16,
          background: isDark() ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.05)',
          borderRadius: 8,
          border: `1px solid ${isDark() ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.2)'}`,
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Campaign Summary</div>
          <div style={{ fontSize: 12, display: 'grid', gap: 4 }}>
            <div>
              TAM: <strong>{formatCurrency(state.tamEstimate)}</strong>
            </div>
            <div>
              Budget: <strong>{formatCurrency(totalBudget)}</strong> over {state.campaignDuration} days
            </div>
            <div>
              Reach Potential: <strong>{formatCurrency(projectedReach)}</strong> ({tamPercentage.toFixed(2)}% of TAM)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface MetricBoxProps {
  label: string;
  value: string;
  isDark: boolean;
}

function MetricBox({ label, value, isDark: isDarkMode }: MetricBoxProps) {
  return (
    <div style={{
      padding: 12,
      background: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
      borderRadius: 6,
      border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
      textAlign: 'center',
    }}>
      <div style={{
        fontSize: 11,
        color: isDarkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
        marginBottom: 4,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 14,
        fontWeight: 600,
        color: '#3b82f6',
      }}>
        {value}
      </div>
    </div>
  );
}
