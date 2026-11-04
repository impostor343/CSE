# Migration report: Java Roadmap (253 dated days) to CSE Learning System (Day 1–1,029)

## 1. What the website had
- 253 date-driven entries (`data/roadmap.json`), 56 questions, 7 project records. Progress in IndexedDB `java-roadmap` v4:
  `progress` (keyed by OLD day id 1–246), `dateNotes` (by calendar date), `questionState` (by OLD ids Q001…).
- Home/Calendar were driven by the calendar date.

## 2. What the workbook has (read in full)
Daily Roadmap 1,029 rows (Phase 1 = Days 1–429, Phase 2 = 430–1,029; 24 columns), Module Map 31, Project Catalogue 25, Project Milestones 25,
Project Version Timeline 92 versions, Practice Bank 31, Free Resources 41, GitHub Publishing, Android Side Track, Language Strategy,
Interview Preparation, Academic Pause Planner, Workbook QA, Revision Tracker (formulas only), Start Here.
Imported by `tools/build_data.py` into `data/curriculum.json`. Every Daily Roadmap column is kept.

## 3. Added / replaced
- Added: `data/curriculum.json`, new stores (completions, sessionState, topicState, projectState, milestoneState, practiceState, events, meta), all new screens.
- Replaced: Home, Calendar (now Curriculum navigator + Completion history), Projects, Progress, Questions, Settings.
- Moved to `legacy/` (not loaded): the old date-driven scripts. Old `data/*.json` files are untouched and still used to display earlier records.

## 4. User progress: what happens to it
- The database upgrade only ADDS stores. `progress`, `dateNotes`, `questionState` are never modified or deleted (tested with seeded v4 data).
- They are NOT converted into new completions. Old day ids (1–246, "Methods 01" etc.) are a different curriculum from new Day 1–1,029 (Day 1 is now "Git mental model"). Guessing a mapping would create false completions.
- They are shown read-only in Settings > Earlier records, and included in every backup. Old question ids (Q001…) differ from the new Practice Bank ids (P001…), so there is no collision.
- Your real data lives in your phone's browser; this report could not read it. Open Settings after updating to see exactly what was found.
- **Before uploading:** nothing in the old app exports a backup. The upgrade is additive, but if you want a copy first, keep the old live site open until you confirm Settings shows your earlier records.

## 5. Conflicts and missing information (nothing invented)
1. No Topics sheet exists. Topics = the 31 Module Map rows (IDs M01–M31 assigned in sheet order; the workbook has no module IDs).
2. Practice Bank has Topic IDs (JAVA01, SQL01…) that are not modules, and no module/session links. Questions are not attached to topics or sessions.
3. No "prerequisites per topic" or "topic exercises/remarks" fields. Topic prerequisite shown = the previous module (by sequence) and the workbook says nothing more.
4. Projects have no description, purpose, tech stack, deployment or testing columns. Shown: skills, prerequisite, version roadmap, acceptance checks, folder, publish definition, continuity rule, notes.
5. Project milestones = the workbook versions (92). 4 Semester Planner versions have text targets (Android side-track / "After backend API integration"), not day numbers; shown as text.
6. Session-to-project link: only the 24 sessions whose checkpoint names a project; other project/version relations are "target day" references.
7. Workbook status/remarks columns are all "Not started"/empty and are kept as read-only reference.
8. Revision prompts (+3/+7/+21/+45) are shown as curriculum day numbers.
9. "Skipped" is supported. A skipped session is not counted as complete and is skipped by "next session"; you can return to it.

## 6. Verified (headless Chromium, 390 px wide) and not verified
Verified: upgrade from a seeded v4 DB keeps old records; Mark Done twice quickly = one record; out-of-order completion; reopen invalidates and re-done records a new timestamp; history shows same-day multiples; 35 blocks, last = Days 1021–1029 (9); 25 projects; 31 topics; 31 questions; version completion logs history and raises project %; backup dump includes old and new stores.
Not verified: real phone, restore-from-file flow, offline use (no service worker yet, as before), data-check.html with new data.

---
# Update: workbook v7 import + UI changes
- Source: `CSE_Engineering_Master_Roadmap_v7_Actionable_Daily_Practice_and_GitHub` (text export). Rebuild with `python3 tools/build_data.py <workbook.xlsx or export.txt>`.
- Imported: 31 modules, **294 topics** (TOP0001–TOP0294), 25 projects with proposed metadata, 216 project-topic links, 92 version milestones with mapped days, **882 topic project options** (`data/topic-projects.json`), Folder Guidance, mapping review queue, new session fields (topic, linked questions, problem links, project actions, folders).
- Stable app IDs kept (M01…, PR01…, P001…) so saved progress still matches. Nothing in IndexedDB or backup/restore was changed.
- **Export limit:** the supplied text export stops at 1,000 rows per sheet. Daily Roadmap has Days 1–999 (Days 1,000–1,029 keep the earlier data, `dataSource: carried-over`). Practice Bank has 999 of 2,089 questions (968 added, 31 updated); sessions from about Day 485 name question IDs whose details are not in the file. Re-run the build with the full .xlsx to fill them.
- UI: Progress rebuilt from the reference image; Curriculum calendar is a Google-style grid (still curriculum days, not dates); Settings > Appearance (7 palettes, 6 fonts; stored in localStorage); Home keeps the session after Done and shows Undo done.
- Fonts bundled in `fonts/` are Inter, Poppins and Lora (SIL Open Font License).

---
# Update: full workbook import
- Rebuilt from the complete .xlsx: all 1,029 sessions are `workbook-v7` (no carried-over rows); all 2,089 workbook questions imported (bank total 2,397 with earlier curated/LeetCode entries). Every linked question ID now resolves. Saved progress IDs are unchanged.
- Questions tab now shows 50 at a time ("Show more").
