# Bytewise curriculum icon integration

The curriculum icon assignments are now integrated into the app.

- `data/topic-module-icons.json` contains the icon map for all 31 modules and 294 topics.
- `js/data.js` loads the map alongside the curriculum and exposes `Curriculum.moduleIcon(id)` and `Curriculum.topicIcon(id)`.
- `js/progress.js` uses the mapped icons in the module list, module detail header, topic list, topic detail header, and project references.
- Icon names are resolved by the existing offline SVG registry in `js/icons.js`; no external icon package or network access is required.
- Missing/invalid map data gracefully falls back to existing icons.
- `sw.js` precaches the new JSON file and uses a new cache version so installed clients fetch the update.

To build the Android app, push the source to GitHub and run **Actions → Build Android APK → Run workflow**.
