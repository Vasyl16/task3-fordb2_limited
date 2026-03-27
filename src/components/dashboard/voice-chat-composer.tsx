"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Loader2, Mic, Play, Send, Square, Waves } from "lucide-react";

export type VoiceComposerSendResult =
  | {
      mode: "authenticated";
      chatId: string;
      chatTitle: string;
      lastMessageAt: string;
      userMessage: {
        id: string;
        role: 'USER';
        transcript: string | null;
        audioUrl: string | null;
        createdAt: string;
      };
      assistantMessage: {
        id: string;
        role: 'ASSISTANT';
        transcript: string | null;
        audioUrl: string | null;
        createdAt: string;
      };
    }
  | {
      mode: "guest";
      transcript: string;
      remainingFreeGuestCalls: number;
    };

type VoiceChatComposerProps = {
  activeChatId?: string;
  sendDisabledReason?: string | null;
  onSendStart?: (localAudioUrl: string) => void;
  onSendComplete?: (result: VoiceComposerSendResult) => void;
  onSendError?: () => void;
};

export function VoiceChatComposer({
  activeChatId,
  sendDisabledReason,
  onSendStart,
  onSendComplete,
  onSendError,
}: VoiceChatComposerProps) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isMediaRecorderSupported, setIsMediaRecorderSupported] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioMimeType, setAudioMimeType] = useState("");
  const [audioPreviewUrl, setAudioPreviewUrl] = useState("");
  const [recordingLabel, setRecordingLabel] = useState("No voice note recorded yet.");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsMediaRecorderSupported(Boolean(window.MediaRecorder && navigator.mediaDevices));

    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (!audioBlob) {
      setAudioPreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(audioBlob);
    setAudioPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [audioBlob]);

  const canSend = useMemo(() => {
    return Boolean(audioBlob) && !isRecording && !isUploading && !sendDisabledReason;
  }, [
    audioBlob,
    isRecording,
    isUploading,
    sendDisabledReason,
  ]);

  function getSupportedMimeType() {
    const candidates = [
      "audio/ogg;codecs=opus",
      "audio/webm;codecs=opus",
      "audio/mp4",
    ];

    for (const mimeType of candidates) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        return mimeType;
      }
    }

    return "";
  }

  async function startRecording() {
    setError(null);
    setAudioBlob(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      chunksRef.current = [];
      streamRef.current = stream;
      mediaRecorderRef.current = recorder;
      setAudioMimeType(recorder.mimeType);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setError("Recording failed. Please retry.");
        setIsRecording(false);
      };

      recorder.onstop = () => {
        const nextAudioBlob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });

        setAudioBlob(nextAudioBlob);
        setRecordingLabel(
          nextAudioBlob.size > 0
            ? `Voice note ready (${Math.max(1, Math.round(nextAudioBlob.size / 1024))} KB)`
            : "No audio captured.",
        );
      setIsRecording(false);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setRecordingLabel("Recording... Speak now.");
      setIsRecording(true);
    } catch {
      setError("Microphone access is required to record a voice note.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }

  async function sendVoiceNote() {
    if (!audioBlob) {
      setError("Record a voice note before sending it to AI.");
      return;
    }

    setIsUploading(true);
    setError(null);
    const localAudioUrl = URL.createObjectURL(audioBlob);
    onSendStart?.(localAudioUrl);

    try {
      const formData = new FormData();
      const fileExtension = audioMimeType.includes("ogg")
        ? "ogg"
        : audioMimeType.includes("mp4")
          ? "m4a"
          : "webm";
      const file = new File([audioBlob], `voice-note.${fileExtension}`, {
        type: audioMimeType || audioBlob.type || "audio/webm",
      });

      formData.append("audio", file);

      if (activeChatId) {
        formData.append("chatId", activeChatId);
      }

      const response = await fetch("/api/chats", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as {
        mode?: "authenticated" | "guest";
        chatId?: string;
        chatTitle?: string;
        lastMessageAt?: string;
        userMessage?: {
          id: string;
          role: 'USER';
          transcript: string | null;
          audioUrl: string | null;
          createdAt: string;
        };
        assistantMessage?: {
          id: string;
          role: 'ASSISTANT';
          transcript: string | null;
          audioUrl: string | null;
          createdAt: string;
        };
        transcript?: string;
        remainingFreeGuestCalls?: number;
        error?: string;
      };

      if (!response.ok || !payload.mode) {
        throw new Error(payload.error ?? "Failed to transcribe the voice note.");
      }

      setAudioBlob(null);
      setRecordingLabel("Voice note sent.");

      if (payload.mode === "guest") {
        if (!payload.transcript || payload.remainingFreeGuestCalls === undefined) {
          throw new Error("Guest transcription response is incomplete.");
        }

        onSendComplete?.({
          mode: "guest",
          transcript: payload.transcript,
          remainingFreeGuestCalls: payload.remainingFreeGuestCalls,
        });
        return;
      }

      if (
        !payload.chatId ||
        !payload.chatTitle ||
        !payload.lastMessageAt ||
        !payload.userMessage ||
        !payload.assistantMessage
      ) {
        throw new Error("Authenticated transcription response is incomplete.");
      }

      onSendComplete?.({
        mode: "authenticated",
        chatId: payload.chatId,
        chatTitle: payload.chatTitle,
        lastMessageAt: payload.lastMessageAt,
        userMessage: payload.userMessage,
        assistantMessage: payload.assistantMessage,
      });
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Failed to process your voice note.",
      );
      onSendError?.();
      URL.revokeObjectURL(localAudioUrl);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="rounded-[2rem] border border-white/10 bg-black/40 p-4 shadow-2xl shadow-black/30 backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="font-medium text-white">Voice to text</p>
          <p className="text-sm text-zinc-400">
            Record a voice note, preview it, then send it to OpenRouter for transcription.
          </p>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
          Voice only
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
        <div className="flex items-center gap-2 text-sm text-zinc-300">
          <Waves className="size-4 text-violet-300" />
          <span>{recordingLabel}</span>
        </div>
        {audioBlob && audioPreviewUrl ? (
          <div className="mt-4 rounded-[1.25rem] border border-white/10 bg-black/30 p-4">
            <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-zinc-500">
              <Play className="size-3.5" />
              Recorded preview
            </div>
            <audio className="w-full" controls preload="metadata" src={audioPreviewUrl}>
              <track kind="captions" />
            </audio>
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          className="inline-flex items-center gap-2 rounded-full bg-violet-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!isMediaRecorderSupported || isUploading}
          onClick={isRecording ? stopRecording : startRecording}
          type="button"
        >
          {isRecording ? <Square className="size-4" /> : <Mic className="size-4" />}
          {isRecording ? "Stop recording" : "Start recording"}
        </button>

        <button
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60 disabled:pointer-events-none disabled:hover:bg-white/5"
          disabled={!canSend}
          onClick={sendVoiceNote}
          type="button"
        >
          {isUploading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Send voice note
        </button>

        <button
          className="inline-flex items-center gap-2 rounded-full border border-transparent px-3 py-2 text-sm text-zinc-400 transition hover:text-white"
          disabled={!audioBlob && !isRecording}
          onClick={() => {
            stopRecording();
            setAudioBlob(null);
            setRecordingLabel("No voice note recorded yet.");
            setError(null);
          }}
          type="button"
        >
          Clear
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-xs text-zinc-500">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
          <CheckCircle2 className="size-3.5 text-emerald-300" />
          Voice upload only, no manual typing
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
          <CheckCircle2 className="size-3.5 text-emerald-300" />
          Transcript appears as a separate AI message
        </div>
      </div>

      {!isMediaRecorderSupported ? (
        <p className="mt-3 text-sm text-amber-300">
          This browser does not support microphone recording here. Use a recent Chrome, Edge, or
          Safari build.
        </p>
      ) : null}

      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
      {sendDisabledReason ? (
        <p className="mt-3 text-sm text-amber-300">{sendDisabledReason}</p>
      ) : null}
    </div>
  );
}
