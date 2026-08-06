-- Hinweis zur Datenbasis je Prozessschritt.
-- Die Vier-Block-Ansicht (public/legacy/lumina.html, renderStepGuidance) zeigt den Text als
-- auffaellige Box ganz oben im Anleitung-Block, vor dem Ziel. Ist die Spalte null oder leer,
-- entfaellt die Box vollstaendig - deshalb nullable und ohne Default.
-- Der Frontend-Select liest die Tabelle mit '*', die Spalte steht dort ohne weitere Aenderung bereit.

alter table public.process_step_guidance
  add column if not exists datenbasis_hinweis text;

comment on column public.process_step_guidance.datenbasis_hinweis is
  'Warnhinweis zur Datenbasis des Prozessschritts (z. B. unvollstaendiger oder vorlaeufiger Datenstand). Null/leer = keine Anzeige.';
