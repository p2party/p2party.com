import { useRef, useState } from "react";
import { MicrophoneIcon } from "@heroicons/react/24/solid";
import { Button } from "../button";

export interface MessageInputProps {
  handleFiles: (files: FileList) => void;
}

const MicrophoneButton = ({ handleFiles }: MessageInputProps) => {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState("");

  const synthFileList = (file: File): FileList => {
    const dt = new DataTransfer();
    dt.items.add(file);
    return dt.files;
  };

  const pickMime = () => {
    const c = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/mp4",
    ];
    for (const m of c) {
      if (window.MediaRecorder?.isTypeSupported?.(m)) return m;
    }
    return "";
  };

  const startRecording = async () => {
    if (isRecording) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    try {
      const mimeType = pickMime();
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data?.size) chunksRef.current.push(e.data);
      };

      mr.start();
      setIsRecording(true);
    } catch (cause) {
      // The microphone is already live at this point. If MediaRecorder cannot
      // be constructed or started, release it rather than leaving the browser
      // showing a recording indicator for a recorder that never ran.
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      mediaRecorderRef.current = null;
      throw cause;
    }
  };

  const stopRecording = async () => {
    if (!isRecording) return;
    setIsRecording(false);

    const mr = mediaRecorderRef.current;
    if (!mr) return;

    await new Promise<void>((res) => {
      mr.onstop = () => res();
      if (mr.state === "recording") mr.stop();
      else res();
    });

    try {
      const type = mr.mimeType || "audio/webm";
      const blob = new Blob(chunksRef.current, { type });
      const ext = type.includes("mp4")
        ? "m4a"
        : type.includes("ogg")
          ? "ogg"
          : "webm";
      const file = new File([blob], `recording-${Date.now()}.${ext}`, { type });
      if (file.size > 0) {
        handleFiles(synthFileList(file));
      }
    } finally {
      chunksRef.current = [];
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      mediaRecorderRef.current = null;
    }
  };

  const onPointerDown: React.PointerEventHandler<HTMLButtonElement> = async (
    e,
  ) => {
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      /* empty */
    }
    // React drops this handler's promise, so an unhandled rejection here would
    // be invisible — and a denied permission prompt is the single most common
    // outcome, not an edge case.
    try {
      setError("");
      if (isRecording) await stopRecording();
      else await startRecording();
    } catch (cause) {
      setIsRecording(false);
      const name = cause instanceof DOMException ? cause.name : "";
      setError(
        name === "NotAllowedError" || name === "SecurityError"
          ? "Microphone access was denied. Allow it in your browser to record."
          : name === "NotFoundError"
            ? "No microphone was found."
            : "Recording failed. Check that another app is not using the microphone.",
      );
    }
  };

  const onPointerUp: React.PointerEventHandler<HTMLButtonElement> = async (
    e,
  ) => {
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    } catch {
      /* empty */
    }
  };

  const onPointerCancelOrLeave: React.PointerEventHandler<
    HTMLButtonElement
  > = async () => {
    // await stopRecording();
  };

  return (
    <div className='relative shrink-0'>
      <Button
        ref={btnRef}
        plain
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancelOrLeave}
        onPointerLeave={onPointerCancelOrLeave}
        aria-pressed={isRecording}
        className={`mr-2 shrink-0 cursor-pointer touch-none select-none ${isRecording ? "animate-pulse bg-red-500! text-white! hover:bg-red-600!" : ""}`}
        title={isRecording ? "Recording... press to stop" : "Hold to record"}
      >
        <MicrophoneIcon className='pointer-events-none select-none' />
      </Button>
      {error.length > 0 && (
        <p
          role='alert'
          className='absolute bottom-full left-0 z-10 mb-1 w-64 border border-red-500 bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-200'
        >
          {error}
        </p>
      )}
    </div>
  );
};

export default MicrophoneButton;
