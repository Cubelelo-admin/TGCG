import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { events } from "@/site/content/events";
import type { EventConfig } from "@/site/content/types";
import { registrationStatus } from "@/site/lib/event";

// Link-preview images (WhatsApp, Instagram DMs, Facebook…), 1200×630.
// Kept photo-free on purpose: WhatsApp drops preview images larger than ~300 KB.
// Keep colours in sync with the [data-event] blocks in globals.css.
const theme: Record<EventConfig["slug"], { brand: string; brand2: string; primary: string; accent: string }> = {
  raipur: { brand: "#093556", brand2: "#0d4a74", primary: "#e31e24", accent: "#f9b44e" },
  raigarh: { brand: "#13402f", brand2: "#1d5a43", primary: "#b4500b", accent: "#f2c14e" },
};

const size = { width: 1200, height: 630 };

async function fonts() {
  const data = await readFile(join(process.cwd(), "src/site/lib/fonts/ArchivoBlack-Regular.ttf"));
  return [{ name: "Display", data, weight: 400 as const, style: "normal" as const }];
}

const shortDist = (d: string) => d.replace(".195", "").replace(".097", "").replace(" KM", "K");

type Theme = (typeof theme)[EventConfig["slug"]];

const rootStyle = (t: Theme) =>
  ({
    width: "100%",
    height: "100%",
    display: "flex",
    position: "relative",
    color: "#fff",
    fontFamily: "Display",
    backgroundColor: t.brand,
    backgroundImage: `radial-gradient(circle at 92% 0%, ${t.accent}99 0%, ${t.brand2}00 45%), linear-gradient(135deg, ${t.brand} 0%, ${t.brand2} 100%)`,
    borderBottom: `14px solid ${t.primary}`,
  }) as const;

export async function renderEventOg(e: EventConfig) {
  const t = theme[e.slug];
  const races = e.races;

  return new ImageResponse(
    (
      <div style={rootStyle(t)}>
        <div style={{ position: "relative", display: "flex", width: "100%", padding: "60px 72px", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 720 }}>
            <div style={{ display: "flex", fontSize: 24, letterSpacing: 5, color: t.accent, fontFamily: "Display" }}>
              THE GREAT CHHATTISGARH RUN · {e.edition}
            </div>
            <div style={{ display: "flex", fontSize: e.city.length > 8 ? 104 : 124, lineHeight: 1, marginTop: 20, fontFamily: "Display" }}>
              {e.city.toUpperCase()}
            </div>
            {e.tagline && (
              <div style={{ display: "flex", fontSize: 30, marginTop: 14, color: t.accent, fontFamily: "Display", letterSpacing: 2 }}>
                {e.tagline.toUpperCase()}
              </div>
            )}
            <div style={{ display: "flex", fontSize: 38, marginTop: 26 }}>{e.dateLabel}</div>
            <div style={{ display: "flex", fontSize: 28, opacity: 0.85, marginTop: 6 }}>{e.venue.name}</div>
            <div style={{ display: "flex", marginTop: 34 }}>
              <div style={{ display: "flex", background: t.primary, padding: "14px 30px", borderRadius: 999, fontSize: 30, fontFamily: "Display" }}>
                {{ open: "REGISTER AT TGCG.RUN", soon: "COMING SOON · TGCG.RUN", closed: "SEE YOU ON RACE DAY · TGCG.RUN" }[registrationStatus(e)]}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {races.length ? (
              races.map((r) => (
                <div
                  key={r.slug}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 220,
                    height: 92,
                    borderRadius: 22,
                    background: r.color,
                    fontSize: 54,
                    fontFamily: "Display",
                    boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
                  }}
                >
                  {shortDist(r.distance)}
                </div>
              ))
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 280,
                  height: 280,
                  borderRadius: 9999,
                  border: `6px solid ${t.accent}`,
                  fontFamily: "Display",
                  fontSize: 40,
                  lineHeight: 1.1,
                  textAlign: "center",
                }}
              >
                <div style={{ display: "flex" }}>RACES</div>
                <div style={{ display: "flex", color: t.accent }}>SOON</div>
              </div>
            )}
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: await fonts() },
  );
}

export async function renderChooserOg() {
  const t = theme.raipur;
  return new ImageResponse(
    (
      <div style={rootStyle(t)}>
        <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", padding: 64 }}>
          <div style={{ display: "flex", fontSize: 28, letterSpacing: 8, color: t.accent, fontFamily: "Display" }}>TGCG.RUN</div>
          <div style={{ display: "flex", fontSize: 74, marginTop: 16, fontFamily: "Display", textAlign: "center" }}>THE GREAT CHHATTISGARH RUN</div>
          <div style={{ display: "flex", fontSize: 32, marginTop: 10, opacity: 0.85 }}>Choose your run</div>
          <div style={{ display: "flex", gap: 28, marginTop: 44 }}>
            {events.map((e) => {
              const et = theme[e.slug];
              return (
                <div
                  key={e.slug}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    background: et.brand2,
                    border: `4px solid ${et.accent}`,
                    borderRadius: 26,
                    padding: "22px 40px",
                    boxShadow: "0 16px 40px rgba(0,0,0,0.35)",
                  }}
                >
                  <div style={{ display: "flex", fontSize: 46, fontFamily: "Display" }}>{e.city.toUpperCase()}</div>
                  <div style={{ display: "flex", fontSize: 28, opacity: 0.9, marginTop: 4 }}>{e.dateLabel.replace(/^\w+, /, "")}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: await fonts() },
  );
}
