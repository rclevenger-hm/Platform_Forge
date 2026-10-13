# Authoring missions

Use **Author** in the app to copy an existing lesson and edit its JSON. The preview checks the complete curriculum reference graph and displays explanations without executing imported code. Drafts persist with browser progress. Export a lesson, add or replace it in `src/data/missions.json`, and review it through normal git commits.

Run `npm run validate:curriculum`, `npm test`, and `npm run test:server` before publishing. Python solutions run under the bundled runtime in tests. Config/terminal solutions must satisfy their checks and starters must fail. Bash checks also run in the dedicated Docker integration job.

## Required fields

| Field | Contract |
|---|---|
| `id`, `version` | Stable uppercase ID; positive content version. Increase version when the challenge contract changes. |
| `title`, `summary`, `lesson`, `objective` | Original learning content; at least two explanatory paragraphs. |
| `track`, `difficulty`, `minutes` | Existing track ID; Foundation/Core/Advanced; 1–240 minutes. |
| `concepts` | Unique keys from `CONCEPTS` in `src/lib/curriculum.mjs`. |
| `prerequisites` | Existing mission IDs; cycles rejected. Guidance is advisory in the UI. |
| `transferOf` | Optional source mission ID sharing at least one concept. |
| `hints` | Exactly three progressive hints. |
| `quiz`, `answer`, `why` | Question + three choices, zero-based correct choice, explanation. |
| `kind` | `terminal`, `config` or `python`. |

Terminal missions need `commands` and `checks`. Config missions need `starter`, `solution` and `checks`. Python missions need `starter`, `solution` and trusted `tests`. Use edge cases that distinguish broken approaches, not just the exact worked solution.

## Bounded browser checks

Each descriptor has a learner-readable `label` and `type`.

| Kind | Type | Value |
|---|---|---|
| terminal | `read` | Path recorded in the simulation's read history |
| terminal | `state` | `key`: mode/running/cleared/inspectedDisk; expected `value` |
| terminal | `filePresent` | Path to a nonempty simulated file |
| config | `line` | Exact active trimmed line |
| config | `oneOfLines` | Array of accepted active lines |
| config | `lineCount` | Expected active line count |
| config | `normalizedLine` | Expected active line with whitespace collapsed |

Blank lines and comments are ignored by template checks. These check the syntax taught in the lesson; they do not parse arbitrary shell or prove semantic equivalence. Extending the simulation's filesystem/commands or adding a new check type still requires implementation work.

## Real Bash cases

A config mission can declare `runtime: "bash"` and 1–12 `cases`. Each case provides `label`, string-array `args`, `stdin`, exact `stdout` and expected `exit` (0–255). The harness runs each in a fresh temporary directory containing `sentinel.txt` so wildcard expansion mistakes are observable. Output includes stderr for clear failures. No network, persistent files or fixture uploads are supported.

Case definitions are trusted repository content. Author preview never runs imported scripts. The browser sends only a known mission ID and bounded learner code to the gateway. Review content and scripts before publishing; checks are inspectable self-study evidence.

## Version and transfer rules

An editorial typo need not invalidate learning evidence. A changed objective, behavior contract or concept mapping should increment `version`. Previous passes remain in Portfolio, while Review requests current evidence. Give a genuinely new application of a concept a new ID with `transferOf` pointing to its source. Repeated submissions of one mission never count as transfer.
