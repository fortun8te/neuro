import React, { useState, useCallback, createContext, useContext } from 'react';

export interface BrandColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  success: string;
  warning: string;
  danger: string;
}

export interface BrandingConfig {
  colors: BrandColors;
  logo?: string;
  logoUrl?: string;
  fontFamily: string;
  fontSize: {
    small: number;
    base: number;
    large: number;
    xl: number;
  };
  borderRadius: number;
  companyName?: string;
  companyUrl?: string;
}

const defaultBrandingConfig: BrandingConfig = {
  colors: {
    primary: '#3b82f6',
    secondary: '#8b5cf6',
    accent: '#ec4899',
    background: '#ffffff',
    text: '#000000',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
  },
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: {
    small: 12,
    base: 14,
    large: 16,
    xl: 24,
  },
  borderRadius: 8,
};

const BrandingContext = createContext<{
  config: BrandingConfig;
  updateConfig: (config: Partial<BrandingConfig>) => void;
  applyBranding: (element: HTMLElement) => void;
}>({
  config: defaultBrandingConfig,
  updateConfig: () => {},
  applyBranding: () => {},
});

export function useBranding() {
  return useContext(BrandingContext);
}

export interface BrandingSystemProps {
  initialConfig?: Partial<BrandingConfig>;
  onConfigChange?: (config: BrandingConfig) => void;
  children?: React.ReactNode;
}

export const BrandingProvider: React.FC<BrandingSystemProps> = ({
  initialConfig = {},
  onConfigChange,
  children,
}) => {
  const [config, setConfig] = useState<BrandingConfig>({
    ...defaultBrandingConfig,
    ...initialConfig,
  });

  const updateConfig = useCallback((newConfig: Partial<BrandingConfig>) => {
    const updated = { ...config, ...newConfig };
    setConfig(updated);
    onConfigChange?.(updated);

    // Apply CSS variables
    const root = document.documentElement;
    if (updated.colors) {
      Object.entries(updated.colors).forEach(([key, value]) => {
        root.style.setProperty(`--brand-${key}`, value);
      });
    }
    if (updated.fontFamily) {
      root.style.setProperty('--brand-font-family', updated.fontFamily);
    }
    if (updated.borderRadius) {
      root.style.setProperty('--brand-border-radius', `${updated.borderRadius}px`);
    }
  }, [config, onConfigChange]);

  const applyBranding = useCallback((element: HTMLElement) => {
    element.style.setProperty('--brand-primary', config.colors.primary);
    element.style.setProperty('--brand-secondary', config.colors.secondary);
    element.style.setProperty('--brand-accent', config.colors.accent);
    element.style.setProperty('--font-family', config.fontFamily);
    element.style.setProperty('--border-radius', `${config.borderRadius}px`);
  }, [config]);

  return (
    <BrandingContext.Provider value={{ config, updateConfig, applyBranding }}>
      {children}
    </BrandingContext.Provider>
  );
};

export interface BrandingSystemUIProps {
  config?: Partial<BrandingConfig>;
  onConfigChange?: (config: BrandingConfig) => void;
}

