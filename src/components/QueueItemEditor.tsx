/**
 * Editor component for individual queue items
 */

import React, { useState } from 'react';
import { PromptQueue, QueuedPromptItem } from '../types/queuedPrompt';

interface QueueItemEditorProps {
  item: QueuedPromptItem;
  queue: PromptQueue;
  onChange: (updated: Partial<QueuedPromptItem>) => void;
  onClose: () => void;
}

export default function QueueItemEditor({
  item,
  queue,
  onChange,
  onClose,
}: QueueItemEditorProps) {
  const [formData, setFormData] = useState({
    label: item.label || '',
    prompt: item.prompt,
    model: item.model,
    temperature: item.temperature ?? 0.7,
    maxTokens: item.maxTokens ?? 2000,
    timeout: item.timeout ?? 120000,
    delayMs: item.delayMs ?? 0,
    systemMessage: item.systemMessage || '',
    dependsOnIds: item.dependsOnIds?.join(', ') || '',
  });

  const handleChange = (field: string, value: unknown) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = () => {
    onChange({
      label: formData.label,
      prompt: formData.prompt,
      model: formData.model,
      temperature: parseFloat(String(formData.temperature)),
      maxTokens: parseInt(String(formData.maxTokens), 10),
      timeout: parseInt(String(formData.timeout), 10),
      delayMs: parseInt(String(formData.delayMs), 10),
      systemMessage: formData.systemMessage,
      dependsOnIds: formData.dependsOnIds
        ? formData.dependsOnIds.split(',').map((s) => s.trim())
        : undefined,
    });
    onClose();
  };

  return (
    <div className="space-y-3">
      {/* Label */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">Label (optional)</label>
        <input
          type="text"
          value={formData.label}
          onChange={(e) => handleChange('label', e.target.value)}
          placeholder="e.g., Research phase"
          className="w-full px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-sm"
        />
      </div>

      {/* Prompt */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">Prompt</label>
        <textarea
          value={formData.prompt}
          onChange={(e) => handleChange('prompt', e.target.value)}
          className="w-full px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-sm font-mono resize-none"
          rows={4}
        />
        <p className="text-xs text-gray-500 mt-1">
          Reference previous outputs with {'{output_0}'}, {'{output_1}'}, etc.
        </p>
      </div>

      {/* Model & Configuration */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Model</label>
          <select
            value={formData.model}
            onChange={(e) => handleChange('model', e.target.value)}
            className="w-full px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-sm"
          >
            <option>qwen3.5:0.8b</option>
            <option>qwen3.5:2b</option>
            <option>qwen3.5:4b</option>
            <option>qwen3.5:9b</option>
            <option>qwen3.5:27b</option>
            <option>gpt-oss-20b</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Temperature</label>
          <input
            type="number"
            min="0"
            max="2"
            step="0.1"
            value={formData.temperature}
            onChange={(e) => handleChange('temperature', e.target.value)}
            className="w-full px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-sm"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Max Tokens</label>
          <input
            type="number"
            min="100"
            max="8000"
            step="100"
            value={formData.maxTokens}
            onChange={(e) => handleChange('maxTokens', e.target.value)}
            className="w-full px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-sm"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Timeout (ms)</label>
          <input
            type="number"
            min="1000"
            step="1000"
            value={formData.timeout}
            onChange={(e) => handleChange('timeout', e.target.value)}
            className="w-full px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-sm"
          />
        </div>
      </div>

      {/* Advanced options */}
      <details className="text-sm">
        <summary className="text-gray-400 cursor-pointer hover:text-gray-300">
          Advanced Options
        </summary>

        <div className="mt-2 space-y-2">
          <div>
            <label className="block text-xs text-gray-400 mb-1">System Message</label>
            <textarea
              value={formData.systemMessage}
              onChange={(e) => handleChange('systemMessage', e.target.value)}
              className="w-full px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-sm font-mono resize-none"
              rows={2}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Delay Before (ms)
            </label>
            <input
              type="number"
              min="0"
              step="100"
              value={formData.delayMs}
              onChange={(e) => handleChange('delayMs', e.target.value)}
              className="w-full px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Depends on (comma-separated item IDs)
            </label>
            <input
              type="text"
              value={formData.dependsOnIds}
              onChange={(e) => handleChange('dependsOnIds', e.target.value)}
              placeholder="item_1, item_2"
              className="w-full px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-sm font-mono"
            />
          </div>
        </div>
      </details>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          className="flex-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium"
        >
          Save
        </button>
        <button
          onClick={onClose}
          className="flex-1 px-3 py-1 bg-gray-600 hover:bg-gray-700 rounded text-sm font-medium"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
