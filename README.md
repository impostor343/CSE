# Bytewise — CSE Learning Roadmap
Personal 1,029-session CSE learning tracker (PWA). See HANDOFF.md.


## Expanded curriculum practice bank

The Questions tab loads `data/question-bank.json` in addition to the workbook exercises. The bank contains 339 questions: 252 curated practical prompts across all 31 modules, workbook exercises and the existing LeetCode catalogue, with task descriptions, acceptance criteria, hints, difficulty, type, estimated time and module mapping. Search and filter by module, difficulty, type and personal status. Progress and notes remain local in IndexedDB.

To add questions, append objects to the `questions` array in `data/question-bank.json`. Give every new question a unique `id`, `moduleId`, `module`, `title`, `type`, `difficulty`, `prompt`, `acceptanceCriteria`, `hint`, and `estimatedMinutes`. Keep `sessionDays` aligned with the module's start/end day range.
