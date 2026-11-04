# Project Status

## Bytewise UI update (2026-10-31)
- Bytewise branding applied to the PWA/Android app name and launcher/PWA icons.
- Native Next Session widget redesigned with live curriculum data, progress percentage/ring, and Previous / Done / Next actions.
- Each of the 25 projects now has a semantic icon in the Projects tab and Progress dashboard.
- JavaScript syntax checks pass. Android native widget build and real-device interaction remain unverified; build through the GitHub Actions workflow and test on the phone.


Version 2 (CSE Learning System, Day 1–1,029) built and tested in headless Chromium; awaiting phone test. See HANDOFF.md and MIGRATION_REPORT.md. Stage 8 (offline) and final cleanup remain.

---
OLD STATUS (history)

## Architecture
Plain HTML, CSS and vanilla JavaScript. No build step, no framework, no server.
Roadmap data will be converted from the workbook into a JSON file in `data/`.
Progress will be saved in the browser (IndexedDB) and kept separate from the data.

## Folder structure (Stage 1)
```
java-roadmap-app/
  index.html              page shell, 6 screens, bottom tab bar
  manifest.webmanifest    install information (name, icons, colours)
  css/styles.css          design tokens (light and dark) and base styles
  js/app.js               switches screens using the URL hash
  icons/                  icon-192.png, icon-512.png, icon-maskable-512.png
  data-check.html         temporary page to check the data (removed later)
  js/data.js              loads the data once and shares helpers
  js/icons.js             shared line icons
  js/questions.js         Question Bank
  js/status.js            Done/Skipped/catch-up status logic
  js/progress.js          Progress dashboard, project and topic pages
  js/store.js             IndexedDB storage (day notes)
  js/notes.js             My notes section (Calendar and Today)
  js/calendar.js          month calendar with project colours, legend and preview
  js/today.js             Today card, Previous/Next and the Info sheet
  data/display-titles.json  display titles for the 23 cut-off workbook titles
  js/data-check.js        loads the data files for that page
  data/roadmap.json       246 daily entries (from the repaired workbook)
  data/title-overrides.json  31 shortened display titles (edit this file to change them)
  data/questions.json     56 Question Bank entries
  data/projects.json      7 project records with their versions
  data/resources.json     free resources list
  DESIGN_SPEC.md          approved design
  HANDOFF.md              full handoff for another AI or a new session
  PROJECT_STATUS.md       this file
```

## Stages
- Stage 1 Foundation: BUILT. Not yet tested on the phone.
- Stage 2 Roadmap data: BUILT. Waiting for the user to check data-check.html.
- Stage 3 Daily card and Info sheet: BUILT and checked on the phone by the user.
- Stage 4 Calendar: REBUILT in Google Calendar style, plus My notes and Today date strip. Checked in headless Chromium at phone size. Awaiting the user's phone test.
- Stage 5 Done/Skipped, catch-up, Progress, project and topic pages: BUILT. Checked in headless Chromium at phone size. Awaiting the user's phone test.
- Stage 6a Question Bank and Home/Info UI refresh: BUILT. Checked in headless Chromium at phone size. Awaiting the user's phone test. Stage 6b (Projects tab): not started.
- Stage 7 Storage and backup: not started.
- Stage 8 Offline and install (service worker): not started.
- Stage 9 Final testing and user guide: not started.

## Checks done so far
- app.js passes a JavaScript syntax check.
- manifest.webmanifest is valid JSON.
- index.html tags are balanced.
- NOT done: opening in a real browser, phone layout, install.

## Known issues and open items
- Schedule extended by 7 days for exams (see HANDOFF.md): 7 pause days 11-17 Nov, everything from id 33 moved 7 days later, ends 7 Jul 2027. Dates inside workbook text not updated.
- Today tab renamed Home.
- 23 workbook display titles were cut off with "...". Decided with the user: short titles; project days use the project name plus a running number. 31 edits in data/title-overrides.json (the original workbook titles stay in data/roadmap.json). Semester Planner days 206-211 were renumbered 03-08 so days 204-211 run 01-08; the user can ask to revert this.
- Days 218 and 221 mention projects in the project text but have no project colour key in the workbook; left as is.
- Frontend extension has no colour of its own in the workbook; it is not coloured.
- Codex platform name/URL still needed (8 slots stay pending).
- Today screen shows a labelled sample card; it is replaced in Stage 3.
- No service worker yet, so no offline use and no full install until Stage 8.

## Next step
User tests Stage 1 on the phone. Then Stage 2: convert the workbook
data into data/roadmap.json and review it with the user.


## Practice bank expansion (2026-10)
- Added a separate curriculum-aligned `data/question-bank.json` loaded by the app.
- Added 252 module-specific curated tasks (at least 8 per each of 31 modules), plus existing workbook exercises and 56 LeetCode catalogue problems.
- Questions include multiple practice formats, difficulty, prompts, acceptance criteria, hints, time estimates and module mapping.
- Questions UI now supports module, difficulty, type, text search and personal-status filters.

## Update (v6 batch)
- Questions: "Practice today" (3-5 questions for the current session); full bank behind search / Browse. `#questions/<id>` opens one question.
- Calendar: week strip + "Up next" list; the 30-day grid is collapsed under "Full 30-day grid".
- Settings: menu -> Appearance (live preview, contrast check + auto-fix), Reminders, Backup and data.
- Cards: short titles (js/shorten.js); tap a title to see the full name.
- Books linked to modules (data/module-books.json, js/books.js): "Read:" row on the Home card with page bookmark and Open book; Books section in Info.
- Home: "Continue where you stopped" card and categorised search (js/search.js: All / Questions / Sessions / Modules).
- Widget: android-build/add_widgets.py draws the whole Home card, coloured from the app palette (js/widgets.js sends Theme.widgetColors()). Needs the APK rebuilt; not tested on a device.
