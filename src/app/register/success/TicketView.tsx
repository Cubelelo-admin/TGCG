"use client";

import { useState } from "react";

const ACCENT = "#5b3fa0";
const EVENT_TITLE = "HIRA TGCG 2026";
const EVENT_DATE_LINE = "Sun, 20 Dec 2026 · CBD Square, Naya Raipur";

export type TicketData = {
  fullName: string;
  categoryName: string;
  registrationCode: string;
  qrDataUrl: string;
};

/**
 * Renders every attendee's ticket card plus "Save QR" actions. A client
 * component because saving requires composing a downloadable PNG on
 * <canvas> — the QR itself is still generated server-side (page.tsx), this
 * just draws it (and the surrounding ticket details) onto a canvas so the
 * saved image is self-contained, not just a bare QR code.
 */
export default function TicketView({ tickets }: { tickets: TicketData[] }) {
  const [savingAll, setSavingAll] = useState(false);
  const [savingCode, setSavingCode] = useState<string | null>(null);

  async function saveOne(ticket: TicketData) {
    const canvas = await renderTicketCanvas(ticket);
    downloadCanvas(canvas, `${ticket.registrationCode}.png`);
  }

  async function handleSaveOne(ticket: TicketData) {
    setSavingCode(ticket.registrationCode);
    try {
      await saveOne(ticket);
    } finally {
      setSavingCode(null);
    }
  }

  async function handleSaveAll() {
    setSavingAll(true);
    try {
      for (const ticket of tickets) {
        await saveOne(ticket);
        // Staggered so browsers don't treat near-simultaneous downloads as a
        // popup-style flood and block later ones.
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    } finally {
      setSavingAll(false);
    }
  }

  return (
    <div className="space-y-4">
      {tickets.map((ticket) => (
        <TicketCard
          key={ticket.registrationCode}
          ticket={ticket}
          onSave={() => handleSaveOne(ticket)}
          saving={savingCode === ticket.registrationCode}
        />
      ))}

      {tickets.length > 1 && (
        <button
          type="button"
          onClick={handleSaveAll}
          disabled={savingAll}
          className="w-full rounded-md border py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
          style={{ borderColor: ACCENT, color: ACCENT }}
        >
          {savingAll ? "Saving all tickets..." : "Save All Tickets"}
        </button>
      )}
    </div>
  );
}

function TicketCard({
  ticket,
  onSave,
  saving,
}: {
  ticket: TicketData;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#e5e7eb] bg-white text-left">
      <div className="flex items-center gap-5 p-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ticket.qrDataUrl} alt="Registration QR code" className="h-28 w-28 shrink-0 rounded-sm" />
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-[#9ca3af]">Registration ID</p>
          <p className="text-2xl font-bold" style={{ color: ACCENT }}>
            {ticket.registrationCode}
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-[#111827]">{ticket.fullName}</p>
          <p className="truncate text-sm text-[#6b7280]">{ticket.categoryName}</p>
          <span className="mt-2 inline-block rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
            Confirmed
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 px-5 pb-5">
        <InfoBox label="BIB Details" value="To be updated" hint="Details to follow" />
        <InfoBox label="Race Details" value="To be updated" hint="Details to follow" />
      </div>

      <div className="border-t border-[#e5e7eb] py-3 text-center">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="text-sm font-semibold underline disabled:cursor-not-allowed disabled:opacity-50"
          style={{ color: ACCENT }}
        >
          {saving ? "Saving..." : "Save QR to device"}
        </button>
      </div>
    </div>
  );
}

function InfoBox({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-md border border-[#e5e7eb] bg-[#f9fafb] p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-[#9ca3af]">{label}</p>
      <p className="mt-1 text-sm font-bold text-[#111827]">{value}</p>
      <p className="text-xs text-[#9ca3af]">{hint}</p>
    </div>
  );
}

// ---------------------------------------------------------------------
// Canvas rendering — produces a self-contained ticket image (event header,
// QR, details, BIB/Race placeholders, footer line) for the "Save" buttons.
// Uses plain web-safe fonts rather than the app's Google Fonts: matching
// the on-screen look exactly isn't the point of a saved image, and it
// avoids a font-loading race before drawing.
// ---------------------------------------------------------------------

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function truncateToWidth(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 1 && ctx.measureText(truncated + "…").width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + "…";
}

function drawInfoBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  hint: string
) {
  roundRect(ctx, x, y, w, h, 10);
  ctx.fillStyle = "#f9fafb";
  ctx.fill();
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "#9ca3af";
  ctx.font = "bold 10px Arial, sans-serif";
  ctx.fillText(label.toUpperCase(), x + 14, y + 14);

  ctx.fillStyle = "#111827";
  ctx.font = "bold 15px Arial, sans-serif";
  ctx.fillText(value, x + 14, y + 34);

  ctx.fillStyle = "#9ca3af";
  ctx.font = "12px Arial, sans-serif";
  ctx.fillText(hint, x + 14, y + 56);
}

async function renderTicketCanvas(ticket: TicketData): Promise<HTMLCanvasElement> {
  const width = 640;
  const pad = 32;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = 480;

  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textBaseline = "top";

  const [logo, qr] = await Promise.all([
    loadImage("/logo.png").catch(() => null),
    loadImage(ticket.qrDataUrl),
  ]);

  if (logo) {
    // object-contain equivalent: fit within a 48x48 box without cropping
    // or distorting — logo.png is a wordmark, not a circular emblem.
    const box = 48;
    const scale = Math.min(box / logo.width, box / logo.height);
    const drawW = logo.width * scale;
    const drawH = logo.height * scale;
    ctx.drawImage(logo, pad + (box - drawW) / 2, pad + (box - drawH) / 2, drawW, drawH);
  }

  ctx.fillStyle = "#111827";
  ctx.font = "bold 24px Arial, sans-serif";
  ctx.fillText(EVENT_TITLE, pad + 64, pad + 2);

  ctx.fillStyle = "#6b7280";
  ctx.font = "14px Arial, sans-serif";
  ctx.fillText(EVENT_DATE_LINE, pad + 64, pad + 32);

  const accentY = pad + 64;
  ctx.fillStyle = ACCENT;
  ctx.fillRect(pad, accentY, width - pad * 2, 3);

  const cardY = accentY + 24;
  const cardH = 190;
  roundRect(ctx, pad, cardY, width - pad * 2, cardH, 12);
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  ctx.stroke();

  const qrSize = 140;
  ctx.drawImage(qr, pad + 24, cardY + 24, qrSize, qrSize);

  const textX = pad + 24 + qrSize + 24;
  const maxTextWidth = width - pad - textX - 16;

  ctx.fillStyle = "#9ca3af";
  ctx.font = "bold 12px Arial, sans-serif";
  ctx.fillText("REGISTRATION ID", textX, cardY + 26);

  ctx.fillStyle = ACCENT;
  ctx.font = "bold 30px Arial, sans-serif";
  ctx.fillText(ticket.registrationCode, textX, cardY + 44);

  ctx.fillStyle = "#111827";
  ctx.font = "bold 17px Arial, sans-serif";
  ctx.fillText(truncateToWidth(ctx, ticket.fullName, maxTextWidth), textX, cardY + 88);

  ctx.fillStyle = "#6b7280";
  ctx.font = "13px Arial, sans-serif";
  ctx.fillText(truncateToWidth(ctx, ticket.categoryName, maxTextWidth), textX, cardY + 112);

  const pillY = cardY + 138;
  ctx.fillStyle = "#dcfce7";
  roundRect(ctx, textX, pillY, 112, 26, 13);
  ctx.fill();
  ctx.fillStyle = "#15803d";
  ctx.font = "bold 12px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("CONFIRMED", textX + 56, pillY + 7);
  ctx.textAlign = "left";

  const boxY = cardY + cardH + 20;
  const boxH = 90;
  const gap = 16;
  const boxW = (width - pad * 2 - gap) / 2;
  drawInfoBox(ctx, pad, boxY, boxW, boxH, "BIB Details", "To be updated", "Details to follow");
  drawInfoBox(ctx, pad + boxW + gap, boxY, boxW, boxH, "Race Details", "To be updated", "Details to follow");

  ctx.fillStyle = "#111827";
  ctx.font = "bold 14px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Show this at the time of BIB collection.", width / 2, boxY + boxH + 28);
  ctx.textAlign = "left";

  return canvas;
}

function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, "image/png");
}
