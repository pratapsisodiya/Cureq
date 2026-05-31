'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Bot, Send, Loader2, Zap, X, RefreshCw, Activity, MessageCircle } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

const TOOL_LABELS: Record<string, string> = {
  get_queue_status: '📋 Checked live queue',
  get_patient_token: '🔖 Found your token',
  book_appointment: '📅 Booked appointment',
  cancel_appointment: '❌ Cancelled appointment',
  get_clinic_info: 'ℹ️ Fetched clinic info',
  get_available_slots: '🕐 Checked available slots',
  get_prescription_history: '📄 Retrieved visit history',
  triage_symptoms: '🩺 Assessed symptoms',
};

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolsUsed?: string[];
  timestamp: Date;
  failed?: boolean;
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

function TypingIndicator({ color }: { color: string }) {
  return (
    <div className="flex items-end gap-2 mb-4">
      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm" style={{ background: color }}>
        <Bot className="h-4 w-4 text-white" />
      </div>
      <div className="bg-white border border-[#e9e9e7] rounded-2xl rounded-bl-sm px-4 py-3 shadow-xs">
        <div className="flex gap-1 items-center h-4">
          {[0, 1, 2].map(i => (
            <span key={i} className="w-2 h-2 rounded-full animate-bounce" style={{ background: color, animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PublicChatbotPage() {
  const params = useParams();
  const clinicId = params?.clinicId as string;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState('');

  const messagesEndRefMobile = useRef<HTMLDivElement>(null);
  const messagesEndRefDesktop = useRef<HTMLDivElement>(null);
  const inputRefMobile = useRef<HTMLInputElement>(null);
  const inputRefDesktop = useRef<HTMLInputElement>(null);

  // Load bot config via React Query
  const { 
    data: config, 
    isLoading: configLoading, 
    isError: configError 
  } = useQuery<BotConfig>({
    queryKey: ['chatbotConfig', clinicId],
    queryFn: async () => {
      const res = await fetch(`${BACKEND_URL}/api/chatbot/${clinicId}/config`);
      if (!res.ok) throw new Error('Failed to load chatbot config');
      return res.json();
    },
    enabled: !!clinicId,
  });

  // Restore session and messages on load
  useEffect(() => {
    if (!clinicId) return;
    const savedSession = sessionStorage.getItem(`cureq_chat_session_${clinicId}`);
    if (savedSession) setSessionId(savedSession);

    const savedMsgs = sessionStorage.getItem(`cureq_chat_messages_${clinicId}`);
    if (savedMsgs) {
      try {
        const parsed = JSON.parse(savedMsgs);
        const hydrated = parsed.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        }));
        setMessages(hydrated);
      } catch (err) {
        console.error("Failed to parse saved chat messages:", err);
      }
    }
  }, [clinicId]);

  // Auto-add greeting message only if no saved messages are restored and config is loaded
  useEffect(() => {
    if (config?.greeting && clinicId) {
      const hasSaved = sessionStorage.getItem(`cureq_chat_messages_${clinicId}`);
      if (!hasSaved) {
        setMessages([{
          id: 'greeting',
          role: 'assistant',
          content: config.greeting,
          timestamp: new Date(),
        }]);
      }
    }
  }, [config, clinicId]);

  // Persist messages to sessionStorage when they change
  useEffect(() => {
    if (clinicId && !configLoading) {
      sessionStorage.setItem(`cureq_chat_messages_${clinicId}`, JSON.stringify(messages));
    }
  }, [messages, clinicId, configLoading]);

  // Auto-scroll
  const scrollToBottom = useCallback(() => {
    messagesEndRefMobile.current?.scrollIntoView({ behavior: 'smooth' });
    messagesEndRefDesktop.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Focus inputs on load
  useEffect(() => {
    if (config) {
      setTimeout(() => {
        inputRefMobile.current?.focus();
        inputRefDesktop.current?.focus();
      }, 300);
    }
  }, [config]);

  // Send message mutation via React Query
  const sendMutation = useMutation({
    mutationFn: async (msgText: string) => {
      const res = await fetch(`${BACKEND_URL}/api/chatbot/${clinicId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msgText, sessionId }),
      });
      if (!res.ok) throw new Error('Failed to send message');
      return res.json();
    },
    onMutate: async (msgText: string) => {
      setMessages(prev => {
        // If the message is already in messages (e.g. from retrying), don't append it again
        const lastFew = prev.slice(-3);
        const alreadyExists = lastFew.some(m => m.role === 'user' && m.content === msgText);
        if (alreadyExists) return prev;

        const userMsg: Message = { id: Date.now().toString(), role: 'user', content: msgText, timestamp: new Date() };
        return [...prev, userMsg];
      });
    },
    onSuccess: (data) => {
      const newSessionId = data.sessionId || sessionId;
      if (newSessionId !== sessionId) {
        setSessionId(newSessionId);
        sessionStorage.setItem(`cureq_chat_session_${clinicId}`, newSessionId);
      }

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reply || "Sorry, I couldn't get a response. Please try again.",
        toolsUsed: data.toolsUsed,
        timestamp: new Date(),
      }]);
    },
    onError: (error, msgText) => {
      console.error('Failed to send message:', error);
      
      // Mark the sent user message as failed
      setMessages(prev => {
        const updated = [...prev];
        for (let i = updated.length - 1; i >= 0; i--) {
          if (updated[i].role === 'user' && updated[i].content === msgText) {
            updated[i] = { ...updated[i], failed: true };
            break;
          }
        }
        return updated;
      });

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm having trouble connecting right now. Please try again in a moment, or call the clinic directly.",
        timestamp: new Date(),
      }]);
    },
    onSettled: () => {
      setTimeout(() => {
        inputRefMobile.current?.focus();
        inputRefDesktop.current?.focus();
      }, 50);
    }
  });

  const retryMessage = (failedMsgId: string) => {
    const failedMsg = messages.find(m => m.id === failedMsgId);
    if (!failedMsg || sendMutation.isPending) return;

    // Remove the error assistant message and clear failed flag
    setMessages(prev => {
      let filtered = [...prev];
      if (filtered.length > 0 && filtered[filtered.length - 1].role === 'assistant') {
        const lastMsg = filtered[filtered.length - 1];
        if (lastMsg.content.includes("I'm having trouble connecting") || lastMsg.content.includes("trouble connecting right now")) {
          filtered.pop();
        }
      }
      return filtered.map(m => m.id === failedMsgId ? { ...m, failed: false } : m);
    });

    sendMutation.mutate(failedMsg.content);
  };

  const sendMessage = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || sendMutation.isPending || !clinicId || !config) return;

    setInput('');
    sendMutation.mutate(msg);
  };

  const resetChat = () => {
    sessionStorage.removeItem(`cureq_chat_session_${clinicId}`);
    sessionStorage.removeItem(`cureq_chat_messages_${clinicId}`);
    setSessionId('');
    setMessages(config?.greeting ? [{
      id: 'greeting',
      role: 'assistant',
      content: config.greeting,
      timestamp: new Date(),
    }] : []);
  };

  const color = config?.primaryColor || '#01696f';

  const quickReplies = config ? [
    config.enableQueueStatus && "What's the wait time?",
    config.enableBooking && 'Book an appointment',
    config.enableTriage && 'I have a health concern',
    'What are your clinic hours?',
  ].filter(Boolean) as string[] : [];

  // Loading state
  if (configLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#f0fafa] to-[#e6f3f4] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-[#01696f]">
          <Activity className="h-10 w-10 animate-spin" />
          <p className="text-sm font-semibold tracking-widest uppercase animate-pulse">Loading Chatbot…</p>
        </div>
      </div>
    );
  }

  // Error / inactive state
  if (configError || !config) {
    return (
      <div className="min-h-screen bg-[#fbfbfa] flex items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <div className="h-16 w-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageCircle className="h-8 w-8 text-red-400" />
          </div>
          <h2 className="font-bold text-lg text-[#1a202c] mb-2">Chatbot Not Found</h2>
          <p className="text-sm text-[#64748b]">This clinic chatbot could not be loaded. Please check the link or contact the clinic directly.</p>
        </div>
      </div>
    );
  }

  if (!config.isActive) {
    return (
      <div className="min-h-screen bg-[#fbfbfa] flex items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <div className="h-16 w-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Bot className="h-8 w-8 text-amber-500" />
          </div>
          <h2 className="font-bold text-lg text-[#1a202c] mb-2">Chatbot Temporarily Unavailable</h2>
          <p className="text-sm text-[#64748b]">The clinic's AI assistant is currently offline. Please try again later or call the clinic directly.</p>
        </div>
      </div>
    );
  }

  const renderChatContent = (isMobile: boolean) => {
    return (
      <>
        {/* Header */}
        <div className={`flex items-center gap-3 px-5 shrink-0 ${isMobile ? 'py-4' : 'pt-11 pb-4'}`} style={{ background: color }}>
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shadow-sm">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-white font-bold text-base leading-tight">{config.botName}</p>
            <p className="text-white/75 text-[11px] flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-300 inline-block animate-pulse" />
              Online · AI-powered health assistant
            </p>
          </div>
          <button
            onClick={resetChat}
            title="Start new conversation"
            className="p-2 rounded-lg hover:bg-white/20 text-white transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 bg-[#fbfbfa] space-y-1">
          {messages.map(msg => (
            <div key={msg.id} className={`flex items-end gap-2 mb-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm" style={{ background: color }}>
                  <Bot className="h-4 w-4 text-white" />
                </div>
              )}
              <div className={`max-w-[82%] flex flex-col gap-1.5 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                  className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'text-white rounded-br-sm'
                      : 'bg-white border border-[#e9e9e7] text-[#1a202c] rounded-bl-sm shadow-xs'
                  }`}
                  style={msg.role === 'user' ? { background: color } : {}}
                >
                  {msg.content}
                </div>
                {msg.failed && (
                  <button
                    onClick={() => retryMessage(msg.id)}
                    className="flex items-center gap-1.5 text-[10px] text-red-500 font-semibold hover:underline mt-1 bg-red-50 hover:bg-red-100/70 border border-red-200 px-2.5 py-0.5 rounded shadow-xs transition-colors cursor-pointer self-end"
                  >
                    <RefreshCw className="h-2.5 w-2.5" />
                    Failed to send. Click to retry
                  </button>
                )}
                {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {msg.toolsUsed.map(tool => (
                      <span key={tool} className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#e6f3f4] text-[#01696f] font-medium">
                        <Zap className="h-2.5 w-2.5" />
                        {TOOL_LABELS[tool] || tool}
                      </span>
                    ))}
                  </div>
                )}
                <span className="text-[9px] text-[#9ca3af]">
                  {msg.timestamp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}

          {sendMutation.isPending && <TypingIndicator color={color} />}

          {/* Quick reply chips — shown after greeting */}
          {messages.length === 1 && !sendMutation.isPending && quickReplies.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3 pb-2">
              <p className="w-full text-[10px] text-[#9ca3af] uppercase tracking-wider font-semibold mb-1">Quick questions</p>
              {quickReplies.map(q => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-xs px-3.5 py-2 rounded-full border border-[#e9e9e7] bg-white hover:bg-[#e6f3f4] hover:border-[#01696f] hover:text-[#01696f] text-[#64748b] font-medium transition-all shadow-xs"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          <div ref={isMobile ? messagesEndRefMobile : messagesEndRefDesktop} />
        </div>

        {/* Input */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-t border-[#e9e9e7] bg-white shrink-0">
          <input
            ref={isMobile ? inputRefMobile : inputRefDesktop}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Type your question here…"
            className="flex-1 px-4 py-2.5 text-sm border border-[#e9e9e7] rounded-xl focus:outline-none focus:border-[#01696f] bg-[#fbfbfa] focus:bg-white transition-colors placeholder:text-gray-400"
            disabled={sendMutation.isPending}
            autoFocus={isMobile}
          />
          <button
            onClick={() => sendMessage()}
            disabled={sendMutation.isPending || !input.trim()}
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all disabled:opacity-40 shadow-sm hover:opacity-90 active:scale-95"
            style={{ background: color }}
          >
            {sendMutation.isPending ? <Loader2 className="h-4 w-4 text-white animate-spin" /> : <Send className="h-4 w-4 text-white" />}
          </button>
        </div>

        <p className={`text-[9px] text-center text-[#b0bec5] bg-white ${isMobile ? 'pb-2.5' : 'pb-8'}`}>
          Powered by <span className="font-semibold text-[#01696f]">CureQ AI</span> · Responses are for guidance only, not medical advice
        </p>
      </>
    );
  };

  return (
    <>
      {/* MOBILE VIEW: Full screen on phones */}
      <div className="flex md:hidden flex-col h-screen w-full bg-white overflow-hidden font-sans">
        {renderChatContent(true)}
      </div>

      {/* DESKTOP/PC VIEW: iPhone mold */}
      <div className="hidden md:flex min-h-screen bg-gradient-to-br from-[#f0fafa] to-[#e6f3f4] items-center justify-center p-6 font-sans">
        {/* iPhone outer shell */}
        <div className="relative border-[12px] border-slate-900 bg-slate-900 rounded-[50px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.35)] ring-1 ring-slate-800/10" style={{ width: '385px', height: '812px' }}>
          
          {/* Speaker grill */}
          <div className="absolute top-[6px] left-1/2 transform -translate-x-1/2 h-[4px] w-[50px] bg-slate-800 rounded-full z-30" />
          
          {/* Dynamic Island / Notch */}
          <div className="absolute top-[12px] left-1/2 transform -translate-x-1/2 h-[26px] w-[100px] bg-slate-950 rounded-full z-30 flex items-center justify-between px-3">
            <div className="w-1.5 h-1.5 rounded-full bg-[#1e293b] opacity-80" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#0b1329] ring-[1px] ring-slate-800/50" />
          </div>

          {/* Left volume buttons (sleek shadows) */}
          <div className="absolute -left-[14px] top-[140px] w-[2px] h-[50px] bg-slate-900 rounded-l" />
          <div className="absolute -left-[14px] top-[200px] w-[2px] h-[50px] bg-slate-900 rounded-l" />
          {/* Right power button */}
          <div className="absolute -right-[14px] top-[170px] w-[2px] h-[75px] bg-slate-900 rounded-r" />

          {/* Inner Screen Content */}
          <div className="w-full h-full bg-white rounded-[38px] overflow-hidden flex flex-col pt-0 relative">
            
            {/* Status Bar */}
            <div className="absolute top-0 left-0 right-0 h-10 px-6 flex justify-between items-center text-[11px] font-semibold select-none z-20 text-white pointer-events-none">
              <span>{new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
              <div className="flex items-center gap-1.5">
                {/* Cellular Signal Icon */}
                <svg className="w-3.5 h-3.5 fill-current text-white/90" viewBox="0 0 24 24">
                  <path d="M2 16h2v4H2zm4-4h2v8H6zm4-4h2v12h-2zm4-4h2v16h-2z" />
                </svg>
                {/* Wifi Icon */}
                <svg className="w-3.5 h-3.5 fill-current text-white/90" viewBox="0 0 24 24">
                  <path d="M12 21l-12-14.3c.3-.3 4.9-4.7 12-4.7s11.7 4.4 12 4.7l-12 14.3zm0-16.8c-5.7 0-9.5 3.2-10.2 3.8l10.2 12.2 10.2-12.2c-.7-.6-4.5-3.8-10.2-3.8z" />
                </svg>
                {/* Battery Icon */}
                <div className="w-6 h-3 border border-white/60 rounded-[4px] p-[1.5px] flex items-center relative">
                  <div className="bg-white h-full w-full rounded-[1px]" />
                  <div className="absolute -right-[3px] top-[3.5px] w-[1.5px] h-[3.5px] bg-white/60 rounded-r-[1px]" />
                </div>
              </div>
            </div>

            {renderChatContent(false)}

            {/* Home Indicator */}
            <div className="absolute bottom-[6px] left-1/2 transform -translate-x-1/2 w-[130px] h-[5px] bg-slate-400/30 rounded-full z-30" />
          </div>
        </div>
      </div>
    </>
  );
}
