import React, { useState, useRef, useEffect } from 'react';
import {
  AgentChatMessage,
  AgentFunctionCall,
  Coordinates,
  POIItem,
  RouteItem,
} from '../types.ts';
import { sendAgentMessage, speakText, stopSpeaking } from '../services/agentService.ts';
import {
  Sparkles,
  Send,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  RotateCcw,
  Navigation,
  Compass,
  Bus,
  BellRing,
  Building,
  Check,
  ArrowRight,
  Bot,
  User,
} from 'lucide-react';

interface CopilotTabProps {
  pois: POIItem[];
  routes: RouteItem[];
  onExecutePlanRoute: (originName: string, destName: string) => void;
  onExecuteNearby: (locationName: string, radiusMeters?: number) => void;
  onExecuteHighlightLine: (lineIdOrNumber: string) => void;
  onExecuteGeofence: (targetName: string, thresholdMeters?: number) => void;
  onExecuteExplorePlaces: (category?: string, query?: string) => void;
  onNavigateToTab: (tab: 'lines' | 'near' | 'route' | 'places') => void;
}

const QUICK_SUGGESTIONS = [
  '¿Qué micro me lleva de la Gabriel al Ventura Mall?',
  '¿Qué micros pasan cerca de La Ramada?',
  'Mostrame por dónde va la línea 72',
  'Avísame a 200m del Parque Urbano',
  'Hospitales cerca del 2do o 3er anillo',
];

