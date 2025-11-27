"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Clock,
  Calendar,
  Download,
  Trash2,
  FileText,
  Sparkles,
  RefreshCw,
  Edit2,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { Input } from "@/components/ui/input";

interface Transcript {
  id: string;
  text: string;
  chunkIndex: number;
  timestamp: number;
  confidence: number | null;
}

interface Summary {
  id: string;
  fullSummary: string;
  keyPoints: string[];
  actionItems: string[];
  decisions: string[];
}

interface SessionDetail {
  id: string;
  title: string;
  duration: number;
  status: string;
  source: string;
  fullTranscript: string | null;
  createdAt: string;
  recordingStartedAt: string;
  recordingEndedAt: string | null;
  transcripts: Transcript[];
  summary: Summary | null;
}

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  useEffect(() => {
    fetchSession();
  }, [sessionId]);

  const fetchSession = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/sessions/${sessionId}`);

      if (!response.ok) {
        throw new Error("Failed to fetch session");
      }

      const data = await response.json();
      setSession(data.session);
      setNewTitle(data.session.title);
    } catch (error) {
      console.error("Error fetching session:", error);
      toast.error("Failed to load recording");
      router.push("/dashboard/sessions");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        "Are you sure you want to delete this recording? This cannot be undone."
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete session");
      }

      toast.success("Recording deleted successfully");
      router.push("/dashboard/sessions");
    } catch (error) {
      console.error("Error deleting session:", error);
      toast.error("Failed to delete recording");
    }
  };

  const handleUpdateTitle = async () => {
    if (!newTitle.trim()) {
      toast.error("Title cannot be empty");
      return;
    }

    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      });

      if (!response.ok) {
        throw new Error("Failed to update title");
      }

      setSession({ ...session!, title: newTitle });
      setEditing(false);
      toast.success("Title updated successfully");
    } catch (error) {
      console.error("Error updating title:", error);
      toast.error("Failed to update title");
    }
  };

  const downloadTranscript = () => {
    // 1. Safety Check: Ensure session exists
    if (!session) {
      toast.error("Session data not found");
      return;
    }

    // 2. Get Transcript Text (Handle missing transcripts array)
    const transcriptText =
      session.fullTranscript ||
      session.transcripts?.map((t) => t.text).join("\n\n") ||
      "";

    if (!transcriptText.trim()) {
      toast.error("No transcript available to download");
      return;
    }

    try {
      // 3. Safely extract summary data with defaults to prevent crashes
      const summary = session.summary || {};
      const keyPoints = summary.keyPoints || [];
      const actionItems = summary.actionItems || [];
      const decisions = summary.decisions || [];
      const title = session.title || "Untitled Session";

      // 4. Create formatted transcript (Flush left to prevent indentation in text file)
      const formattedTranscript = `${title}
${"=".repeat(title.length)}

Duration: ${
        typeof formatDuration === "function"
          ? formatDuration(session.duration)
          : session.duration
      }
Date: ${
        typeof format === "function"
          ? format(new Date(session.createdAt), "PPP p")
          : new Date(session.createdAt).toLocaleString()
      }
Source: ${session.source === "MIC" ? "Microphone" : "Tab Audio"}
Status: ${session.status}

${
  summary.fullSummary
    ? `SUMMARY
-------
${summary.fullSummary}

${
  keyPoints.length > 0
    ? `KEY POINTS:
${keyPoints.map((p, i) => `${i + 1}. ${p}`).join("\n")}
`
    : ""
}
${
  actionItems.length > 0
    ? `ACTION ITEMS:
${actionItems.map((a, i) => `${i + 1}. ${a}`).join("\n")}
`
    : ""
}
${
  decisions.length > 0
    ? `DECISIONS:
${decisions.map((d, i) => `${i + 1}. ${d}`).join("\n")}
`
    : ""
}`
    : ""
}

