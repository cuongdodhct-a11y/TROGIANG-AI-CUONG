import { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Mic, MicOff, Loader2, Play, PauseCircle, Sparkles, RefreshCw, Radio, CheckCircle2 } from "lucide-react";
import { arrayBufferToBase64, base64ToArrayBuffer, float32ToInt16, int16ToFloat32 } from "@/src/lib/audio-utils";
import { motion, AnimatePresence } from "motion/react";
import SchoolLogo from './SchoolLogo';

const WORKLET_CODE = `
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 4096;
    this.buffer = new Float32Array(this.bufferSize);
    this.bytesWritten = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (input.length > 0 && input[0]) {
      const channelData = input[0];
      for (let i = 0; i < channelData.length; i++) {
        this.buffer[this.bytesWritten++] = channelData[i];
        if (this.bytesWritten >= this.bufferSize) {
          this.port.postMessage(new Float32Array(this.buffer));
          this.bytesWritten = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor('pcm-processor', PCMProcessor);
`;

interface VoiceChatProps {
  systemInstruction: string;
}

export default function VoiceChat({ systemInstruction }: VoiceChatProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [transcription, setTranscription] = useState<string>("");
  const [aiTranscription, setAiTranscription] = useState<string>("");
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [activationState, setActivationState] = useState<'standby' | 'active'>('standby');
  const [error, setError] = useState<string | null>(null);
  const [engineMode, setEngineMode] = useState<'live' | 'standard'>('live');
  const [isAiThinking, setIsAiThinking] = useState(false);

  const activationStateRef = useRef<'standby' | 'active'>('standby');
  const isMutedRef = useRef(false);
  const engineModeRef = useRef<'live' | 'standard'>('live');

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const nextPlaybackTimeRef = useRef(0);
  const speakingTimeoutRef = useRef<any>(null);
  const isSessionActiveRef = useRef(false);
  const speechRecognizerRef = useRef<any>(null);
  const isProcessingFallbackRef = useRef(false);
  const reconnectTimeoutRef = useRef<any>(null);

  const updateActivationState = (newState: 'standby' | 'active') => {
    activationStateRef.current = newState;
    setActivationState(newState);
    if (newState === 'standby') {
      stopPlayback();
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    }
  };

  const isWakeWord = (text: string): boolean => {
    const t = text.toLowerCase().trim();
    return (
      t.includes("giáo sư") || 
      t.includes("giao su") || 
      t.includes("thưa giáo sư") || 
      t.includes("thay giao su") ||
      t.includes("chào giáo sư") ||
      t.includes("bác giáo sư") ||
      t.includes("cô giáo sư")
    );
  };

  const isStopWord = (text: string): boolean => {
    const t = text.toLowerCase().trim();
    return (
      t.includes("kết thúc") ||
      t.includes("ket thuc") ||
      t.includes("dừng lại") ||
      t.includes("dung lai") ||
      t.includes("dừng") ||
      t.includes("dung") ||
      t.includes("tạm dừng") ||
      t.includes("tam dung") ||
      t.includes("ngắt lời") ||
      t.includes("ngắt") ||
      t.includes("về chế độ chờ") ||
      t.includes("stop")
    );
  };

  // Speaks text using browser SpeechSynthesis with Vietnamese voice
  const speakText = (text: string) => {
    if (!('speechSynthesis' in window) || activationStateRef.current !== 'active') return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'vi-VN';
    utterance.rate = 0.95;
    utterance.pitch = 0.95;

    const voices = window.speechSynthesis.getVoices();
    const viVoice = voices.find(v => v.lang.includes('vi') || v.lang.includes('VI'));
    if (viVoice) {
      utterance.voice = viVoice;
    }

    utterance.onstart = () => {
      setIsAiSpeaking(true);
    };

    utterance.onend = () => {
      setIsAiSpeaking(false);
    };

    utterance.onerror = () => {
      setIsAiSpeaking(false);
    };

    window.speechSynthesis.speak(utterance);
  };

  // Process user speech when using Fallback Standard Engine with Real-Time Google Search Grounding
  const processFallbackTurn = async (userPrompt: string) => {
    if (isProcessingFallbackRef.current || isMutedRef.current) return;
    isProcessingFallbackRef.current = true;
    setIsAiThinking(true);

    try {
      const response = await fetch('/api/gemini/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userPrompt,
          systemInstruction,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server responded with ${response.status}`);
      }

      const data = await response.json();
      const replyText = data.text || "";
      if (replyText) {
        setAiTranscription(replyText);
        
        // If activated, speak out the answer
        if (activationStateRef.current === 'active') {
          speakText(replyText);
        }

        // Check if reply instructs return to standby
        if (replyText.toLowerCase().includes("trạng thái chờ") || replyText.toLowerCase().includes("chế độ chờ")) {
          setTimeout(() => {
            updateActivationState('standby');
          }, 3000);
        }
      }
    } catch (err: any) {
      console.error("Fallback generateContent error:", err);
    } finally {
      setIsAiThinking(false);
      isProcessingFallbackRef.current = false;
    }
  };

  // Continuous speech recognition for keyword detection & fallback input
  const startSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      if (speechRecognizerRef.current) {
        speechRecognizerRef.current.abort();
      }

      const recognizer = new SpeechRecognition();
      recognizer.continuous = true;
      recognizer.interimResults = true;
      recognizer.lang = 'vi-VN';

      recognizer.onresult = (event: any) => {
        let currentTranscript = "";
        let isFinal = false;

        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            isFinal = true;
          }
        }

        const trimmed = currentTranscript.trim();
        if (trimmed) {
          setTranscription(trimmed);

          if (isWakeWord(trimmed)) {
            console.log("Keyword detected: Giáo sư -> ACTIVATE");
            updateActivationState('active');
          } else if (isStopWord(trimmed)) {
            console.log("Keyword detected: Dừng/Kết thúc -> STANDBY");
            updateActivationState('standby');
            if ('speechSynthesis' in window) {
              window.speechSynthesis.cancel();
            }
            return;
          }

          // If in standard fallback mode and user finished speaking while active, send to Gemini
          if (engineModeRef.current === 'standard' && isFinal && activationStateRef.current === 'active') {
            processFallbackTurn(trimmed);
          }
        }
      };

      recognizer.onerror = (e: any) => {
        if (e.error !== 'no-speech') {
          console.log("Speech recognition notice:", e.error);
        }
      };

      recognizer.onend = () => {
        if (isSessionActiveRef.current) {
          try {
            recognizer.start();
          } catch (err) {}
        }
      };

      recognizer.start();
      speechRecognizerRef.current = recognizer;
    } catch (e) {
      console.warn("Speech recognition initialization skipped:", e);
    }
  };

  const stopSpeechRecognition = () => {
    if (speechRecognizerRef.current) {
      try {
        speechRecognizerRef.current.abort();
      } catch (e) {}
      speechRecognizerRef.current = null;
    }
  };

  // Start with Fallback Mode directly
  const startFallbackConnection = async () => {
    try {
      setEngineMode('standard');
      engineModeRef.current = 'standard';
      setIsConnecting(false);
      setIsConnected(true);
      isSessionActiveRef.current = true;
      updateActivationState('standby');
      startSpeechRecognition();
      setError(null);
    } catch (err) {
      setError("Không thể khởi tạo micro. Vui lòng cấp quyền micro trên trình duyệt.");
      setIsConnecting(false);
    }
  };

  const startConnection = async (preferLive = true) => {
    if (isConnecting) return;
    setError(null);
    setIsConnecting(true);
    updateActivationState('standby');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      if (!preferLive) {
        startFallbackConnection();
        return;
      }

      // Connect to Live API via server WebSocket
      let hasOpened = false;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/live`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: 'init',
          systemInstruction,
          voiceName: 'Zephyr',
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'open') {
            console.log("Live API connected via server");
            hasOpened = true;
            setEngineMode('live');
            engineModeRef.current = 'live';
            setIsConnected(true);
            isSessionActiveRef.current = true;
            setIsConnecting(false);

            startMic(ws);
            startSpeechRecognition();
            return;
          }

          if (data.type === 'message') {
            if (data.inputTranscription) {
              setTranscription(data.inputTranscription);
              if (isWakeWord(data.inputTranscription)) {
                updateActivationState('active');
              } else if (isStopWord(data.inputTranscription)) {
                updateActivationState('standby');
              }
            }

            if (data.audio) {
              if (activationStateRef.current === 'active') {
                const audioData = base64ToArrayBuffer(data.audio);
                const float32Data = int16ToFloat32(new Int16Array(audioData));
                scheduleAudio(float32Data);
              }
            }

            if (data.outputTranscription) {
              setAiTranscription(prev => prev ? prev + " " + data.outputTranscription : data.outputTranscription);
              if (data.outputTranscription.toLowerCase().includes("trạng thái chờ") || data.outputTranscription.toLowerCase().includes("chế độ chờ")) {
                setTimeout(() => {
                  updateActivationState('standby');
                }, 2500);
              }
            }

            if (data.interrupted) {
              stopPlayback();
            }
            return;
          }

          if (data.type === 'error') {
            console.warn("Live API encounter:", data.error);
            const errStr = String(data.error || "");
            
            // If service unavailable or transient error, automatically switch to reliable fallback engine!
            if (!hasOpened || errStr.includes("unavailable") || errStr.includes("Network") || errStr.includes("503") || errStr.includes("not found")) {
              console.log("Switching to Standard Gemini AI Engine due to Live API temporary unavailability...");
              setError("Live Audio máy chủ đang bảo trì/quá tải. Đã chuyển sang Chế độ Giọng nói Dự phòng độ ổn định cao.");
              startFallbackConnection();
            } else {
              setError("Đang tự động kết nối lại...");
              clearTimeout(reconnectTimeoutRef.current);
              reconnectTimeoutRef.current = setTimeout(() => {
                startConnection(false);
              }, 2000);
            }
            return;
          }

          if (data.type === 'close') {
            console.log("Live API closed");
            if (isSessionActiveRef.current && engineModeRef.current === 'live') {
              startFallbackConnection();
            }
            return;
          }
        } catch (e) {
          console.error("Error parsing Live message:", e);
        }
      };

      ws.onerror = (e) => {
        console.warn("Live API websocket error:", e);
        if (!hasOpened) {
          startFallbackConnection();
        }
      };

      ws.onclose = () => {
        console.log("Live API websocket closed");
        if (isSessionActiveRef.current && engineModeRef.current === 'live') {
          startFallbackConnection();
        }
      };

      // Timeout safeguard in case websocket stalls
      setTimeout(() => {
        if (!hasOpened && isSessionActiveRef.current === false && isConnecting) {
          console.log("Live API connection timeout -> switching to Standard Engine");
          startFallbackConnection();
        }
      }, 5000);

    } catch (error: any) {
      console.error("Failed to connect:", error);
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setError("Không thể truy cập micro. Vui lòng cấp quyền micro cho trang web.");
        setIsConnecting(false);
      } else {
        // Fallback to Standard Voice Chat
        startFallbackConnection();
      }
    }
  };

  const stopConnection = () => {
    isSessionActiveRef.current = false;
    clearTimeout(reconnectTimeoutRef.current);
    stopSpeechRecognition();
    if (wsRef.current) {
      try {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'close' }));
        }
        wsRef.current.close();
      } catch (e) {}
      wsRef.current = null;
    }
    stopMic();
    stopPlayback();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsConnected(false);
    setIsConnecting(false);
    updateActivationState('standby');
    setTranscription("");
    setAiTranscription("");
    setIsAiThinking(false);
  };

  const startMic = async (ws: WebSocket) => {
    try {
      let stream = streamRef.current;
      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
      }

      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      await audioContext.audioWorklet.addModule(
        `data:application/javascript,${encodeURIComponent(WORKLET_CODE)}`
      );

      const source = audioContext.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(audioContext, 'pcm-processor');
      workletNodeRef.current = workletNode;

      workletNode.port.onmessage = (e) => {
        if (isMutedRef.current || !isSessionActiveRef.current || ws !== wsRef.current || ws.readyState !== WebSocket.OPEN) return;

        const inputData = e.data;
        const int16Data = float32ToInt16(inputData);
        const base64Data = arrayBufferToBase64(int16Data.buffer);

        try {
          ws.send(JSON.stringify({
            type: 'realtime_input',
            audio: base64Data,
          }));
        } catch (err) {
          // Handled gracefully
        }
      };

      source.connect(workletNode);
      workletNode.connect(audioContext.destination);
    } catch (error) {
      console.error("Failed to start microphone stream:", error);
    }
  };

  const stopMic = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  };

  const scheduleAudio = (float32Data: Float32Array) => {
    if (activationStateRef.current !== 'active') return;

    if (!playbackContextRef.current) {
      playbackContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      nextPlaybackTimeRef.current = playbackContextRef.current.currentTime;
    }
    const playCtx = playbackContextRef.current;
    
    if (playCtx.state === 'suspended') {
      playCtx.resume();
    }

    if (nextPlaybackTimeRef.current < playCtx.currentTime) {
      nextPlaybackTimeRef.current = playCtx.currentTime + 0.05;
    }

    const buffer = playCtx.createBuffer(1, float32Data.length, 24000);
    buffer.getChannelData(0).set(float32Data);
    
    const source = playCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(playCtx.destination);
    source.start(nextPlaybackTimeRef.current);
    
    nextPlaybackTimeRef.current += buffer.duration;
    
    setIsAiSpeaking(true);
    
    clearTimeout(speakingTimeoutRef.current);
    const delay = (nextPlaybackTimeRef.current - playCtx.currentTime) * 1000;
    speakingTimeoutRef.current = setTimeout(() => {
      setIsAiSpeaking(false);
    }, delay);
  };

  const stopPlayback = () => {
    setIsAiSpeaking(false);
    clearTimeout(speakingTimeoutRef.current);
    if (playbackContextRef.current) {
      playbackContextRef.current.close().catch(() => {});
      playbackContextRef.current = null;
    }
    nextPlaybackTimeRef.current = 0;
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    isMutedRef.current = nextMuted;
  };

  useEffect(() => {
    return () => {
      stopConnection();
    };
  }, []);

  return (
    <Card className="w-full max-w-2xl mx-auto overflow-hidden border-none shadow-2xl bg-stone-50/50 backdrop-blur-sm">
      <CardHeader className="bg-stone-900 text-stone-50 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-2xl font-serif tracking-tight">Giáo sư Triết học số</CardTitle>
              {isConnected && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 ${
                  engineMode === 'live' ? 'bg-emerald-800/80 text-emerald-200 border border-emerald-600' : 'bg-blue-800/80 text-blue-200 border border-blue-600'
                }`}>
                  <Radio className="w-3 h-3 animate-pulse" />
                  {engineMode === 'live' ? 'Live Audio' : 'Voice Engine'}
                </span>
              )}
            </div>
            <CardDescription className="text-stone-400 font-sans">Trợ giảng AI - Tương tác giọng nói trực tiếp</CardDescription>
          </div>
          <div className="flex gap-2">
            {!isConnected ? (
              <Button 
                onClick={() => startConnection(true)} 
                disabled={isConnecting}
                className="bg-emerald-700 hover:bg-emerald-800 text-white border-none shadow-md"
              >
                {isConnecting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mic className="w-4 h-4 mr-2" />}
                Bắt đầu phiên làm việc
              </Button>
            ) : (
              <Button 
                onClick={stopConnection} 
                variant="destructive"
                className="bg-red-800 hover:bg-red-900 shadow-md"
              >
                Ngắt kết nối
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 md:p-8 space-y-6">
        <div className="min-h-[200px] flex flex-col justify-center items-center space-y-6">
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{error}</span>
                </div>
                {!isConnected && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => startConnection(false)} 
                    className="text-xs h-7 bg-white text-stone-800 hover:bg-stone-100 shrink-0"
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Thử lại
                  </Button>
                )}
              </motion.div>
            )}

            {!isConnected ? (
              <motion.div 
                key="idle"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-center space-y-4"
              >
                <div className="flex justify-center mx-auto mb-2">
                  <SchoolLogo className="w-24 h-24 md:w-28 md:h-28" />
                </div>
                <div className="space-y-3">
                  <p className="text-stone-800 font-semibold text-base">Nhấn "Bắt đầu phiên làm việc" để kết nối hệ thống.</p>
                  
                  {/* Rule Callout Box */}
                  <div className="p-3.5 bg-amber-50/80 border border-amber-200/80 rounded-xl text-xs text-amber-950 text-left max-w-lg mx-auto space-y-2">
                    <div className="flex items-center gap-1.5 font-bold text-amber-900">
                      <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Quy tắc vận hành từ khóa:</span>
                    </div>
                    <ul className="list-disc pl-4 space-y-1 text-stone-700">
                      <li>
                        <span className="font-semibold text-emerald-800">Bắt đầu / Kích hoạt:</span> Gọi <span className="font-bold text-emerald-900 font-mono bg-emerald-100 px-1 py-0.5 rounded">"Giáo sư..."</span> để bắt đầu thảo luận.
                      </li>
                      <li>
                        <span className="font-semibold text-amber-800">Trạng thái chờ (Im lặng tuyệt đối):</span> Giáo sư sẽ <span className="font-bold text-amber-900">tuyệt đối giữ im lặng</span>, không tự ý lên tiếng khi chưa có từ khóa <span className="font-mono">"Giáo sư"</span>.
                      </li>
                      <li>
                        <span className="font-semibold text-red-800">Tạm dừng về chế độ chờ:</span> Nói <span className="font-bold text-red-900 font-mono bg-red-100 px-1 py-0.5 rounded">"Dừng"</span> hoặc <span className="font-bold text-red-900 font-mono bg-red-100 px-1 py-0.5 rounded">"Kết thúc"</span>.
                      </li>
                    </ul>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="active"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-full space-y-6"
              >
                {/* Real-time Status Badge & Controls */}
                <div className={`p-4 rounded-xl border text-center transition-all shadow-sm ${
                  activationState === 'active' 
                    ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950 ring-2 ring-emerald-400/20' 
                    : 'bg-amber-50/90 border-amber-300 text-amber-950 ring-2 ring-amber-400/20'
                }`}>
                  <div className="flex items-center justify-center gap-2 mb-1.5">
                    <span className={`w-3 h-3 rounded-full ${activationState === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                    <span className="font-bold text-xs uppercase tracking-wider">
                      {activationState === 'active' ? '● TRẠNG THÁI: ĐÃ KÍCH HOẠT (ĐANG LÀM VIỆC)' : '○ TRẠNG THÁI: ĐANG CHỜ TỪ KHÓA (IM LẶNG TUYỆT ĐỐI)'}
                    </span>
                  </div>
                  
                  <p className="text-xs mb-3 font-medium">
                    {activationState === 'active'
                      ? 'Giáo sư đang tham gia thảo luận. Nói "Dừng" hoặc "Kết thúc" để quay về trạng thái chờ.'
                      : 'Giáo sư đang giữ im lặng tuyệt đối. Hãy nói "Giáo sư..." hoặc bấm nút dưới để kích hoạt.'}
                  </p>

                  <div className="flex flex-wrap justify-center gap-2 pt-2 border-t border-stone-200">
                    <Button 
                      size="sm" 
                      onClick={() => updateActivationState('active')}
                      className={`text-xs h-8 px-3.5 font-medium transition-all ${
                        activationState === 'active' 
                          ? 'bg-emerald-700 text-white shadow-md' 
                          : 'bg-white border border-emerald-400 text-emerald-800 hover:bg-emerald-50'
                      }`}
                    >
                      <Play className="w-3.5 h-3.5 mr-1" />
                      Kích hoạt: "Giáo sư..."
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={() => updateActivationState('standby')}
                      className={`text-xs h-8 px-3.5 font-medium transition-all ${
                        activationState === 'standby' 
                          ? 'bg-amber-700 text-white shadow-md' 
                          : 'bg-white border border-amber-400 text-amber-800 hover:bg-amber-50'
                      }`}
                    >
                      <PauseCircle className="w-3.5 h-3.5 mr-1" />
                      Tạm dừng: "Dừng / Kết thúc"
                    </Button>
                  </div>
                </div>

                <div className="flex justify-center items-center gap-12 pt-2">
                  {/* User Mic Visualizer */}
                  <div className="relative text-center">
                    <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 mx-auto ${isMuted ? 'bg-stone-200' : 'bg-red-100'}`}>
                      {isMuted ? <MicOff className="w-10 h-10 text-stone-400" /> : <Mic className="w-10 h-10 text-red-600" />}
                    </div>
                    <span className="text-xs font-semibold text-stone-500 mt-2 block">
                      {isMuted ? "Micro đã tắt tiếng" : "Micro đang thu"}
                    </span>
                    {!isMuted && !isAiSpeaking && (
                      <motion.div 
                        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.2, 0.5] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="absolute inset-0 bg-red-400 rounded-full -z-10"
                      />
                    )}
                  </div>

                  {/* AI Professor Avatar Visualizer */}
                  <div className="relative text-center flex flex-col items-center">
                    <div className={`w-28 h-28 rounded-full flex items-center justify-center transition-all duration-500 mx-auto p-1 bg-white shadow-md border-2 ${
                      isAiSpeaking 
                        ? 'border-amber-500 ring-4 ring-amber-300/60' 
                        : activationState === 'active'
                          ? 'border-emerald-500 ring-2 ring-emerald-300/40'
                          : 'border-stone-200 opacity-90'
                    }`}>
                      <SchoolLogo className="w-full h-full" animated={false} showNameTag={false} />
                    </div>
                    
                    {/* Prominent Name Tag under active avatar */}
                    <div className="mt-2.5 px-3 py-1 bg-[#121E17] border border-[#F9B217] rounded-full shadow-md flex items-center gap-1.5 z-10">
                      <span className={`w-2 h-2 rounded-full ${activationState === 'active' ? 'bg-[#F9B217] animate-pulse' : 'bg-stone-400'} shrink-0`} />
                      <span className="font-serif font-bold text-white tracking-widest text-[11px] md:text-xs">
                        ĐỖ ĐÌNH CƯỜNG
                      </span>
                    </div>

                    <span className="text-xs font-semibold text-stone-600 mt-1.5 block">
                      {isAiSpeaking 
                        ? "Giáo sư đang giảng giải..." 
                        : isAiThinking
                          ? "Giáo sư đang suy nghĩ..."
                          : activationState === 'active'
                            ? "Giáo sư đang lắng nghe..."
                            : "Giáo sư (Đang chờ từ khóa)"}
                    </span>
                    {isAiSpeaking && (
                      <motion.div 
                        animate={{ scale: [1, 1.25, 1], opacity: [0.6, 0.2, 0.6] }}
                        transition={{ repeat: Infinity, duration: 1.2 }}
                        className="absolute inset-0 bg-amber-400/40 rounded-full -z-10"
                      />
                    )}
                  </div>
                </div>

                {/* Subtitles & Transcriptions */}
                <div className="space-y-3 pt-2">
                  {transcription && (
                    <div className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-sm">
                      <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-1">
                        Âm thanh nhận diện:
                      </p>
                      <p className="text-stone-800 text-sm font-medium">{transcription}</p>
                    </div>
                  )}
                  {aiTranscription && activationState === 'active' && (
                    <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-200 shadow-sm">
                      <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider mb-1">
                        Giáo sư:
                      </p>
                      <p className="text-stone-900 leading-relaxed text-sm">{aiTranscription}</p>
                    </div>
                  )}
                </div>

                <div className="flex justify-center pt-2">
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={toggleMute}
                    className={`rounded-full w-12 h-12 ${isMuted ? 'bg-red-50 text-red-600 border-red-200' : 'text-stone-600'}`}
                    title={isMuted ? "Bật micro" : "Tắt tiếng micro"}
                  >
                    {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
}
