# Platform Forge

A local-first platform engineering learning environment. Learn by investigating failures, writing code, checking results and explaining tradeoffs.

**v0.2: Practice that travels** — twenty original missions, a browser Python runtime, a design experiment, interview practice and a portable engineering notebook. No account or LLM required.

## What works today

| Capability | Standalone / Pages | Docker core | Optional service |
|---|---|---|---|
| Lessons, authored hints, worked examples | Yes | Yes | None |
| Linux terminal and shell/cron teaching models | Yes | Yes | None |
| Real Python execution | Browser worker | Browser worker | Docker runner also available |
| Concept review, versioned progress, notes and JSON import/export | Browser storage | Browser storage | None |
| Capacity/failure experiment and saved rationale | Yes | Yes | None |
| Interview prompts, timer and self-review | Yes | Yes | None |
| Contextual AI mentor | Via your own gateway | Via gateway | Reachable compatible local/remote model |
| Isolated Docker Python and Bash | Via your own gateway | Opt-in labs profile | Dedicated lab Docker daemon |

Linux/cron teaching models and standalone shell template checks are labeled simulations. Eleven Python missions execute real code in the browser; three shell missions also have optional real Bash behavior checks in isolated Docker containers. Advanced Kubernetes, cloud, networking and production-style incident labs are on the [development roadmap](docs/ROADMAP.md); this release does not claim to teach the entire profession yet.

## Run the standalone app

Requires Node.js 24+ and npm.

```sh
git clone https://github.com/rclevenger-hm/Platform_Forge.git
cd Platform_Forge
npm ci
npm run prepare:python
npm run dev
```

Open **http://127.0.0.1:5173**. The Python runtime is bundled locally; the first execution loads it into a disposable worker. No API key is needed. Progress belongs to the current browser and origin; export it from Portfolio before clearing site storage or moving between deployments.

For a production static build:

```sh
npm run build
npm run preview
```

## Run with Docker

Requires Docker Engine/Desktop and the Compose plugin.

```sh
docker compose up --build -d
```

Open **http://localhost:8080**. Core learning works with no configuration. Optional backend requests require a token when arriving through the Docker frontend; the default empty token intentionally leaves those features disconnected.

### Connect a local or remote LLM

1. Copy `.env.example` to `.env`.
2. Set `API_TOKEN` to a random value. Generate one with `python3 -c 'import secrets; print(secrets.token_urlsafe(32))'`.
3. Set `LLM_BASE_URL` to a compatible API base, including `/v1`, and `LLM_MODEL` to an available model ID. Set `LLM_API_KEY` only if the provider needs one.
4. Recreate the service with `docker compose up --build -d`.
5. In **Settings**, leave the backend URL blank, enter your `API_TOKEN`, and select **Check connection**.

For Ollama on the Docker host, a typical base is `http://host.docker.internal:11434/v1`. Pull your chosen model in Ollama first and ensure its server is reachable from the container. For a hosted provider, use its HTTPS OpenAI-compatible base and credentials. Exact parameter compatibility varies; this gateway uses `GET /models` and `POST /chat/completions` with `max_tokens`.

The mentor turns on only after the configured model appears in a successful models response. It offers contextual hints; deterministic checks still decide exercise completion. Model failures never remove authored hints or browser Python. Provider keys remain on the server. Tutoring sends the current lesson, question, code and output to the configured endpoint.

For development without Docker, `python3 server/app.py` starts a loopback-only gateway on port 8787. Export the desired model variables into that process environment; Vite proxies `/api` during development. The server does not automatically read `.env` outside Compose.

### Add Docker Python and Bash labs

Use a **dedicated lab daemon or VM**, preferably rootless. The runner mounts a Docker socket, which grants control of that daemon; it must not share valuable workloads or secrets. The API itself never mounts the socket.

In `.env`, set a separate random `RUNNER_TOKEN`, set `RUNNER_URL=http://runner:8788`, and set `LAB_DOCKER_SOCKET` if using a nondefault/rootless socket. Keep `API_TOKEN` configured.

```sh
docker pull python:3.13-alpine
docker build --target bash-lab -t platform-forge-bash:0.2 .
docker compose --profile labs up --build -d
```

Prepare both images on the daemon the runner uses. Check the connection again in Settings, then select **Docker Python** inside a Python mission or **Docker Bash** in M05, M06 or M20. Languages become available only when their images are installed. Lab containers are non-root, network-disabled, read-only and resource-limited. Full Linux/systemd/cron VM labs are a later milestone.

## GitHub Pages

The `Publish standalone edition` workflow builds the complete non-LLM frontend with the repository subpath and bundled Python assets. It uploads a Pages artifact on each main-branch push. No secrets are included in that build.

Initial repository setup: open **Settings → Pages → Build and deployment → Source → GitHub Actions**. Then run **Actions → Publish standalone edition → Run workflow** (or push a commit). The expected address is `https://rclevenger-hm.github.io/Platform_Forge/`; it becomes live after a successful deployment. The workflow reports and skips deployment if Pages is not yet enabled; building an artifact alone does not make a live site.

To connect that static edition to your own gateway, expose the gateway over HTTPS, configure an access token, and add `https://rclevenger-hm.github.io` to `ALLOWED_ORIGINS`. Enter the gateway URL and token in Settings. An HTTPS page may be unable to call a private or HTTP endpoint because of browser network policies; the local Docker frontend is the straightforward local-model setup.

## Development and validation

```sh
npm test
npm run test:server
npx playwright install --with-deps chromium
npm run test:e2e
```

See [validation details](docs/TESTING.md), [architecture and trust boundaries](docs/ARCHITECTURE.md), and the [release roadmap](docs/ROADMAP.md). GitHub Actions additionally builds Compose and exercises the real Docker runner on a disposable CI host.

Mission content lives in `src/data/missions.json`. Each mission includes a briefing, objective, three hints, explanation question, practice checks and a worked solution. These checks support self-study, not certification or anti-cheat enforcement. AI feedback is advisory, and the design simulator explicitly uses illustrative equations rather than measured production benchmarks.

## Author and review lessons

Open **Author** to copy a mission, edit its JSON, validate references and preview the lesson. Export the validated file for repository review. New missions need no UI/grader changes when they use the supported check types. See the [authoring contract](docs/AUTHORING.md).

Open **Review** for concept-based scheduling and transfer exercises. Existing v1 progress migrates automatically; prior content versions stay in Portfolio. Reviews use a transparent practice heuristic, not a mastery score.

See [concepts versus implementation](docs/VISUAL_REVIEW.md) for the original design images, actual release captures and remaining visual goals.

## Publication history

The initial implementation was authored in October 2026. Its initial commits use a deliberately backdated publication schedule, requested by the repository owner, across selected dates in the supplied October 2025–October 2026 contribution graph. Twenty-six substantive implementation commits are distributed as two commits on each selected date. Those timestamps do not claim the software existed on those dates. Publication, CI fixes and deployment configuration may have their actual publication timestamps.

## License

Original application code and original curriculum are MIT licensed. Third-party dependencies retain their own licenses. No proprietary course book or external paid question bank is included.
