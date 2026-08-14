# Project Context

## Product

**LUMINA Abschluss-Cockpit / LUMINA Workflow** is a professional workflow application for German HGB annual-closing processes.

Core promise:

> **Der Jahresabschluss. Transparent, termintreu, geräuschlos.**

Primary target users:
- CFO / finance leadership
- head of accounting
- general ledger / specialist accounting teams
- project leadership
- reviewers
- auditors / external participants where authorized
- administrators

Primary target companies:
- German HGB companies
- especially larger/mid-sized companies with material annual-closing and audit processes

## Product objective

LUMINA should make the annual-closing process operationally manageable:
- clear responsibilities
- deadlines and milestones
- task status
- document evidence
- review status
- communication
- audit readiness
- escalation
- management status
- role-specific daily work

The product must not become a generic project-management tool. It is specifically shaped around the finance / accounting / audit closing process.

## Current process model

Eight primary phases are used in the current shell:

1. Prüfungsauftrag & Mandatierung
2. Projektplanung & Kick-off
3. Abschlussvorbereitung
4. Erstellung Einzelabschlüsse
5. Konsolidierung & Gruppenabschluss
6. Prüfungsdurchführung
7. Feststellung & Gremienbeschluss
8. Veröffentlichung

The underlying project state contains a much richer hierarchy of process steps/tasks.

## Work status

Canonical user-facing work states:
- Offen
- In Bearbeitung
- Eingereicht
- Abgeschlossen

Internal values commonly used:
- `open`
- `in_progress`
- `submitted`
- `completed`

## Review status

Canonical user-facing review states:
- Ungeprüft
- Rückfrage
- Nachbesserung
- Akzeptiert

Typical internal values:
- `unreviewed`
- `question`
- `changes_required`
- `accepted`

## Important product principle

The process tile/task level is intended to be sufficiently actionable for an experienced accounting user. Instructions and evidence requirements should be concrete and task-specific rather than generic boilerplate.

## Historical content model

A major content redesign consolidated a larger set of detailed annual-closing activities into final work tiles with fields such as:
- Ziel
- Was ist zu tun
- Benötigte Unterlagen
- Liefergegenstand
- Typische Fehler
- Erledigt, wenn
- Empfohlene Arbeitshilfe

The final UI may use a different technical representation, but the product principle remains: the user should be able to execute work from the task itself without needing an undefined lower level.
