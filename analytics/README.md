# OpenEx Analytics Service (Week 3, Day 11)

A lightweight Flask microservice that simulates live crypto market data —
no real exchange feed involved. It generates a random-walk-with-drift price
series per symbol, updates it on a fixed interval in a background thread,
and exposes it as clean JSON for the React frontend to chart.

## Endpoints

| Method | Path                    | Description                                      |
|--------|-------------------------|---------------------------------------------------|
| GET    | `/actuator/health`      | Health check                                       |
| GET    | `/api/market/symbols`   | List available symbols                             |
| GET    | `/api/market/ticks`     | Ticks for a symbol, with `ma_short`/`ma_long` MAs   |

`GET /api/market/ticks` query params:
- `symbol` (default `BTC-USD`) — one of the symbols returned by `/api/market/symbols`
- `limit` (optional) — only return the most recent N ticks

Example:
```
GET /api/market/ticks?symbol=BTC-USD&limit=50
```

## Running locally

```bash
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cd app
python main.py
```

The service listens on **`http://localhost:5000`**.

## Configuration

- `ALLOWED_ORIGIN` (env var, default `http://localhost:5173`) — the frontend
  origin allowed to call this API from the browser via CORS.

## Notes

- Price data is generated in-memory only; nothing is persisted, and it
  resets every time the service restarts.
- Two symbols are seeded by default: `BTC-USD` (starting ~$50,000) and
  `ETH-USD` (starting ~$3,000). Add more in `main.py`'s `MarketSimulator(...)`
  call if needed.
- `ma_short` / `ma_long` are simple moving averages over the last 5 / 20
  ticks respectively — enough for a frontend chart to show trend crossovers.
