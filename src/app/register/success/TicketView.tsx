"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import JSZip from "jszip";

function subscribeNever() {
  return () => {};
}
function getIsFramed() {
  return window.self !== window.top;
}
function getIsFramedServer() {
  return false;
}

const FLOW_1 = "#0f3a4d";
const FLOW_2 = "#1a6e66";
const FLOW_3 = "#2f8f82";
const GOLD = "#c9a869";
const GOLD_DEEP = "#a9803e";
// Matches Illustration.png's own baked-in sky color exactly (sampled from
// the file) — anything else leaves a visible seam where the image starts.
const PAPER = "#f1e1c7";
const INK = "#1a2422";

const VENUE_TEXT = "CBD Square, Naya Raipur";
const FOOTER_TEXT = "Show this at the time of BIB collection.";
// Split out (rather than reusing DATE_LINE_1-style prose) so the closing
// illustration's date badge can size/weight each part differently.
const EVENT_DAY = "20";
const EVENT_MONTH = "DEC";
const EVENT_YEAR = "2026";
const EVENT_WEEKDAY = "SUNDAY";

export type TicketData = {
  fullName: string;
  categoryName: string;
  registrationCode: string;
  qrDataUrl: string;
  bibNumber: string | null;
  tshirtSize: string | null;
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
  const inIframe = useSyncExternalStore(subscribeNever, getIsFramed, getIsFramedServer);

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

  async function handleSaveOne(ticket: TicketData) {
    setSavingCode(ticket.registrationCode);
    try {
      const canvas = await renderTicketCanvas(ticket);
      const blob = await canvasToBlob(canvas);
      const filename = `${ticket.registrationCode}.png`;
      // Chrome/Safari block <a download> clicks that originate inside a
      // cross-origin iframe (this page is embedded on tgcg.run) unless the
      // parent explicitly opts in — which Taplink's embed doesn't. Opening
      // the image in a new top-level tab isn't subject to that restriction,
      // so it's the reliable fallback there; the user saves it manually.
      if (inIframe) {
        openBlobInNewTab(blob, filename);
      } else {
        downloadBlob(blob, filename);
      }
    } finally {
      setSavingCode(null);
    }
  }

  async function handleSaveAll() {
    setSavingAll(true);
    try {
      const zip = new JSZip();
      for (const ticket of tickets) {
        const canvas = await renderTicketCanvas(ticket);
        const blob = await canvasToBlob(canvas);
        zip.file(`${ticket.registrationCode}.png`, blob);
      }
      const zipBlob = await zip.generateAsync({ type: "blob" });
      // Bundling into one zip also sidesteps Chrome's block on multiple
      // automatic downloads from the same page, which broke this when it
      // looped over separate per-ticket downloads.
      if (inIframe) {
        openBlobInNewTab(zipBlob, "tgcg-tickets.zip");
      } else {
        downloadBlob(zipBlob, "tgcg-tickets.zip");
      }
    } finally {
      setSavingAll(false);
    }
  }

  return (
    <div className="space-y-4">
      {inIframe && (
        <p className="text-center text-xs opacity-60">
          Saved tickets open in a new tab — tap and hold the image (or use your browser&apos;s download icon) to save it.
        </p>
      )}

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
  if (ticket.bibNumber) {
    return (
      <span
        className="inline-flex items-center rounded-full px-8 py-3 text-[22px] font-extrabold tracking-wide"
        style={{
          background: `linear-gradient(135deg, ${GOLD}, ${GOLD_DEEP})`,
          color: "#241c0a",
          boxShadow: "0 6px 14px -4px rgba(169,128,62,.65)",
        }}
      >
        {ticket.bibNumber === "SUPERHERO" ? "SUPERHERO" : `BIB #${ticket.bibNumber}`}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center rounded-full px-6 py-2.5 text-sm font-bold uppercase tracking-wide"
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
        className="relative overflow-hidden px-6 pt-6 pb-20"
        style={{ background: `linear-gradient(150deg, ${FLOW_1} 0%, ${FLOW_2} 55%, ${FLOW_3} 100%)` }}
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

        <div className="relative z-10 rounded-xl bg-white px-5 py-4 shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/tgcg-logo-full.png"
            alt="HIRA — The Great Chhattisgarh Run"
            className="mx-auto block w-4/5"
          />
        </div>

        <p
          className="relative z-10 mt-4 flex items-center justify-center gap-1.5 text-center text-[15px] font-bold text-white opacity-90"
          style={{ textShadow: "0 1px 3px rgba(0,0,0,.4)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="shrink-0">
            <path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21Z" />
            <circle cx="12" cy="9.5" r="2.4" />
          </svg>
          {VENUE_TEXT}
        </p>
      </div>

      <div className="relative z-20 mx-auto -mt-16 w-[184px]">
        <div className="rounded-[16px] p-3.5 shadow-lg" style={{ background: "#fbf7ec" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ticket.qrDataUrl} alt="Registration QR code" className="block w-full" />
        </div>
      </div>

      <p className="mt-2.5 text-center text-sm">
        <span className="text-[11px] font-bold uppercase tracking-wide opacity-50">Reg No.</span>{" "}
        <span className="font-mono text-sm font-bold">{ticket.registrationCode}</span>
      </p>

      <div className="px-6 pt-3.5 pb-1.5 text-center">
        <p className="text-[22px] font-extrabold">{ticket.fullName}</p>
        <p className={`text-[15px] opacity-65 ${ticket.tshirtSize ? "" : "mb-4"}`}>{ticket.categoryName}</p>
        {ticket.tshirtSize && (
          <p className="mt-2.5 mb-4 text-[15px] opacity-65">
            Requested T-Shirt Size: <span className="font-bold">{ticket.tshirtSize}*</span>
          </p>
        )}
        <BibBadge ticket={ticket} />
      </div>

      <div className="relative mt-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/Illustration.png" alt="Runners at HIRA — The Great Chhattisgarh Run" className="block w-full" />
        <div className="absolute right-3.5 bottom-3.5 flex items-center gap-2">
          <span
            className="text-[28px] font-extrabold leading-none"
            style={{ color: PAPER, textShadow: "0 2px 6px rgba(15,58,77,.7)" }}
          >
            {EVENT_DAY}
          </span>
          <div className="flex flex-col leading-[1.05]">
            <span
              className="text-[11px] font-extrabold tracking-wide"
              style={{ color: GOLD, textShadow: "0 1px 4px rgba(15,58,77,.7)" }}
            >
              {EVENT_MONTH}
            </span>
            <span className="text-[9px] font-bold" style={{ color: GOLD, textShadow: "0 1px 4px rgba(15,58,77,.7)" }}>
              {EVENT_YEAR}
            </span>
          </div>
          <span
            className="ml-0.5 border-l pl-2 text-[10px] font-extrabold tracking-widest"
            style={{ color: PAPER, borderColor: "rgba(243,228,202,.55)", textShadow: "0 1px 4px rgba(15,58,77,.7)" }}
          >
            {EVENT_WEEKDAY}
          </span>
        </div>
      </div>

      <p className="px-6 pt-4 pb-5 text-center text-[12px] font-bold" style={{ color: FLOW_1 }}>
        {FOOTER_TEXT}
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

// ---------------------------------------------------------------------
// Canvas rendering — produces a self-contained ticket image (river-flow
// header, QR credential, BIB badge, race details, closing illustration) for
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

/** Solid pin silhouette matching the on-screen inline SVG's path, scaled to `size` px tall. */
function drawPinIcon(ctx: CanvasRenderingContext2D, leftX: number, topY: number, size: number, color: string) {
  const scale = size / 24;
  ctx.save();
  ctx.translate(leftX, topY);
  ctx.scale(scale, scale);
  ctx.fillStyle = color;
  ctx.fill(new Path2D("M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21Z"));
  ctx.restore();
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

function drawBibBadge(ctx: CanvasRenderingContext2D, centerX: number, y: number, ticket: TicketData): number {
  let text: string;
  let mode: "pending" | "allotted";
  if (ticket.bibNumber) {
    text = ticket.bibNumber === "SUPERHERO" ? "SUPERHERO" : `BIB #${ticket.bibNumber}`;
    mode = "allotted";
    ctx.font = "bold 26px Arial, sans-serif";
  } else {
    text = "BIB TO BE ALLOTTED";
    mode = "pending";
    ctx.font = "bold 17px Arial, sans-serif";
  }

  const textW = ctx.measureText(text).width;
  const padX = 34;
  const h = BADGE_H;
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
  } else {
    ctx.save();
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = "rgba(26,36,34,.4)";
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "rgba(26,36,34,.65)";
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, centerX, y + h / 2 + 1);
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  return h;
}

// The whole layout below is fixed-pixel, top to bottom, so the final
// canvas height is a deterministic constant — no badge text, name length,
// etc. changes any element's height, only its width. Computed once here so
// the canvas can be sized correctly before the single drawing pass.
const CANVAS_WIDTH = 640;
const PAD = 32;

// Header: logo scaled to fill (matching the on-screen w-4/5 chip), venue
// line below it, no date line (date moved to the closing illustration).
// Matches tgcg-logo-full.png's actual 1891x844 aspect ratio.
const LOGO_ASPECT = 1891 / 844;
const HEADER_PAD_X = 44;
const HEADER_PAD_TOP = 34;
const LOGO_CHIP_PAD_X = 36;
const LOGO_CHIP_PAD_Y = 26;
const LOGO_IMG_W = (CANVAS_WIDTH - HEADER_PAD_X * 2 - LOGO_CHIP_PAD_X * 2) * 0.8;
const LOGO_IMG_H = LOGO_IMG_W / LOGO_ASPECT;
const LOGO_CHIP_H = LOGO_IMG_H + LOGO_CHIP_PAD_Y * 2;
const VENUE_GAP = 28;
const VENUE_LINE_H = 26;
const HEADER_CONTENT_H = HEADER_PAD_TOP + LOGO_CHIP_H + VENUE_GAP + VENUE_LINE_H;

const QR_BOX = 240;
const QR_TILE_PAD = 18;
const QR_TILE_SIZE = QR_BOX + QR_TILE_PAD * 2;
// The QR tile overlaps up into the header's bottom padding, same effect as
// the on-screen -mt-16 on a -mt-64-style overlap — scaled to this bigger tile.
const HEADER_OVERLAP = Math.round(QR_TILE_SIZE * 0.42);
const HEADER_H = HEADER_CONTENT_H + HEADER_OVERLAP;
const QR_TILE_Y = HEADER_H - HEADER_OVERLAP;

const REG_NO_GAP = 26;
const REG_NO_H = 22;
const NAME_GAP = 24;
const NAME_H = 34;
const CATEGORY_GAP = 8;
const CATEGORY_H = 22;
const BADGE_GAP = 24;
const BADGE_H = 56;
const TSHIRT_GAP = 28;
const TSHIRT_H = 22;
const ILLUSTRATION_GAP = 34;
// Matches Illustration.png's actual 926x425 aspect ratio, scaled to the
// canvas's fixed width — drawn in full (not cropped).
const ILLUSTRATION_H = Math.round((CANVAS_WIDTH * 425) / 926);
const FOOTER_GAP = 34;
const FOOTER_H = 24;
const BOTTOM_MARGIN = 24;

const CANVAS_HEIGHT =
  QR_TILE_Y +
  QR_TILE_SIZE +
  REG_NO_GAP +
  REG_NO_H +
  NAME_GAP +
  NAME_H +
  CATEGORY_GAP +
  CATEGORY_H +
  BADGE_GAP +
  BADGE_H +
  TSHIRT_GAP +
  TSHIRT_H +
  ILLUSTRATION_GAP +
  ILLUSTRATION_H +
  FOOTER_GAP +
  FOOTER_H +
  BOTTOM_MARGIN;

function drawDateBadge(ctx: CanvasRenderingContext2D, rightX: number, bottomY: number) {
  // Canvas has no CSS text-shadow — approximated with shadowBlur instead.
  ctx.save();
  ctx.shadowColor = "rgba(15,58,77,.7)";
  ctx.shadowBlur = 6;
  ctx.textBaseline = "alphabetic";

  ctx.font = "bold 15px Arial, sans-serif";
  const weekdayW = ctx.measureText(EVENT_WEEKDAY).width;
  ctx.font = "bold 12px Arial, sans-serif";
  const monthW = Math.max(
    ctx.measureText(EVENT_MONTH).width,
    (() => {
      ctx.font = "bold 10px Arial, sans-serif";
      return ctx.measureText(EVENT_YEAR).width;
    })()
  );
  ctx.font = "bold 40px Arial, sans-serif";
  const dayW = ctx.measureText(EVENT_DAY).width;

  const gap = 10;
  let x = rightX - weekdayW;
  ctx.textAlign = "left";
  ctx.fillStyle = PAPER;
  ctx.font = "bold 15px Arial, sans-serif";
  ctx.fillText(EVENT_WEEKDAY, x, bottomY);

  x -= gap + 1;
  ctx.strokeStyle = "rgba(243,228,202,.55)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, bottomY - 20);
  ctx.lineTo(x, bottomY + 2);
  ctx.stroke();

  x -= gap + monthW;
  ctx.fillStyle = GOLD;
  ctx.font = "bold 12px Arial, sans-serif";
  ctx.fillText(EVENT_MONTH, x, bottomY - 12);
  ctx.font = "bold 10px Arial, sans-serif";
  ctx.fillText(EVENT_YEAR, x, bottomY + 2);

  x -= gap + dayW;
  ctx.fillStyle = PAPER;
  ctx.font = "bold 40px Arial, sans-serif";
  ctx.fillText(EVENT_DAY, x, bottomY + 4);

  ctx.restore();
}

async function renderTicketCanvas(ticket: TicketData): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;

  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const [logo, qr, illustration] = await Promise.all([
    loadImage("/tgcg-logo-full.png").catch(() => null),
    loadImage(ticket.qrDataUrl),
    loadImage("/Illustration.png").catch(() => null),
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

  const chipX = HEADER_PAD_X;
  const chipY = HEADER_PAD_TOP;
  const chipW = CANVAS_WIDTH - HEADER_PAD_X * 2;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.15)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  roundRect(ctx, chipX, chipY, chipW, LOGO_CHIP_H, 14);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.restore();

  if (logo) {
    ctx.drawImage(
      logo,
      chipX + (chipW - LOGO_IMG_W) / 2,
      chipY + LOGO_CHIP_PAD_Y,
      LOGO_IMG_W,
      LOGO_IMG_H
    );
  }

  ctx.font = "bold 17px Arial, sans-serif";
  const venueY = chipY + LOGO_CHIP_H + VENUE_GAP;
  const venueTextW = ctx.measureText(VENUE_TEXT).width;
  const PIN_SIZE = 15;
  const PIN_TEXT_GAP = 7;
  const venueStartX = CANVAS_WIDTH / 2 - (PIN_SIZE + PIN_TEXT_GAP + venueTextW) / 2;
  drawPinIcon(ctx, venueStartX, venueY - PIN_SIZE + 3, PIN_SIZE, "#ffffff");
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.fillText(VENUE_TEXT, venueStartX + PIN_SIZE + PIN_TEXT_GAP, venueY);

  // --- QR credential tile, overlapping the header/body seam ---
  const tileX = (CANVAS_WIDTH - QR_TILE_SIZE) / 2;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.35)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 10;
  roundRect(ctx, tileX, QR_TILE_Y, QR_TILE_SIZE, QR_TILE_SIZE, 16);
  ctx.fillStyle = "#fbf7ec";
  ctx.fill();
  ctx.restore();
  ctx.drawImage(qr, tileX + QR_TILE_PAD, QR_TILE_Y + QR_TILE_PAD, QR_BOX, QR_BOX);

  // --- reg no / name / category / bib badge ---
  let y = QR_TILE_Y + QR_TILE_SIZE + REG_NO_GAP;
  ctx.textAlign = "center";
  ctx.font = "bold 12px Arial, sans-serif";
  ctx.fillStyle = "rgba(26,36,34,.5)";
  const regNoLabel = "REG NO.  ";
  const regLabelW = ctx.measureText(regNoLabel).width;
  ctx.font = "bold 15px ui-monospace, Menlo, monospace";
  const regValueW = ctx.measureText(ticket.registrationCode).width;
  const regTotalW = regLabelW + regValueW;
  let regX = CANVAS_WIDTH / 2 - regTotalW / 2;
  ctx.textAlign = "left";
  ctx.font = "bold 12px Arial, sans-serif";
  ctx.fillStyle = "rgba(26,36,34,.5)";
  ctx.fillText(regNoLabel, regX, y);
  regX += regLabelW;
  ctx.font = "bold 15px ui-monospace, Menlo, monospace";
  ctx.fillStyle = INK;
  ctx.fillText(ticket.registrationCode, regX, y);

  y += NAME_GAP + NAME_H - 10;
  ctx.fillStyle = INK;
  ctx.font = "bold 34px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(truncateToWidth(ctx, ticket.fullName, CANVAS_WIDTH - PAD * 2), CANVAS_WIDTH / 2, y);

  y += CATEGORY_GAP + CATEGORY_H;
  ctx.fillStyle = "rgba(26,36,34,.65)";
  ctx.font = "16px Arial, sans-serif";
  ctx.fillText(truncateToWidth(ctx, ticket.categoryName, CANVAS_WIDTH - PAD * 2), CANVAS_WIDTH / 2, y);

  if (ticket.tshirtSize) {
    y += TSHIRT_GAP;
    const tshirtLabel = "Requested T-Shirt Size: ";
    const tshirtValue = `${ticket.tshirtSize}*`;
    ctx.font = "16px Arial, sans-serif";
    const tshirtLabelW = ctx.measureText(tshirtLabel).width;
    ctx.font = "bold 16px Arial, sans-serif";
    const tshirtValueW = ctx.measureText(tshirtValue).width;
    let tshirtX = CANVAS_WIDTH / 2 - (tshirtLabelW + tshirtValueW) / 2;
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(26,36,34,.65)";
    ctx.font = "16px Arial, sans-serif";
    ctx.fillText(tshirtLabel, tshirtX, y);
    tshirtX += tshirtLabelW;
    ctx.font = "bold 16px Arial, sans-serif";
    ctx.fillText(tshirtValue, tshirtX, y);
    y += TSHIRT_H;
  }
  ctx.textAlign = "left";

  y += BADGE_GAP;
  drawBibBadge(ctx, CANVAS_WIDTH / 2, y, ticket);
  y += BADGE_H;

  // --- closing illustration band, with the date badge overlaid on it ---
  y += ILLUSTRATION_GAP;
  if (illustration) {
    ctx.drawImage(illustration, 0, y, CANVAS_WIDTH, ILLUSTRATION_H);
  }
  drawDateBadge(ctx, CANVAS_WIDTH - 22, y + ILLUSTRATION_H - 22);
  y += ILLUSTRATION_H;

  // --- footer line ---
  y += FOOTER_GAP;
  ctx.fillStyle = FLOW_1;
  ctx.font = "bold 18px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(FOOTER_TEXT, CANVAS_WIDTH / 2, y);
  ctx.textAlign = "left";

  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Canvas toBlob returned null"));
    }, "image/png");
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function openBlobInNewTab(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (!win) {
    // Popup blocked — same-tab download is still better than nothing.
    downloadBlob(blob, filename);
    URL.revokeObjectURL(url);
    return;
  }
  // Give the new tab time to load the blob before it's revoked.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