TRANSCRIPT
----------
${transcriptText}`.trim();

      // 5. Create blob and download
      const blob = new Blob([formattedTranscript], {
        type: "text/plain;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      // Generate safe filename
      const safeTitle = title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
      // Assuming 'format' is from date-fns, otherwise use standard date string
      const timestamp =
        typeof format === "function"
          ? format(new Date(session.createdAt), "yyyy-MM-dd")
          : new Date().toISOString().split("T")[0];

      link.href = url;
      link.download = `${safeTitle}_${timestamp}.txt`;
      link.style.display = "none";

      document.body.appendChild(link);
      link.click();

      // Cleanup
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);

      toast.success("Transcript downloaded successfully!");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download transcript");
    }
  };

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs}h ${mins}m ${secs}s`;
    }
    return `${mins}m ${secs}s`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "bg-green-500/10 text-green-600 dark:text-green-400";
      case "PROCESSING":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400";
      case "FAILED":
        return "bg-red-500/10 text-red-600 dark:text-red-400";
      default:
        return "bg-gray-500/10 text-gray-600 dark:text-gray-400";
    }
  };

  if (loading) {
    return (
      <div className="container max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="text-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading recording...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="container max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => router.push("/dashboard/sessions")}
        className="mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Sessions
      </Button>

      {/* Header */}
      <Card className="p-6 sm:p-8 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="flex items-center gap-2">
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="text-lg font-semibold"
                  autoFocus
                />
                <Button size="sm" onClick={handleUpdateTitle}>
                  <Check className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditing(false);
                    setNewTitle(session.title);
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <h1 className="text-2xl sm:text-3xl font-bold break-words">
                  {session.title}
                </h1>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditing(true)}
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 mt-3">
              <Badge className={getStatusColor(session.status)}>
                {session.status}
              </Badge>
              <Badge variant="outline">
                {session.source === "MIC" ? "🎤 Microphone" : "🖥️ Tab Audio"}
              </Badge>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                const transcriptText =
                  session?.fullTranscript ||
                  session?.transcripts.map((t) => t.text).join("\n\n") ||
                  "";

                if (!transcriptText.trim()) {
                  toast.error("No transcript to copy");
                  return;
                }

                navigator.clipboard.writeText(transcriptText);
                toast.success("Transcript copied to clipboard!");
              }}
            >
              <FileText className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Copy</span>
            </Button>

            <Button variant="outline" onClick={downloadTranscript}>
              <Download className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Download</span>
            </Button>

            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Delete</span>
            </Button>
          </div>
        </div>

        {/* Metadata */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>Duration: {formatDuration(session.duration)}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>{format(new Date(session.createdAt), "PPP")}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <FileText className="w-4 h-4" />
            <span>{session.transcripts.length} transcript chunks</span>
          </div>
        </div>
      </Card>

      {/* Summary Section */}
      {session.summary && (
        <Card className="p-6 sm:p-8 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold">AI Summary</h2>
          </div>

          <p className="text-muted-foreground mb-6 leading-relaxed">
            {session.summary.fullSummary}
          </p>

          {session.summary.keyPoints.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold mb-3">Key Points</h3>
              <ul className="space-y-2">
                {session.summary.keyPoints.map((point, index) => (
                  <li key={index} className="flex gap-2">
                    <span className="text-primary">•</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {session.summary.actionItems.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold mb-3">Action Items</h3>
              <ul className="space-y-2">
                {session.summary.actionItems.map((item, index) => (
                  <li key={index} className="flex gap-2">
                    <span className="text-orange-500">→</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {session.summary.decisions.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3">Decisions</h3>
              <ul className="space-y-2">
                {session.summary.decisions.map((decision, index) => (
                  <li key={index} className="flex gap-2">
                    <span className="text-green-500">✓</span>
                    <span>{decision}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      {/* Full Transcript */}
      <Card className="p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold">Full Transcript</h2>
        </div>

        {session.fullTranscript ? (
          <div className="prose prose-sm sm:prose dark:prose-invert max-w-none">
            <p className="whitespace-pre-wrap leading-relaxed">
              {session.fullTranscript}
            </p>
          </div>
        ) : session.transcripts.length > 0 ? (
          <div className="space-y-4">
            {session.transcripts.map((transcript) => (
              <div
                key={transcript.id}
                className="border-l-2 border-primary/20 pl-4"
              >
                <div className="text-xs text-muted-foreground mb-1">
                  Chunk {transcript.chunkIndex + 1} •{" "}
                  {Math.floor(transcript.timestamp)}s
                  {transcript.confidence && (
                    <>
                      {" "}
                      • {(transcript.confidence * 100).toFixed(0)}% confidence
                    </>
                  )}
                </div>
                <p className="leading-relaxed">{transcript.text}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">
            No transcript available
          </p>
        )}
      </Card>
    </div>
  );
}
