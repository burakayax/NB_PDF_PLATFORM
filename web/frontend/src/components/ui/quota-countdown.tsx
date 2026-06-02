import { useState, useEffect } from "react";

interface QuotaCountdownProps {
  resetAt: Date;
  timezone: string;
}

function formatDuration(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getNextMidnight(timezone: string): Date {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";

  const year = parseInt(get("year"));
  const month = parseInt(get("month")) - 1;
  const day = parseInt(get("day"));

  // Tomorrow midnight UTC equivalent
  const localMidnight = new Date(year, month, day + 1, 0, 0, 0);
  // We approximate using the difference between Date and locale string
  const localNowStr = now.toLocaleString("en-US", { timeZone: timezone });
  const utcNowStr = now.toLocaleString("en-US", { timeZone: "UTC" });
  const offsetMs = new Date(localNowStr).getTime() - new Date(utcNowStr).getTime();

  return new Date(localMidnight.getTime() - offsetMs);
}

export function QuotaCountdown({ resetAt, timezone }: QuotaCountdownProps) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, resetAt.getTime() - Date.now()),
  );

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(Math.max(0, resetAt.getTime() - Date.now()));
    }, 1000);
    return () => clearInterval(id);
  }, [resetAt]);

  const localMidnight = getNextMidnight(timezone);
  const hhmm = localMidnight.toLocaleTimeString("tr-TR", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <span className="font-mono text-xs text-gray-400">
      {formatDuration(remaining)}{" "}
      <span className="text-gray-600">({hhmm})</span>
    </span>
  );
}
