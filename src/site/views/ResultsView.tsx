import Link from "next/link";
import PageHero from "@/site/components/PageHero";
import CourseRecords from "@/site/components/CourseRecords";
import PastResults from "@/site/components/PastResults";
import ResultsLookup from "@/site/components/ResultsLookup";
import type { EventConfig } from "@/site/content/types";
import { waLink } from "@/site/lib/event";

export default function ResultsView({ e }: { e: EventConfig }) {
  const template = e.links.results;
  const past = e.pastResults ?? [];

  return (
    <>
      <PageHero
        eyebrow={`${e.shortName} ${e.edition}`}
        title="Results & certificates"
        subtitle="Find your finish time and download your timing certificate, for this year and every past edition. परिणाम और सर्टिफिकेट।"
      >
        {past.length > 0 && (
          <nav className="jump-links" aria-label="On this page">
            <a href="#this-year">{e.edition} results</a>
            <a href="#records">Track records</a>
            <a href="#past">Past editions &amp; certificates</a>
          </nav>
        )}
      </PageHero>

      <section className="section" id="this-year">
        <div className="container narrow">
          {template ? (
            <div className="info-card results-card reveal">
              <h2>Look up your {e.edition} result</h2>
              <p className="muted">Enter the number printed on your BIB. Your result opens on the timing partner&apos;s site.</p>
              <ResultsLookup template={template} />
            </div>
          ) : (
            <div className="coming-soon">
              <span className="coming-soon-icon" aria-hidden="true">⏱️</span>
              <strong>{e.edition} results and timing certificates will be published here after race day.</strong>
              <span className="hi">रेस के बाद परिणाम और सर्टिफिकेट यहाँ उपलब्ध होंगे।</span>
              <a
                href={waLink(e, `Hi, I'd like to know when ${e.shortName} ${e.edition} results are out.`)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
              >
                Tell me when results are out
              </a>
            </div>
          )}
        </div>
      </section>

      {past.length > 0 && (
        <section className="section section-navy section-texture" id="records">
          <div className="container">
            <div className="section-head reveal">
              <p className="eyebrow">TGCG track records · कोर्स रिकॉर्ड</p>
              <h2>The fastest ever at TGCG</h2>
              <p>Can you beat them on {e.dateLabel.replace(/^\w+, /, "")}?</p>
            </div>
            <CourseRecords editions={past} />
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section className="section section-sand" id="past">
          <div className="container">
            <div className="section-head reveal">
              <p className="eyebrow">Hall of fame · पिछले परिणाम</p>
              <h2>Past editions: winners &amp; certificates</h2>
              <p className="muted">
                Pick a year to see the podium in every category, and download your old timing certificate with your BIB
                number. पुराने सर्टिफिकेट के लिए साल चुनें।
              </p>
              {e.pastResultsGaps?.map((g) => (
                <p key={g.label} className="muted pr-gapline">
                  {g.label}: non-timed, invite-only runs due to COVID, so no results.
                </p>
              ))}
            </div>
            <PastResults editions={past} gaps={e.pastResultsGaps} />
          </div>
        </section>
      )}

      <section className="section">
        <div className="container narrow center">
          <Link href={`${e.basePath}/pace-calculator`} className="link">
            Planning your next run? Try the pace calculator →
          </Link>
        </div>
      </section>
    </>
  );
}
