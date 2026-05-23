'use client';

import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';

interface VoiceDictationProps {
  onResult: (text: string) => void;
  className?: string;
}

export default function VoiceDictation({ onResult, className = '' }: VoiceDictationProps) {
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // @ts-ignore
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recog = new SpeechRecognition();
        recog.continuous = false;
        recog.interimResults = false;
        recog.lang = 'en-US';

        recog.onstart = () => {
          setIsListening(true);
          setError('');
        };

        recog.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          onResult(transcript);
          setIsListening(false);
        };

        recog.onerror = (event: any) => {
          console.error('Speech recognition error', event.error);
          setIsListening(false);
          setError('Microphone error');
          setTimeout(() => setError(''), 3000);
        };

        recog.onend = () => {
          setIsListening(false);
        };

        setRecognition(recog);
      } else {
        setError('Not supported in this browser');
      }
    }
  }, [onResult]);

  const toggleListening = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent form submission
    if (!recognition) return;

    if (isListening) {
      recognition.stop();
    } else {
      recognition.start();
    }
  };

  if (!recognition) {
    return (
      <button 
        disabled 
        title="Voice dictation not supported in this browser"
        className={`p-1.5 rounded-md text-gray-400 bg-gray-100 opacity-50 cursor-not-allowed ${className}`}
      >
        <MicOff className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={toggleListening}
        type="button"
        title="Click to dictate"
        className={`p-1.5 rounded-md transition-all shadow-xs ${
          isListening 
            ? 'bg-red-50 text-red-500 border border-red-200 animate-pulse' 
            : 'bg-white text-[#64748b] hover:text-[#01696f] hover:bg-[#e6f3f4] border border-[#e9e9e7]'
        } ${className}`}
      >
        {isListening ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
      </button>
      {error && (
        <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap z-50">
          {error}
        </span>
      )}
    </div>
  );
}
