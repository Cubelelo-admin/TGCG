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
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  const folderId = process.env.GOOGLE_DRIVE_KYC_FOLDER_ID;

  if (!clientId || !clientSecret || !refreshToken || !folderId) {
    console.warn(
      "GOOGLE_OAUTH_CLIENT_ID/GOOGLE_OAUTH_CLIENT_SECRET/GOOGLE_OAUTH_REFRESH_TOKEN/GOOGLE_DRIVE_KYC_FOLDER_ID not set — skipping Drive mirror"
    );
    return null;
  }

  try {
    // Service accounts have no storage quota on a personal (non-Workspace)
    // Google account and can't create Shared Drives there, so this mirrors
    // as the real Drive-folder-owning account via a stored OAuth refresh
    // token instead of a service account key.
    const auth = new google.auth.OAuth2(clientId, clientSecret);
    auth.setCredentials({ refresh_token: refreshToken });

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
