"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SiteAsset } from "@/lib/site-assets";
import { Button, Icon, StatusPill } from "@/components/ds";

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
    <div className="flex flex-col gap-3 rounded-12 border border-line bg-white px-3 py-6">
      {/* Settings-card header: 42px icon tile inline with the title. */}
      <div className="flex items-center gap-3">
        <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[10.5px] bg-surface-tertiary text-ink">
          <Icon name="file" size={18} />
        </div>
        <h2 className="min-w-0 flex-1 break-words text-20 font-medium text-ink">{asset.label}</h2>
        {asset.pdf_path ? (
          <StatusPill tone="active">Uploaded</StatusPill>
        ) : (
          <StatusPill tone="pending">Missing</StatusPill>
        )}
      </div>

      {asset.pdf_path ? (
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="flex min-w-0 items-center gap-1.5 text-14 text-ink">
            <Icon name="checkCircle" size={16} className="shrink-0 text-on-tint-green" />
            <span className="truncate">{asset.original_filename ?? "PDF uploaded"}</span>
          </p>
          <p className="text-12 text-ink-muted">
            Updated {new Date(asset.updated_at).toLocaleString("en-IN")}
          </p>
          <a
            href={`/api/assets/${asset.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex w-fit items-center gap-1 text-14 text-link hover:underline"
          >
            View current PDF
            <Icon name="external" size={14} />
          </a>
        </div>
      ) : (
        <p className="text-14 text-ink-muted">No PDF uploaded yet.</p>
      )}

      {error && (
        <p role="alert" className="flex items-center gap-1.5 text-12 text-[#D92D20]">
          <Icon name="alert" size={14} className="shrink-0" />
          {error}
        </p>
      )}

      <div className="mt-auto pt-1">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          onChange={onFileChange}
          disabled={uploading}
          className="hidden"
        />
        <Button
          type="button"
          variant={asset.pdf_path ? "outline" : "dark"}
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          <Icon name={uploading ? "clock" : asset.pdf_path ? "refresh" : "upload"} size={16} />
          {uploading ? "Uploading..." : asset.pdf_path ? "Replace PDF" : "Upload PDF"}
        </Button>
      </div>
    </div>
  );
}
