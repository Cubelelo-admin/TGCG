-- uploadKycFileToDrive (src/lib/drive.ts) already mirrors every uploaded
-- govt ID into the team's Drive folder, but the fileId it returns was never
-- saved anywhere — there was no way to link back to the mirrored copy from
-- the admin CSV export. Stores it so the export can build a direct Drive
-- link per registration.

alter table registrations add column if not exists govt_id_drive_file_id text;
