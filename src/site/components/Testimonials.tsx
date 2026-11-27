import Image from "next/image";
import type { Testimonial } from "@/site/content/types";

export default function Testimonials({ items }: { items?: Testimonial[] }) {
  if (!items?.length) return null;

  return (
    <section className="section">
      <div className="container">
        <div className="section-head reveal">
          <p className="eyebrow">From the runners</p>
          <h2>Why they come back</h2>
        </div>
        <div className="quote-grid">
          {items.map((t, i) => (
            <figure key={t.name + i} className="quote-card reveal" style={{ "--delay": `${i * 80}ms` } as React.CSSProperties}>
              <blockquote>“{t.quote}”</blockquote>
              <figcaption>
                {t.photo ? (
                  <Image src={t.photo} alt="" width={48} height={48} className="quote-photo" />
                ) : (
                  <span className="quote-photo quote-initial" aria-hidden="true">
                    {t.name.charAt(0)}
                  </span>
                )}
                <span>
                  <strong>{t.name}</strong>
                  {t.detail && <span className="small">{t.detail}</span>}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
