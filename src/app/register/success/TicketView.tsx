"use client";

import { useEffect, useState } from "react";

const FLOW_1 = "#0f3a4d";
const FLOW_2 = "#1a6e66";
const FLOW_3 = "#2f8f82";
const GOLD = "#c9a869";
const GOLD_LIGHT = "#f0d9a8";
const GOLD_DEEP = "#a9803e";
const PAPER = "#f3e4ca";
const RACE_BOX_BG = "#eadab5";
const INK = "#1a2422";

const EVENT_TITLE = "HIRA TGCG 2026";
const TAGLINE = "Run With The Flow";
const DATE_LINE_1 = "SUN 20 DEC 2026";
const DATE_LINE_2 = "CBD SQUARE, NAYA RAIPUR";
const FOOTER_TEXT = "Show this at the time of BIB collection.";
const CHILD_FOOTER_TEXT = "Accompanying child — show at check-in.";

export type TicketData = {
  fullName: string;
  categoryName: string;
  registrationCode: string;
  qrDataUrl: string;
  isChildRunner: boolean;
  bibNumber: string | null;
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

  // Arriving here is a client-side navigation from /register (same iframe,
  // same document) — the browser never does its own scroll-to-top for that,
  // and the parent page has no reason to know the iframe's content just
  // changed underneath it. See scrollToFormTop in RegisterFlow.tsx for the
  // same pattern on the Save step.
  useEffect(() => {
    if (typeof window !== "undefined" && window.self !== window.top) {
      window.parent.postMessage({ type: "tgcg:scrollToTop" }, "*");
    }
  }, []);

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
          style={{ borderColor: FLOW_1, color: FLOW_1 }}
        >
          {savingAll ? "Saving all tickets..." : "Save All Tickets"}
        </button>
      )}
    </div>
  );
}

