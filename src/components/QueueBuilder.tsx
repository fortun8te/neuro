/**
 * Queue builder component for creating and editing queues
 */

import React, { useState } from 'react';
import { PromptQueue, QueuedPromptItem } from '../types/queuedPrompt';
import QueueItemEditor from './QueueItemEditor';

interface QueueBuilderProps {
  queue: PromptQueue;
  onUpdate: (queue: PromptQueue) => Promise<void>;
  onAddItems: (queueId: string, items: Partial<QueuedPromptItem>[]) => Promise<void>;
  onRemoveItem: (queueId: string, itemId: string) => Promise<void>;
  onReorder: (queueId: string, itemIds: string[]) => Promise<void>;
}

export default function QueueBuilder({
  queue,
  onUpdate,
  onAddItems,
  onRemoveItem,
  onReorder,
}: QueueBuilderProps) {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);

  const handleAddItem = async () => {
    const newItem: Partial<QueuedPromptItem> = {
      prompt: '',
      model: 'qwen3.5:4b',
      temperature: 0.7,
      maxTokens: 2000,
    };

    await onAddItems(queue.id, [newItem]);
  };

  const handleUpdateQueue = async () => {
    await onUpdate(queue);
  };

  const handleDragStart = (itemId: string) => {
    setDraggedItemId(itemId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (targetItemId: string) => {
    if (!draggedItemId || draggedItemId === targetItemId) return;

    const draggedIndex = queue.items.findIndex((i) => i.id === draggedItemId);
    const targetIndex = queue.items.findIndex((i) => i.id === targetItemId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newOrder = [...queue.items];
    [newOrder[draggedIndex], newOrder[targetIndex]] = [
      newOrder[targetIndex],
      newOrder[draggedIndex],
    ];

    await onReorder(queue.id, newOrder.map((i) => i.id));
    setDraggedItemId(null);
  };

  return (
    <div className="h-full flex flex-col p-4 gap-4">
      {/* Queue settings */}
      <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
        <h3 className="text-lg font-semibold mb-3">Queue Settings</h3>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Parallel Limit</label>
            <input
              type="number"
              min="1"
              max="10"
              value={queue.parallelExecutionLimit}
              onChange={(e) => {
                queue.parallelExecutionLimit = parseInt(e.target.value, 10);
                handleUpdateQueue();
              }}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Retry on Failure</label>
            <input
              type="number"
              min="0"
              max="5"
              value={queue.retryOnFailure}
              onChange={(e) => {
                queue.retryOnFailure = parseInt(e.target.value, 10);
                handleUpdateQueue();
              }}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={queue.stopOnError}
                onChange={(e) => {
                  queue.stopOnError = e.target.checked;
                  handleUpdateQueue();
                }}
                className="w-4 h-4"
              />
              <span className="text-gray-400">Stop on Error</span>
            </label>
          </div>
        </div>
      </div>

      {/* Queue preview */}
      <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Queue Items ({queue.items.length})</h3>
          <button
            onClick={handleAddItem}
            className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium"
          >
            Add Item
          </button>
        </div>

        {/* Items list */}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {queue.items.map((item, idx) => (
            <div
              key={item.id}
              draggable
              onDragStart={() => handleDragStart(item.id)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(item.id)}
              className={`p-3 bg-gray-700 border border-gray-600 rounded-lg cursor-move transition ${
                draggedItemId === item.id ? 'opacity-50 bg-gray-600' : 'hover:bg-gray-650'
              }`}
            >
              <div
                className="flex items-start justify-between gap-2"
                onClick={() => setExpandedItemId(expandedItemId === item.id ? null : item.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 font-mono">#{idx + 1}</span>
                    <span className="text-xs px-2 py-1 bg-gray-600 rounded text-gray-300">
                      {item.status}
                    </span>
                    {item.label && <span className="text-sm font-medium">{item.label}</span>}
                  </div>

                  {!expandedItemId || expandedItemId !== item.id ? (
                    <p className="text-sm text-gray-400 mt-1 truncate">
                      {item.prompt.substring(0, 80)}...
                    </p>
                  ) : (
                    <p className="text-sm text-gray-400 mt-1 line-clamp-3">
                      {item.prompt}
                    </p>
                  )}
                </div>

                <div className="flex gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingItemId(editingItemId === item.id ? null : item.id);
                    }}
                    className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded"
                  >
                    Edit
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveItem(queue.id, item.id);
                    }}
                    className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 rounded"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Item editor */}
              {editingItemId === item.id && (
                <div className="mt-3 pt-3 border-t border-gray-600">
                  <QueueItemEditor
                    item={item}
                    queue={queue}
                    onChange={(updated) => {
                      Object.assign(item, updated);
                      handleUpdateQueue();
                    }}
                    onClose={() => setEditingItemId(null)}
                  />
                </div>
              )}
            </div>
          ))}

          {queue.items.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>No items in queue</p>
              <button
                onClick={handleAddItem}
                className="mt-2 text-blue-400 hover:text-blue-300"
              >
                Add one
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Configuration preview */}
      <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 text-sm">
        <h4 className="font-semibold mb-2">Configuration</h4>
        <ul className="text-gray-400 space-y-1">
          <li>Schedule: {queue.schedule.type}</li>
          <li>Parallel Limit: {queue.parallelExecutionLimit}</li>
          <li>Retry on Failure: {queue.retryOnFailure}x</li>
          <li>Stop on Error: {queue.stopOnError ? 'Yes' : 'No'}</li>
        </ul>
      </div>
    </div>
  );
}
