"use client";

import { useEffect, useState } from "react";
import { SessionList } from "@/components/sessions/SessionList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, RefreshCw, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function SessionsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("createdAt");

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search,
        status: statusFilter,
        sortBy,
        sortOrder: "desc",
      });

      const response = await fetch(`/api/sessions?${params}`);

      if (!response.ok) {
        throw new Error("Failed to fetch sessions");
      }

      const data = await response.json();
      setSessions(data.sessions);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      toast.error("Failed to load recordings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [search, statusFilter, sortBy]);

  const handleDelete = (sessionId: string) => {
    setSessions(sessions.filter((s: any) => s.id !== sessionId));
  };

  return (
    <div className="container max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">My Recordings</h1>
          <p className="text-muted-foreground">
            View and manage your recording sessions
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

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search recordings..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="PROCESSING">Processing</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="createdAt">Date Created</SelectItem>
            <SelectItem value="duration">Duration</SelectItem>
            <SelectItem value="title">Title</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="icon"
          onClick={fetchSessions}
          disabled={loading}
          className="w-full sm:w-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Sessions List */}
      {loading ? (
        <div className="text-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading recordings...</p>
        </div>
      ) : (
        <SessionList sessions={sessions} onDelete={handleDelete} />
      )}
    </div>
  );
}
