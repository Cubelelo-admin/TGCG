import type { Metadata } from "next";
import { GALLERY_PHOTOS, YOUTUBE } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Gallery — LetsRun TGCG 2026",
  description: "Recap films and race-day photos from past editions of TGCG.",
};

export default function GalleryPage() {
  return (
    <main className="flex-1">
      <div className="border-b border-[#17181a]/10 bg-[#fbf7ee]">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <div className="text-xs font-semibold uppercase tracking-[0.1em] text-[#8a5a3a]">
            Gallery
          </div>
          <h1 className="font-display mt-4 text-3xl uppercase tracking-[-0.01em] sm:text-5xl">
            Nine editions of running together
          </h1>
        </div>
      </div>

      <section className="mx-auto max-w-5xl px-6 py-14">
        <h2 className="font-display text-2xl uppercase tracking-[-0.01em]">2026 Teaser</h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <VideoEmbed id={YOUTUBE.teaser2026.id} title={YOUTUBE.teaser2026.title} />
          <VideoEmbed id={YOUTUBE.anthem.id} title={YOUTUBE.anthem.title} />
        </div>
      </section>

      <section className="bg-[#fbf7ee]">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <h2 className="font-display text-2xl uppercase tracking-[-0.01em]">Past Edition Recaps</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {YOUTUBE.recaps.map((v) => (
              <VideoEmbed key={v.id} id={v.id} title={v.title} />
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-14">
        <h2 className="font-display text-2xl uppercase tracking-[-0.01em]">The Track</h2>
        <div className="mt-6 max-w-xl">
          <VideoEmbed id={YOUTUBE.trackTalk.id} title={YOUTUBE.trackTalk.title} />
        </div>
      </section>

      <section className="bg-[#fbf7ee]">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <h2 className="font-display text-2xl uppercase tracking-[-0.01em]">Race Day Photos</h2>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {GALLERY_PHOTOS.map((src) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={src}
                src={src}
                alt="TGCG race moment"
                loading="lazy"
                className="aspect-square w-full rounded-xl border border-[#17181a]/10 object-cover"
              />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function VideoEmbed({ id, title }: { id: string; title: string }) {
  return (
    <div>
      <div className="aspect-video overflow-hidden rounded-xl border border-[#17181a]/10 bg-[#17181a]">
        <iframe
          className="h-full w-full"
          src={`https://www.youtube.com/embed/${id}`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
      <p className="mt-2 text-sm text-[#6d6656]">{title}</p>
    </div>
  );
}
