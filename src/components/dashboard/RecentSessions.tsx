import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Clock, Calendar, ArrowRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'next/navigation';

interface Session {
  id: string;
  title: string;
  duration: number;
  status: string;
  createdAt: string;
  source: string;
}

interface RecentSessionsProps {
  sessions: Session[];
}

export function RecentSessions({ sessions }: RecentSessionsProps) {
  const router = useRouter();

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-500/10 text-green-600 dark:text-green-400';
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
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Recent Recordings</h2>
        </div>
        <div className="text-center py-12">
          <FileText className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="text-muted-foreground mb-4">
            No recordings yet
          </p>
          <Button onClick={() => router.push('/dashboard/record')}>
            Create Your First Recording
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Recent Recordings</h2>
        <Button 
          variant="ghost" 
          onClick={() => router.push('/dashboard/sessions')}
        >
          View All
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>

      <div className="space-y-4">
        {sessions.map((session) => (
          <div
            key={session.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
            onClick={() => router.push(`/dashboard/sessions/${session.id}`)}
          >
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <FileText className="w-5 h-5 mt-1 flex-shrink-0 text-primary" />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium truncate mb-1">
                  {session.title}
                </h3>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDuration(session.duration)}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 ml-8 sm:ml-0">
              <Badge className={getStatusColor(session.status)}>
                {session.status}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {session.source === 'MIC' ? '🎤' : '🖥️'}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
