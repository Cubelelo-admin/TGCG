import Image from "next/image";
import type { EventConfig } from "@/site/content/types";

// Logo wall when individual logos are configured; otherwise the single sponsors poster.
export default function Sponsors({ e }: { e: EventConfig }) {
  const logos = e.sponsors ?? [];
  if (!logos.length && !e.images?.sponsors) return null;

  return (
    <section className="section">
      <div className="container">
        <div className="section-head reveal">
          <p className="eyebrow">Thank you</p>
          <h2>Our partners</h2>
        </div>
        {logos.length ? (
          <ul className="logo-wall">
            {logos.map((s) => {
              const logo = <Image src={s.logo} alt={s.name} width={240} height={120} />;
              return (
                <li key={s.name} className="reveal">
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noopener noreferrer">
                      {logo}
                    </a>
                  ) : (
                    logo
                  )}
                  {s.tier && <span className="logo-tier">{s.tier}</span>}
                </li>
              );
            })}
          </ul>
        ) : (
          <Image src={e.images!.sponsors!} alt="Event sponsors and partners" width={1080} height={1179} className="sponsors-img reveal" />
        )}
      </div>
    </section>
  );
}
