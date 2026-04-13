/**
 * TemplateSelector Component
 * Displays available research templates and allows selection
 */

import { useState } from 'react';
import { useResearchTemplate } from '../hooks/useResearchTemplate';
import type { ResearchTemplate } from '../types/template';

interface TemplateSelectorProps {
  isDarkMode: boolean;
  onSelectTemplate: (template: ResearchTemplate) => void;
  onDismiss: () => void;
}

export function TemplateSelector({ isDarkMode, onSelectTemplate, onDismiss }: TemplateSelectorProps) {
  const { getAvailableTemplates, loadTemplate } = useResearchTemplate();
  const templateMetadata = getAvailableTemplates();
  const [searchQuery, setSearchQuery] = useState('');

  // Filter templates by search query
  const filteredMetadata = templateMetadata.filter((t) => {
    const query = searchQuery.toLowerCase();
    return (
      t.name.toLowerCase().includes(query) ||
      t.description.toLowerCase().includes(query) ||
      (t.targetAudience?.toLowerCase().includes(query))
    );
  });

  // Load full templates for selected items
  const filteredTemplates = filteredMetadata
    .map((meta) => loadTemplate(meta.id))
    .filter((t): t is ResearchTemplate => t !== null);

  return (
    <div className={`fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50`}>
      <div className={`rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col ${
        isDarkMode ? 'bg-zinc-900' : 'bg-white'
      }`}>
        {/* Header */}
        <div className={`px-6 py-4 border-b flex items-center justify-between ${
          isDarkMode ? 'border-white/[0.1]' : 'border-black/[0.1]'
        }`}>
          <div>
            <h2 className="text-lg font-semibold">Research Templates</h2>
            <p className={`text-xs mt-1 ${isDarkMode ? 'text-white/[0.5]' : 'text-black/[0.5]'}`}>
              Pre-configured research strategies for different industries
            </p>
          </div>
          <button
            onClick={onDismiss}
            className={`text-xl leading-none px-3 py-1 rounded hover:bg-white/[0.1] transition ${
              isDarkMode ? 'text-white/[0.6] hover:text-white' : 'text-black/[0.6] hover:text-black'
            }`}
          >
            ×
          </button>
        </div>

        {/* Search */}
        <div className={`px-6 py-3 border-b ${isDarkMode ? 'border-white/[0.05] bg-zinc-800/30' : 'border-black/[0.05] bg-gray-50'}`}>
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full px-3 py-2 rounded text-sm ${
              isDarkMode
                ? 'bg-white/[0.05] border border-white/[0.1] text-white placeholder-white/[0.4]'
                : 'bg-white border border-black/[0.1] text-black placeholder-black/[0.4]'
            }`}
          />
        </div>

        {/* Templates Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredTemplates.length === 0 ? (
            <div className={`text-center py-12 ${isDarkMode ? 'text-white/[0.4]' : 'text-black/[0.4]'}`}>
              <p className="text-sm">No templates match your search</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  isDarkMode={isDarkMode}
                  onSelect={() => onSelectTemplate(template)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Individual template card
 */
function TemplateCard({
  template,
  isDarkMode,
  onSelect,
}: {
  template: ResearchTemplate & { id: string };
  isDarkMode: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`p-4 rounded-lg border-2 transition text-left hover:shadow-md ${
        isDarkMode
          ? 'bg-zinc-800 border-white/[0.1] hover:border-white/[0.2] hover:bg-zinc-700'
          : 'bg-white border-black/[0.1] hover:border-black/[0.2] hover:bg-gray-50'
      }`}
    >
      {/* Icon & Name */}
      <div className="flex items-start gap-3 mb-2">
        <span className="text-2xl flex-shrink-0">{template.icon || '📋'}</span>
        <div>
          <h3 className="font-semibold text-sm">{template.name}</h3>
          <p className={`text-xs mt-1 ${isDarkMode ? 'text-white/[0.5]' : 'text-black/[0.5]'}`}>
            {template.targetAudience}
          </p>
        </div>
      </div>

      {/* Description */}
      <p className={`text-xs mb-3 leading-relaxed ${isDarkMode ? 'text-white/[0.6]' : 'text-black/[0.6]'}`}>
        {template.description}
      </p>

      {/* Sections Preview */}
      <div className="mb-3">
        <p className={`text-[10px] uppercase font-semibold tracking-wider mb-1 ${
          isDarkMode ? 'text-white/[0.4]' : 'text-black/[0.4]'
        }`}>
          Research Sections
        </p>
        <div className="flex flex-wrap gap-1">
          {template.sections.slice(0, 3).map((s) => (
            <span
              key={s.sectionId}
              className={`inline-block px-2 py-1 text-[10px] rounded ${
                isDarkMode
                  ? 'bg-white/[0.08] text-white/[0.7]'
                  : 'bg-black/[0.08] text-black/[0.7]'
              }`}
            >
              {s.title.split(' ').slice(0, 2).join(' ')}
            </span>
          ))}
          {template.sections.length > 3 && (
            <span className={`text-[10px] ${isDarkMode ? 'text-white/[0.4]' : 'text-black/[0.4]'}`}>
              +{template.sections.length - 3}
            </span>
          )}
        </div>
      </div>

      {/* Meta Info */}
      <div className="flex items-center justify-between text-xs">
        <span className={`${isDarkMode ? 'text-white/[0.5]' : 'text-black/[0.5]'}`}>
          {template.estimatedTotalTime} min
        </span>
        {template.suggestedPreset && (
          <span className={`px-2 py-1 rounded font-mono text-[10px] ${
            isDarkMode
              ? 'bg-blue-500/20 text-blue-300'
              : 'bg-blue-100 text-blue-700'
          }`}>
            {template.suggestedPreset}
          </span>
        )}
      </div>
    </button>
  );
}
