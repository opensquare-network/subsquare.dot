import { AlertCircle, CheckCircle2, Clock, XCircle } from "lucide-react";

interface StatusBadgeProps {
  status: string;
  color: string;
}

export function StatusBadge({ status, color }: StatusBadgeProps) {
  const background = `color-mix(in srgb, ${color} 9%, transparent)`;
  const borderColor = `color-mix(in srgb, ${color} 19%, transparent)`;

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-medium uppercase tracking-widest rounded-sm"
      style={{
        color,
        background,
        border: `1px solid ${borderColor}`,
      }}
    >
      {status === "Deciding" && <Clock size={9} />}
      {status === "Confirming" && <CheckCircle2 size={9} />}
      {status === "Passed" && <CheckCircle2 size={9} />}
      {status === "Rejected" && <XCircle size={9} />}
      {status === "Queueing" && <AlertCircle size={9} />}
      {status}
    </span>
  );
}

interface TrackBadgeProps {
  track: string;
  color: string;
}

export function TrackBadge({ track, color }: TrackBadgeProps) {
  const background = `color-mix(in srgb, ${color} 9%, transparent)`;
  const borderColor = `color-mix(in srgb, ${color} 19%, transparent)`;

  return (
    <span
      className="inline-flex items-center text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-sm"
      style={{
        color,
        background,
        border: `1px solid ${borderColor}`,
      }}
    >
      {track}
    </span>
  );
}
