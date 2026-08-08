import { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from "@google/genai";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Mic, MicOff, Volume2, VolumeX, Loader2, MessageSquare } from "lucide-react";
import { arrayBufferToBase64, base64ToArrayBuffer, float32ToInt16, int16ToFloat32 } from "@/src/lib/audio-utils";
import { motion, AnimatePresence } from "motion/react";
import SchoolLogo from './SchoolLogo';

const MODEL_NAME = "gemini-3.1-flash-live-preview";

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

  const aiRef = useRef<any>(null);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const nextPlaybackTimeRef = useRef(0);
  const speakingTimeoutRef = useRef<any>(null);
  const isSessionActiveRef = useRef(false);

  const startConnection = async () => {
    if (isConnecting || isConnected) return;
    setError(null);
    setIsConnecting(true);
    setActivationState('standby');

    try {
      // Request microphone permission immediately on user gesture
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      aiRef.current = ai;

      const sessionPromise = ai.live.connect({
        model: MODEL_NAME,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            console.log("Live API connected");
            setIsConnected(true);
            isSessionActiveRef.current = true;
            setIsConnecting(false);
            
            sessionPromise.then(session => {
              sessionRef.current = session;
              startMic(session);
            });
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle audio output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              const audioData = base64ToArrayBuffer(base64Audio);
              const float32Data = int16ToFloat32(new Int16Array(audioData));
              scheduleAudio(float32Data);
            }

            // Handle input transcription and keyword detection
            const inputTranscription = (message as any).serverContent?.inputAudioTranscription?.transcription;
            if (inputTranscription) {
              setTranscription(inputTranscription);
              const textLower = inputTranscription.toLowerCase();
              if (textLower.includes("giáo sư") || textLower.includes("giao su")) {
                setActivationState('active');
              } else if (textLower.includes("kết thúc") || textLower.includes("dừng") || textLower.includes("ngắt") || textLower.includes("stop")) {
                setActivationState('standby');
                stopPlayback();
              }
            }

            // Handle output transcription
            const outputTranscription = (message as any).serverContent?.modelTurn?.parts?.find((p: any) => p.text)?.text;
            if (outputTranscription) {
              setAiTranscription(prev => prev + " " + outputTranscription);
              setActivationState('active');
            }

            if (message.serverContent?.interrupted) {
              stopPlayback();
            }
          },
          onerror: (error) => {
            console.error("Live API error:", error);
            setError("Lỗi kết nối AI. Vui lòng thử lại.");
            stopConnection();
          },
          onclose: () => {
            console.log("Live API closed");
            stopConnection();
          },
        },
      });

    } catch (error: any) {
      console.error("Failed to connect to Live API:", error);
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setError("Không thể truy cập micro. Vui lòng kiểm tra cài đặt trình duyệt và cho phép ứng dụng sử dụng micro.");
      } else {
        setError("Không thể khởi tạo kết nối. Vui lòng thử lại.");
      }
      setIsConnecting(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }
  };

  const stopConnection = () => {
    isSessionActiveRef.current = false;
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    stopMic();
    stopPlayback();
    setIsConnected(false);
    setIsConnecting(false);
    setActivationState('standby');
    setTranscription("");
    setAiTranscription("");
  };

  const startMic = async (session: any) => {
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
        if (isMuted || !isSessionActiveRef.current || session !== sessionRef.current) return;

        const inputData = e.data;
        const int16Data = float32ToInt16(inputData);
        const base64Data = arrayBufferToBase64(int16Data.buffer);

        try {
          const result = session.sendRealtimeInput({
            audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
          });
          
          // Handle potential async return
          if (result instanceof Promise) {
            result.catch((err: any) => {
              console.error("Async error sending audio input:", err);
              isSessionActiveRef.current = false;
              stopConnection();
            });
          }
        } catch (err) {
          console.error("Error sending audio input:", err);
          isSessionActiveRef.current = false;
          stopConnection();
        }
      };

      source.connect(workletNode);
      workletNode.connect(audioContext.destination);
    } catch (error) {
      console.error("Failed to start microphone:", error);
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
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  const scheduleAudio = (float32Data: Float32Array) => {
    if (!playbackContextRef.current) {
      playbackContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      nextPlaybackTimeRef.current = playbackContextRef.current.currentTime;
    }
    const playCtx = playbackContextRef.current;
    
    if (playCtx.state === 'suspended') {
      playCtx.resume();
    }

    // Ensure we don't schedule in the past
    if (nextPlaybackTimeRef.current < playCtx.currentTime) {
      nextPlaybackTimeRef.current = playCtx.currentTime + 0.05; // 50ms buffer
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
      playbackContextRef.current.close().catch(console.error);
      playbackContextRef.current = null;
    }
    nextPlaybackTimeRef.current = 0;
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  useEffect(() => {
    return () => {
      stopConnection();
    };
  }, []);

  return (
    <Card className="w-full max-w-2xl mx-auto overflow-hidden border-none shadow-2xl bg-stone-50/50 backdrop-blur-sm">
      <CardHeader className="bg-stone-900 text-stone-50 p-6">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl font-serif tracking-tight">Giáo sư Triết học số</CardTitle>
            <CardDescription className="text-stone-400 font-sans">Trợ giảng AI - Tương tác giọng nói thời gian thực</CardDescription>
          </div>
          <div className="flex gap-2">
            {!isConnected ? (
              <Button 
                onClick={startConnection} 
                disabled={isConnecting}
                className="bg-red-700 hover:bg-red-800 text-white border-none"
              >
                {isConnecting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mic className="w-4 h-4 mr-2" />}
                Bắt đầu thảo luận
              </Button>
            ) : (
              <Button 
                onClick={stopConnection} 
                variant="destructive"
                className="bg-stone-700 hover:bg-stone-800"
              >
                Dừng thảo luận
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-8 space-y-6">
        <div className="min-h-[200px] flex flex-col justify-center items-center space-y-6">
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full p-4 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm text-center mb-4"
              >
                {error}
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
                <div className="space-y-2">
                  <p className="text-stone-700 font-medium">Nhấn "Bắt đầu" để bật micro và kết nối với Giáo sư.</p>
                  <p className="text-stone-500 text-xs max-w-md mx-auto">
                    Cơ chế từ khóa: Bắt đầu câu nói bằng <span className="font-semibold text-red-700 font-mono">"Giáo sư..."</span> để kích hoạt. Nói <span className="font-semibold text-stone-700 font-mono">"Dừng"</span> hoặc <span className="font-semibold text-stone-700 font-mono">"Kết thúc"</span> để quay lại trạng thái chờ.
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="active"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-full space-y-6"
              >
                {/* Status Indicator Banner */}
                <div className={`p-4 rounded-xl border text-center transition-all ${
                  activationState === 'active' 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                    : 'bg-amber-50/80 border-amber-200 text-amber-900'
                }`}>
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <span className={`w-2.5 h-2.5 rounded-full ${activationState === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                    <span className="font-bold text-xs uppercase tracking-wider">
                      {activationState === 'active' ? 'Trạng thái: Đã kích hoạt' : 'Trạng thái: Đang chờ từ khóa'}
                    </span>
                  </div>
                  <p className="text-xs mb-3">
                    {activationState === 'active'
                      ? 'Đang duy trì hội thoại liên tục. Nói "Kết thúc" hoặc "Dừng" để quay lại trạng thái chờ.'
                      : 'Bắt đầu câu nói bằng "Giáo sư..." để kích hoạt. Tạp âm và câu nói không gọi Giáo sư sẽ bị bỏ qua.'}
                  </p>
                  <div className="flex justify-center gap-2 pt-1 border-t border-amber-200/60">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setActivationState('active')}
                      className={`text-xs h-7 px-3 ${activationState === 'active' ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700' : 'bg-white border-amber-300 text-amber-900 hover:bg-amber-100'}`}
                    >
                      Gọi "Giáo sư..." (Kích hoạt)
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        setActivationState('standby');
                        stopPlayback();
                      }}
                      className={`text-xs h-7 px-3 ${activationState === 'standby' ? 'bg-amber-600 text-white border-amber-600 hover:bg-amber-700' : 'bg-white border-amber-300 text-amber-900 hover:bg-amber-100'}`}
                    >
                      Nói "Dừng / Kết thúc" (Trạng thái chờ)
                    </Button>
                  </div>
                </div>

                <div className="flex justify-center items-center gap-12 pt-2">
                  <div className="relative text-center">
                    <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 mx-auto ${isMuted ? 'bg-stone-200' : 'bg-red-100'}`}>
                      {isMuted ? <MicOff className="w-10 h-10 text-stone-400" /> : <Mic className="w-10 h-10 text-red-600" />}
                    </div>
                    <span className="text-xs font-semibold text-stone-500 mt-2 block">Micro người dùng</span>
                    {!isMuted && !isAiSpeaking && (
                      <motion.div 
                        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.2, 0.5] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="absolute inset-0 bg-red-400 rounded-full -z-10"
                      />
                    )}
                  </div>

                  <div className="relative text-center flex flex-col items-center">
                    <div className={`w-28 h-28 rounded-full flex items-center justify-center transition-all duration-500 mx-auto p-1 bg-white shadow-md border-2 ${isAiSpeaking ? 'border-amber-500 ring-4 ring-amber-300/60' : 'border-stone-200'}`}>
                      <SchoolLogo className="w-full h-full" animated={false} showNameTag={false} />
                    </div>
                    
                    {/* Prominent Name Tag under active avatar */}
                    <div className="mt-2.5 px-3 py-1 bg-[#121E17] border border-[#F9B217] rounded-full shadow-md flex items-center gap-1.5 z-10">
                      <span className="w-2 h-2 rounded-full bg-[#F9B217] animate-pulse shrink-0" />
                      <span className="font-serif font-bold text-white tracking-widest text-[11px] md:text-xs">
                        ĐỖ ĐÌNH CƯỜNG
                      </span>
                    </div>

                    <span className="text-xs font-semibold text-stone-600 mt-1.5 block">
                      {isAiSpeaking ? "Giáo sư đang giảng..." : "Giáo sư Triết học số"}
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

                <div className="space-y-4 pt-2">
                  {transcription && (
                    <div className="bg-white p-4 rounded-xl border border-stone-100 shadow-sm">
                      <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">Bạn đang nói:</p>
                      <p className="text-stone-700">{transcription}</p>
                    </div>
                  )}
                  {aiTranscription && (
                    <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100 shadow-sm">
                      <p className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-1">Giáo sư:</p>
                      <p className="text-stone-800 leading-relaxed">{aiTranscription}</p>
                    </div>
                  )}
                </div>

                <div className="flex justify-center pt-2">
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={toggleMute}
                    className={`rounded-full w-12 h-12 ${isMuted ? 'bg-red-50 text-red-600 border-red-200' : 'text-stone-600'}`}
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
