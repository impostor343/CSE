# HANDOFF: CSE Roadmap app (read this first)

## Update (Learning Library + UI refresh)
- **Library tab** (route still `#resources`, label "Library"): `js/resources.js` rewritten. Data: `data/library.json` (10 topic cards, 94 free books/guides/docs, every one of the 25 areas covered) plus the existing `data/free-resources.json` (41 sites). `#resources/<topicId>` shows one topic. Only legally free material is listed; `pdf` is set only where a direct PDF link is known, otherwise `url` is the book page.
- Offline PDFs work for books and sites (IndexedDB `resourceFiles`, ids `BKxxx` / `FRxx`); marks use `resourceState`. Not in the JSON backup.
- **css/library.css** (Library styles) and **css/refresh.css** (loaded last): one header style, solid tab bar + fade so content no longer shows through/overlaps, pastel Calendar (no dark band/cells), pastel Settings sections, Progress "This week" chart, and all motion.
- **js/motion.js**: adds `body.anim-on` for ~2s after each screen change; animations only run then, so re-renders never replay them. `prefers-reduced-motion` disables all animation.
- `js/progress.js`: added `weekCard()` (last 7 days of completions, streak).
- `css/resources.css` is still loaded (it also holds Settings > Appearance rules); do not delete it.
- Service worker cache is `bytewise-v20`.
- To add books: edit `data/library.json` (`areas`, `title`, `author`, `url`, `pdf`, `kind`, `level`, `license`, `note`).


## Update (Android integration)
- **First-launch Home fix:** `U.route` now treats an empty hash as Home. Before, opening the app at `https://localhost/` (no `#`) left Home on "Loading…".
- **Back button (Android app):** `js/native.js` > `NativeNav`. Order: close open dialog, go up one level (`parentHash`), then Home, then minimise the app. Needs `@capacitor/app` (added to package.json).
- **Swipes:** `js/gestures.js`. Home card: swipe left = following day, right = previous day (never changes completion). Info sheet: drag down to dismiss (only from the top of the content or the handle).
- **Widgets (native):** `android-build/add_widgets.py` writes Java + XML into the generated Capacitor project (MainActivity registers `WidgetBridge`; providers `NextSessionWidget`, `ProgressWidget`; patches AndroidManifest). The workflow runs it after `cap sync`.
- **Widget data flow:** the real progress lives in the WebView's IndexedDB, so `js/widgets.js` sends a snapshot (done, total, skipped, next day, title, module, time) via `Capacitor.Plugins.WidgetBridge.update` on launch, on every `cur-changed`, and when the app is hidden. Native stores it in SharedPreferences and redraws both widgets. Widget tap passes a route (`#today/N` or `#progress`); only those exact patterns are accepted by JS.
- Service worker cache is `cse-roadmap-v12`; bump it and the `?v=` numbers together.
- Not verified: the native build itself (no Android SDK in the authoring environment). Check the first Actions run and a real phone.

## Update (Bytewise branding + interactive widget)
- App/PWA identity renamed Bytewise; launcher and web icons are generated from the owner's graduation-cap/code logo reference.
- Native Next Session widget redesigned as a Bytewise card with a determinate blue circular progress ring, live day/title/module/time, and Previous / Done / Next controls. Button taps open the app; Done marks the selected curriculum day complete in the existing IndexedDB-backed state.
- Widget percentage is completed sessions / total sessions; skipped sessions remain separately counted in the Progress widget.
- Added semantic icons and individual accent treatments for all 25 projects in list and detail views.
- `js/widgets.js`, `android-build/add_widgets.py`, `js/projects.js`, `js/icons.js`, `css/progress.css`, `index.html`, `manifest.webmanifest`, `capacitor.config.json`, and `icons/` were updated.
- Android build still requires GitHub Actions; no Android SDK is available in this authoring environment. Native widget rendering and taps must be tested on a real Android launcher.