export const CopilotTab: React.FC<CopilotTabProps> = ({
  pois,
  routes,
  onExecutePlanRoute,
  onExecuteNearby,
  onExecuteHighlightLine,
  onExecuteGeofence,
  onExecuteExplorePlaces,
  onNavigateToTab,
}) => {
  const [messages, setMessages] = useState<AgentChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      content:
        '¡Hola! Soy **MicroBot SCZ**, tu copiloto de micros en Santa Cruz. Puedo calcular tus rutas de micro, buscar qué líneas pasan cerca, mostrarte recorridos en el mapa o activar tu alarma de bajada por GPS. ¿A dónde te gustaría ir?',
      timestamp: Date.now(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Clean up audio and voice on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  // Web Speech API Voice Recognition
  const toggleRecording = () => {
    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
      return;
    }

    const SpeechRecognition =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Tu navegador no soporta reconocimiento de voz nativo. Por favor escribe tu mensaje.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'es-BO';
      recognition.interimResults = false;
      recognition.continuous = false;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputText((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      };

      recognition.onerror = () => {
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognition.start();
      recognitionRef.current = recognition;
      setIsRecording(true);
    } catch (e) {
      console.warn('Speech recognition start failed:', e);
      setIsRecording(false);
    }
  };

  const handleSpeakMessage = (msgId: string, text: string) => {
    if (speakingMessageId === msgId) {
      stopSpeaking();
      setSpeakingMessageId(null);
      return;
    }

    setSpeakingMessageId(msgId);
    speakText(text, () => {
      setSpeakingMessageId(null);
    });
  };

  // Dispatch function call to parent map actions
  const executeFunctionCall = (fc: AgentFunctionCall, messageId: string) => {
    const { name, args } = fc;

    if (name === 'planRoute') {
      onExecutePlanRoute(args.originName, args.destName);
      onNavigateToTab('route');
    } else if (name === 'searchNearbyMicros') {
      onExecuteNearby(args.locationName, args.radiusMeters);
      onNavigateToTab('near');
    } else if (name === 'highlightLine') {
      onExecuteHighlightLine(args.lineIdentifier);
      onNavigateToTab('lines');
    } else if (name === 'setGeofenceAlarm') {
      onExecuteGeofence(args.targetName, args.thresholdMeters);
    } else if (name === 'explorePlaces') {
      onExecuteExplorePlaces(args.category, args.query);
      onNavigateToTab('places');
    }

    // Mark action as executed in message
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, actionExecuted: true } : m))
    );
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isLoading) return;

    setInputText('');
    stopSpeaking();
    setSpeakingMessageId(null);

    const userMessageId = `user-${Date.now()}`;
    const userMessage: AgentChatMessage = {
      id: userMessageId,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    const updatedHistory = [...messages, userMessage];
    setMessages(updatedHistory);
    setIsLoading(true);

    try {
      const response = await sendAgentMessage(text, updatedHistory);

      const botMessageId = `bot-${Date.now()}`;
      const botMessage: AgentChatMessage = {
        id: botMessageId,
        role: 'model',
        content: response.reply,
        timestamp: Date.now(),
        functionCalls: response.functionCalls,
        actionExecuted: false,
      };

      setMessages((prev) => [...prev, botMessage]);

      // If Function Calls are returned, execute automatically for instant responsiveness!
      if (response.functionCalls && response.functionCalls.length > 0) {
        response.functionCalls.forEach((fc) => {
          executeFunctionCall(fc, botMessageId);
        });
      }

      // Voice readout if autoSpeak is enabled
      if (autoSpeak && response.reply) {
        setSpeakingMessageId(botMessageId);
        speakText(response.reply, () => {
          setSpeakingMessageId(null);
        });
      }
    } catch (err: unknown) {
      console.error('Agent chat error:', err);
      const errorMessage: AgentChatMessage = {
        id: `err-${Date.now()}`,
        role: 'model',
        content:
          'Lo siento, ocurrió un error temporal al comunicarme con el servidor. Por favor intenta de nuevo en un momento.',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    stopSpeaking();
    setSpeakingMessageId(null);
    setMessages([
      {
        id: 'welcome-reset',
        role: 'model',
        content: 'Historial reiniciado. ¿En qué ruta o línea de micro de Santa Cruz te puedo colaborar?',
        timestamp: Date.now(),
      },
    ]);
  };

  return (
    <div className="flex flex-col h-full space-y-2">
      {/* Copilot Header Controls */}
      <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="font-bold text-slate-200">MicroBot SCZ</span>
            <span className="text-[10px] text-slate-400 block leading-none">Copiloto Inteligente de Rutas</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Toggle Auto Speak Voice */}
          <button
            type="button"
            onClick={() => setAutoSpeak(!autoSpeak)}
            className={`p-1.5 rounded-lg border transition ${
              autoSpeak
                ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/60'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
            title={autoSpeak ? 'Lectura por voz activada' : 'Lectura por voz desactivada'}
          >
            {autoSpeak ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>

          {/* Reset History */}
          <button
            type="button"
            onClick={handleClearHistory}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition"
            title="Reiniciar chat"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Chat Messages Viewport */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 -mr-1 text-xs">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';

          return (
            <div
              key={msg.id}
              className={`flex items-start gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* Avatar Icon */}
              <div
                className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                  isUser
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-indigo-600 text-white shadow-sm'
                }`}
              >
                {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
              </div>

              {/* Message Bubble */}
              <div
                className={`max-w-[85%] rounded-2xl p-3 border space-y-2 ${
                  isUser
                    ? 'bg-emerald-950/70 border-emerald-700/60 text-emerald-100 rounded-tr-none'
                    : 'bg-slate-800/80 border-slate-700/80 text-slate-200 rounded-tl-none shadow-md'
                }`}
              >
                <div className="prose prose-invert prose-xs text-xs leading-relaxed whitespace-pre-wrap">
                  {msg.content}
                </div>

                {/* Render Interactive Action Cards if Function Calls were made */}
                {msg.functionCalls && msg.functionCalls.length > 0 && (
                  <div className="space-y-1.5 pt-1.5 border-t border-slate-700/60">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                      Acción sobre el mapa:
                    </span>

                    {msg.functionCalls.map((fc, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded-xl bg-slate-900/90 border border-indigo-500/40 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          {fc.name === 'planRoute' && <Navigation className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                          {fc.name === 'searchNearbyMicros' && <Compass className="w-3.5 h-3.5 text-sky-400 shrink-0" />}
                          {fc.name === 'highlightLine' && <Bus className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                          {fc.name === 'setGeofenceAlarm' && <BellRing className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
                          {fc.name === 'explorePlaces' && <Building className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}

                          <div className="min-w-0 text-[11px]">
                            {fc.name === 'planRoute' && (
                              <p className="truncate font-semibold text-slate-200">
                                Ruta: {fc.args.originName} → {fc.args.destName}
                              </p>
                            )}
                            {fc.name === 'searchNearbyMicros' && (
                              <p className="truncate font-semibold text-slate-200">
                                Micros cerca de: {fc.args.locationName}
                              </p>
                            )}
                            {fc.name === 'highlightLine' && (
                              <p className="truncate font-semibold text-slate-200">
                                Recorrido Línea {fc.args.lineIdentifier}
                              </p>
                            )}
                            {fc.name === 'setGeofenceAlarm' && (
                              <p className="truncate font-semibold text-slate-200">
                                Alarma: {fc.args.targetName} ({fc.args.thresholdMeters || 200} m)
                              </p>
                            )}
                            {fc.name === 'explorePlaces' && (
                              <p className="truncate font-semibold text-slate-200">
                                Explorar: {fc.args.category || fc.args.query || 'Lugares'}
                              </p>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => executeFunctionCall(fc, msg.id)}
                          className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] shrink-0 transition flex items-center gap-1 shadow-sm active:scale-95"
                        >
                          <span>{msg.actionExecuted ? 'Ver' : 'Ejecutar'}</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Footer bar with timestamp & Read aloud */}
                {!isUser && (
                  <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400">
                    <span>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleSpeakMessage(msg.id, msg.content)}
                      className="p-1 rounded hover:bg-slate-700/60 text-slate-400 hover:text-white transition flex items-center gap-1"
                      title={speakingMessageId === msg.id ? 'Detener voz' : 'Escuchar respuesta'}
                    >
                      {speakingMessageId === msg.id ? (
                        <>
                          <VolumeX className="w-3 h-3 text-amber-400 animate-pulse" />
                          <span className="text-amber-400">Pausar</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-3 h-3 text-slate-400" />
                          <span>Escuchar</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Loading Spinner */}
        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-indigo-300 p-2 rounded-xl bg-slate-900/60 border border-slate-800 animate-pulse">
            <Sparkles className="w-4 h-4 text-indigo-400 animate-spin" />
            <span>Consultando rutas y geografía de Santa Cruz...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Suggestion Pills */}
      {messages.length <= 2 && (
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1 text-[11px] touch-pan-x">
          {QUICK_SUGGESTIONS.map((sug, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendMessage(sug)}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white whitespace-nowrap shrink-0 transition"
            >
              {sug}
            </button>
          ))}
        </div>
      )}

      {/* Input Form with Text & Voice */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/90 border border-slate-700 focus-within:border-indigo-500 transition"
      >
        {/* Voice dictation button */}
        <button
          type="button"
          onClick={toggleRecording}
          className={`p-2 rounded-lg transition shrink-0 ${
            isRecording
              ? 'bg-rose-600 text-white animate-pulse ring-2 ring-rose-400/50'
              : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
          }`}
          title={isRecording ? 'Detener dictado por voz' : 'Hablar por micrófono'}
        >
          {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={isRecording ? 'Escuchando tu voz...' : 'Pregunta qué micro tomar, cómo ir, o activa una alarma...'}
          className="flex-1 bg-transparent border-0 px-2 py-1 text-xs text-slate-100 placeholder-slate-400 focus:outline-none min-w-0"
        />

        <button
          type="submit"
          disabled={!inputText.trim() || isLoading}
          className={`p-2 rounded-lg font-bold text-xs transition shrink-0 ${
            inputText.trim() && !isLoading
              ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md active:scale-95'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
          }`}
          title="Enviar mensaje al copiloto"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
