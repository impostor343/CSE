# Design Specification: Bytewise (personal CSE roadmap app)

Approved by the user. Source data: GTU_Java_Internship_Roadmap_REPAIRED.xlsx
(replaces the earlier workbook). Changes need the user's agreement.

## Look and feel
- Clean and minimal. White base with blue and violet as the Bytewise brand accents; the user's Bytewise icon is used for the app/PWA identity. (Changed from cream by the user after seeing
  Stage 1.)
- Light and dark both supported; follows the phone setting.
- Soft rounded buttons, generous spacing, large readable text.
- Only gentle fade/slide animation; none when "reduce motion" is on.
- App icons: simple line icons with a text label under each.
  Topic symbols stay as the workbook's emoji.

## Navigation
- Bottom bar, 5 tabs: Home (was Today; renamed by the user, house icon), Calendar,
  Questions, Projects, Progress.
- Settings is an icon in the top corner.

## Home card (the screen formerly called Today; restyled from the user's reference image)
- Order: date (small), topic group as a large heading, symbol, title with
  topic-day number (e.g. "Methods 01"), overall day ("Day 1 of 246"),
  suggested time, status marker (symbol plus word).
- Controls: Info, Previous, Next, Done, Skipped.
- Previous/Next follow the original roadmap order.
- Done saves instantly; an "Add remark" link then appears.

## Info (bottom sheet)
- Plain lines with a bold label, e.g. **Time:** 60-90 min.
- Empty labels and sections are left out. No fake links or estimates.

## Calendar (revised after user feedback: Google Calendar style)
- Month in rows and columns with thin grid lines, weekday letters on top,
  previous/next month arrows next to the month title.
- Each day shows its date number and one coloured chip: emoji plus topic name
  (project days use the project colour, plain days a neutral tint).
- Today = date number in a green circle. Selected day = green outline.
- A small pencil mark shows a day that has saved notes.
- Tapping a date shows a preview (title, day, project, time, topics) with an
  "Open card" button, then the My notes section, then the project legend.

## My notes (new)
- Under a selected date in the Calendar, and under the card on Today.
- Notes belong to calendar dates, not topics.
- Three fields: What I did today; Review (what I learned, what was hard);
  Remarks or blockers. Saved automatically on this phone, plus a Save button.

## Today navigation (revised)
- Yesterday / Today / Tomorrow buttons above the card (relative to the real date).
- Previous/Next still follow the original roadmap order.
- A "Jump to date" picker opens any scheduled date.

## Status markers
- Corner symbols: done = check, skipped = arrow, catch-up done = loop.
- Done days are dimmed slightly. Pending days have no marker.

## Question Bank (built: search, status and platform filters, topic groups, problem sheet with own status and notes)
- Grouped by topic, collapsible groups, search box.
- "Assigned (suggested)" stays separate from "Catalogue only".
- Codex slots stay pending until the user gives the platform name/URL.

## Projects (from the workbook)
Guessing Game (blue), Banking (green), Smart Library (purple),
Inventory (orange), Task Management REST API (teal, was pale green),
Semester Planner Android App in Java (pink, was pale red).
Frontend work is an extension of Library/Inventory.
Concurrency is an optional Banking extension.

## Progress (revised in Stage 5, from the user's reference image)
- Ring and bar for overall progress, four status cards (Completed, Skipped, Pending, Catch-up),
  Keep moving card (next pending learning day), Projects list, Topics list (first 6 + View all topics).
- Tapping a project or topic opens its own page; tapping a status card opens a filtered list;
  Catch-up opens the queue. Done = strikethrough + check + original date kept. Skipped = arrow +
  label, no strikethrough. Colours stay the app's own palette.
- Original progress notes below still apply.

## Progress (original)
- Key numbers (completed, skipped, pending, catch-up queue), one progress
  bar, problems solved, per-project milestone progress.
- Scheduled and catch-up completions are counted separately.
- No streaks, no guilt warnings.

## Catch-up
- Separate screen reached from Progress, with a "Do it today" button per item.
- Original date never changes.

## Settings
- Export backup, Restore backup (validated, with confirmation), a note that
  data lives only on this phone, appearance (text size, project colours).

## Rules that never change
- The workbook is the roadmap. Progress is stored separately and never
  rewrites the schedule.
- Never invent problems, links, resources or roadmap entries.
- Semester 3 finals and all Semester 4 dates are provisional, not official.


## Bytewise identity and Android home-screen widget (2026-10)
- Launcher/PWA icon uses the graduation-cap + code-mark image supplied by the owner.
- The native Next Session widget follows the supplied white, blue and violet card reference.
- Widget data is live from the app's IndexedDB-backed State: curriculum day, title, module, time, completed count and completion percentage. Never hardcode the sample 294 days or 87%.
- Widget controls: Previous opens the prior curriculum day; Done records completion for the displayed day; Next opens the following curriculum day. They open the app to carry out state-changing actions safely.
- The separate Progress widget remains available.
- Projects list and detail pages show a unique semantic icon for each of the 25 project records.
