'use client';

import { useRecordingStore } from '@/stores/recordingStore';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowDown, Copy, FileText } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

export function TranscriptDisplay() {
  const { transcriptChunks, fullTranscript, status } = useRecordingStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Auto-scroll to bottom when new chunks arrive
  useEffect(() => {
    if (scrollRef.current && status === 'recording') {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcriptChunks, status]);

  // Check if user scrolled up
  const handleScroll = () => {
    if (!scrollRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isScrolledUp = scrollHeight - scrollTop - clientHeight > 100;
    setShowScrollButton(isScrolledUp);
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  };

  const copyTranscript = () => {
    navigator.clipboard.writeText(fullTranscript);
    toast.success('Transcript copied to clipboard');
  };

  if (transcriptChunks.length === 0) {
    return (
      <Card className="w-full p-6 sm:p-8 md:p-12">
        <div className="flex flex-col items-center justify-center text-center text-muted-foreground space-y-3">
          <FileText className="w-12 h-12 sm:w-16 sm:h-16 opacity-20" />
          <p className="text-sm sm:text-base">
            Transcript will appear here as you record
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="w-full relative">
      {/* Header */}
      <div className="flex items-center justify-between p-3 sm:p-4 border-b">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
          <h3 className="font-semibold text-sm sm:text-base">Live Transcript</h3>
          <span className="text-xs sm:text-sm text-muted-foreground">
            ({transcriptChunks.length} chunks)
          </span>
        </div>
        
        <Button
          size="sm"
          variant="ghost"
          onClick={copyTranscript}
          className="text-xs sm:text-sm"
        >
          <Copy className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
          <span className="hidden sm:inline">Copy</span>
        </Button>
      </div>

      {/* Transcript content */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="p-4 sm:p-6 space-y-3 sm:space-y-4 max-h-[300px] sm:max-h-[400px] md:max-h-[500px] overflow-y-auto"
      >
        {transcriptChunks.map((chunk, index) => (
          <div
            key={chunk.chunkIndex}
            className="flex gap-3 sm:gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300"
          >
            <div className="shrink-0">
              <span className="inline-flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-primary/10 text-primary text-xs sm:text-sm font-medium">
                {chunk.chunkIndex + 1}
              </span>
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="text-sm sm:text-base leading-relaxed wrap-break-words">
                {chunk.text}
              </p>
              {chunk.confidence && (
                <p className="text-xs text-muted-foreground mt-1">
                  Confidence: {(chunk.confidence * 100).toFixed(0)}%
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <Button
          size="sm"
          variant="secondary"
          className="absolute bottom-4 right-4 shadow-lg"
          onClick={scrollToBottom}
        >
          <ArrowDown className="w-4 h-4" />
        </Button>
      )}
    </Card>
  );
}
