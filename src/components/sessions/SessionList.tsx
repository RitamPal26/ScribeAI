'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Trash2, 
  FileText, 
  Clock, 
  Calendar,
  Download,
  ExternalLink 
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface Session {
  id: string;
  title: string;
  duration: number;
  status: string;
  source: string;
  createdAt: string;
  _count: {
    transcripts: number;
  };
  summary: { id: string } | null;
}

interface SessionListProps {
  sessions: Session[];
  onDelete: (sessionId: string) => void;
}

export function SessionList({ sessions, onDelete }: SessionListProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this recording? This cannot be undone.')) {
      return;
    }

    setDeletingId(sessionId);

    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete session');
      }

      toast.success('Recording deleted successfully');
      onDelete(sessionId);
    } catch (error) {
      console.error('Error deleting session:', error);
      toast.error('Failed to delete recording');
    } finally {
      setDeletingId(null);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-500/10 text-green-600 dark:text-green-400';
      case 'RECORDING':
        return 'bg-red-500/10 text-red-600 dark:text-red-400';
      case 'PROCESSING':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400';
      case 'FAILED':
        return 'bg-red-500/10 text-red-600 dark:text-red-400';
      default:
        return 'bg-gray-500/10 text-gray-600 dark:text-gray-400';
    }
  };

  if (sessions.length === 0) {
    return (
      <Card className="p-12 text-center">
        <FileText className="w-16 h-16 mx-auto mb-4 opacity-20" />
        <h3 className="text-lg font-semibold mb-2">No recordings yet</h3>
        <p className="text-muted-foreground mb-6">
          Start your first recording to see it here
        </p>
        <Button onClick={() => router.push('/dashboard/record')}>
          Start Recording
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {sessions.map((session) => (
        <Card 
          key={session.id} 
          className="p-4 sm:p-6 hover:shadow-lg transition-shadow cursor-pointer"
          onClick={() => router.push(`/dashboard/sessions/${session.id}`)}
        >
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            {/* Left side - Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 mt-1 shrink-0 text-primary" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base sm:text-lg mb-1 truncate">
                    {session.title}
                  </h3>
                  
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-3">
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>{formatDuration(session.duration)}</span>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    
                    <Badge variant="outline" className="text-xs">
                      {session.source === 'MIC' ? '🎤 Microphone' : '🖥️ Tab Audio'}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={getStatusColor(session.status)}>
                      {session.status}
                    </Badge>
                    
                    {session._count.transcripts > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {session._count.transcripts} transcript chunks
                      </span>
                    )}
                    
                    {session.summary && (
                      <Badge variant="secondary" className="text-xs">
                        ✨ Summary available
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right side - Actions */}
            <div className="flex sm:flex-col gap-2 ml-8 sm:ml-0">
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/dashboard/sessions/${session.id}`);
                }}
                className="flex-1 sm:flex-none"
              >
                <ExternalLink className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">View</span>
              </Button>
              
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(session.id);
                }}
                disabled={deletingId === session.id}
                className="flex-1 sm:flex-none text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Delete</span>
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
