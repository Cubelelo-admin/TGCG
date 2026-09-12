-- Generalize wa_message_log to cover both WhatsApp (AiSensy) and email
-- (Gmail SMTP) confirmation sends, so both show up in one audit trail.

alter table wa_message_log
  add column if not exists channel text not null default 'whatsapp';

alter table wa_message_log
  add constraint wa_message_log_channel_check check (channel in ('whatsapp', 'email'));
