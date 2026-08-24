interface VoteBarProps {
  aye: number;
  nay: number;
  threshold: number;
}

/** Aye/nay split bar with a threshold tick, used in list rows and the tally card. */
export function VoteBar({ aye, nay, threshold }: VoteBarProps) {
  return (
    <div className="relative w-full h-1.5 rounded-full overflow-hidden bg-foreground/5">
      <div
        className="absolute left-0 top-0 h-full transition-all duration-500"
        style={{
          width: `${aye}%`,
          background: "#00d395",
          borderRadius: "2px 0 0 2px",
        }}
      />
      <div
        className="absolute right-0 top-0 h-full"
        style={{
          width: `${nay}%`,
          background: "#ff4444",
          borderRadius: "0 2px 2px 0",
        }}
      />
      <div
        className="absolute top-0 h-full w-px bg-foreground/30"
        style={{ left: `${threshold}%` }}
      />
    </div>
  );
}
