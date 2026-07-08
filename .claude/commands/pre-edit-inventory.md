---
name: pre-edit-inventory
description: >
  Checklist to run BEFORE making targeted edits to UI, copy, or computed values.
  Triggers on: modifying a display formula, changing terminology, polling for
  deployment status, fixing a metric inconsistency, updating brand copy.
---

# Pre-Edit Inventory Checklist

Run this checklist before making any edit that touches a shared value,
a brand term, or a user-facing string. The goal is to inventory all affected
locations before writing the first change, not after.

---

## Trigger-Action Rules

**When modifying how a computed metric is displayed**
(renaming, applying a formula, scaling, adding an adjustment),
before writing the first edit,
must search the entire codebase for the source variable name and list every
location that renders it; exit criterion: all render locations accounted for,
each either updated with the new formula or explicitly documented as
intentionally unchanged.

**When changing terminology or copy on any page**
(rebranding, updating standard references, correcting disclaimers, removing
overclaims),
before closing the task,
must search all user-facing content files for the old string pattern;
exit criterion: zero remaining occurrences of the old term confirmed, or each
exception noted with justification.

**When a user reports two UI elements showing the same data with different
values**,
before writing any fix,
must search for all locations in the codebase that render that data source;
exit criterion: a complete list of render sites, and every site updated to
the same formula in a single commit.

**When a copy or branding change is driven by compliance or accuracy concerns**
(removing overclaims, adding disclaimers, updating framework/standard names),
before committing,
must audit all files that constitute the user-facing surface (pages, templates,
share views, legal pages);
exit criterion: the changed phrase returns zero matches across all
user-facing files.

**When implementing a polling loop using a web fetch tool**,
before the first iteration,
must verify whether the tool caches responses and the cache TTL;
if the TTL exceeds the polling interval, abort and escalate to the user
immediately rather than running futile iterations on stale data.

---

## Root Cause This Addresses

**Targeted fix without inventory** — making a correct but incomplete edit
because the full set of affected locations was not enumerated before starting.
This manifests as: one div updated, six pages untouched; one formula corrected,
one bar still showing the old value.

## Session Origin

Derived from CloudFrame session 2026-05-28.
A:B ratio: 2:1 (two user-triggered corrections vs one self-discovered issue).
Both (A) turning points shared the same root cause: solution before inventory.
