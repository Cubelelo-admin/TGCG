import "server-only";
import { Readable } from "node:stream";
import { google } from "googleapis";

/**
 * Mirrors a KYC file (already stored in Supabase Storage, the source of
 * truth) into a Google Drive folder for the team's convenience. Best-effort
 * only — a Drive failure must never affect the registration or payment flow.
 */
export async function uploadKycFileToDrive(params: {
  filename: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<{ fileId: string } | null> {
  const keyBase64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64;
  const folderId = process.env.GOOGLE_DRIVE_KYC_FOLDER_ID;

  if (!keyBase64 || !folderId) {
    console.warn(
      "GOOGLE_SERVICE_ACCOUNT_KEY_BASE64/GOOGLE_DRIVE_KYC_FOLDER_ID not set — skipping Drive mirror"
    );
    return null;
  }

  try {
    const credentials = JSON.parse(
      Buffer.from(keyBase64, "base64").toString("utf-8")
    );

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/drive"],
    });

    const drive = google.drive({ version: "v3", auth });

    const res = await drive.files.create({
      requestBody: {
        name: params.filename,
        parents: [folderId],
      },
      media: {
        mimeType: params.mimeType,
        body: Readable.from(params.buffer),
      },
      fields: "id",
    });

    return res.data.id ? { fileId: res.data.id } : null;
  } catch (err) {
    console.error("Drive KYC mirror failed", err);
    return null;
  }
}
