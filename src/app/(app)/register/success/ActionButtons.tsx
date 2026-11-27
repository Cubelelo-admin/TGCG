"use client";

import { useState } from "react";
import type { BibCollectionInfo } from "@/lib/event-profiles";

const ACCENT = "#5b3fa0";

function WhatsAppIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#25D366" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.35 5.07L2 22l5.06-1.33A9.94 9.94 0 0 0 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2Zm0 18.1c-1.62 0-3.14-.44-4.44-1.2l-.32-.19-3.16.83.84-3.09-.2-.32A8.09 8.09 0 0 1 3.9 12c0-4.47 3.63-8.1 8.1-8.1s8.1 3.63 8.1 8.1-3.63 8.1-8.1 8.1Zm4.46-6.07c-.24-.12-1.44-.71-1.66-.79-.22-.08-.39-.12-.55.12-.16.24-.63.79-.78.95-.14.16-.29.18-.53.06-.24-.12-1.02-.38-1.94-1.2-.72-.64-1.2-1.43-1.35-1.67-.14-.24-.02-.37.11-.49.11-.11.24-.29.36-.43.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.55-1.33-.76-1.82-.2-.48-.4-.42-.55-.42-.14-.01-.3-.01-.47-.01-.16 0-.42.06-.65.3-.22.24-.85.83-.85 2.03s.87 2.36 1 2.52c.12.16 1.71 2.61 4.15 3.66.58.25 1.03.4 1.38.51.58.18 1.11.16 1.53.1.47-.07 1.44-.59 1.64-1.16.2-.57.2-1.06.14-1.16-.06-.1-.22-.16-.46-.28Z" />
    </svg>
  );
}

function BookletIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" aria-hidden="true">
      <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5V4.5Z" />
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    </svg>
  );
}

function PinIcon({ color = "#ffffff" }: { color?: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" aria-hidden="true">
      <path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.4" />
    </svg>
  );
}

function MapIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#ffffff"
        d="M12 2C7.86 2 4.5 5.36 4.5 9.5c0 5.63 6.5 11.66 7.02 12.13a.72.72 0 0 0 .96 0C13 21.16 19.5 15.13 19.5 9.5 19.5 5.36 16.14 2 12 2Zm0 10.25a2.75 2.75 0 1 1 0-5.5 2.75 2.75 0 0 1 0 5.5Z"
      />
    </svg>
  );
}

export type WaGroupLinks = {
  group4221: string | null;
  group10: string | null;
  group6: string | null;
};

/**
 * Replaces the old "You're registered! N attendees · ₹X" summary — the
 * three most useful next actions instead: join a WhatsApp group, get the
 * race booklet/FAQ, and check BIB collection logistics.
 */
