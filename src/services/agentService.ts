import { AgentChatMessage, AgentFunctionCall } from '../types.ts';

export interface AgentChatResponse {
  reply: string;
  functionCalls: AgentFunctionCall[];
  error?: string;
}

/**
 * Sends a message with conversation history to the backend Gemini agent.
 */
export async function sendAgentMessage(
  message: string,
  history: AgentChatMessage[]
): Promise<AgentChatResponse> {
  const formattedHistory = history.map((item) => ({
    role: item.role,
    content: item.content,
  }));

  const res = await fetch('/api/agent/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      history: formattedHistory,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Error HTTP ${res.status}`);
  }

  return res.json();
}

/**
 * Reads text aloud using browser SpeechSynthesis API.
 */
export function speakText(text: string, onEnd?: () => void): () => void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return () => {};
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  // Strip markdown markers for cleaner audio
  const cleanText = text
    .replace(/[*_#`~[\]]/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .trim();

  if (!cleanText) return () => {};

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = 'es-BO'; // Bolivian Spanish preference, fallback to generic Spanish
  utterance.rate = 1.05;
  utterance.pitch = 1.0;

  // Try to find a Spanish voice
  const voices = window.speechSynthesis.getVoices();
  const spanishVoice =
    voices.find((v) => v.lang.startsWith('es-BO')) ||
    voices.find((v) => v.lang.startsWith('es')) ||
    null;

  if (spanishVoice) {
    utterance.voice = spanishVoice;
  }

  if (onEnd) {
    utterance.onend = onEnd;
    utterance.onerror = onEnd;
  }

  window.speechSynthesis.speak(utterance);

  return () => {
    window.speechSynthesis.cancel();
  };
}

/**
 * Stop any active speech synthesis.
 */
export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
