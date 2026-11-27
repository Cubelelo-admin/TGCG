"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

function diff(target: number, end: number) {
  const now = Date.now();
  const ms = Math.max(0, target - now);
  return {
    days: Math.floor(ms / 86_400_000),
    hours: Math.floor((ms / 3_600_000) % 24),
    mins: Math.floor((ms / 60_000) % 60),
    secs: Math.floor((ms / 1000) % 60),
    phase: now < target ? ("before" as const) : now < end ? ("live" as const) : ("after" as const),
  };
}

// Counts down to the start; shows "Race day is here" while the race is on and a thank-you once it has ended.
export default function Countdown({ to, end, resultsHref }: { to: string; end: string; resultsHref?: string }) {
  const target = new Date(to).getTime();
  const endMs = new Date(end).getTime();
  const [t, setT] = useState<ReturnType<typeof diff> | null>(null);

  useEffect(() => {
    setT(diff(target, endMs));
    const id = setInterval(() => setT(diff(target, endMs)), 1000);
    return () => clearInterval(id);
  }, [target, endMs]);

  if (t?.phase === "live") {
    return (
      <p className="countdown-done">
        Race day is here! 🏁 <span className="hi">आज रेस का दिन है!</span>
      </p>
    );
  }

  if (t?.phase === "after") {
    return (
      <p className="countdown-done">
        Thank you for running! 🏅 <span className="hi">दौड़ने के लिए धन्यवाद!</span>
        {resultsHref && (
          <>
            {" "}
            <Link href={resultsHref} className="link">
              See results →
            </Link>
          </>
        )}
      </p>
    );
  }

  const units: [string, string, number | undefined][] = [
    ["Days", "दिन", t?.days],
    ["Hours", "घंटे", t?.hours],
    ["Min", "मिनट", t?.mins],
    ["Sec", "सेकंड", t?.secs],
  ];

  return (
    <div className="countdown" role="timer" aria-label="Time until race day">
      {units.map(([label, hi, value]) => (
        <div key={label} className="countdown-cell">
          {/* key changes on every tick, replaying the flip animation */}
          <span key={value} className="countdown-num">
            {value === undefined ? "--" : String(value).padStart(2, "0")}
          </span>
          <span className="countdown-label">
            <span>{label}</span>
            <span className="countdown-hi" lang="hi">
              {hi}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
