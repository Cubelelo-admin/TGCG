// Bilingual text. The language switch (EN / हिंदी / both) shows one or both halves via CSS.
export default function Bi({ en, hi, stack = false }: { en: React.ReactNode; hi?: React.ReactNode; stack?: boolean }) {
  if (!hi) return <>{en}</>;
  return (
    <span className={`bi ${stack ? "bi-stack" : ""}`}>
      <span className="lang-en">{en}</span>
      <span className="lang-sep" aria-hidden="true">
        {" / "}
      </span>
      <span className="lang-hi" lang="hi">
        {hi}
      </span>
    </span>
  );
}
