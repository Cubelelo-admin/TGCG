import type { EventConfig } from "@/site/content/types";
import { googleCalendarUrl, SITE_URL } from "@/site/lib/event";

export default function AddToCalendar({ e, className = "" }: { e: EventConfig; className?: string }) {
  return (
    <div className={`add-cal ${className}`}>
      <span className="add-cal-label">
        <span aria-hidden="true">📅</span> Add race day to calendar:
      </span>
      <a href={googleCalendarUrl(e, SITE_URL)} target="_blank" rel="noopener noreferrer">
        Google
      </a>
      <a href={`${e.basePath}/calendar.ics`} download={`${e.slug}-${e.edition}.ics`}>
        Apple / Outlook
      </a>
    </div>
  );
}
