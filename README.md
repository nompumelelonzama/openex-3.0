# OpenEx 3.0

A simulated crypto exchange and AI trading terminal. Kotlin/Spring Boot backend, React frontend, Flask analytics/AI microservice, and a local LLM via Ollama.

## Stack

| Service | Tech | Port | Role |
|---|---|---|---|
| `db` | PostgreSQL 16 | 5432 | Accounts, ledger, orders, trades |
| `redis` | Redis 7 | 6379 | Idempotency-key cache |
| `api` | Kotlin, Spring Boot | 8080 | Auth, wallets, matching engine, WebSocket feed |
| `analytics` | Python, Flask | 5000 | Market data simulator, AI assistant (LangChain) |
| `frontend` | React, Vite, Chart.js | 5173 | Trading terminal UI |
| Ollama | `llama3.2`, native on host | 11434 | LLM backing the AI assistant |

**Why Ollama isn't containerized:** it's the one deliberate exception to "everything runs via Docker." Local LLM inference wants direct host access, and re-pulling multi-GB model weights inside a container risked disk space and repeat network issues already seen with smaller downloads on this machine. The `analytics` container reaches host-native Ollama automatically via Docker's `host.docker.internal`.

## Prerequisites

- Docker Desktop (Compose v2)
- [Ollama](https://ollama.com) installed natively -- `ollama pull llama3.2`, then keep it running
- Java 21 + the bundled Gradle wrapper (to build the API JAR before first run)

## Run everything

The API's Docker image copies a pre-built JAR rather than compiling inside the container (avoids depending on Maven Central during image build). Build it once, and again after backend changes:

```bash
cd openex && ./gradlew bootJar && cd ..
```

Then, from the repo root:

```bash
docker compose up -d --build
```

Healthchecks gate startup order (`db`/`redis` -> `api` -> `analytics` -> `frontend`). Check status:

```bash
docker compose ps   # all should show healthy/running
```

- App: http://localhost:5173
- API: http://localhost:8080
- Analytics/AI: http://localhost:5000

Stop: `docker compose down`

## Using it

Register -> deposit simulated funds -> place orders on **Trading** (order book updates live via WebSocket) -> watch the price chart on **Dashboard** -> ask the chat assistant (bottom-right) about your balance -- it calls a real tool against your actual wallet, it doesn't guess.

## Local dev (no Docker, for faster iteration)

```bash
docker compose up -d db redis                          # infra only

cd openex && ./gradlew bootRun                          # terminal 2

cd analytics/app && pip install -r ../requirements.txt  # terminal 3
python main.py

cd frontend && npm install && npm run dev               # terminal 4
```

Ollama should already be running natively.

## Testing & linting

```bash
cd openex
docker compose up -d db redis
./gradlew test
./gradlew ktlintCheck
```

## Structure
```
openex/       Kotlin backend -- ledger, matching engine, auth, WebSockets
analytics/    Flask -- market simulator, LangChain/Ollama assistant
frontend/     React trading terminal
docker-compose.yml
```

## Key design notes

- **Double-entry ledger** -- every trade posts balancing CREDIT/DEBIT entries in one transaction; balances are always the sum of ledger rows, never a mutable column.
- **Idempotency** -- POST /api/orders requires an Idempotency-Key. Same key + same body replays the cached response; same key + different body returns 409. Postgres is the source of truth, Redis is a fast-path cache in front of it.
- **Matching engine** -- in-memory, price-time priority, one order book + lock per symbol, so different symbols match fully in parallel.
