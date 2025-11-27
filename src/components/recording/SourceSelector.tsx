'use client';

import { useRecordingStore } from '@/stores/recordingStore';
import { Mic, MonitorSpeaker } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function SourceSelector() {
  const { source, setSource, status } = useRecordingStore();
  const isDisabled = status !== 'idle';

  return (
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
        onClick={() => setSource('TAB_SHARE')}
        disabled={isDisabled}
        title="Tab sharing - Coming on Day 3"
      >
        <MonitorSpeaker className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
        <span className="text-sm sm:text-base">Tab Audio</span>
      </Button>
    </div>
  );
}
