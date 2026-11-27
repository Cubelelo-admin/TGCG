"use client";

import { useEffect, useState } from "react";

type Hour = { time: string; temp: number; rain: number; humidity: number };

const DAY = 86_400_000;

// Race-morning forecast from Open-Meteo (free, no key). Forecasts exist ~14 days ahead.
export default function Weather({ lat, lng, date }: { lat: number; lng: number; date: string }) {
  const [hours, setHours] = useState<Hour[] | null>(null);
  const [state, setState] = useState<"early" | "loading" | "ok" | "error" | "past">("loading");

  // Race date in IST (YYYY-MM-DD)
  const day = new Date(new Date(date).getTime() + 5.5 * 3_600_000).toISOString().slice(0, 10);

  useEffect(() => {
    const ms = new Date(date).getTime() - Date.now();
    if (ms < -DAY) return setState("past");
    if (ms > 14 * DAY) return setState("early");
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,precipitation_probability,relative_humidity_2m&timezone=Asia%2FKolkata&start_date=${day}&end_date=${day}`;
    let cancelled = false;
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => {
        if (cancelled) return;
        const list: Hour[] = j.hourly.time
          .map((t: string, i: number) => ({
            time: t.slice(11, 16),
            temp: Math.round(j.hourly.temperature_2m[i]),
            rain: j.hourly.precipitation_probability?.[i] ?? 0,
            humidity: j.hourly.relative_humidity_2m?.[i] ?? 0,
          }))
          .filter((x: Hour) => {
            const hr = Number(x.time.slice(0, 2));
            return hr >= 3 && hr <= 10;
          });
        setHours(list);
        setState("ok");
      })
      .catch(() => !cancelled && setState("error"));
    return () => {
      cancelled = true;
    };
  }, [lat, lng, date, day]);

  if (state === "early")
    return <p className="muted">The race-morning forecast appears here two weeks before race day.</p>;
  if (state === "past") return <p className="muted">Race day has passed.</p>;
  if (state === "error") return <p className="muted">Couldn&apos;t load the forecast right now. Please try again later.</p>;
  if (state === "loading" || !hours) return <p className="muted">Loading forecast…</p>;

  return (
    <div className="weather">
      {hours.map((h) => (
        <div key={h.time} className="weather-cell">
          <span className="weather-time">{h.time}</span>
          <strong>{h.temp}°C</strong>
          <span title="Chance of rain">💧 {h.rain}%</span>
          <span className="small">RH {h.humidity}%</span>
        </div>
      ))}
    </div>
  );
}
