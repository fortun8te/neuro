/**
 * Prompt template manager
 */

import React, { useState } from 'react';
import { PromptTemplate, PromptVariable } from '../types/queuedPrompt';

interface TemplateManagerProps {
  templates: PromptTemplate[];
  onSaveTemplate: (template: PromptTemplate) => Promise<void>;
  onDeleteTemplate: (templateId: string) => Promise<void>;
}

const TEMPLATE_CATEGORIES = ['research', 'creative', 'analysis', 'custom'] as const;

export default function TemplateManager({
  templates,
  onSaveTemplate,
  onDeleteTemplate,
}: TemplateManagerProps) {
  const [activeCategory, setActiveCategory] = useState<typeof TEMPLATE_CATEGORIES[number]>(
    'research',
  );
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);

  const [formData, setFormData] = useState<Partial<PromptTemplate>>({
    name: '',
    description: '',
    prompt: '',
    category: 'research',
    variables: [],
    tags: [],
    isPublic: false,
  });

  const categorizedTemplates = templates.filter((t) => t.category === activeCategory);

  const handleCreateTemplate = async () => {
    if (!formData.name || !formData.prompt) {
      alert('Name and prompt are required');
      return;
    }

    const template: PromptTemplate = {
      id: `template_${Date.now()}`,
      name: formData.name,
      description: formData.description || '',
      prompt: formData.prompt,
      category: formData.category || 'custom',
      variables: formData.variables || [],
      tags: formData.tags || [],
      isPublic: formData.isPublic || false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      usageCount: 0,
    };

    await onSaveTemplate(template);

    // Reset form
    setFormData({
      name: '',
      description: '',
      prompt: '',
      category: 'research',
      variables: [],
      tags: [],
      isPublic: false,
    });

    setShowNewForm(false);
  };

  return (
    <div className="h-full flex flex-col p-4 gap-4">
      {/* Category tabs */}
      <div className="flex gap-2 border-b border-gray-700 pb-3">
        {TEMPLATE_CATEGORIES.map((category) => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            className={`px-3 py-2 rounded-t-lg font-medium capitalize transition ${
              activeCategory === category
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* New template form */}
      {showNewForm && (
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
          <h3 className="text-lg font-semibold mb-4">Create New Template</h3>

          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Name</label>
              <input
                type="text"
                value={String(formData.name || '')}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Description</label>
              <textarea
                value={String(formData.description || '')}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white resize-none"
                rows={2}
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Prompt</label>
              <textarea
                value={String(formData.prompt || '')}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, prompt: e.target.value }))
                }
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white font-mono resize-none"
                rows={6}
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Tags</label>
              <input
                type="text"
                placeholder="comma-separated"
                value={Array.isArray(formData.tags) ? formData.tags.join(', ') : ''}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    tags: e.target.value.split(',').map((t) => t.trim()),
                  }))
                }
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              />
            </div>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isPublic || false}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, isPublic: e.target.checked }))
                }
              />
              <span className="text-sm text-gray-400">Public template</span>
            </label>

            <div className="flex gap-2">
              <button
                onClick={handleCreateTemplate}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium"
              >
                Create Template
              </button>
              <button
                onClick={() => setShowNewForm(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New template button */}
      {!showNewForm && (
        <button
          onClick={() => setShowNewForm(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium self-start"
        >
          New Template
        </button>
      )}

      {/* Templates list */}
      <div className="flex-1 overflow-auto">
        <div className="space-y-2">
          {categorizedTemplates.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p>No templates in this category</p>
            </div>
          ) : (
            categorizedTemplates.map((template) => (
              <div key={template.id} className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h4 className="font-semibold text-lg">{template.name}</h4>
                    <p className="text-sm text-gray-400">{template.description}</p>
                  </div>

                  <div className="flex gap-1">
                    <button
                      onClick={() => onDeleteTemplate(template.id)}
                      className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 rounded"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Tags */}
                {template.tags.length > 0 && (
                  <div className="flex gap-1 mb-2 flex-wrap">
                    {template.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs px-2 py-1 bg-gray-700 rounded text-gray-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Preview */}
                <div className="text-sm">
                  <div className="text-gray-400 mb-1">Prompt:</div>
                  <p className="font-mono text-xs bg-gray-700 p-2 rounded max-h-16 overflow-auto text-gray-300">
                    {template.prompt.substring(0, 200)}
                    {template.prompt.length > 200 && '...'}
                  </p>
                </div>

                {/* Metadata */}
                <div className="mt-2 text-xs text-gray-500">
                  <span>Created: {new Date(template.createdAt).toLocaleDateString()}</span>
                  {' • '}
                  <span>Uses: {template.usageCount}</span>
                  {template.isPublic && ' • Public'}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