## Update (latest)
- Added js/theme.js (palette, font, light/dark, text size; was referenced but missing) and Settings > Appearance + Offline card.
- Added missing State functions used by Progress: pendingCount, inProgressCount, conceptStats, conceptStatus, conceptsDone (dashboard crashed without them).
- Added Resources tab (js/resources.js, css/resources.css, data/free-resources.json, 41 links). Offline PDFs: attach on phone (IndexedDB 'resourceFiles', DB v6, not in JSON backup) or set "pdf" path in the JSON (files go in pdfs/).
- Added sw.js (offline cache). Bump CACHE in sw.js and the ?v= numbers in index.html whenever files change.
- Dark mode can now be forced: every prefers-color-scheme dark block has a data-mode twin.


**Version 2 (this update) replaced the 253-day dated Java schedule with a 1,029-session day-numbered CSE learning system.**
Sections below the divider describe the OLD version and are kept only for history; `MIGRATION_REPORT.md` is current.

## Current design
- Plain HTML/CSS/vanilla JS PWA, no build step. Source of truth = workbook `CSE_Engineering_Master_Roadmap_Sem3_to_Sem8_v3_Full_Detail_Verified.xlsx`, converted by `python3 tools/build_data.py <xlsx>` into `data/curriculum.json`.
- Two separate time systems: curriculum Day 1–1,029 (permanent IDs; no dates; next session = first not completed/not skipped) and actual completion history (real timestamps in `completions`).
- Files: js/util.js, store.js (IndexedDB v5, additive), data.js, state.js (all progress logic), sessionview.js, home.js, navigator.js (curriculum blocks of 30), history.js, progress.js (+topics), projects.js, questions.js, settings.js (backup/restore + earlier records). css/cur.css. Old scripts in legacy/.
- Stores: completions (one active record per day; reopen sets reopenedAt), sessionState, topicState, projectState, milestoneState, events, practiceState, meta. Old stores progress/dateNotes/questionState are never modified.
- Tabs unchanged: Home, Calendar (Curriculum | Completion history), Questions, Projects, Progress. Settings via top icon.
- Rules from the owner still apply: never invent roadmap data; don't claim untested things; plain-English, small steps; no frameworks.
- Open: Stage 8 (service worker/offline), final cleanup (data-check.html still exists), phone test, topic prerequisites/exercises not in workbook (see report).

---
# OLD VERSION (history only)

