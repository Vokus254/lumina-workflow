create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.companies (
  id uuid primary key default gen_random_uuid(), name text not null, legal_form text,
  registered_office text, currency_code text not null default 'EUR', legacy_source_key text unique,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.projects (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
  name text not null, fiscal_year_start date not null, fiscal_year_end date not null, reporting_date date not null,
  status text not null default 'active' check(status in ('draft','active','locked','archived')),
  legacy_source_key text unique, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(company_id,fiscal_year_start,fiscal_year_end)
);
create table public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  security_role text not null check(security_role in ('owner','manager','contributor','reviewer','viewer')),
  active boolean not null default true, created_at timestamptz not null default now(), primary key(project_id,user_id)
);
create table public.responsibility_roles (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
  role_key text not null, display_name text not null, first_name text, last_name text, email text,
  legacy_source_key text, created_at timestamptz not null default now(), unique(project_id,role_key)
);
create table public.external_contacts (
  id uuid primary key default gen_random_uuid(), company_id uuid references public.companies(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete set null, email text not null, first_name text, last_name text,
  organization_name text, active boolean not null default true, access_enabled boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(company_id,email)
);
create table public.process_steps (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
  parent_id uuid references public.process_steps(id) on delete cascade, code text not null, name text not null,
  sort_order integer not null default 0, legacy_source_key text, unique(project_id,code)
);
create table public.tasks (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
  process_step_id uuid references public.process_steps(id), responsibility_role_id uuid references public.responsibility_roles(id),
  source_number text, title text not null, category text, required_documents_text text, expected_format text,
  company_scope_text text, due_rule_label text, due_offset_days integer, due_date date, due_date_override date,
  internal_comment text, work_status text not null default 'open' check(work_status in ('open','accepted','in_progress','submitted','completed','not_relevant')),
  review_status text not null default 'unreviewed' check(review_status in ('unreviewed','question','changes_required','accepted')),
  legacy_source_id text, legacy_source_key text not null, sent_at timestamptz, reminded_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(project_id,legacy_source_key)
);
create index tasks_project_status_idx on public.tasks(project_id,work_status,review_status);
create index tasks_project_due_idx on public.tasks(project_id,due_date);
create table public.dataroom_folders (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
  parent_folder_id uuid references public.dataroom_folders(id) on delete cascade, name text not null, template_key text,
  sort_order integer not null default 0, visibility_scope text not null default 'internal' check(visibility_scope in ('internal','assigned_external','project_external')),
  legacy_path_key text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
  unique(project_id,legacy_path_key)
);
create table public.task_folder_assignments (
  task_id uuid not null references public.tasks(id) on delete cascade, folder_id uuid not null references public.dataroom_folders(id) on delete cascade,
  is_primary boolean not null default true, assigned_at timestamptz not null default now(), assigned_by uuid references auth.users(id), primary key(task_id,folder_id)
);
create table public.document_requests (
  id uuid primary key default gen_random_uuid(), task_id uuid not null references public.tasks(id) on delete cascade,
  folder_id uuid references public.dataroom_folders(id), title text not null, description text, expected_format text,
  required boolean not null default true, sort_order integer not null default 0, created_at timestamptz not null default now()
);
create table public.task_invitations (
  id uuid primary key default gen_random_uuid(), task_id uuid not null references public.tasks(id) on delete cascade,
  external_contact_id uuid not null references public.external_contacts(id), status text not null default 'draft' check(status in ('draft','sent','opened','accepted','expired','revoked','completed')),
  token_hash text unique, expires_at timestamptz not null, sent_at timestamptz, first_opened_at timestamptz,
  last_opened_at timestamptz, revoked_at timestamptz, created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create index task_invitations_contact_idx on public.task_invitations(external_contact_id,status,expires_at);
create table public.documents (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
  folder_id uuid not null references public.dataroom_folders(id), task_id uuid references public.tasks(id), request_id uuid references public.document_requests(id),
  display_name text not null, document_status text not null default 'uploaded' check(document_status in ('uploaded','in_review','question','changes_required','approved','rejected','archived')),
  created_by_user_id uuid references auth.users(id), created_by_external_contact_id uuid references public.external_contacts(id),
  legacy_source_id text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
  check(created_by_user_id is not null or created_by_external_contact_id is not null)
);
create table public.document_versions (
  id uuid primary key default gen_random_uuid(), document_id uuid not null references public.documents(id) on delete cascade,
  version_number integer not null check(version_number>0), storage_bucket text not null default 'lumina-datarooms', storage_path text not null,
  original_file_name text not null, mime_type text, file_size bigint not null check(file_size>=0 and file_size<=52428800), checksum_sha256 text,
  upload_comment text, uploaded_by_user_id uuid references auth.users(id), uploaded_by_external_contact_id uuid references public.external_contacts(id),
  created_at timestamptz not null default now(), unique(document_id,version_number), unique(storage_bucket,storage_path),
  check(uploaded_by_user_id is not null or uploaded_by_external_contact_id is not null)
);
create table public.document_reviews (
  id uuid primary key default gen_random_uuid(), document_id uuid not null references public.documents(id) on delete cascade,
  document_version_id uuid not null references public.document_versions(id), action text not null check(action in ('submitted','question','changes_required','accepted','rejected')),
  comment text, reviewer_user_id uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create table public.task_messages (
  id uuid primary key default gen_random_uuid(), task_id uuid not null references public.tasks(id) on delete cascade,
  invitation_id uuid references public.task_invitations(id), message_type text not null check(message_type in ('invitation','reminder','question','response','completion')),
  recipient_email text not null, subject text not null, body_text text not null, provider_message_id text,
  status text not null default 'queued' check(status in ('draft','queued','sent','delivered','failed','bounced')),
  sent_at timestamptz, created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create table public.task_activity_events (
  id bigint generated always as identity primary key, project_id uuid not null references public.projects(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade, document_id uuid references public.documents(id) on delete cascade,
  actor_user_id uuid references auth.users(id), actor_external_contact_id uuid references public.external_contacts(id),
  event_type text not null, event_data jsonb not null default '{}'::jsonb, legacy_event_at timestamptz, created_at timestamptz not null default now()
);
create table public.project_notification_settings (
  project_id uuid primary key references public.projects(id) on delete cascade, sender_email text not null,
  magic_link_enabled boolean not null default true, password_login_enabled boolean not null default true,
  max_file_size_bytes bigint not null default 52428800, bucket_name text not null default 'lumina-datarooms', updated_at timestamptz not null default now()
);

do $$ declare t text; begin foreach t in array array['companies','projects','project_members','responsibility_roles','external_contacts','process_steps','tasks','dataroom_folders','task_folder_assignments','document_requests','task_invitations','documents','document_versions','document_reviews','task_messages','task_activity_events','project_notification_settings'] loop execute format('alter table public.%I enable row level security',t); end loop; end $$;
