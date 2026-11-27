import Link from "next/link";
import PageHero from "@/site/components/PageHero";
import RegisterCta from "@/site/components/RegisterCta";
import YouTube from "@/site/components/YouTube";
import type { EventConfig } from "@/site/content/types";
import { waLink } from "@/site/lib/event";

export default function TrainingView({ e }: { e: EventConfig }) {
  const t = e.training;
  const join = waLink(e, `Hi, I'd like to join the ${e.shortName} training program.`);

  return (
    <>
      <PageHero
        eyebrow="Free and effective"
        title={`Join the ${e.shortName} training program`}
        subtitle={t?.intro ?? `Training sessions for ${e.city} runners will be announced soon. Join on WhatsApp to get the schedule.`}
      >
        <div className="hero-actions">
          <a href={join} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
            Join via WhatsApp
          </a>
          <Link href={`${e.basePath}/pace-calculator`} className="btn btn-ghost">
            Pace calculator
          </Link>
        </div>
      </PageHero>

      <section className="section">
        <div className={`container ${t?.video ? "split" : "narrow"}`}>
          {t?.video && <YouTube id={t.video} title={`${e.shortName} training program`} vertical />}
          <div className="reveal">
            {t?.points?.length ? (
              <>
                <h2>What you get</h2>
                <ul className="check-list check-list-dark">
                  {t.points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <h2>Get race-ready with us</h2>
                <p className="lead">
                  Message the LetsRun team on WhatsApp to get the training schedule and join the group.
                  <span className="hi">ट्रेनिंग शेड्यूल के लिए हमें WhatsApp करें।</span>
                </p>
              </>
            )}
            <a href={join} target="_blank" rel="noopener noreferrer" className="btn btn-dark">
              Ask about the next session
            </a>
          </div>
        </div>
      </section>

      <RegisterCta e={e} />
    </>
  );
}