function BibBadge({ ticket }: { ticket: TicketData }) {
  if (ticket.isChildRunner) {
    return (
      <span
        className="inline-flex items-center rounded-full px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wide"
        style={{ background: "rgba(26,36,34,.06)", border: "1.4px solid rgba(26,36,34,.18)", color: "rgba(26,36,34,.7)" }}
      >
        No BIB Entry
      </span>
    );
  }
  if (ticket.bibNumber) {
    return (
      <span
        className="inline-flex items-center rounded-full px-3.5 py-1.5 text-[11.5px] font-bold tracking-wide"
        style={{
          background: `linear-gradient(135deg, ${GOLD}, ${GOLD_DEEP})`,
          color: "#241c0a",
          boxShadow: "0 4px 10px -3px rgba(169,128,62,.6)",
        }}
      >
        BIB #{ticket.bibNumber}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center rounded-full px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wide"
      style={{ border: "1.4px dashed rgba(26,36,34,.35)", color: "rgba(26,36,34,.65)" }}
    >
      BIB To Be Allotted
    </span>
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
    <div className="overflow-hidden rounded-[20px] text-left shadow-xl" style={{ background: PAPER, color: INK }}>
      <div
        className="relative overflow-hidden px-5 pt-[18px]"
        style={{ height: 180, background: `linear-gradient(150deg, ${FLOW_1} 0%, ${FLOW_2} 55%, ${FLOW_3} 100%)` }}
      >
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 346 156" preserveAspectRatio="none">
          <path d="M-20,110 C60,80 110,130 180,100 C250,72 290,118 366,88 L366,0 L-20,0 Z" fill="rgba(255,255,255,.07)" />
          <path d="M-20,130 C60,102 120,148 190,120 C260,95 300,135 366,108 L366,0 L-20,0 Z" fill="rgba(255,255,255,.05)" />
          <path
            d="M-20,84 C70,60 120,96 190,72 C255,50 300,82 366,58"
            fill="none"
            stroke="rgba(201,168,105,.55)"
            strokeWidth="1.4"
          />
        </svg>

        <div className="relative z-10 mx-auto flex w-fit flex-col items-end">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="" className="h-[19px] w-[19px] object-contain" />
            </div>
            <div
              className="font-display text-[21px] text-white"
              style={{ textShadow: "0 1px 3px rgba(0,0,0,.4)" }}
            >
              {EVENT_TITLE}
            </div>
          </div>
          <div
            className="mt-[7px] font-mono text-[9px] font-bold uppercase tracking-[0.16em]"
            style={{ color: GOLD_LIGHT, textShadow: "0 1px 2px rgba(0,0,0,.45)" }}
          >
            {TAGLINE}
          </div>
        </div>

        <div
          className="relative z-10 mt-4 text-center text-[13px] font-bold leading-snug text-white"
          style={{ textShadow: "0 1px 3px rgba(0,0,0,.4)" }}
        >
          <div>{DATE_LINE_1}</div>
          <div>{DATE_LINE_2}</div>
        </div>
      </div>

      <div className="relative z-20 mx-auto -mt-[58px] w-[136px]">
        <div className="rounded-[14px] p-3 shadow-lg" style={{ background: "#fbf7ec" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ticket.qrDataUrl} alt="Registration QR code" className="block w-full" />
        </div>
      </div>

      <div className="px-6 pb-[18px] pt-[14px] text-center">
        <p className="text-[17px] font-bold">{ticket.fullName}</p>
        <p className="mb-3 text-xs opacity-60">{ticket.categoryName}</p>
        <BibBadge ticket={ticket} />
        <p className="mt-3.5 font-mono text-xs font-semibold opacity-55">{ticket.registrationCode}</p>
      </div>

      <div className="mx-6 mb-1">
        {ticket.isChildRunner ? (
          <InfoBox
            label="Accompanying Child"
            value="No BIB / race entry"
            hint="Not part of the timed race"
            bg={RACE_BOX_BG}
          />
        ) : (
          <InfoBox label="Race Details" value="To be updated" hint="Details to follow" bg={RACE_BOX_BG} />
        )}
      </div>

      <div className="relative mt-1.5 h-[150px] overflow-hidden" style={{ background: PAPER }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/finish-line.jpg"
          alt="Runners crossing the finish line at HIRA TGCG"
          className="block h-full w-full object-cover"
          style={{ objectPosition: "center 42%" }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-16"
          style={{ background: `linear-gradient(180deg, rgba(243,228,202,0) 0%, ${PAPER} 92%)` }}
        />
      </div>
      <p className="px-6 pb-5 pt-0.5 text-center text-[11px] font-semibold" style={{ color: FLOW_1 }}>
        {ticket.isChildRunner ? CHILD_FOOTER_TEXT : FOOTER_TEXT}
      </p>

      <div className="border-t py-3 text-center" style={{ borderColor: "rgba(26,36,34,.12)" }}>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="text-sm font-semibold underline disabled:cursor-not-allowed disabled:opacity-50"
          style={{ color: FLOW_1 }}
        >
          {saving ? "Saving..." : "Save QR to device"}
        </button>
      </div>
    </div>
  );
}

function InfoBox({ label, value, hint, bg }: { label: string; value: string; hint: string; bg: string }) {
  return (
    <div className="rounded-md p-3 text-left" style={{ background: bg }}>
      <p className="text-[10px] font-bold uppercase tracking-wide opacity-60">{label}</p>
      <p className="mt-1 text-sm font-bold">{value}</p>
      <p className="text-xs opacity-55">{hint}</p>
    </div>
  );
}

// ---------------------------------------------------------------------
// Canvas rendering — produces a self-contained ticket image (river-flow
// header, QR credential, BIB badge, race details, finish-line footer) for
// the "Save" buttons. Uses plain web-safe fonts rather than the app's
// Google Fonts: matching the on-screen look exactly isn't the point of a
// saved image, and it avoids a font-loading race before drawing.
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
  ctx.fillStyle = RACE_BOX_BG;
  ctx.fill();

  ctx.fillStyle = "rgba(26,36,34,.6)";
  ctx.font = "bold 11px Arial, sans-serif";
  ctx.fillText(label.toUpperCase(), x + 18, y + 16);

  ctx.fillStyle = INK;
  ctx.font = "bold 17px Arial, sans-serif";
  ctx.fillText(value, x + 18, y + 38);

  ctx.fillStyle = "rgba(26,36,34,.55)";
  ctx.font = "13px Arial, sans-serif";
  ctx.fillText(hint, x + 18, y + 62);
}

function drawBibBadge(ctx: CanvasRenderingContext2D, centerX: number, y: number, ticket: TicketData): number {
  let text: string;
  let mode: "pending" | "allotted" | "child";
  if (ticket.isChildRunner) {
    text = "NO BIB ENTRY";
    mode = "child";
    ctx.font = "bold 12px Arial, sans-serif";
  } else if (ticket.bibNumber) {
    text = `BIB #${ticket.bibNumber}`;
    mode = "allotted";
    ctx.font = "bold 14px Arial, sans-serif";
  } else {
    text = "BIB TO BE ALLOTTED";
    mode = "pending";
    ctx.font = "bold 12px Arial, sans-serif";
  }

  const textW = ctx.measureText(text).width;
  const padX = 18;
  const h = 34;
  const w = textW + padX * 2;
  const x = centerX - w / 2;

  roundRect(ctx, x, y, w, h, h / 2);
  if (mode === "allotted") {
    const grad = ctx.createLinearGradient(x, y, x + w, y + h);
    grad.addColorStop(0, GOLD);
    grad.addColorStop(1, GOLD_DEEP);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.fillStyle = "#241c0a";
  } else if (mode === "pending") {
    ctx.save();
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = "rgba(26,36,34,.4)";
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "rgba(26,36,34,.65)";
  } else {
    ctx.fillStyle = "rgba(26,36,34,.06)";
    ctx.fill();
    ctx.strokeStyle = "rgba(26,36,34,.18)";
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.fillStyle = "rgba(26,36,34,.7)";
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, centerX, y + h / 2 + 1);
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  return h;
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  verticalBias = 0.42
) {
  const srcRatio = img.width / img.height;
  const dstRatio = dw / dh;
  let sx = 0;
  let sy = 0;
  let sw = img.width;
  let sh = img.height;
  if (srcRatio > dstRatio) {
    sw = img.height * dstRatio;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / dstRatio;
    sy = (img.height - sh) * verticalBias;
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

// The whole layout below is fixed-pixel, top to bottom, so the final
// canvas height is a deterministic constant — no badge text, name length,
// etc. changes any element's height, only its width. Computed once here so
// the canvas can be sized correctly before the single drawing pass.
const CANVAS_WIDTH = 640;
const PAD = 32;
const HEADER_H = 220;
const HEADER_ROW_Y = 26;
const LOGO_SIZE = 44;
const LOGO_GAP = 14;
const QR_BOX = 180;
const QR_TILE_PAD = 16;
const QR_TILE_SIZE = QR_BOX + QR_TILE_PAD * 2;
const QR_TILE_Y = HEADER_H - 90;
const RACE_BOX_H = 90;
const FINISH_H = 260;
const FINISH_FADE_H = 90;
const BADGE_H = 34;
const CANVAS_HEIGHT =
  QR_TILE_Y + QR_TILE_SIZE + 26 + 30 + 26 + BADGE_H + 28 + 30 + RACE_BOX_H + 24 + FINISH_H + 40 + 30;

async function renderTicketCanvas(ticket: TicketData): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;

  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const [logo, qr, finish] = await Promise.all([
    loadImage("/logo.png").catch(() => null),
    loadImage(ticket.qrDataUrl),
    loadImage("/finish-line.jpg").catch(() => null),
  ]);

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // --- header ---
  const headerGrad = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, HEADER_H);
  headerGrad.addColorStop(0, FLOW_1);
  headerGrad.addColorStop(0.55, FLOW_2);
  headerGrad.addColorStop(1, FLOW_3);
  ctx.fillStyle = headerGrad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, HEADER_H);

  ctx.fillStyle = "rgba(255,255,255,.07)";
  ctx.beginPath();
  ctx.moveTo(-40, 150);
  ctx.bezierCurveTo(110, 110, 200, 180, 330, 145);
  ctx.bezierCurveTo(460, 110, 540, 175, 680, 135);
  ctx.lineTo(680, 0);
  ctx.lineTo(-40, 0);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,.05)";
  ctx.beginPath();
  ctx.moveTo(-40, 175);
  ctx.bezierCurveTo(110, 135, 220, 205, 350, 165);
  ctx.bezierCurveTo(480, 130, 560, 190, 680, 150);
  ctx.lineTo(680, 0);
  ctx.lineTo(-40, 0);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(201,168,105,.55)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-40, 115);
  ctx.bezierCurveTo(130, 80, 220, 130, 350, 95);
  ctx.bezierCurveTo(470, 65, 560, 105, 680, 75);
  ctx.stroke();

  // --- title / tagline group, centered as one block, both right-aligned ---
  ctx.font = "bold 30px Arial, sans-serif";
  const titleW = ctx.measureText(EVENT_TITLE).width;
  const titleRowW = LOGO_SIZE + LOGO_GAP + titleW;

  ctx.font = "bold 12px Arial, sans-serif";
  const taglineText = TAGLINE.toUpperCase().split("").join("  ");
  const taglineW = ctx.measureText(taglineText).width;

  const groupW = Math.max(titleRowW, taglineW);
  const groupLeft = (CANVAS_WIDTH - groupW) / 2;
  const titleRowX = groupLeft + (groupW - titleRowW);

  if (logo) {
    roundRect(ctx, titleRowX, HEADER_ROW_Y, LOGO_SIZE, LOGO_SIZE, 9);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    const box = LOGO_SIZE - 12;
    const scale = Math.min(box / logo.width, box / logo.height);
    const drawW = logo.width * scale;
    const drawH = logo.height * scale;
    ctx.drawImage(
      logo,
      titleRowX + (LOGO_SIZE - drawW) / 2,
      HEADER_ROW_Y + (LOGO_SIZE - drawH) / 2,
      drawW,
      drawH
    );
  }

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 30px Arial, sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText(EVENT_TITLE, titleRowX + LOGO_SIZE + LOGO_GAP, HEADER_ROW_Y + LOGO_SIZE / 2 + 1);

  ctx.fillStyle = GOLD_LIGHT;
  ctx.font = "bold 12px Arial, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(taglineText, groupLeft + groupW, HEADER_ROW_Y + LOGO_SIZE + 22);
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 16px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(DATE_LINE_1, CANVAS_WIDTH / 2, HEADER_ROW_Y + LOGO_SIZE + 42);
  ctx.fillText(DATE_LINE_2, CANVAS_WIDTH / 2, HEADER_ROW_Y + LOGO_SIZE + 64);
  ctx.textAlign = "left";

  // --- QR credential tile, overlapping the header/body seam ---
  const tileX = (CANVAS_WIDTH - QR_TILE_SIZE) / 2;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.35)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 10;
  roundRect(ctx, tileX, QR_TILE_Y, QR_TILE_SIZE, QR_TILE_SIZE, 14);
  ctx.fillStyle = "#fbf7ec";
  ctx.fill();
  ctx.restore();
  ctx.drawImage(qr, tileX + QR_TILE_PAD, QR_TILE_Y + QR_TILE_PAD, QR_BOX, QR_BOX);

  // --- name / category / bib badge / code ---
  let y = QR_TILE_Y + QR_TILE_SIZE + 26;
  ctx.fillStyle = INK;
  ctx.font = "bold 26px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(truncateToWidth(ctx, ticket.fullName, CANVAS_WIDTH - PAD * 2), CANVAS_WIDTH / 2, y);

  y += 30;
  ctx.fillStyle = "rgba(26,36,34,.6)";
  ctx.font = "14px Arial, sans-serif";
  ctx.fillText(truncateToWidth(ctx, ticket.categoryName, CANVAS_WIDTH - PAD * 2), CANVAS_WIDTH / 2, y);

  y += 26;
  drawBibBadge(ctx, CANVAS_WIDTH / 2, y, ticket);

  y += BADGE_H + 28;
  ctx.fillStyle = "rgba(26,36,34,.55)";
  ctx.font = "13px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(ticket.registrationCode, CANVAS_WIDTH / 2, y);
  ctx.textAlign = "left";

  // --- race / child-runner details ---
  y += 30;
  const boxW = CANVAS_WIDTH - PAD * 2;
  if (ticket.isChildRunner) {
    drawInfoBox(ctx, PAD, y, boxW, RACE_BOX_H, "Accompanying Child", "No BIB / race entry", "Not part of the timed race");
  } else {
    drawInfoBox(ctx, PAD, y, boxW, RACE_BOX_H, "Race Details", "To be updated", "Details to follow");
  }
  y += RACE_BOX_H + 24;

  // --- finish-line footer illustration ---
  if (finish) {
    drawCoverImage(ctx, finish, 0, y, CANVAS_WIDTH, FINISH_H);
  }
  const fade = ctx.createLinearGradient(0, y + FINISH_H - FINISH_FADE_H, 0, y + FINISH_H);
  fade.addColorStop(0, "rgba(243,228,202,0)");
  fade.addColorStop(0.92, PAPER);
  ctx.fillStyle = fade;
  ctx.fillRect(0, y + FINISH_H - FINISH_FADE_H, CANVAS_WIDTH, FINISH_FADE_H);
  y += FINISH_H;

  // --- footer line ---
  y += 40;
  ctx.fillStyle = FLOW_1;
  ctx.font = "bold 16px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(ticket.isChildRunner ? CHILD_FOOTER_TEXT : FOOTER_TEXT, CANVAS_WIDTH / 2, y);
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
