-- Zweite Ergaenzung zur WP accepted-only Security-Luecke. Live-Test F zeigte: documents_access_select
-- pruefte can_access_task(task_id) OR can_access_folder(folder_id) IMMER, auch wenn ein Dokument
-- bereits ein eigenes task_id hat. Datenraumordner werden in diesem Projekt von sehr vielen Aufgaben
-- gemeinsam genutzt (task_folder_assignments ist m:n) - sobald IRGENDEINE Aufgabe in diesem Ordner
-- fuer den Nutzer zugreifbar ist (z. B. weil sie 'accepted' ist), gewaehrte can_access_folder()
-- Zugriff auf den GESAMTEN Ordner und damit auf ALLE Dokumente darin, unabhaengig vom review_status
-- der tatsaechlich zum jeweiligen Dokument gehoerenden Aufgabe. Live bestaetigt: ein NICHT
-- akzeptiertes Dokument einer fremden Aufgabe war fuer 'viewer' trotzdem sichtbar, weil derselbe
-- Ordner auch von einer bereits akzeptierten Aufgabe genutzt wurde.
--
-- Fix (praeziser fuer ALLE Rollen, nicht nur 'viewer' - keine Rechtsausweitung, nur eine bisher zu
-- weite OR-Verknuepfung eingeengt): wenn ein Dokument ein eigenes task_id hat, ist ausschliesslich
-- can_access_task(task_id) massgeblich. can_access_folder(folder_id) greift nur noch fuer
-- taskless Dokumente (task_id is null - z. B. schrittgebundene, nicht aufgabengebundene
-- Ablagen/Guidance-Dokumente, siehe Legacy-Kommentar "Dokumente ohne task_id haengen am
-- Prozessschritt").

alter policy documents_access_select on public.documents
  using (case when task_id is not null then private.can_access_task(task_id) else private.can_access_folder(folder_id) end);

alter policy versions_access_select on public.document_versions
  using (exists (
    select 1 from public.documents d
    where d.id = document_versions.document_id
      and (case when d.task_id is not null then private.can_access_task(d.task_id) else private.can_access_folder(d.folder_id) end)
  ));