export default function ActionButtons({
  waGroupLinks,
  showRaceBooklet,
  bibCollection,
}: {
  waGroupLinks: WaGroupLinks;
  showRaceBooklet: boolean;
  bibCollection: BibCollectionInfo | null;
}) {
  const [bibOpen, setBibOpen] = useState(false);
  const [waPickerOpen, setWaPickerOpen] = useState(false);
  const hasAnyWaGroup = Boolean(waGroupLinks.group4221 || waGroupLinks.group10 || waGroupLinks.group6);

  return (
    <div className="space-y-2.5">
      {hasAnyWaGroup && (
        <button
          type="button"
          onClick={() => setWaPickerOpen(true)}
          className="flex h-[50px] w-full items-center justify-center gap-2 rounded-full text-sm font-bold"
          style={{ background: "#dcf8e6", border: "1.5px solid #25D366", color: "#0f5132" }}
        >
          <WhatsAppIcon />
          Join WhatsApp Group for Updates
        </button>
      )}
      {showRaceBooklet && (
        <a
          href="/api/assets/race-information"
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-[50px] items-center justify-center gap-2 rounded-full text-sm font-bold"
          style={{ background: "#ffffff", border: `1.5px solid ${ACCENT}`, color: ACCENT }}
        >
          <BookletIcon />
          Race Booklet &amp; FAQ
        </a>
      )}
      {bibCollection && (
        <button
          type="button"
          onClick={() => setBibOpen(true)}
          className="flex h-[50px] w-full items-center justify-center gap-2 rounded-full text-sm font-bold text-white"
          style={{ background: ACCENT }}
        >
          <PinIcon />
          View BIB Collection Details
        </button>
      )}

      {bibOpen && bibCollection && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-5"
          onClick={() => setBibOpen(false)}
        >
          <div
            className="relative max-h-[88vh] w-full max-w-[400px] overflow-y-auto rounded-[22px] bg-white p-[30px] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setBibOpen(false)}
              aria-label="Close"
              className="absolute top-[18px] right-[18px] flex h-8 w-8 items-center justify-center rounded-full border border-[#e5e7eb] text-[#374151]"
            >
              ✕
            </button>
            <h3 className="mb-5 text-xl font-extrabold text-[#111827]">BIB Collection Details</h3>

            <p className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: ACCENT }}>
              Schedule
            </p>
            <table className="mb-[22px] w-full border-collapse">
              <thead>
                <tr>
                  <th className="border-b-2 border-[#f0eef5] px-2.5 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280]">
                    Date
                  </th>
                  <th className="border-b-2 border-[#f0eef5] px-2.5 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280]">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody>
                {bibCollection.schedule.map((slot, idx) => {
                  const last = idx === bibCollection.schedule.length - 1;
                  return (
                    <tr key={slot.date}>
                      <td
                        className={`px-2.5 py-3 text-[15px] font-bold text-[#111827] ${last ? "" : "border-b border-[#f3f4f6]"}`}
                      >
                        {slot.date}
                      </td>
                      <td className={`px-2.5 py-3 text-[15px] text-[#111827] ${last ? "" : "border-b border-[#f3f4f6]"}`}>
                        {slot.time}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <p className="mb-1.5 text-xs font-bold uppercase tracking-wide" style={{ color: ACCENT }}>
              Collect Your BIB At
            </p>
            <p className="mb-3.5 text-base font-bold text-[#111827]">{bibCollection.venue}</p>

            {bibCollection.mapsUrl && (
              <a
                href={bibCollection.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-[50px] items-center justify-center gap-2 rounded-full text-sm font-bold text-white"
                style={{ background: ACCENT }}
              >
                <MapIcon />
                Open Location in Google Maps
              </a>
            )}
          </div>
        </div>
      )}

      {waPickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-5"
          onClick={() => setWaPickerOpen(false)}
        >
          <div
            className="relative w-full max-w-[400px] rounded-[22px] bg-white p-[30px] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setWaPickerOpen(false)}
              aria-label="Close"
              className="absolute top-[18px] right-[18px] flex h-8 w-8 items-center justify-center rounded-full border border-[#e5e7eb] text-[#374151]"
            >
              ✕
            </button>
            <h3 className="mb-5 text-xl font-extrabold text-[#111827]">Choose Your Group</h3>

            <div className="space-y-2.5">
              {waGroupLinks.group4221 && (
                <a
                  href={waGroupLinks.group4221}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-[50px] items-center justify-center gap-2 rounded-full text-sm font-bold"
                  style={{ background: "#dcf8e6", border: "1.5px solid #25D366", color: "#0f5132" }}
                >
                  <WhatsAppIcon />
                  21K / 42K Group
                </a>
              )}
              {waGroupLinks.group10 && (
                <a
                  href={waGroupLinks.group10}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-[50px] items-center justify-center gap-2 rounded-full text-sm font-bold"
                  style={{ background: "#dcf8e6", border: "1.5px solid #25D366", color: "#0f5132" }}
                >
                  <WhatsAppIcon />
                  10K Group
                </a>
              )}
              {waGroupLinks.group6 && (
                <a
                  href={waGroupLinks.group6}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-[50px] items-center justify-center gap-2 rounded-full text-sm font-bold"
                  style={{ background: "#dcf8e6", border: "1.5px solid #25D366", color: "#0f5132" }}
                >
                  <WhatsAppIcon />
                  6K Group
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
