# Guided practice

## A daily plan with evidence

Choose 15, 30 or 60 minutes on Home. The plan prioritizes due concepts, then a useful next mission whose prerequisites have been practiced. It stays stable while you work. Changing the budget creates a fresh plan; a new local calendar day or changed lesson contract refreshes it automatically.

A passed current-version attempt completes a mission step. A newly saved handoff completes a writing step. For a short session with no full mission fitting the budget, an observation step asks you to record one fact from the briefing. A saved design experiment completes the design step. All evidence must be recorded after plan creation; old completions do not silently fill today's plan. Time estimates are suggestions, not deadlines or readiness scores.

## An incident workspace

Each mission includes four stages:

| Stage | Recorded evidence |
|---|---|
| Observe | An observation and a testable hypothesis |
| Repair | A description of the change |
| Verify | The latest submitted practice checks passed |
| Explain | Verification reasoning plus a handoff note |

Stages navigate to useful parts of the page. They are not mandatory gates: you can inspect, repair, test and revise your hypothesis in any order. Text evidence is self-reported; writing a verification note cannot turn a failing check into a pass.

Workspace tabs separate the editor/teaching terminal, file inspection, check contracts and attempt history. File inspection operates on the bounded browser simulation; it does not inspect your computer. Simulation files and command transcripts reset on a new session; code drafts, notes, attempts and incident reasoning persist. A URL such as `#Practice%2FM12` restores the selected mission after reload.

Portfolio exports a JSON backup for restoration and a Markdown incident journal for sharing. Review Markdown before publishing it: it contains the text you wrote. Editing a notebook for a new lesson version adopts that version; exported earlier backups retain the prior text.

## An editable architecture

Design Lab supports one node of each role: clients, load balancer, API service, cache, database, queue and worker. Replica controls model the number of API/worker instances inside those roles. Add/remove components and connect supported paths. Drag nodes or focus them and use arrow keys; Shift moves farther. Positions affect layout only. Removing a node also removes its connections.

An API needs a client path and a database path. The cache contributes its configured hit rate only when the API → cache → database connections exist. Disconnected resources still incur their illustrative provisioned cost. Database unavailability makes the foreground path fail in this model, even if some real systems could serve cached data independently.

**Pin baseline** snapshots the graph and controls. Change one assumption and inspect the difference in latency, rejections, backlog and cost. **Run scenario suite** compares current conditions, doubled traffic (capped at 10,000 req/s), one lost API replica, a cold cache and stopped workers. Changing the experiment clears the previous suite results so they cannot appear current by mistake.

## What the queue model means

Background job arrival is a separate input; the model does not derive jobs from foreground requests. An active connected API can enqueue jobs. Connected workers can drain existing jobs even if the enqueue path breaks. Each worker offers 300 jobs/s and each job uses one database operation. Foreground reads get database capacity first.

For constant rates over the scenario duration:

- Available work is starting backlog plus successfully enqueued arrivals.
- Processing is limited by workers, spare database capacity and available work.
- Excess work fills the finite buffer; work beyond it is rejected.
- Initial backlog plus all arrivals equals processed jobs plus final backlog plus rejected jobs.

“Drain time” assumes new arrivals stop. A missing or failed worker can leave a queue unable to drain. This fluid approximation does not model within-interval bursts, retry storms, acknowledgements, replication, cache warmup or real latency distributions. The foreground latency equation is also illustrative. Use the results to form hypotheses to validate with measurements, not to size production systems.

Drafts persist locally. Save a named experiment with rationale to Portfolio; **Reopen design** restores its graph, controls and baseline. No model endpoint is needed for any of these features.