This file lets any AI assistant continue the project without the earlier chat.
Last updated after Stage 6a: UI refresh of Home and the Info sheet (from the user's reference image) and the Question Bank; awaiting the user's phone test.

## 1. What this is
A personal, installable, offline-first Progressive Web App (PWA) that lets one
GTU CSE student follow a 253-day Java internship learning roadmap (246 workbook days + 7 pause days) on an Android
phone. Source of truth: an Excel workbook, GTU_Java_Internship_Roadmap_REPAIRED.xlsx.
The app has no Excel reader; the workbook was converted once into JSON files.

## 2. The user and how to work with them
- Beginner programmer. Explain in plain English. Give exact file paths.
- Works almost entirely on an Android phone (Chrome, Files app, GitHub website).
- Zero budget: free tools only. No accounts, ads, analytics, API keys or backend.
- Wants small steps: ONE stage per response, state the goal, list the exact
  files, give complete replacement files, then a short test checklist.
- Never claim something is tested unless it really was. Say what was and was
  not checked. Wait for the user's test result before the next stage.
- During design, ask ONE question per message with simple options.
- Never invent roadmap entries, problems, links, resources or project steps.
  If data is unclear, ask the user.
- Do not change architecture (no React, TypeScript, build tools, frameworks).

## 3. Tech and hosting
- Plain HTML, CSS, vanilla JavaScript. Manifest now; service worker in Stage 8.
- Progress storage (later): IndexedDB. Export/restore backup as a downloadable file.
- Hosting: GitHub Pages (free). Account: impostor343. Repo: java-roadmap-app (public).
- Live address: https://impostor343.github.io/java-roadmap-app/
- Temporary data page: .../data-check.html (to be removed before the final version).
- It is a PWA, not an APK. Install via Chrome menu, Install app / Add to Home Screen.
  Full offline support and proper install are Stage 8.

### How the user updates files (works on a phone)
Each stage is delivered as a small zip of changed files. The user extracts it
in the Files app, then uploads each file with GitHub's upload pages, which
create folders automatically and replace same-named files:
- Root files: https://github.com/impostor343/java-roadmap-app/upload/main
- css/: .../upload/main/css    js/: .../upload/main/js
- data/: .../upload/main/data  icons/: .../upload/main/icons
Then tap Commit changes, wait about a minute, reopen the app address.
Note: when scripting zips, create folders with separate mkdir commands
(brace expansion like {css,js} failed in the shell used earlier).

## 4. Folder structure (current)
```
java-roadmap-app/
  index.html               shell: header, 6 screens, bottom tab bar, Info dialog
  manifest.webmanifest     install info (white background/theme colours)
  css/styles.css           design tokens (light + dark) and all styles
  js/app.js                screen switching by URL hash
  js/data.js               loads data once; window.RoadmapData shared helpers
  js/today.js              Today card, Previous/Next, Info sheet; window.TodayView.showDay(day)
  js/icons.js              shared line icons: window.Icons.make(name)
  js/questions.js          Question Bank screen: search, filters, topic groups, problem sheet, own status and notes
  js/status.js             window.RoadmapStatus: Done/Skipped/catch-up logic, in-memory map, tally() counts
  js/progress.js           Progress dashboard, project pages, topic pages, status lists, catch-up queue (hash routes under #progress)
  js/store.js              IndexedDB wrapper: window.RoadmapStore (getNote(date), saveNote, deleteNote(date), allNotes); db 'java-roadmap' version 4; stores: 'dateNotes' (keyed by date), 'questionState' (keyed by question id: {id, status 'in-progress'|'solved', notes, updatedAt}; no record = Not started), 'progress' (keyed by fixed day id: {day, scheduled 'done'|'skipped', scheduledAt, catchup null|'queued'|'done', catchupAt, updatedAt}); the old version-1 store 'dayNotes' is copied over once
  js/notes.js              My notes section: window.DayNotes.mount(parent, entry, idPrefix, onChange) and flush()
  js/calendar.js           Google-Calendar-style month grid, chips, legend, preview, notes
  js/data-check.js         temporary data check page script
  data-check.html          temporary data check page
  data/roadmap.json        246 entries from the workbook
  data/questions.json      56 Question Bank entries
  data/projects.json       7 project records with 24 versions
  data/resources.json      free resources list
  data/display-titles.json display titles for 23 cut-off workbook titles
  icons/                   icon-192.png, icon-512.png, icon-maskable-512.png
  DESIGN_SPEC.md           approved design
  PROJECT_STATUS.md        short status
  HANDOFF.md               this file
```
Script order in index.html: app.js, data.js, store.js, notes.js, today.js, calendar.js.
Note record: {date, day, did, review, remarks, updatedAt} (key = date). Empty notes are deleted, not stored.
`window.RoadmapData` has: entries, titles, ready (Promise), two(), toDate(),
formatDate(iso), titleOf(entry), plainTitle(entry), todayIso(), projectNames.

## 5. The workbook (inspect again if you can; ask the user to attach it)
Sheets: Daily Roadmap, Calendar View, App Display & Design, Question Bank, Free
Resources, Project Milestones, Project Version Map, Weekly Review, Read Me First,
plus Claude Guide and Workbook QA in the repaired file.
- 246 workbook days, 28 Oct 2026 to 30 Jun 2027 (Day 1 = Wed 28 Oct 2026); the app schedule is 253 days to 7 Jul 2027, see the schedule shift below.
- roadmap.json entry fields: day, date (ISO), phase, topics, task, resource
  {text, name, url}, practice, project, publish, folder, time, group, symbol,
  topicDay, title, projectKey (null on plain days), projectNotes.
- Overall roadmap day (day) is different from topicDay (resets per topic sequence).
  Card shows both: "Methods 01" (topic day) and "Day 1 of 246".
- 152 entries have resource links; others have plain text (no fake links).
- questions.json: 56 entries: id, platform, title, url, difficulty, prerequisites,
  recommendedDate, recommendedDay, assignmentRule, purpose, status, notes.
  14 are "Assigned (suggested)" to a real day; the rest are catalogue or pending,
  including 8 Codex slots with no titles/URLs yet. All assigned dates match the roadmap dates.
- Projects (six, with colours): Guessing Game (blue), Banking (green), Smart Library
  (purple), Inventory (orange), Task Management REST API (teal), Semester Planner
  Android App in Java (pink). Also a "frontend extension" record with no colour,
  and an optional concurrency extension of Banking. Semester 3 finals and all
  Semester 4 dates are provisional, not official.

### Schedule shift (user-approved, applied to data/roadmap.json)
- The user's GTU exams are 18-28 Nov 2026. The roadmap is paused for the 7 days
  before them (11-17 Nov) and continues after the exams. The roadmap is simply
  EXTENDED by 7 days: it now has 253 entries and ends 7 Jul 2027 (was 30 Jun).
- 7 new entries "Pre-exam Pause 01-07" (ids 247-253, symbol pause, group GTU exams,
  added: true). Wording written by Claude: "Roadmap paused before the GTU exams.
  No new topics or project work." The user can change it.
- Exam Buffer 01-11 stay on 18-28 Nov. The topics that were on 11-17 Nov (ids 15-21)
  now run 29 Nov-5 Dec. Every entry from id 33 to 246 moved exactly 7 days later,
  including the later (provisional) exam windows. Nothing was deleted or reordered.
- Each entry keeps `day` = fixed id from the workbook and `workbookDate` = original
  workbook date. `seq` (added at load in data.js) = position in the schedule, used for
  "Day N of 253". Question dates follow their entries (workbookRecommendedDate keeps the
  original). 7 of the 14 assigned dates changed.
- Not updated: dates written inside workbook text (e.g. project milestone strings like
  "Dec 2-6" in projects.json). Review them with the user when building the Projects tab.
- Notes belong to calendar DATES (user decision), not to topics.
- The Today tab was renamed Home (internal hash is still #today).

### Progress rules (Stage 5)
- Eligible learning entries = 154 (not pause days, not "Exam Buffer" entries). The workbook has 246
  entries = 154 learning + 92 exam-buffer days; +7 pause days = 253. The user's brief wanted
  "246" as the denominator, but buffer days cannot be completed, so 154 is used and the dashboard
  explains this. Change one constant (the isLearning filter in js/status.js) if the user disagrees.
- Overall completed = done on schedule + caught up later. Cards: Completed = on schedule only;
  Skipped = all skipped (waiting + caught up); Pending = no status; Catch-up = waiting in queue.
- Status is keyed by the fixed day id, so it stays with the topic. Notes stay keyed by date.
- Home card has Done / Skipped / Mark caught up / Undo. Undo deletes the record. markSkipped never
  creates a second queue entry. Skipping never changes any date.
- Topics = the workbook `group` field (17 groups, schedule order). Projects = `projectKey` (6).
  The same entry can appear in one topic and one project; overall totals count each entry once.
- Project percent = project entries done / project entries (no version-level status exists).
- Project text dates (`returnWhen`, `milestones`) in projects.json are NOT shown: they belong to the
  original schedule. Banking V1 says "Nov 14-17, 2026" but its entries are now 2-5 Dec 2026.
- Routes: #progress, #progress/project/<key>, #progress/topic/<slug>, #progress/topics,
  #progress/list/<completed|skipped|pending>, #progress/catchup.
- Calendar cells show a corner mark (done, skipped, caught up) and dim done days.

### Question Bank and UI refresh (Stage 6a)
- Home card and Info sheet follow the user's reference image (tinted card, group chip with icon, big emoji,
  Done/Skipped with icons, Previous/Info/Next, Jump to date, notes card; Info sheet = section cards with
  label/value rows, resource link row, folder row with a copy button). The mockup text "This task
  covers..." was NOT used because it is not in the workbook.
- Question Bank: groups come from the "Learn/practise: <topic>;" part of each question's prerequisites text
  (18 groups incl. the 8 Codex placeholder slots). Filters: All/Assigned/Not assigned/Not started/In
  progress/Solved plus platform. Assigned = workbook status "Assigned (suggested)" (14). Codex slots have
  no title/URL: shown as "Needs clarification", not trackable, not counted in totals (48 trackable problems).
- The Info sheet lists the problems assigned to that day with link and status.
- Still to do in Stage 6: the Projects tab (placeholder).
- Ask the user which other screens (Calendar, Progress, etc.) should get the same visual polish.

## 6. Design decisions made by the user (interview answers)
1. Style: clean and minimal, lots of space, calm.
2. Palette: first cream + soft green; LATER CHANGED to white base with green as
   the main accent, plus blue, purple and pink as supporting colours.
3. Theme: follows the phone (light and dark both supported).
4. Daily card: single centred card. Revised order: date, topic group as a LARGE
   heading (e.g. Java basics), big emoji symbol, title with topic-day number,
   then "Day N of 246", suggested time, status marker.
5. Extras on card: date, overall day, suggested time, status marker (symbol + word).
6. Info screen: bottom sheet sliding up over the card.
7. Info content: plain lines "**Bold label:** info" (own idea). Empty ones are hidden.
8. Navigation: bottom bar of 5 tabs (Today, Calendar, Questions, Projects,
   Progress); Settings is an icon in the top corner.
9. Calendar: first a card-style grid; REVISED by the user to a Google Calendar
   style grid (rows/columns, thin lines, one coloured chip per day with emoji + topic name).
   Tapping a date shows a preview and list, plus a My notes section.
10. Cell text: emoji plus topic name in very small text, wrapping to 2 lines;
    full name appears in the preview.
11. Project colours: workbook colours softened to pastel; teal and pink replace
    pale green and pale red so they stay distinguishable.
12. Status markers: small corner symbols (check = done, arrow = skipped, loop =
    catch-up done), done days dimmed slightly, pending has none. Never rely on colour alone.
13. App icons: simple line icons with a text label under each. Topic symbols stay as workbook emoji.
14. Buttons: soft rounded, generous spacing, large text, only subtle fade/slide
    animation (none if reduced motion).
15. Question Bank: grouped by topic in collapsible groups, with a search box.
16. Progress: key numbers (completed, skipped, pending, catch-up queue), one
    progress bar, problems solved, per-project milestone progress. No streaks or guilt.
17. Settings: Export backup, Restore backup (validated + confirmation), note that
    data lives only on this phone, appearance (text size, project colours).
18. Done: saves instantly, then a gentle "Add remark" link appears.
19. Catch-up: a separate Catch-up screen reached from Progress, with a "Do it
    today" button on each item.

### Later user requests (after the interview)
- Add a notes section for any date (calendar) with: what I did today, review, remarks.
  Also shown on Today. Saved automatically on the phone (IndexedDB).
- Today tab: Yesterday / Today / Tomorrow buttons and a Jump to date picker.
- These notes must be included in the Stage 7 backup export/restore.

## 7. Behaviour rules (must be implemented exactly)
- Done: save status, timestamp, checklist state, notes locally; show in calendar
  and progress; never rewrite the original roadmap entry.
- Skipped: keep the original date, mark the entry skipped, add the work to a
  separate catch-up queue, never shift later dates, avoid duplicate catch-up entries.
- Catch-up completion is recorded separately; it does not pretend the original day was done on time.
- Next/Previous follow the ORIGINAL roadmap order, even if an entry is skipped.
- Progress statistics come only from real saved data. Scheduled and catch-up
  completions are counted separately.
- Backup: export to a file, import with validation, confirm before replacing,
  clear success/error messages, handle old/invalid files.
- Be honest that local data can be lost if browser data is cleared; external
  links need internet.

## 8. Data decisions made with the user
- 23 workbook titles were cut off with "..." . Display overrides live in
  data/display-titles.json: project days show the project title only with no
  number (e.g. "Banking project", "Guessing Game V3", "Concurrency lab"); other
  days show the full topic text plus the number. Original workbook titles are untouched.
- Days 218 and 221 mention projects but have no colour in the workbook: left as plain days (user agreed).
- Codex = a platform for coding examples and practice. Its name/URL is still
  unknown; its 8 slots stay pending. Do not invent them.
- The workbook has no "Why am I doing this?" text. Do not invent it. Ask the user where it should come from.
- Calendar only colours days that really have a project key in the workbook.
  Task API, Inventory and Semester Planner colour appear only if such days exist.

## 9. Stages
1. Foundation (shell, manifest, icons, styling): DONE, tested by user.
2. Roadmap data (JSON from workbook, data-check page): DONE, tested by user.
3. Daily card + Previous/Next + Info sheet: DONE, tested by user ("all fine").
4. Calendar (Google-style grid, project colours, legend, preview, Open card, notes marker),
   My notes section, and Today date strip: BUILT and checked in headless Chromium at phone
   size (grid, notes saving and surviving a reload, jump to date). NOT yet tested by the user on the phone.
5. Done, Skipped, catch-up screen, Progress dashboard, project pages, topic pages: BUILT and checked in
   headless Chromium at phone size (statuses, counts, strikethrough, reload persistence). NOT yet tested by the user.
6. Question Bank (topic groups, search, filters, assigned vs unassigned, status,
   notes) and Projects tab (project list, versions/milestones from projects.json).
7. Persistence and backup: IndexedDB, export, validated restore, Settings screen.
8. Offline and install: service worker, caching, update notice, test offline launch.
9. Final testing, remove data-check page, user guide, troubleshooting, known limits.

## 10. Known issues and open items
- Codex name/URL missing. 8 Codex slots pending.
- Info sheet has no "Why am I doing this?" (no workbook data).
- No saved progress yet; status on the card is always "Pending".
- No service worker yet: no offline use and no full install until Stage 8.
- The calendar cell text is very small by design; long names are clamped to 2 lines.
- The user must still check Stage 5 on the phone.
- Fixed in 5b: if an older open copy of the app (another tab or window) blocks the IndexedDB upgrade,
  the app used to stay on "Loading...". store.js now gives up after 4 s, shows a warning on Home and
  Progress, and closes its own connection when a newer version needs to upgrade. Scripts and CSS in
  index.html carry ?v=5b so phones fetch fresh copies; bump it when files change.
- Projects tab is still a placeholder (Stage 6b); Progress links to it.
- Group named "Learning" (16 entries) is a catch-all in the workbook; shown as is.
- Group "GTU exams" has 2 real learning entries, shown as a topic.
- Frontend extension has no roadmap entries, so it is not listed under Projects.
- Notes are in IndexedDB only: backup/restore (Stage 7) must cover them.
- Calendar chip text is tiny and long words may break mid-word in narrow cells.

## 11. Message to paste into a new AI chat
"I am continuing a project. Read HANDOFF.md (attached) and DESIGN_SPEC.md and
PROJECT_STATUS.md. Follow section 2 and section 7 exactly. Ask me to attach
GTU_Java_Internship_Roadmap_REPAIRED.xlsx and any repo files you need. Current
step: Stage 4 is built and awaiting my phone test; after I confirm it, start Stage 5.
Give one small stage at a time, complete replacement files, and a test checklist."
(Repo files can also be read at https://github.com/impostor343/java-roadmap-app)

## Android APK (Capacitor)
- Built by .github/workflows/build-apk.yml (manual run). Files: package.json, capacitor.config.json, android-build/{prepare-web.js,make_icons.py,debug.keystore}. APK is published under Releases.
- js/native.js shares files via Capacitor Filesystem+Share (blob downloads/PDF do not work in the WebView). Service worker is skipped inside the app.
- debug.keystore is committed on purpose so every build has the same signature (updates install over the old app). Keep the app private.
