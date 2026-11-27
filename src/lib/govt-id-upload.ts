/**
 * Client-side prep for the KYC govt-ID upload.
 *
 * The file travels inside the /api/register checkout request, and Vercel rejects any
 * function request body over 4.5 MB with a plain-text 413 before our code runs. A phone
 * camera photo is often 4–8 MB, so competitive-category runners were stuck on
 * "Something went wrong". Photos are shrunk here (an ID stays readable at 1600 px), and
 * anything that still can't fit is refused at pick time with a clear message.
 */

/** Per file. Leaves room for the rest of the form and for more than one attendee. */
export const GOVT_ID_MAX_BYTES = 3 * 1024 * 1024;
/** Whole checkout request; Vercel's hard limit is 4.5 MB. */
export const CHECKOUT_MAX_BYTES = 4 * 1024 * 1024;

const MAX_SIDE = 1600;
const JPEG_QUALITY = 0.82;

export type PreparedGovtId = { ok: true; file: File } | { ok: false; error: string };

function mb(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function shrinkImage(file: File): Promise<File | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return null; // e.g. HEIC on Android Chrome: the browser can't decode it
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return null;
  }
  // JPEG has no alpha: paint white first so transparent PNG screenshots don't turn black.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
  if (!blob) return null;
  const base = file.name.replace(/\.[^.]+$/, "") || "govt-id";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
}

export async function prepareGovtIdFile(file: File): Promise<PreparedGovtId> {
  if (file.type.startsWith("image/")) {
    const shrunk = await shrinkImage(file);
    if (shrunk && shrunk.size < file.size) return { ok: true, file: shrunk };
    if (file.size <= GOVT_ID_MAX_BYTES) return { ok: true, file };
    return {
      ok: false,
      error: `This photo is too large (${mb(file.size)}) and couldn't be resized. Please upload a JPG or PNG photo or screenshot of the ID.`,
    };
  }
  if (file.size <= GOVT_ID_MAX_BYTES) return { ok: true, file };
  return {
    ok: false,
    error: `This file is too large (${mb(file.size)}). Please upload a photo of the ID instead, or a PDF under ${mb(GOVT_ID_MAX_BYTES)}.`,
  };
}
