import Link from "next/link";
import type { EventConfig } from "@/site/content/types";
import { registrationStatus, waLink } from "@/site/lib/event";
import Bi from "./Bi";

export default function RegisterCta({ e }: { e: EventConfig }) {
  const status = registrationStatus(e);
  const canRegister = status === "open";
  return (
    <section className="cta-band">
      <div className="container cta-inner">
        <div>
          <h2>See you at the start line in {e.city}.</h2>
          <p>
            {status === "closed" ? (
              <>
                Registration is closed. {e.shortName} · {e.dateLabel}
              </>
            ) : e.registrationDeadline ? (
              <>
                Registration closes <strong>{e.registrationDeadline}</strong>.{" "}
                {e.registrationDeadlineHi && <span className="hi">{e.registrationDeadlineHi}</span>}
              </>
            ) : (
              <>
                {e.shortName} · {e.dateLabel}
              </>
            )}
          </p>
        </div>
        {canRegister ? (
          <Link href={`${e.basePath}/register`} className="btn btn-light btn-lg">
            <Bi en="Register now" hi="पंजीकरण" />
          </Link>
        ) : status === "closed" ? (
          <Link href={`${e.basePath}/race-day`} className="btn btn-light btn-lg">
            <Bi en="Race day guide" hi="रेस डे गाइड" />
          </Link>
        ) : (
          <a
            href={waLink(e, `Hi, please notify me when registration for ${e.shortName} ${e.edition} opens.`)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-light btn-lg"
          >
            <Bi en="Notify me" hi="सूचना पाएँ" />
          </a>
        )}
      </div>
    </section>
  );
}
