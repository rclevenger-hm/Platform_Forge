# Managed execution protocol v1

The optional Docker runner now exposes asynchronous jobs. This is the first runtime milestone toward real incident labs. Runs still execute authored Python/Bash checks in short-lived containers; they are not persistent Linux VMs.

## Learning flow

Connect a compatible backend in Settings, select Docker Python or Docker Bash in Practice, and submit. The workspace reports starting/running/cancelling/finished state and offers **Cancel run**. Completed records show image identity, cleanup status and lifecycle events. History and Portfolio retain the most recent 100 observed terminal records; they are included in account sync and JSON export.

A cancellation, timeout, output limit or infrastructure failure does not create a scored practice attempt. Successful/failed authored checks still combine with the explanation question. Code and quiz controls are locked during a run to prevent attributing results to an edited draft. Leaving the mission requests cancellation on a best-effort basis; the runner enforces its own deadline regardless of the browser.

Older gateways without `runnerJobs` keep the synchronous execution path. Every standalone feature remains available during an outage.

## Endpoints

All gateway endpoints use the existing operator authentication or an individual account session. The gateway binds each managed run to its creator; another account cannot poll, cancel or reuse its ID. The internal runner uses a separate bearer token.

| Gateway | Internal runner | Behavior |
|---|---|---|
| POST `/api/jobs` | POST `/jobs` | Submit `{jobId, missionId, code}`; returns 202 with record |
| GET `/api/jobs/ID` | GET `/jobs/ID` | Poll a bounded record |
| POST `/api/jobs/ID/cancel` | POST `/jobs/ID/cancel` | Request cancellation with `{}`; idempotent |
| POST `/api/run` | POST `/run` | Compatible blocking adapter through the same manager |

Client-generated IDs are 32 lowercase hex characters. Repeating an ID with the same content returns the original record; changed content gets 409. Unknown/expired IDs return 404. A full runner or record store returns 429; there is no unbounded queue.

Records contain mission/content version, timestamps, state, output, passed flag, cleanup status, image reference/content ID/available repository digests, and up to 20 lifecycle events. They never contain learner source or credentials. The source exists only while execution is active; stdout/stderr is bounded to approximately 16 KB. The runner logs metadata events only.

## Limits and cleanup

- Two active jobs, 100 retained records, and a 15-minute record TTL after completion.
- A 10-second execution deadline, plus bounded image inspection and cleanup calls.
- No network, host mounts or added capabilities; non-root learner, read-only root, resource limits and a small tmpfs.
- Each image is inspected and the container launches by the immutable local `sha256` image ID. Repository digests are recorded when available; a locally built image may have none. Images are never pulled by a job.
- Containers carry version, owner and absolute 30-second expiry labels. `LAB_RUNNER_ID` is a stable namespace; use distinct IDs for different runners on one daemon.
- Normal completion and cancellation explicitly remove the container. Killing the Docker CLI alone is not treated as cleanup.
- The maintenance loop retries pending removals and scans expired containers every five seconds plus the time needed for Docker calls. It checks owner/version/name before removal. A restarted runner can reap labelled orphans without the old in-memory records.

A stopped runner or unreachable daemon cannot enforce cleanup until service is restored. TTL labels are recovery metadata, not a Docker-native watchdog. Run records are in memory and disappear on runner restart; audit stdout retention belongs to the deployment. Full host/VM crash guarantees, durable orchestration, snapshots and independent watchdogs remain future work.

Cancellation accepted before finalization wins over a late success. Cancellation after an already terminal result returns that result unchanged. Cleanup failures stay visibly pending and are retried; the UI does not invent a successful removal.

Reference: [Docker run controls and image addressing](https://docs.docker.com/engine/containers/run/).
