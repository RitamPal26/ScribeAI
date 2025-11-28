"use client";

import { useRecording } from "@/hooks/useRecording";
import { Button } from "@/components/ui/button";
import { Mic, Square, Pause, Play, Loader2 } from "lucide-react";
import { useRecordingStore } from "@/stores/recordingStore";
import { toast } from "sonner";
import { useEffect } from "react";

export function RecordingControls() {
  const {
    status,
    error,
    permissionStatus,
    isConnected,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
  } = useRecording();

  const source = useRecordingStore((state) => state.source);

  // Show error toasts
  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  // Show connection status
  useEffect(() => {
    if (!isConnected && status !== "idle") {
      toast.error("Connection lost. Recording will stop.");
    }
  }, [isConnected, status]);

  const handleStart = async () => {
    if (!isConnected) {
      toast.error("Not connected to server. Please refresh the page.");
      return;
    }

    if (permissionStatus === "denied") {
      toast.error(
        "Microphone permission denied. Please enable it in browser settings."
      );
      return;
    }

    await startRecording(source);
  };

  const handleStop = async () => {
    await stopRecording();
    toast.success("Recording stopped. Processing transcript...");
  };

  // Idle state - Show start button
  if (status === "idle") {
    return (
      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
        <Button
          size="lg"
          className="flex-1 h-14 sm:h-16 text-base sm:text-lg"
          onClick={handleStart}
          disabled={!isConnected}
        >
          <Mic className="w-5 h-5 sm:w-6 sm:h-6 mr-2" />
          Start Recording
        </Button>
      </div>
    );
  }

  // Recording state - Show pause and stop
  if (status === "recording") {
    return (
      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
        <Button
          size="lg"
          variant="outline"
          className="flex-1 h-14 sm:h-16 text-base sm:text-lg"
          onClick={pauseRecording}
        >
          <Pause className="w-5 h-5 sm:w-6 sm:h-6 mr-2" />
          Pause
        </Button>

        <Button
          size="lg"
          variant="destructive"
          className="flex-1 h-14 sm:h-16 text-base sm:text-lg"
          onClick={handleStop}
        >
          <Square className="w-5 h-5 sm:w-6 sm:h-6 mr-2" />
          Stop
        </Button>
      </div>
    );
  }

  // Paused state - Show resume and stop
  if (status === "paused") {
    return (
      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
        <Button
          size="lg"
          className="flex-1 h-14 sm:h-16 text-base sm:text-lg"
          onClick={resumeRecording}
        >
          <Play className="w-5 h-5 sm:w-6 sm:h-6 mr-2" />
          Resume
        </Button>

        <Button
          size="lg"
          variant="destructive"
          className="flex-1 h-14 sm:h-16 text-base sm:text-lg"
          onClick={handleStop}
          // 👇 ADD THIS LINE TO PREVENT DOUBLE-CLICKS
          disabled={status === "processing" || status === "completed"}
        >
          {status === "processing" ? (
            // Optional: Show a spinner while processing
            <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 mr-2 animate-spin" />
          ) : (
            <Square className="w-5 h-5 sm:w-6 sm:h-6 mr-2 fill-current" />
          )}
          {status === "processing" ? "Processing..." : "Stop"}
        </Button>
      </div>
    );
  }

  // Processing state - Show loader
  if (status === "processing") {
    return (
      <div className="flex items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
        <span className="text-sm sm:text-base">Processing recording...</span>
      </div>
    );
  }

  // Completed state
  if (status === "completed") {
    return (
      <div className="flex flex-col gap-3 w-full max-w-md">
        <div className="text-center text-green-600 dark:text-green-400 text-sm sm:text-base mb-2">
          ✓ Recording completed successfully!
        </div>
        <Button
          size="lg"
          className="w-full h-14 sm:h-16 text-base sm:text-lg"
          onClick={handleStart}
        >
          <Mic className="w-5 h-5 sm:w-6 sm:h-6 mr-2" />
          New Recording
        </Button>
      </div>
    );
  }

  return null;
}
