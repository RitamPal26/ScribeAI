"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Clock, TrendingUp, Mic } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { QuickActionCard } from "@/components/dashboard/QuickActionCard";
import { RecentSessions } from "@/components/dashboard/RecentSessions";

interface DashboardStats {
  totalSessions: number;
  totalDuration: number;
  completedSessions: number;
  recentSessions: Array<{
    id: string;
    title: string;
    duration: number;
    status: string;
    createdAt: string;
    source: string;
  }>;
}

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/dashboard/stats");

      if (!response.ok) {
        throw new Error("Failed to fetch stats");
      }

      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const avgDuration = stats?.totalSessions
    ? Math.floor(stats.totalDuration / stats.totalSessions / 60)
    : 0;

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here's your recording overview
          </p>
        </div>

        <Button
          size="lg"
          onClick={() => router.push("/dashboard/record")}
          className="w-full sm:w-auto"
        >
          <Plus className="w-5 h-5 mr-2" />
          New Recording
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatsCard
          title="Total Recordings"
          value={stats?.totalSessions || 0}
          subtitle={`${stats?.completedSessions || 0} completed`}
          icon={FileText}
          iconColor="text-primary bg-primary/10"
        />

        <StatsCard
          title="Total Duration"
          value={Math.floor((stats?.totalDuration || 0) / 60)}
          subtitle="minutes recorded"
          icon={Clock}
          iconColor="text-blue-600 dark:text-blue-400 bg-blue-500/10"
        />

        <StatsCard
          title="Avg. Session"
          value={avgDuration}
          subtitle="minutes average"
          icon={TrendingUp}
          iconColor="text-green-600 dark:text-green-400 bg-green-500/10"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <QuickActionCard
          title="Start Recording"
          description="Record audio and get AI transcription"
          icon={Mic}
          iconColor="text-primary bg-primary/10"
          onClick={() => router.push("/dashboard/record")}
        />

        <QuickActionCard
          title="View All Sessions"
          description="Browse and manage your recordings"
          icon={FileText}
          iconColor="text-blue-600 dark:text-blue-400 bg-blue-500/10"
          onClick={() => router.push("/dashboard/sessions")}
        />
      </div>

      {/* Recent Sessions */}
      <RecentSessions sessions={stats?.recentSessions || []} />
    </div>
  );
}
