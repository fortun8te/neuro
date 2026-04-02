import React, { useState, useRef } from 'react';
import {
  exportChartToPng,
  exportToCsv,
  exportToPdf,
  exportToPowerPoint,
  exportToJson,
  prepareDataForExport,
} from '../../utils/exportUtils';

export interface ExportConfig {
  title: string;
  description?: string;
  charts?: Array<{
    element: HTMLElement;
    title?: string;
  }>;
  data?: Array<Record<string, any>>;
  includeTimestamp?: boolean;
  logo?: string;
}

export interface ExportSystemProps {
  config: ExportConfig;
  onExportStart?: () => void;
  onExportComplete?: (format: string) => void;
  onExportError?: (error: Error) => void;
}

type ExportFormat = 'png' | 'pdf' | 'pptx' | 'csv' | 'json';

export const ExportSystem: React.FC<ExportSystemProps> = ({
  config,
  onExportStart,
  onExportComplete,
  onExportError,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [currentFormat, setCurrentFormat] = useState<ExportFormat | null>(null);
  const [progress, setProgress] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const isDark = () => document.documentElement.classList.contains('dark');

  const handleExport = async (format: ExportFormat) => {
    setIsExporting(true);
    setCurrentFormat(format);
    setProgress(0);
    onExportStart?.();

    try {
      const { title, charts = [], data = [], includeTimestamp = true, logo } = config;

      switch (format) {
        case 'png': {
          if (charts.length === 0) {
            throw new Error('No charts available for PNG export');
          }
          setProgress(50);
          await exportChartToPng(charts[0].element, title);
          break;
        }

        case 'pdf': {
          if (charts.length === 0) {
            throw new Error('No charts available for PDF export');
          }
          setProgress(50);
          await exportToPdf({
            title,
            chartElements: charts,
            logo,
            includeTimestamp,
          });
          break;
        }

        case 'pptx': {
          if (charts.length === 0) {
            throw new Error('No charts available for PowerPoint export');
          }
          setProgress(50);
          await exportToPowerPoint({
            title,
            chartElements: charts,
            logo,
            includeTimestamp,
          });
          break;
        }

        case 'csv': {
          if (data.length === 0) {
            throw new Error('No data available for CSV export');
          }
          setProgress(50);
          const preparedData = prepareDataForExport(data, true);
          exportToCsv(preparedData, title);
          break;
        }

        case 'json': {
          if (data.length === 0) {
            throw new Error('No data available for JSON export');
          }
          setProgress(50);
          exportToJson({ title, data }, title);
          break;
        }

        default:
          throw new Error(`Unknown export format: ${format}`);
      }

      setProgress(100);
      onExportComplete?.(format);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(`Export failed for format ${format}:`, err);
      onExportError?.(err);
    } finally {
      setIsExporting(false);
      setCurrentFormat(null);
      setTimeout(() => setProgress(0), 500);
    }
  };

  const exportOptions: Array<{
    format: ExportFormat;
    label: string;
    icon: string;
    description: string;
    disabled: boolean;
  }> = [
    {
      format: 'png',
      label: 'PNG',
      icon: '🖼️',
      description: 'Single chart image',
      disabled: config.charts?.length === 0,
    },
    {
      format: 'pdf',
      label: 'PDF',
      icon: '📄',
      description: 'Multi-page document',
      disabled: config.charts?.length === 0,
    },
    {
      format: 'pptx',
      label: 'PowerPoint',
      icon: '📊',
      description: 'Presentation slides',
      disabled: config.charts?.length === 0,
    },
    {
      format: 'csv',
      label: 'CSV',
      icon: '📋',
      description: 'Tabular data',
      disabled: config.data?.length === 0,
    },
    {
      format: 'json',
      label: 'JSON',
      icon: '{}',
      description: 'Structured data',
      disabled: config.data?.length === 0,
    },
  ];

  return (
    <div ref={containerRef} style={{
      background: isDark() ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)',
      borderRadius: 8,
      padding: 24,
      color: isDark() ? '#fff' : '#000',
    }}>
      <div style={{
        fontSize: 18,
        fontWeight: 600,
        marginBottom: 8,
      }}>
        Export Campaign
      </div>
      <div style={{
        fontSize: 13,
        color: isDark() ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
        marginBottom: 24,
      }}>
        Download your campaign data and visuals in multiple formats
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 12,
      }}>
        {exportOptions.map((option) => (
          <button
            key={option.format}
            onClick={() => handleExport(option.format)}
            disabled={isExporting || option.disabled}
            style={{
              padding: 16,
              background: isDark() ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.05)',
              border: `2px solid ${isDark() ? 'rgba(59,130,246,0.3)' : 'rgba(59,130,246,0.2)'}`,
              borderRadius: 8,
              cursor: isExporting || option.disabled ? 'not-allowed' : 'pointer',
              transition: 'all 200ms ease-out',
              opacity: option.disabled ? 0.5 : isExporting && currentFormat === option.format ? 0.7 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isExporting && !option.disabled) {
                (e.target as HTMLElement).style.background = isDark()
                  ? 'rgba(59,130,246,0.15)'
                  : 'rgba(59,130,246,0.1)';
                (e.target as HTMLElement).style.borderColor = isDark()
                  ? 'rgba(59,130,246,0.5)'
                  : 'rgba(59,130,246,0.4)';
              }
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.background = isDark()
                ? 'rgba(59,130,246,0.1)'
                : 'rgba(59,130,246,0.05)';
              (e.target as HTMLElement).style.borderColor = isDark()
                ? 'rgba(59,130,246,0.3)'
                : 'rgba(59,130,246,0.2)';
            }}
          >
            <div style={{
              fontSize: 24,
              marginBottom: 8,
              height: 28,
            }}>
              {option.icon}
            </div>
            <div style={{
              fontWeight: 600,
              fontSize: 14,
              marginBottom: 4,
            }}>
              {option.label}
            </div>
            <div style={{
              fontSize: 11,
              color: isDark() ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
            }}>
              {option.description}
            </div>

            {/* Loading indicator */}
            {isExporting && currentFormat === option.format && (
              <div style={{
                marginTop: 12,
                height: 2,
                background: isDark() ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                borderRadius: 1,
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${progress}%`,
                  background: '#3b82f6',
                  transition: 'width 200ms ease-out',
                }} />
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Batch export option */}
      <div style={{
        marginTop: 24,
        padding: 16,
        background: isDark() ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
        borderRadius: 8,
        border: `1px solid ${isDark() ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
      }}>
        <div style={{
          fontSize: 14,
          fontWeight: 600,
          marginBottom: 12,
        }}>
          Batch Export All Formats
        </div>
        <button
          onClick={async () => {
            setIsExporting(true);
            onExportStart?.();

            try {
              setProgress(0);
              const { title, charts = [], data = [], includeTimestamp = true, logo } = config;

              // Export all available formats
              const formats: ExportFormat[] = [];

              if (charts.length > 0) {
                formats.push('png', 'pdf', 'pptx');
              }
              if (data.length > 0) {
                formats.push('csv', 'json');
              }

              for (let i = 0; i < formats.length; i++) {
                const format = formats[i];
                setCurrentFormat(format);
                setProgress((i / formats.length) * 100);

                switch (format) {
                  case 'png':
                    await exportChartToPng(charts[0].element, title);
                    break;
                  case 'pdf':
                    await exportToPdf({ title, chartElements: charts, logo, includeTimestamp });
                    break;
                  case 'pptx':
                    await exportToPowerPoint({ title, chartElements: charts, logo, includeTimestamp });
                    break;
                  case 'csv': {
                    const preparedData = prepareDataForExport(data, true);
                    exportToCsv(preparedData, title);
                    break;
                  }
                  case 'json':
                    exportToJson({ title, data }, title);
                    break;
                }
              }

              setProgress(100);
              onExportComplete?.('all');
            } catch (error) {
              const err = error instanceof Error ? error : new Error(String(error));
              onExportError?.(err);
            } finally {
              setIsExporting(false);
              setCurrentFormat(null);
              setTimeout(() => setProgress(0), 500);
            }
          }}
          disabled={isExporting || (config.charts?.length === 0 && config.data?.length === 0)}
          style={{
            padding: '10px 20px',
            background: '#10b981',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: isExporting || (config.charts?.length === 0 && config.data?.length === 0) ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            fontSize: 13,
            transition: 'all 200ms ease-out',
            opacity: isExporting ? 0.7 : 1,
          }}
        >
          {isExporting ? `Exporting... ${progress}%` : 'Export All Formats'}
        </button>
      </div>

      {/* Tips */}
      <div style={{
        marginTop: 24,
        padding: 12,
        background: isDark() ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.05)',
        borderRadius: 6,
        border: `1px solid ${isDark() ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.1)'}`,
        fontSize: 12,
        color: isDark() ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)',
      }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Export Tips:</div>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>PNG exports are optimized for presentations and social media</li>
          <li>PDF combines all charts into a professional document</li>
          <li>PowerPoint slides are ready for client presentations</li>
          <li>CSV is ideal for data analysis in spreadsheets</li>
          <li>JSON preserves all raw data for programmatic access</li>
        </ul>
      </div>
    </div>
  );
};
