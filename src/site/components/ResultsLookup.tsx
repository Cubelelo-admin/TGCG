"use client";

import { useState } from "react";

// Opens the timing partner's result / certificate page for a BIB number.
export default function ResultsLookup({ template }: { template: string }) {
  const [bib, setBib] = useState("");

  return (
    <form
      className="results-form"
      onSubmit={(ev) => {
        ev.preventDefault();
        const clean = bib.trim();
        if (!clean) return;
        window.open(template.replace("{bib}", encodeURIComponent(clean)), "_blank", "noopener,noreferrer");
      }}
    >
      <label htmlFor="bib">BIB number / चेस्ट नंबर</label>
      <div className="results-row">
        <input
          id="bib"
          name="bib"
          inputMode="numeric"
          autoComplete="off"
          placeholder="e.g. 21039"
          value={bib}
          onChange={(ev) => setBib(ev.target.value)}
          required
        />
        <button type="submit" className="btn btn-primary">
          Find my result ↗
        </button>
      </div>
    </form>
  );
}
