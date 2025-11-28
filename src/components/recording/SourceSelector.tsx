'use client';

import { useState } from 'react';
import { useRecordingStore } from '@/stores/recordingStore';
import { Mic, MonitorSpeaker } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TabAudioInstructions } from './TabAudioInstructions';
import { useRecording } from '@/hooks/useRecording';

export function SourceSelector() {
  const { source, setSource, status } = useRecordingStore();
  const { startRecording } = useRecording();
  const [showInstructions, setShowInstructions] = useState(false);
  const isDisabled = status !== 'idle';

  const handleTabAudioClick = () => {
    if (isDisabled) return;
    setShowInstructions(true);
  };

  const handleProceed = () => {
    setShowInstructions(false);
    setSource('TAB_SHARE');
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
        <Button
          variant={source === 'MIC' ? 'default' : 'outline'}
          className="flex-1 h-12 sm:h-14"
          onClick={() => setSource('MIC')}
          disabled={isDisabled}
        >
          <Mic className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
          <span className="text-sm sm:text-base">Microphone</span>
        </Button>
        
        <Button
          variant={source === 'TAB_SHARE' ? 'default' : 'outline'}
          className="flex-1 h-12 sm:h-14"
          onClick={handleTabAudioClick}
          disabled={isDisabled}
        >
          <MonitorSpeaker className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
          <span className="text-sm sm:text-base">Tab Audio</span>
        </Button>
      </div>

      <TabAudioInstructions 
        open={showInstructions}
        onClose={() => setShowInstructions(false)}
        onProceed={handleProceed}
      />
    </>
  );
}
