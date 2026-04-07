/**
 * Main panel for queued prompts management
 */

import React, { useState } from 'react';
import { PromptQueue, QueuedPromptItem } from '../types/queuedPrompt';
import { useQueuedPrompts } from '../hooks/useQueuedPrompts';
import QueueBuilder from './QueueBuilder';
import QueueExecutor from './QueueExecutor';
import QueueHistory from './QueueHistory';
import TemplateManager from './TemplateManager';

type TabType = 'builder' | 'history' | 'templates' | 'execute';

export default function QueuedPromptsPanel() {
  const [activeTab, setActiveTab] = useState<TabType>('builder');
  const {
    queues,
    selectedQueue,
    selectedQueueId,
    templates,
    createQueue,
    updateQueue,
    deleteQueue,
    cloneQueue,
    addItemsToQueue,
    removeQueueItem,
    reorderQueue,
    executeQueue,
    cancelQueue,
    setSelectedQueueId,
    saveTemplate,
    deleteTemplate,
  } = useQueuedPrompts();

  const handleCreateQueue = async () => {
    const name = prompt('Enter queue name:');
    if (name) {
      const queue = await createQueue(name);
      setSelectedQueueId(queue.id);
      setActiveTab('builder');
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white">
      {/* Header */}
      <div className="border-b border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Queued Prompts</h1>
          <button
            onClick={handleCreateQueue}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition"
          >
            New Queue
          </button>
        </div>

        {/* Queue selector */}
        <div className="flex items-center gap-2">
          <select
            value={selectedQueueId || ''}
            onChange={(e) => setSelectedQueueId(e.target.value || null)}
            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white"
          >
            <option value="">Select a queue...</option>
            {queues.map((queue) => (
              <option key={queue.id} value={queue.id}>
                {queue.name} ({queue.items.length} items) — {queue.status}
              </option>
            ))}
          </select>

          {selectedQueue && (
            <div className="flex gap-2">
              <button
                onClick={() => cloneQueue(selectedQueue.id)}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
                title="Clone queue"
              >
                Clone
              </button>
              <button
                onClick={() => setActiveTab('execute')}
                className="px-3 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm"
                title="Execute queue"
              >
                Execute
              </button>
              <button
                onClick={() => {
                  if (confirm('Delete this queue?')) {
                    deleteQueue(selectedQueue.id);
                  }
                }}
                className="px-3 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm"
                title="Delete queue"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex border-b border-gray-700 bg-gray-800">
        {(['builder', 'execute', 'history', 'templates'] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 font-medium capitalize transition ${
              activeTab === tab
                ? 'border-b-2 border-blue-500 text-blue-400'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'builder' && selectedQueue && (
          <QueueBuilder
            queue={selectedQueue}
            onUpdate={updateQueue}
            onAddItems={addItemsToQueue}
            onRemoveItem={removeQueueItem}
            onReorder={reorderQueue}
          />
        )}

        {activeTab === 'execute' && selectedQueue && (
          <QueueExecutor
            queue={selectedQueue}
            onExecute={executeQueue}
            onCancel={cancelQueue}
            onUpdateQueue={updateQueue}
          />
        )}

        {activeTab === 'history' && (
          <QueueHistory queues={queues} />
        )}

        {activeTab === 'templates' && (
          <TemplateManager
            templates={templates}
            onSaveTemplate={saveTemplate}
            onDeleteTemplate={deleteTemplate}
          />
        )}

        {!selectedQueue && activeTab === 'builder' && (
          <div className="flex items-center justify-center h-full text-gray-400">
            <p>Select or create a queue to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}
