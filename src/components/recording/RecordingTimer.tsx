'use client';

import { useRecordingStore } from '@/stores/recordingStore';

export function RecordingTimer() {
  const elapsedTime = useRecordingStore((state) => state.elapsedTime);

  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="text-center">
      <div className="text-4xl sm:text-6xl md:text-7xl font-mono font-bold tracking-wider">
        {formatTime(elapsedTime)}
      </div>
      <p className="text-xs sm:text-sm text-muted-foreground mt-2">
        {elapsedTime >= 3600 ? 'HH:MM:SS' : 'MM:SS'}
      </p>
    </div>
  );
}
