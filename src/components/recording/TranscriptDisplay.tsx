"use client";

import { useRecordingStore } from "@/stores/recordingStore";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowDown, Copy, FileText, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export function TranscriptDisplay() {
  const { transcriptChunks, fullTranscript, status } = useRecordingStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isUserScrolledUp, setIsUserScrolledUp] = useState(false);

  // --- SMART SCROLL LOGIC ---
  useEffect(() => {
    const viewport = scrollRef.current;
    if (!viewport) return;

    // Only auto-scroll if the user hasn't manually scrolled up
    if (!isUserScrolledUp) {
      viewport.scrollTo({
        top: viewport.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [transcriptChunks, isUserScrolledUp]);

  // Check scroll position on scroll event
  const handleScroll = () => {
    if (!scrollRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;

    // If user is more than 100px from the bottom, they are "scrolled up"
    const isUp = scrollHeight - scrollTop - clientHeight > 100;

    setIsUserScrolledUp(isUp);
    setShowScrollButton(isUp);
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
      setIsUserScrolledUp(false); // Reset lock
    }
  };
  // ---------------------------

  const copyTranscript = () => {
    if (!fullTranscript) return;
    navigator.clipboard.writeText(fullTranscript);
    toast.success("Transcript copied to clipboard");
  };

  // Format seconds to MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (transcriptChunks.length === 0) {
    return (
      <Card className="w-full p-6 sm:p-8 md:p-12 border-dashed">
        <div className="flex flex-col items-center justify-center text-center text-muted-foreground space-y-4">
          <div className="p-4 bg-secondary/50 rounded-full">
            <FileText className="w-8 h-8 sm:w-10 sm:h-10 opacity-50" />
          </div>
          <div className="space-y-1">
            <h3 className="font-medium text-foreground">No transcript yet</h3>
            <p className="text-sm">
              {status === "recording"
                ? "Listening for speech..."
                : "Start recording to generate a transcript."}
            </p>
          </div>
          {status === "recording" && (
            <Loader2 className="w-5 h-5 animate-spin text-primary mt-2" />
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card className="w-full relative flex flex-col h-[500px] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 sm:p-4 border-b bg-card z-10">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              status === "recording"
                ? "bg-red-500 animate-pulse"
                : "bg-slate-300"
            }`}
          />
          <h3 className="font-semibold text-sm sm:text-base">
            Live Transcript
          </h3>
          <span className="text-xs text-muted-foreground hidden sm:inline-block">
            ({transcriptChunks.length} segments)
          </span>
        </div>

        <Button
          size="sm"
          variant="ghost"
          onClick={copyTranscript}
          className="text-xs h-8"
          disabled={!fullTranscript}
        >
          <Copy className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5" />
          Copy
        </Button>
      </div>

      {/* Transcript content */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 p-4 space-y-4 overflow-y-auto scroll-smooth"
      >
        {transcriptChunks.map((chunk, index) => (
          <div
            key={`${chunk.chunkIndex}-${chunk.timestamp}`}
            className="flex gap-3 group animate-in fade-in slide-in-from-bottom-1 duration-500"
          >
            {/* Timestamp Column */}
            <div className="shrink-0 w-12 text-xs font-mono text-muted-foreground pt-1 opacity-50 group-hover:opacity-100 transition-opacity">
              {formatTime(chunk.timestamp)}
            </div>

            {/* Text Column */}
            <div className="flex-1 min-w-0">
              <div className="bg-secondary/30 p-3 rounded-lg rounded-tl-none">
                <p className="text-sm sm:text-base text-foreground leading-relaxed">
                  {chunk.text}
                </p>
              </div>

              {/* Metadata (Confidence) */}
              {chunk.confidence < 0.85 && (
                <p className="text-[10px] text-amber-600 mt-1 ml-1">
                  Low confidence ({(chunk.confidence * 100).toFixed(0)}%)
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Floating Scroll Button */}
      {showScrollButton && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 animate-in fade-in zoom-in duration-200">
          <Button
            size="sm"
            variant="default"
            className="rounded-full shadow-xl opacity-90 hover:opacity-100"
            onClick={scrollToBottom}
          >
            <ArrowDown className="w-4 h-4 mr-2" />
            New messages
          </Button>
        </div>
      )}
    </Card>
  );
}
