'use client';

import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Info, CheckCircle } from 'lucide-react';

interface TabAudioInstructionsProps {
  open: boolean;
  onClose: () => void;
  onProceed: () => void;
}

export function TabAudioInstructions({ open, onClose, onProceed }: TabAudioInstructionsProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="w-5 h-5 text-primary" />
            Tab Audio Recording
          </DialogTitle>
          <DialogDescription>
            Follow these steps to record audio from a browser tab
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-sm font-semibold text-primary">1</span>
            </div>
            <div>
              <h4 className="font-medium mb-1">Select Browser Tab</h4>
              <p className="text-sm text-muted-foreground">
                Choose the tab you want to record (e.g., Google Meet, Zoom, YouTube)
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-sm font-semibold text-primary">2</span>
            </div>
            <div>
              <h4 className="font-medium mb-1">Enable Audio Sharing</h4>
              <p className="text-sm text-muted-foreground">
                <strong className="text-orange-600 dark:text-orange-400">Important:</strong> Check the "Share audio" checkbox in the sharing dialog
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-sm font-semibold text-primary">3</span>
            </div>
            <div>
              <h4 className="font-medium mb-1">Start Recording</h4>
              <p className="text-sm text-muted-foreground">
                Click "Share" and the recording will begin automatically
              </p>
            </div>
          </div>

          <div className="bg-muted p-4 rounded-lg mt-4">
            <div className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium mb-1">Works with:</p>
                <p className="text-muted-foreground">
                  Google Meet, Zoom, Microsoft Teams, YouTube, Spotify, and any browser tab with audio
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={onProceed} className="flex-1">
            Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
