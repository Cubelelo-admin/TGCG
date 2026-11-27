"use client";

import { useEffect, useState } from "react";

const DAY = 86_400_000;
const IST_OFFSET = 5.5 * 3_600_000;
// Calendar day number in India (Asia/Kolkata, no DST), so "today" / "1 day" flip at local midnight
const istDay = (t: number) => Math.floor((t + IST_OFFSET) / DAY);

// mode "deadline": "Registration closes in N days" (urgent in the last week)
// mode "race":     "N days to go"
// Text is shown in English and Hindi together.
export default function DaysChip({ to, mode }: { to: string; mode: "deadline" | "race" }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (now === null) return null;

  const target = new Date(to).getTime();
  const days = istDay(target) - istDay(now); // calendar days between today and the target day

  const hi = (text: string) => (
    <span className="days-chip-hi" lang="hi">
      {text}
    </span>
  );

  if (mode === "race") {
    if (days < 0) return <span className="days-chip">Thank you for running {hi("दौड़ने के लिए धन्यवाद")}</span>;
    if (days === 0) return <span className="days-chip days-chip-urgent">Race day! {hi("आज रेस है!")}</span>;
    return (
      <span className="days-chip">
        <strong>{days}</strong> {days === 1 ? "day" : "days"} to go {hi(`· ${days} दिन बाकी`)}
      </span>
    );
  }

  // Check the exact deadline before looking at calendar days
  if (now > target)
    return <span className="days-chip days-chip-closed">Registration closed {hi("· पंजीकरण बंद")}</span>;
  const urgent = days <= 7;
  return (
    <span className={`days-chip ${urgent ? "days-chip-urgent" : ""}`}>
      {days <= 0 ? (
        <>Registration closes today {hi("· पंजीकरण आज बंद")}</>
      ) : (
        <>
          Registration closes in <strong>{days}</strong> {days === 1 ? "day" : "days"}{" "}
          {hi(`· ${days} दिन में पंजीकरण बंद`)}
        </>
      )}
    </span>
  );
}
