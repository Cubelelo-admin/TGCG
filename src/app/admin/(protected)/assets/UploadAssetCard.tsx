"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SiteAsset } from "@/lib/site-assets";

export default function UploadAssetCard({ asset }: { asset: SiteAsset }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.set("file", file);

    const res = await fetch(`/api/admin/assets/${asset.id}`, { method: "POST", body: formData });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Upload failed");
      setUploading(false);
      return;
    }

    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
      <h2 className="font-semibold">{asset.label}</h2>

      {asset.pdf_path ? (
        <div className="mt-2 text-sm text-neutral-400">
          <p className="truncate text-emerald-400">{asset.original_filename ?? "PDF uploaded"}</p>
          <p className="mt-0.5">Updated {new Date(asset.updated_at).toLocaleString("en-IN")}</p>
          <a
            href={`/api/assets/${asset.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block underline"
          >
            View current PDF
          </a>
        </div>
      ) : (
        <p className="mt-2 text-sm text-neutral-500">No PDF uploaded yet.</p>
      )}

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

      <label className="mt-4 block">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          onChange={onFileChange}
          disabled={uploading}
          className="hidden"
        />
        <span
          className={`inline-flex items-center rounded-full border px-4 py-2 text-sm font-medium ${
            uploading
              ? "cursor-not-allowed border-white/10 text-neutral-500"
              : "cursor-pointer border-white/20 text-neutral-50 hover:border-white/40"
          }`}
        >
          {uploading ? "Uploading..." : asset.pdf_path ? "Replace PDF" : "Upload PDF"}
        </span>
      </label>
    </div>
  );
}
