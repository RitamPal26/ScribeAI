'use client';

import { useRecordingStore } from '@/stores/recordingStore';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function RecordingStatus() {
  const status = useRecordingStore((state) => state.status);

  const statusConfig = {
    idle: {
      label: 'Ready',
      color: 'bg-gray-500',
      animation: '',
    },
    recording: {
      label: 'Recording',
      color: 'bg-red-500',
      animation: 'animate-pulse',
    },
    paused: {
      label: 'Paused',
      color: 'bg-yellow-500',
      animation: '',
    },
    processing: {
      label: 'Processing',
      color: 'bg-blue-500',
      animation: 'animate-pulse',
    },
    completed: {
      label: 'Completed',
      color: 'bg-green-500',
      animation: '',
    },
    error: {
      label: 'Error',
      color: 'bg-red-600',
      animation: '',
    },
  };

  const config = statusConfig[status];

  return (
    <div className="flex items-center justify-center gap-3 sm:gap-4">
      <div className="flex items-center gap-2">
        <div className={cn(
          'w-3 h-3 sm:w-4 sm:h-4 rounded-full',
          config.color,
          config.animation
        )} />
        <Badge 
          variant="outline" 
          className="text-xs sm:text-sm px-3 py-1 sm:px-4 sm:py-1.5 font-medium"
        >
          {config.label}
        </Badge>
      </div>
    </div>
  );
}
