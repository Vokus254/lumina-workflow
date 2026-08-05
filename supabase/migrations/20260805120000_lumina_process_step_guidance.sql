-- Anleitungstexte und Arbeitshilfen je Prozessschritt.
-- Die Vier-Block-Ansicht im Legacy-Cockpit (public/legacy/lumina.html) liest genau diese Tabelle:
-- Block 1 Anleitung, Block 2 Arbeitshilfe-Download, Block 3 Status, Block 4 Datei-Upload.

create table if not exists public.process_step_guidance (
  id uuid primary key default gen_random_uuid(),
  process_step_id uuid not null unique references public.process_steps(id) on delete cascade,
  ziel text,
  was_ist_zu_tun jsonb not null default '[]'::jsonb,
  benoetigte_unterlagen jsonb not null default '[]'::jsonb,
  liefergegenstand jsonb not null default '[]'::jsonb,
  typische_fehler jsonb not null default '[]'::jsonb,
  erledigt_wenn text,
  zustaendige_rolle text,
  rechtsgrundlage text,
  arbeitshilfe_name text,
  arbeitshilfe_felder jsonb not null default '[]'::jsonb,
  arbeitshilfe_storage_bucket text not null default 'lumina-templates',
  arbeitshilfe_storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.process_step_guidance enable row level security;

-- Sichtbar fuer jeden, der den zugehoerigen Prozessschritt sehen darf (gleiche Regel wie process_steps).
drop policy if exists guidance_access_select on public.process_step_guidance;
create policy guidance_access_select on public.process_step_guidance for select to authenticated
using(exists(
  select 1 from public.process_steps s
  where s.id = process_step_id
    and (private.is_project_member(s.project_id)
      or exists(select 1 from public.tasks t where t.process_step_id = s.id and private.can_access_task(t.id)))));

-- Lesend fuer angemeldete Benutzer; Pflege erfolgt ueber Migrationen bzw. Service Role.
grant select on public.process_step_guidance to authenticated;
revoke insert, update, delete, truncate, references, trigger
  on public.process_step_guidance from authenticated;

-- Eigener Bucket fuer Arbeitshilfen/Vorlagen. Der Datenraum-Bucket scheidet aus,
-- weil dessen Leserechte an registrierte document_versions gebunden sind.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('lumina-templates','lumina-templates',false,26214400,array[
 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
 'application/vnd.ms-excel','application/pdf','text/csv',
 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists lumina_templates_select on storage.objects;
create policy lumina_templates_select on storage.objects for select to authenticated
using(bucket_id='lumina-templates');

insert into public.process_step_guidance
  (process_step_id, ziel, was_ist_zu_tun, benoetigte_unterlagen, liefergegenstand,
   typische_fehler, erledigt_wenn, zustaendige_rolle, rechtsgrundlage,
   arbeitshilfe_name, arbeitshilfe_felder, arbeitshilfe_storage_path)
select id,
  'Alle Rückstellungsarten (Personal, Gewährleistung, Steuern, Pensionen, ausstehende Rechnungen etc.) berechnen und belegen.',
  '["Bereits bekannte und neu identifizierte rückstellungsrelevante Sachverhalte mit der Buchhaltung besprechen und Belege einsehen.", "Berechnungsunterlagen zu den sonstigen Rückstellungen erstellen.", "Sonstige Personalkostenrückstellungen berechnen und prüfen.", "Pensionsrückstellungen anhand versicherungsmathematischer Gutachten ansetzen; für Jubiläumsrückstellungen ebenfalls.", "Steuerrückstellungen unter Berücksichtigung angekündigter Betriebsprüfungen berechnen.", "Rückstellungsspiegel je Art erstellen und auf HGB-Konformität prüfen."]'::jsonb,
  '["Versicherungsmathematische Gutachten (Pension, Jubiläum)", "Berechnungsunterlagen sonstige Rückstellungen und Personalkostenrückstellungen", "Unterlagen zu angekündigten Betriebsprüfungen"]'::jsonb,
  '["HGB-konformer Rückstellungsspiegel je Rückstellungsart"]'::jsonb,
  '["Rückstellungen werden nicht gemäß § 253 Abs. 2 HGB abgezinst (Restlaufzeit > 1 Jahr).", "Drohverlustrückstellungen für schwebende Geschäfte werden übersehen.", "Wahrscheinlichkeitseinschätzung bei Rechtsstreitigkeiten wird nicht mit dem Rechtsanwalt/StB abgestimmt.", "Vorjahresrückstellung wird nicht auf tatsächliche Inanspruchnahme vs. Auflösung überprüft."]'::jsonb,
  'Erledigt, wenn für jede Rückstellungsart Vortrag, Zuführung, Inanspruchnahme, Auflösung und Endstand HGB-konform im Rückstellungsspiegel dokumentiert sind.',
  'Buchhaltung / Leitung Rechnungswesen',
  '§ 249, § 253 Abs. 1 und 2 HGB',
  'Excel-Rückstellungsspiegel „Rueckstellungsspiegel"',
  '["Art der Rückstellung","Stand 01.01.","Verbrauch","Auflösung","Zuführung","Aufzinsung/Zinseffekt","Umbuchung","Stand 31.12.","davon Restlaufzeit ≤ 1 Jahr"]'::jsonb,
  'templates/3.12/Rueckstellungsspiegel.xlsx'
from public.process_steps
where legacy_source_key = 'taxonomy:3.12'
on conflict (process_step_id) do update set
  ziel=excluded.ziel,
  was_ist_zu_tun=excluded.was_ist_zu_tun,
  benoetigte_unterlagen=excluded.benoetigte_unterlagen,
  liefergegenstand=excluded.liefergegenstand,
  typische_fehler=excluded.typische_fehler,
  erledigt_wenn=excluded.erledigt_wenn,
  zustaendige_rolle=excluded.zustaendige_rolle,
  rechtsgrundlage=excluded.rechtsgrundlage,
  arbeitshilfe_name=excluded.arbeitshilfe_name,
  arbeitshilfe_felder=excluded.arbeitshilfe_felder,
  arbeitshilfe_storage_path=excluded.arbeitshilfe_storage_path,
  updated_at=now();
