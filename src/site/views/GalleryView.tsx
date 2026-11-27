import InstagramSection from "@/site/components/InstagramSection";
import PageHero from "@/site/components/PageHero";
import RegisterCta from "@/site/components/RegisterCta";
import ThemeCarousel from "@/site/components/ThemeCarousel";
import YouTube from "@/site/components/YouTube";
import type { EventConfig } from "@/site/content/types";

export default function GalleryView({ e }: { e: EventConfig }) {
  const images = e.galleryImages ?? [];
  const videos = e.videos?.gallery ?? [];
  const empty = !images.length && !videos.length;

  return (
    <>
      <PageHero
        eyebrow={images.length ? `${images.length} photos · ${videos.length} videos` : "Gallery"}
        title="Gallery"
        subtitle={`Runners and roads of ${e.city}.`}
      />

      {e.theme && e.theme.images.length > 0 && (
        <section className="section theme-section" id="theme">
          <div className="container">
            <div className="section-head reveal">
              <p className="eyebrow">
                {e.edition} theme · {e.theme.titleHi}
              </p>
              <h2>{e.theme.title}</h2>
              {e.theme.tagline && <p className="theme-tagline">{e.theme.tagline}</p>}
            </div>
            <ThemeCarousel images={e.theme.images} title={`${e.theme.title} – ${e.edition} theme`} />
            <p className="theme-intro">{e.theme.intro}</p>
          </div>
        </section>
      )}

      {images.length > 0 && (
        <section className="section">
          <div className="container">
            {e.theme && (
              <div className="section-head reveal">
                <p className="eyebrow">Photos · फ़ोटो</p>
                <h2>On the road</h2>
              </div>
            )}
            <ThemeCarousel images={images} title={`${e.shortName} on the road`} variant="photo" />
          </div>
        </section>
      )}

      {videos.length > 0 && (
        <section className="section section-sand">
          <div className="container">
            <div className="section-head reveal">
              <p className="eyebrow">Films · वीडियो</p>
              <h2>Every edition on film</h2>
            </div>

            {/* Latest edition, large */}
            <figure className="video-feature reveal">
              <YouTube id={videos[0].id} title={videos[0].title} />
              <figcaption>
                {videos[0].year && <span className="video-year">{videos[0].year}</span>}
                <strong>{videos[0].title}</strong>
                {videos[0].note && <span className="muted">{videos[0].note}</span>}
              </figcaption>
            </figure>

            {videos.length > 1 && (
              <>
                <h3 className="video-subhead">Previous editions</h3>
                <div className="video-grid">
                  {videos.slice(1).map((v) => (
                    <figure key={v.id} className="video-item reveal">
                      <YouTube id={v.id} title={v.title} />
                      <figcaption>
                        {v.year && <span className="video-year">{v.year}</span>}
                        <strong>{v.title}</strong>
                        {v.note && <span className="muted">{v.note}</span>}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {empty && (
        <section className="section">
          <div className="container narrow">
            <div className="coming-soon">
              <span className="coming-soon-icon" aria-hidden="true">📸</span>
              <strong>Photos and videos from {e.shortName} will appear here after race day.</strong>
              <span className="hi">रेस के बाद फ़ोटो और वीडियो यहाँ देखें।</span>
            </div>
          </div>
        </section>
      )}

      <InstagramSection e={e} />

      <RegisterCta e={e} />
    </>
  );
}
