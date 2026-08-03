# OpenEx 3.0 — Backend (Week 1, Days 1–5)

Simulated crypto exchange backend: Kotlin + Spring Boot, Postgres (double-entry ledger),
Redis (idempotency cache), JWT auth, in-memory price-time-priority matching engine.

This covers **Week 1 only** (core engine + DB integrity). Frontend (Week 2) and the
Python/Ollama AI service (Week 3) are not part of this drop.

## Stack
- Kotlin 1.9 / Spring Boot 3.3 (Gradle Kotlin DSL)
- PostgreSQL 16 + Flyway migrations
- Redis 7 (idempotency key cache)
- Spring Security + JWT (stateless)
- JUnit 5 + Testcontainers-style integration tests (using the compose Postgres/Redis)

## Running it

```bash
docker compose up -d db redis        # start infra only
./gradlew bootRun                    # run the API on :8080
```

or the whole thing (once you add Dockerfile for the app in a later day):

```bash
docker compose up
```

Postgres and Redis both have `healthcheck` blocks; nothing else depends on them until
they report healthy.

## Day-by-day map

| Day | What's in the code |
|---|---|
| 1 | Gradle project, `docker-compose.yml` (Postgres+Redis w/ healthchecks), GitHub Actions CI running `./gradlew test` |
| 2 | Flyway `V1__init_schema.sql`, JPA entities, `LedgerService` — every trade is one balanced CREDIT+DEBIT pair inside `@Transactional`, `LedgerServiceTest` proves entries sum to zero and roll back on failure |
| 3 | Spring Security stateless JWT (`JwtService`, `JwtAuthFilter`, `SecurityConfig`), `AuthController` (register/login), `WalletController` deposit "faucet" endpoint |
| 4 | `OrderController` `POST /api/orders` backed by `IdempotencyService` — caches response by `Idempotency-Key` header in Postgres (with a Redis-first fast path) so retried requests never double-submit |
| 5 | `MatchingEngineService` — in-memory price-time-priority order book per symbol, supports partial fills, wired to `LedgerService` so every match settles as ledger entries; `MatchingEngineServiceTest` runs 10 concurrent orders and checks book + ledger integrity |
| 6 | `WebSocketConfig` (STOMP over `/ws` with SockJS fallback), `OrderBookBroadcastService` pushes a full snapshot to `/topic/orderbook/{symbol}` and a `TradeEvent` to `/topic/trades/{symbol}` on every match/cancel; `GET /api/orderbook/{symbol}` gives a one-shot snapshot for initial page load |

## Key design notes

- **Ledger is the source of truth for balances.** There is no `balance` column anywhere.
  `GET /api/wallets` computes balances by summing `ledger_entries` for the account
  (CREDIT positive, DEBIT negative). This is intentional per the brief — never do
  `balance = balance - x`.
- **Idempotency**: `idempotency_keys(key, request_hash, response_body, status_code)`.
  On a repeat key we compare the request hash; same hash → replay cached response;
  different hash → 409 Conflict (protects against key reuse with a different payload).
- **Matching engine** is in-memory (`ConcurrentSkipListMap` per side) for speed, but every
  fill is persisted transactionally (order rows + ledger rows) before the engine returns,
  so a crash never leaves the book and the DB disagreeing.
