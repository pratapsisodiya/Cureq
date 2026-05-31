'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { MessageCircle, X, Send, Loader2, Bot, Zap, ChevronDown } from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
const EXCLUDED_PATHS = ['/display', '/checkin', '/queue', '/login'];

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolsUsed?: string[];
  timestamp: Date;
}

interface BotConfig {
  botName: string;
  greeting: string;
  primaryColor: string;
  isActive: boolean;
  widgetPosition: string;
  enableTriage: boolean;
  enableBooking: boolean;
  enableQueueStatus: boolean;
}

const TOOL_LABELS: Record<string, string> = {
  get_queue_status: 'Checked live queue',
  get_patient_token: 'Found your token',
  book_appointment: 'Booked appointment',
  cancel_appointment: 'Cancelled appointment',
  get_clinic_info: 'Fetched clinic info',
  get_available_slots: 'Checked available slots',
  get_prescription_history: 'Retrieved visit history',
  triage_symptoms: 'Assessed symptoms',
};

function resolveClinicId(): string | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem('cureq_clinic_id');
  if (stored) return stored;
  const params = new URLSearchParams(window.location.search);
  return params.get('clinicId');
}

function TypingIndicator({ color }: { color: string }) {
  return (
    <div className="flex items-end gap-2 mb-3">
      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: color }}>
        <Bot className="h-3.5 w-3.5 text-white" />
      </div>
      <div className="bg-white border border-[#e9e9e7] rounded-2xl rounded-bl-sm px-4 py-2.5 shadow-xs">
        <div className="flex gap-1 items-center h-4">
          {[0, 1, 2].map(i => (
            <span key={i} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: color, animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ChatWidget() {
  const pathname = usePathname();
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [config, setConfig] = useState<BotConfig | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [hasUnread, setHasUnread] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Resolve clinicId on mount
  useEffect(() => {
    setClinicId(resolveClinicId());
  }, []);

  // Restore session from sessionStorage
  useEffect(() => {
    const saved = sessionStorage.getItem('cureq_chat_session');
    if (saved) setSessionId(saved);
  }, []);

  // Fetch bot config
  useEffect(() => {
    if (!clinicId) return;
    fetch(`${BACKEND_URL}/api/chatbot/${clinicId}/config`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setConfig(data); })
      .catch(() => {});
  }, [clinicId]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen, scrollToBottom]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 80);
  };

  const openWidget = () => {
    setIsOpen(true);
    setHasUnread(false);
    setTimeout(() => inputRef.current?.focus(), 100);

    // Show greeting on first open
    if (messages.length === 0 && config) {
      setMessages([{
        id: 'greeting',
        role: 'assistant',
        content: config.greeting,
        timestamp: new Date(),
      }]);
    }
  };

  const sendMessage = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || isLoading || !clinicId) return;

    setInput('');
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: msg, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const token = localStorage.getItem('cureq_token') || '';
      const res = await fetch(`${BACKEND_URL}/api/chatbot/${clinicId}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: msg, sessionId, branchId: localStorage.getItem('cureq_branch_id') }),
      });

      const data = await res.json();
      const newSessionId = data.sessionId || sessionId;
      if (newSessionId !== sessionId) {
        setSessionId(newSessionId);
        sessionStorage.setItem('cureq_chat_session', newSessionId);
      }

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reply || "Sorry, I couldn't get a response.",
        toolsUsed: data.toolsUsed,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
      if (!isOpen) setHasUnread(true);
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm having trouble connecting. Please try again or call the clinic directly.",
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Don't render on excluded routes or if no clinic
  if (!clinicId || !config || !config.isActive) return null;
  if (EXCLUDED_PATHS.some(p => pathname?.startsWith(p))) return null;

  const color = config.primaryColor || '#01696f';
  const quickReplies = [
    config.enableQueueStatus && "What's the wait time?",
    config.enableBooking && 'Book an appointment',
    'Where are you located?',
  ].filter(Boolean) as string[];

  return (
    <>
      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-[150] w-96 h-[34rem] bg-white rounded-2xl shadow-2xl border border-[#e9e9e7] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 shrink-0" style={{ background: color }}>
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-white font-semibold text-sm leading-tight">{config.botName}</p>
              <p className="text-white/70 text-[10px] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-300 inline-block" /> Online · Usually replies instantly
              </p>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 space-y-1 bg-[#fbfbfa]">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex items-end gap-2 mb-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: color }}>
                    <Bot className="h-3.5 w-3.5 text-white" />
                  </div>
                )}
                <div className={`max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                  <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'text-white rounded-br-sm'
                      : 'bg-white border border-[#e9e9e7] text-[#1a202c] rounded-bl-sm shadow-xs'
                  }`} style={msg.role === 'user' ? { background: color } : {}}>
                    {msg.content}
                  </div>
                  {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {msg.toolsUsed.map(tool => (
                        <span key={tool} className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#e6f3f4] text-[#01696f] font-medium">
                          <Zap className="h-2.5 w-2.5" /> {TOOL_LABELS[tool] || tool}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && <TypingIndicator color={color} />}

            {/* Quick reply chips (only on first message) */}
            {messages.length === 1 && !isLoading && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {quickReplies.map(q => (
                  <button key={q} onClick={() => sendMessage(q)}
                    className="text-[11px] px-3 py-1.5 rounded-full border border-[#e9e9e7] bg-white hover:border-[#01696f] hover:text-[#01696f] text-[#64748b] font-medium transition-colors shadow-xs">
                    {q}
                  </button>
                ))}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {showScrollBtn && (
            <button onClick={scrollToBottom} className="absolute bottom-16 right-4 p-1.5 rounded-full bg-white border border-[#e9e9e7] shadow-md text-[#64748b] hover:text-[#01696f] transition-colors">
              <ChevronDown className="h-4 w-4" />
            </button>
          )}

          {/* Input */}
          <div className="flex items-center gap-2 px-3 py-3 border-t border-[#e9e9e7] bg-white shrink-0">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Type a message..."
              className="flex-1 px-3 py-2 text-sm border border-[#e9e9e7] rounded-xl focus:outline-none focus:border-[#01696f] bg-[#fbfbfa]"
              disabled={isLoading}
            />
            <button onClick={() => sendMessage()} disabled={isLoading || !input.trim()}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-40"
              style={{ background: color }}>
              {isLoading ? <Loader2 className="h-4 w-4 text-white animate-spin" /> : <Send className="h-4 w-4 text-white" />}
            </button>
          </div>

          <p className="text-[9px] text-center text-[#9ca3af] pb-2">Powered by CureQ AI · Responses may not replace medical advice</p>
        </div>
      )}

      {/* Bubble */}
      <button
        onClick={isOpen ? () => setIsOpen(false) : openWidget}
        className="fixed bottom-6 right-6 z-[160] w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        style={{ background: color }}
        title={`Chat with ${config.botName}`}
      >
        {isOpen ? <X className="h-6 w-6 text-white" /> : <MessageCircle className="h-6 w-6 text-white" />}
        {hasUnread && !isOpen && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white" />
        )}
      </button>
    </>
  );
}
