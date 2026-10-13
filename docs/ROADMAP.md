# Platform Forge development roadmap

## Shipped foundation: v0.1

- Fifteen original missions across Linux, shell, cron, Python, algorithms, delivery gates and reliable processing.
- Browser terminal/configuration teaching models; seven Python exercises execute real Python in a disposable worker.
- Authored lessons, escalating hints, worked examples, concept checks and handoff notes.
- Persistent local progress, import/export, assisted versus independent practice records, and a review queue.
- Interactive capacity/failure experiment with visible equations and saved design rationale.
- Three interview prompts with a timer, notes and self-review criteria.
- Optional OpenAI-compatible mentor gateway with server-side credentials and explicit capability checks.
- Docker application, opt-in isolated Docker Python runner, and standalone Pages build workflow.

This foundation is a usable starting point, not the complete senior platform engineering curriculum. Completing it is not a promise of interview success or job readiness.

## Shipped in v0.2: learning evidence and authoring

- Twenty missions, including five transfer variants and eleven executable Python exercises.
- Validated data-driven lesson contracts, prerequisite references and a local Author workbench with import, preview and export.
- Automatic v1 progress migration, versioned attempt evidence and concept-based review scheduling.
- Distinct labels for independent repetition and applying an idea to a new variant.
- Real Bash behavior checks for pipeline failures and shell arguments through the optional isolated runner; standalone template checks remain available.
- Per-language runner capability reporting, browser integration tests and concept-versus-product visual captures.

### Remaining v0.2 quality work

1. Review accessibility with keyboard and screen-reader users, including reduced motion and contrast.
2. Expand model compatibility adapters and evaluate grounded hints, hallucinated commands and prompt injection.
3. Pilot the learning sequence with practitioners; calibrate review cadence and transfer difficulty.
4. Move the visual design closer to the original concept: a daily learning plan, richer lab workspace and editable architecture canvas. See [visual review](VISUAL_REVIEW.md).

The curriculum authoring and migration gates are implemented. Practitioner, accessibility and model evaluation gates remain open.

## Release 0.3: real Linux incident labs (3–5 engineer-weeks)

1. Introduce a runner protocol with job lifecycle, cancellation, TTL cleanup, image digests and audit events.
2. Build disposable Linux VM labs for systemd, cron, disk pressure, networking and permissions. Containers alone cannot reproduce every host incident.
3. Add reproducible seeds, reset/snapshot controls, external validators and protected learner workspaces.
4. Add a dedicated lab-host deployment. Evaluate gVisor or microVM isolation before any untrusted multiuser hosting.
5. Track observations, hypothesis, mitigation, verification and postmortem as separate learning artifacts.

Exit criteria: no lab can reach application secrets, peers or host mounts; timeout/crash cleanup is tested; reset produces the same starting fault; validation checks observable system behavior.

## Release 0.4: delivery and cloud platforms (4–6 engineer-weeks)

Add Git, code review, CI pipelines, artifacts, supply-chain controls, containers, Kubernetes, infrastructure as code, IAM, secrets, rollout/rollback, DNS, TCP, HTTP, TLS and observability. Build a project that evolves from a local Python service to a repeatable deployment.

Exit criteria: learner can build, test, deploy, observe and roll back their service; every exercise works without an LLM; optional cloud cost is explicit and bounded.

## Release 0.5: SRE, architecture and platform product work (4–6 engineer-weeks)

Add SLOs, error budgets, burn-rate alerts, toil reduction, capacity planning, distributed queues, idempotency, consistency, caching, backpressure and failure recovery. Expand design experiments with documented calibration and uncertainty. Add developer experience interviews, platform API design, golden paths, adoption research and migration planning.

Exit criteria: learner defends a design with assumptions and evidence, runs a game day, and produces a reviewable incident report and platform proposal.

## Release 1.0: capstone and interview readiness (3–5 engineer-weeks)

Ship a production-style capstone, incident rotation, coding variants, system design practice, behavioral evidence and portfolio export. Add accounts/sync only after data ownership, authentication, backup and migration requirements are settled. Human-reviewed rubrics remain the source of truth for open-ended work.

Estimates assume one experienced full-time engineer and exclude comprehensive content review. They are planning ranges, not delivery promises. Full curriculum quality requires practitioner review and pilot learners.

## Curriculum map

| Track | First useful outcomes | Current status |
|---|---|---|
| Linux | Paths, permissions, processes, disks | 4 simulated missions |
| Shell and scheduling | Quoting, pipelines, cron, locks | 5 configuration missions; 3 support Docker Bash |
| Python | Data processing, testing, errors, retries | 6 executable missions |
| Algorithms | Complexity, maps, heaps, queues | 2 executable missions |
| Delivery | Test gates, CI/CD, artifacts, rollback | 1 executable gate exercise |
| Networking | DNS, TCP, HTTP, TLS, packet reasoning | Planned |
| Containers | Images, limits, isolation, debugging | Planned curriculum; runner implemented |
| Infrastructure | IaC, IAM, cloud primitives, state | Planned |
| Kubernetes | Workloads, scheduling, networking, operations | Planned |
| Reliability | Idempotency, SLOs, alerts, incidents | 2 executable missions |
| Distributed systems | Replication, consistency, queues, backpressure | Planned |
| Platform product | APIs, golden paths, developer experience | Planned |
| System design | Capacity and failure tradeoffs | Interactive teaching model |
| Leadership | Communication, influence, operational judgment | Interview prompts |

Inspiration: exercise-led practice, [SadServers](https://sadservers.com/), [Google SRE Workbook](https://sre.google/workbook/table-of-contents/), and coding interview practice. All shipped prompts and lessons are original; external problem sets and book text are not bundled.
