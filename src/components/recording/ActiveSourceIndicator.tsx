"use client";

import { useRecordingStore } from "@/stores/recordingStore";
import { Badge } from "@/components/ui/badge";
import { Mic, MonitorSpeaker } from "lucide-react";

export function ActiveSourceIndicator() {
  const { source, status } = useRecordingStore();

  if (status === "idle" || status === "completed") {
    return null;
  }

  return (
    <div className="flex justify-center mb-4">
      <Badge variant="secondary" className="px-4 py-2 text-sm">
        {source === "MIC" ? (
          <>
            <Mic className="w-4 h-4 mr-2" />
            Recording from Microphone
          </>
        ) : (
          <>
            <MonitorSpeaker className="w-4 h-4 mr-2" />
            Recording from Tab Audio
          </>
        )}
      </Badge>
    </div>
  );
}