export const BrandingSystemUI: React.FC<BrandingSystemUIProps> = ({
  config: initialConfig = {},
  onConfigChange,
}) => {
  const [config, setConfig] = useState<BrandingConfig>({
    ...defaultBrandingConfig,
    ...initialConfig,
  });
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const isDark = () => document.documentElement.classList.contains('dark');

  const handleColorChange = (key: keyof BrandColors, value: string) => {
    const newConfig = {
      ...config,
      colors: { ...config.colors, [key]: value },
    };
    setConfig(newConfig);
    onConfigChange?.(newConfig);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setLogoPreview(dataUrl);
        const newConfig = { ...config, logoUrl: dataUrl };
        setConfig(newConfig);
        onConfigChange?.(newConfig);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFontFamilyChange = (value: string) => {
    const newConfig = { ...config, fontFamily: value };
    setConfig(newConfig);
    onConfigChange?.(newConfig);
  };

  const handleBorderRadiusChange = (value: number) => {
    const newConfig = { ...config, borderRadius: value };
    setConfig(newConfig);
    onConfigChange?.(newConfig);
  };

  const colorKeys: Array<{ key: keyof BrandColors; label: string }> = [
    { key: 'primary', label: 'Primary' },
    { key: 'secondary', label: 'Secondary' },
    { key: 'accent', label: 'Accent' },
    { key: 'background', label: 'Background' },
    { key: 'text', label: 'Text' },
    { key: 'success', label: 'Success' },
    { key: 'warning', label: 'Warning' },
    { key: 'danger', label: 'Danger' },
  ];

  const fontFamilyOptions = [
    { value: 'system-ui, -apple-system, sans-serif', label: 'System UI' },
    { value: 'Georgia, serif', label: 'Georgia (Serif)' },
    { value: '"Trebuchet MS", sans-serif', label: 'Trebuchet MS' },
    { value: '"Times New Roman", serif', label: 'Times New Roman' },
    { value: '"Courier New", monospace', label: 'Courier New' },
  ];

  return (
    <div style={{
      background: isDark() ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)',
      borderRadius: 8,
      padding: 24,
      color: isDark() ? '#fff' : '#000',
    }}>
      <div style={{
        fontSize: 20,
        fontWeight: 700,
        marginBottom: 8,
      }}>
        Brand Customization
      </div>
      <div style={{
        fontSize: 13,
        color: isDark() ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
        marginBottom: 24,
      }}>
        Customize colors, fonts, and branding for your campaigns
      </div>

      <div style={{ display: 'grid', gap: 32 }}>
        {/* Logo Upload */}
        <div>
          <div style={{
            fontSize: 16,
            fontWeight: 600,
            marginBottom: 12,
          }}>
            Company Logo
          </div>
          <div style={{
            padding: 16,
            border: `2px dashed ${isDark() ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'}`,
            borderRadius: 8,
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 200ms ease-out',
          }}>
            <input
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              style={{ display: 'none' }}
              id="logo-upload"
            />
            <label
              htmlFor="logo-upload"
              style={{
                cursor: 'pointer',
                display: 'block',
              }}
            >
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt="Logo preview"
                  style={{
                    maxWidth: 150,
                    maxHeight: 100,
                    margin: '0 auto',
                  }}
                />
              ) : (
                <div>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>📷</div>
                  <div style={{ fontSize: 13 }}>Click to upload company logo</div>
                  <div style={{
                    fontSize: 11,
                    color: isDark() ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
                    marginTop: 4,
                  }}>
                    PNG, JPG (max 2MB)
                  </div>
                </div>
              )}
            </label>
          </div>
        </div>

        {/* Company Info */}
        <div>
          <div style={{
            fontSize: 16,
            fontWeight: 600,
            marginBottom: 12,
          }}>
            Company Information
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                Company Name
              </label>
              <input
                type="text"
                value={config.companyName || ''}
                onChange={(e) => {
                  const newConfig = { ...config, companyName: e.target.value };
                  setConfig(newConfig);
                  onConfigChange?.(newConfig);
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: isDark() ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)',
                  border: `1px solid ${isDark() ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                  borderRadius: 6,
                  color: isDark() ? '#fff' : '#000',
                  fontSize: 13,
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                Website URL
              </label>
              <input
                type="text"
                value={config.companyUrl || ''}
                onChange={(e) => {
                  const newConfig = { ...config, companyUrl: e.target.value };
                  setConfig(newConfig);
                  onConfigChange?.(newConfig);
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: isDark() ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)',
                  border: `1px solid ${isDark() ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                  borderRadius: 6,
                  color: isDark() ? '#fff' : '#000',
                  fontSize: 13,
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
        </div>

        {/* Color Palette */}
        <div>
          <div style={{
            fontSize: 16,
            fontWeight: 600,
            marginBottom: 12,
          }}>
            Color Palette
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: 16,
          }}>
            {colorKeys.map(({ key, label }) => (
              <div key={key}>
                <label style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 600,
                  marginBottom: 6,
                }}>
                  {label}
                </label>
                <div style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                }}>
                  <input
                    type="color"
                    value={config.colors[key]}
                    onChange={(e) => handleColorChange(key, e.target.value)}
                    style={{
                      width: 40,
                      height: 40,
                      border: 'none',
                      borderRadius: 6,
                      cursor: 'pointer',
                    }}
                  />
                  <input
                    type="text"
                    value={config.colors[key]}
                    onChange={(e) => handleColorChange(key, e.target.value)}
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      background: isDark() ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)',
                      border: `1px solid ${isDark() ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                      borderRadius: 4,
                      color: isDark() ? '#fff' : '#000',
                      fontSize: 11,
                      fontFamily: 'monospace',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Typography */}
        <div>
          <div style={{
            fontSize: 16,
            fontWeight: 600,
            marginBottom: 12,
          }}>
            Typography
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                Font Family
              </label>
              <select
                value={config.fontFamily}
                onChange={(e) => handleFontFamilyChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: isDark() ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)',
                  border: `1px solid ${isDark() ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                  borderRadius: 6,
                  color: isDark() ? '#fff' : '#000',
                  fontSize: 13,
                  boxSizing: 'border-box',
                }}
              >
                {fontFamilyOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Border Radius */}
        <div>
          <div style={{
            fontSize: 16,
            fontWeight: 600,
            marginBottom: 12,
          }}>
            Design System
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
              Border Radius: {config.borderRadius}px
            </label>
            <input
              type="range"
              min="0"
              max="24"
              value={config.borderRadius}
              onChange={(e) => handleBorderRadiusChange(Number(e.target.value))}
              style={{ width: '100%', cursor: 'pointer' }}
            />
            <div style={{
              marginTop: 12,
              display: 'flex',
              gap: 8,
            }}>
              {[0, 4, 8, 12, 16, 24].map(radius => (
                <div
                  key={radius}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: radius,
                    background: config.colors.primary,
                    opacity: config.borderRadius === radius ? 1 : 0.5,
                    cursor: 'pointer',
                    transition: 'all 200ms ease-out',
                  }}
                  onClick={() => handleBorderRadiusChange(radius)}
                  title={`${radius}px`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Preview */}
        <div>
          <div style={{
            fontSize: 16,
            fontWeight: 600,
            marginBottom: 12,
          }}>
            Preview
          </div>
          <div style={{
            padding: 24,
            background: config.colors.background,
            color: config.colors.text,
            borderRadius: config.borderRadius,
            border: `1px solid ${isDark() ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
            fontFamily: config.fontFamily,
          }}>
            <h3 style={{
              fontSize: 20,
              fontWeight: 600,
              color: config.colors.primary,
              marginBottom: 8,
            }}>
              {config.companyName || 'Your Company'}
            </h3>
            <p style={{ marginBottom: 12 }}>
              Preview of your brand colors and typography
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{
                padding: '8px 16px',
                background: config.colors.primary,
                color: '#fff',
                border: 'none',
                borderRadius: config.borderRadius,
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 13,
              }}>
                Primary Button
              </button>
              <button style={{
                padding: '8px 16px',
                background: config.colors.secondary,
                color: '#fff',
                border: 'none',
                borderRadius: config.borderRadius,
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 13,
              }}>
                Secondary Button
              </button>
              <button style={{
                padding: '8px 16px',
                background: config.colors.accent,
                color: '#fff',
                border: 'none',
                borderRadius: config.borderRadius,
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 13,
              }}>
                Accent Button
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
