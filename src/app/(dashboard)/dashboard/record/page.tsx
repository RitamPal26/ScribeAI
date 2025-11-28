import { SourceSelector } from "@/components/recording/SourceSelector";
import { RecordingStatus } from "@/components/recording/RecordingStatus";
import { RecordingTimer } from "@/components/recording/RecordingTimer";
import { RecordingControls } from "@/components/recording/RecordingControls";
import { TranscriptDisplay } from "@/components/recording/TranscriptDisplay";
import { ActiveSourceIndicator } from "@/components/recording/ActiveSourceIndicator";
import { Card } from "@/components/ui/card";

export default function RecordPage() {
  return (
    <div className="min-h-screen w-full bg-background">
      <div className="container max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 md:py-12">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-2 sm:mb-3">
            ScribeAI Recorder
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Record audio and get real-time AI transcription
          </p>
        </div>

        {/* Main Recording Interface */}
        <div className="space-y-6 sm:space-y-8">
          {/* Source Selection */}
          <div className="flex justify-center">
            <SourceSelector />
          </div>

          {/* Recording Card */}
          <Card className="p-6 sm:p-8 md:p-12">
            <div className="space-y-6 sm:space-y-8">
              {/* Status */}
              <RecordingStatus />

              {/* Active Source Indicator */}
              <ActiveSourceIndicator />

              {/* Timer */}
              <RecordingTimer />

              {/* Controls */}
              <div className="flex justify-center">
                <RecordingControls />
              </div>
            </div>
          </Card>

          {/* Transcript Display */}
          <TranscriptDisplay />
        </div>

        {/* Info Footer */}
        <div className="mt-8 sm:mt-12 text-center text-xs sm:text-sm text-muted-foreground space-y-2">
          <p>
            💡 Tip: Audio is processed in 20-second chunks for real-time
            transcription
          </p>
          <p className="text-xs">
            Make sure to allow microphone permissions when prompted
          </p>
        </div>
      </div>
    </div>
  );
}
