import { useState, useRef, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { ollamaService } from '../utils/ollama';

interface ChatMessage {
  type: 'ai' | 'user';
  content: string;
}

interface FormDataFromChat {
  brandName?: string;
  website?: string;
  industry?: string;
  positioning?: string;
  personaName?: string;
  age?: string;
  painPoints?: string;
  productName?: string;
  productCategory?: string;
  problemSolved?: string;
  pricing?: string;
  primaryPlatforms?: string;
  marketingGoal?: string;
  marketingBudget?: string;
}

interface QuickChatBuilderProps {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  onComplete: (formData: FormDataFromChat) => void;
}

const SYSTEM_PROMPT = `You are a research strategist using the Zakaria Framework. Your job is to systematically understand EXACTLY why people buy, using a 4-layer research system. You ask ONE question at a time, progressively deeper, building a complete understanding.

ZAKARIA 4-LAYER SYSTEM:

LAYER 1: AVATAR RESEARCH (Understand the person)
Questions to uncover:
- Current situation (What's their life like RIGHT NOW? What pain points exist daily?)
- Desired situation (What do they WANT to achieve/become?)
- Day-to-day struggles (What frustrates them most?)
- Previous attempts (What have they tried to solve this? Why didn't it work?)
- Their attitude/personality (How do they view the world?)
- Content consumption (What do they read/watch/follow?)
- Exactly what they care about most

LAYER 2: PROBLEM RESEARCH (Understand the mechanism)
Questions to uncover:
- Root cause analysis (Why does the problem exist? Scientific explanation?)
- How the problem develops (Is it gradual or sudden?)
- Why it persists (What makes it hard to fix?)
- Authority/expert explanation (What would a doctor/expert say?)
- Medical/technical understanding (The mechanism behind the problem)

LAYER 3: SOLUTION RESEARCH (Understand why solutions work)
Questions to uncover:
- How does the solution work? (Specific mechanism)
- Why it addresses the root cause (Not just symptoms)
- Why it's different from failed attempts
- Logical pathway from solution → result
- What makes this solution work when others failed

LAYER 4: PRODUCT RESEARCH (Map specific features to deep desires)
Questions to uncover:
- What features does the product have?
- Which feature solves which pain point?
- What's the DEEPEST desire this satisfies?
- Why does this specific feature matter most?

DEEP DESIRE MAPPING PRINCIPLE:
Surface problem ≠ Real desire

Example: "Stop hair loss" (surface) → "Confidence/Attractiveness/Dating success" (deep)
Example: "Better air quality" (surface) → "Be a good mother/Protect kids/Peace of mind" (deep)

YOUR CONVERSATION FLOW:
1. Start by understanding their CURRENT SITUATION (pain/problems)
2. Ask about DESIRED SITUATION (what they want instead)
3. Probe MAGNITUDE OF DESIRE (How much do they want this? Scale of 1-10?)
4. Explore PREVIOUS ATTEMPTS (What have they tried? Why didn't it work?)
5. Dig into ROOT CAUSE (Why does the problem exist at the biological/mechanical level?)
6. Understand the SOLUTION MECHANISM (How would solving the root cause help?)
7. Map FEATURES TO DESIRES (Not "this product has X" but "this feature gives you Y which makes you feel Z")
8. Identify OBJECTIONS (What doubts prevent them from buying? Handle each one)
9. Uncover DEEP DESIRE (What identity/status/transformation are they really after?)

CRITICAL PRINCIPLE: People don't buy products. They buy fulfillment of desires.

TONE:
- Curious, not pushy
- Dig deeper on vague answers ("better quality" → "what specifically? Better in what way?")
- Make them articulate WHY things matter
- Connect their answers to deeper psychological needs
- Be conversational but probing

RULES:
1. ONE question at a time
2. Never accept surface answers — always dig 2-3 levels deeper
3. Each answer reveals what to ask next
4. NEVER say "I have enough info" — the user decides when to stop
5. Extract exact language they use (buzzwords, pain descriptors)
6. Always look for the emotional/identity component behind the surface problem

REMEMBER: Understanding WHY people buy = ability to sell ANY product to the right person`;

const EXTRACTION_PROMPT = `You are a data extraction tool. Read the conversation below and extract ALL campaign information into a JSON object.

CONVERSATION:
{CONVERSATION}

Extract into this exact JSON format (use empty string "" for anything not mentioned):
{"brandName":"","productName":"","industry":"","positioning":"","personaName":"","age":"","painPoints":"","productCategory":"","problemSolved":"","pricing":"","primaryPlatforms":"","marketingGoal":"","marketingBudget":"","website":""}

Rules:
- Extract ONLY what was explicitly stated or strongly implied
- For personaName, create a short persona description from what was discussed
- For painPoints, combine all mentioned pain points
- For positioning, synthesize from the conversation
- Output ONLY the JSON object, nothing else`;

export function QuickChatBuilder({ messages, setMessages, onComplete }: QuickChatBuilderProps) {
  const { isDarkMode } = useTheme();
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [formData, setFormData] = useState<FormDataFromChat>({});
  const [showForm, setShowForm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messageQueueRef = useRef<string[]>([]);

  // Count user messages to know when to show Build button
  const userMessageCount = messages.filter((m) => m.type === 'user').length;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleSendMessage = async () => {
    if (!userInput.trim()) return;

    // If already loading, queue the message
    if (isLoading) {
      messageQueueRef.current.push(userInput);
      setUserInput('');
      return;
    }

    const newMessages = [
      ...messages,
      { type: 'user' as const, content: userInput },
    ];
    setMessages(newMessages);
    setUserInput('');
    setIsLoading(true);

    try {
      const conversationContext = newMessages
        .map((m) => `${m.type === 'user' ? 'User' : 'AI'}: ${m.content}`)
        .join('\n\n');

      const prompt = `${conversationContext}\n\nNow respond as the strategist. Acknowledge briefly, then ask ONE deeper question. Never suggest you have enough info.`;

      // Add empty AI message for streaming
      setMessages((prev) => [
        ...prev,
        { type: 'ai' as const, content: '' },
      ]);

      let aiResponse = '';
      abortControllerRef.current = new AbortController();

      await ollamaService.generateStream(
        prompt,
        SYSTEM_PROMPT,
        {
          model: 'gpt-oss:20b',
          temperature: 0.9,
          onChunk: (chunk) => {
            aiResponse += chunk;
            // Strip any JSON or READY_TO_BUILD the model might hallucinate
            const cleanDisplay = aiResponse
              .replace(/READY_TO_BUILD/gi, '')
              .replace(/```json[\s\S]*?```/g, '')
              .replace(/\{[^{}]*"brandName"[^{}]*\}/g, '')
              .trim();
            setMessages((prev) => {
              const updated = [...prev];
              const lastIdx = updated.length - 1;
              if (updated[lastIdx]?.type === 'ai') {
                updated[lastIdx] = { type: 'ai' as const, content: cleanDisplay };
              }
              return updated;
            });
          },
          signal: abortControllerRef.current.signal,
        }
      );

      setIsLoading(false);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to generate';
      console.error('QuickChat error:', error);

      setMessages((prev) => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (updated[lastIdx]?.type === 'ai') {
          updated[lastIdx] = {
            type: 'ai' as const,
            content: `Error: ${errorMsg}`,
          };
        }
        return updated;
      });
      setIsLoading(false);
    }
  };

  // Process queued messages after AI generation completes
  useEffect(() => {
    if (!isLoading && messageQueueRef.current.length > 0) {
      const nextMessage = messageQueueRef.current.shift();
      if (nextMessage) {
        setUserInput(nextMessage);
        // Delay to ensure state is updated
        const timer = setTimeout(() => {
          setUserInput((current) => {
            if (current.trim()) {
              // Trigger send by updating a dummy dependency
              handleSendMessage();
            }
            return current;
          });
        }, 50);
        return () => clearTimeout(timer);
      }
    }
  }, [isLoading]);

  const handleBuildCampaign = async () => {
    setIsExtracting(true);

    try {
      const conversationContext = messages
        .map((m) => `${m.type === 'user' ? 'User' : 'AI'}: ${m.content}`)
        .join('\n\n');

      const prompt = EXTRACTION_PROMPT.replace('{CONVERSATION}', conversationContext);

      let extractionResponse = '';
      abortControllerRef.current = new AbortController();

      await ollamaService.generateStream(
        prompt,
        'You are a JSON extraction tool. Output ONLY valid JSON.',
        {
          model: 'gpt-oss:20b',
          temperature: 0.9,
          onChunk: (chunk) => {
            extractionResponse += chunk;
          },
          signal: abortControllerRef.current.signal,
        }
      );

      // Parse the extracted JSON
      const jsonMatch = extractionResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const extracted = JSON.parse(jsonMatch[0]);
        setFormData(extracted);
        setShowForm(true);
      } else {
        console.error('No JSON found in extraction response');
        // Fallback: show empty form
        setFormData({});
        setShowForm(true);
      }
    } catch (error) {
      console.error('Extraction error:', error);
      // Show form anyway so user can fill manually
      setFormData({});
      setShowForm(true);
    }

    setIsExtracting(false);
  };

  const handleCancel = () => {
    abortControllerRef.current?.abort();
    setIsLoading(false);
    setIsExtracting(false);
  };

  const handleEditField = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleBackToChat = () => {
    setShowForm(false);
    setFormData({});
  };

  const handleStartCampaign = () => {
    if (!formData.brandName && !formData.productName) return;
    onComplete(formData);
  };

  const borderClass = isDarkMode ? 'border-zinc-800' : 'border-zinc-200';
  const secondaryText = isDarkMode ? 'text-zinc-500' : 'text-zinc-400';

  return (
    <div className="flex flex-col h-[500px]">
      {/* Messages */}
      <div className={`flex-1 overflow-y-auto border ${borderClass} p-4 space-y-4`}>
        {messages.length === 0 && (
          <p className={`font-mono text-xs ${secondaryText} text-center pt-8`}>
            Describe your brand or product to get started.
          </p>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] ${msg.type === 'user' ? 'text-right' : 'text-left'}`}>
              <span className={`font-mono text-[10px] uppercase tracking-widest ${secondaryText} block mb-1`}>
                {msg.type === 'user' ? 'You' : 'Agent'}
              </span>
              <div className={`font-mono text-xs leading-relaxed whitespace-pre-wrap ${
                msg.type === 'user'
                  ? isDarkMode ? 'text-white' : 'text-black'
                  : isDarkMode ? 'text-zinc-300' : 'text-zinc-700'
              }`}>
                {msg.content || (
                  <span className={`${secondaryText} animate-pulse`}>...</span>
                )}
              </div>
            </div>
          </div>
        ))}

        {isExtracting && (
          <div className="flex justify-start">
            <div className="text-left">
              <span className={`font-mono text-[10px] uppercase tracking-widest ${secondaryText} block mb-1`}>
                System
              </span>
              <div className={`font-mono text-xs ${secondaryText} animate-pulse`}>
                Extracting campaign data from conversation...
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Form Preview */}
      {showForm && (
        <div className={`border ${borderClass} p-4 space-y-2 max-h-52 overflow-y-auto`}>
          <div className="flex items-center justify-between">
            <span className={`font-mono text-[10px] uppercase tracking-widest ${secondaryText}`}>Review & Edit</span>
            <button
              onClick={handleBackToChat}
              className={`font-mono text-[10px] uppercase tracking-widest ${
                isDarkMode ? 'text-zinc-500 hover:text-zinc-300' : 'text-zinc-400 hover:text-zinc-600'
              } transition-colors`}
            >
              ← Back to chat
            </button>
          </div>
          {[
            { key: 'brandName', label: 'Brand' },
            { key: 'industry', label: 'Industry' },
            { key: 'productName', label: 'Product' },
            { key: 'productCategory', label: 'Category' },
            { key: 'positioning', label: 'Positioning' },
            { key: 'personaName', label: 'Persona' },
            { key: 'age', label: 'Age' },
            { key: 'painPoints', label: 'Pain Points' },
            { key: 'problemSolved', label: 'Problem' },
            { key: 'pricing', label: 'Price' },
            { key: 'primaryPlatforms', label: 'Platforms' },
            { key: 'marketingGoal', label: 'Goal' },
            { key: 'marketingBudget', label: 'Budget' },
            { key: 'website', label: 'Website' },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2">
              <span className={`font-mono text-[10px] uppercase tracking-widest w-24 shrink-0 ${secondaryText}`}>{label}</span>
              <input
                className={`flex-1 font-mono text-xs px-2 py-1 border ${borderClass} bg-transparent outline-none focus:border-white transition-colors ${
                  isDarkMode ? 'text-white' : 'text-black'
                }`}
                value={formData[key as keyof FormDataFromChat] || ''}
                onChange={(e) => handleEditField(key, e.target.value)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Input Area */}
      {!showForm ? (
        <div className="flex flex-col">
          {/* Build Campaign button - appears after 3+ user messages */}
          {userMessageCount >= 3 && !isLoading && !isExtracting && (
            <button
              onClick={handleBuildCampaign}
              className={`w-full py-2 font-mono text-[10px] uppercase tracking-widest border-x border-t ${borderClass} ${
                isDarkMode
                  ? 'text-emerald-400 hover:bg-emerald-950/30 hover:text-emerald-300'
                  : 'text-emerald-600 hover:bg-emerald-50'
              } transition-colors`}
            >
              ✓ I'm done — Build Campaign
            </button>
          )}
          <div className={`flex border ${borderClass} ${userMessageCount >= 3 && !isLoading && !isExtracting ? 'border-t-0' : ''}`}>
            <input
              ref={inputRef}
              className={`flex-1 font-mono text-xs px-4 py-3 bg-transparent outline-none ${
                isDarkMode ? 'text-white placeholder-zinc-600' : 'text-black placeholder-zinc-400'
              } ${isExtracting ? 'opacity-50' : ''}`}
              placeholder={isExtracting ? 'Extracting...' : 'Tell me about your brand...'}
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              disabled={isExtracting}
            />
            {isExtracting ? (
              <button
                onClick={handleCancel}
                className={`px-4 font-mono text-xs uppercase tracking-widest border-l ${borderClass} ${
                  isDarkMode ? 'text-red-400 hover:bg-red-950/30' : 'text-red-600 hover:bg-red-50'
                } transition-colors`}
              >
                Stop
              </button>
            ) : (
              <button
                onClick={handleSendMessage}
                disabled={!userInput.trim()}
                className={`px-4 font-mono text-xs uppercase tracking-widest border-l ${borderClass} ${
                  isDarkMode
                    ? 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                    : 'text-zinc-500 hover:text-black hover:bg-zinc-100'
                } transition-colors disabled:opacity-30`}
              >
                {isLoading ? 'Queue' : 'Send'}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex gap-0">
          <button
            onClick={handleStartCampaign}
            className={`flex-1 py-3 font-mono text-xs uppercase tracking-widest font-bold border ${
              isDarkMode
                ? 'border-white text-white hover:bg-white hover:text-black'
                : 'border-black text-black hover:bg-black hover:text-white'
            } transition-colors`}
          >
            Start Campaign
          </button>
        </div>
      )}
    </div>
  );
}
