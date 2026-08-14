"""
OpenEx analytics microservice (Week 3, Days 11-13).

Exposes simulated market data as clean JSON arrays so the React frontend
can chart price + moving averages without needing a real exchange feed.
Also exposes an AI trading assistant chat endpoint backed by a local
Ollama model via LangChain, with a tool that queries the user's real
wallet balances from the Kotlin API.
"""

from __future__ import annotations

import os

from flask import Flask, jsonify, request
from flask_cors import CORS

from market_simulator import MarketSimulator
import ai_assistant

app = Flask(__name__)

# Mirrors the CORS setup on the Kotlin backend: only the Vite dev server
# is allowed to call this from the browser. Override via env var for other
# environments (e.g. a deployed frontend origin).
ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN", "http://localhost:5173")
CORS(app, resources={r"/api/*": {"origins": ALLOWED_ORIGIN}})

simulator = MarketSimulator(symbols={"BTC-USD": 50_000.0, "ETH-USD": 3_000.0})
simulator.start()


@app.get("/actuator/health")
def health() -> tuple[dict, int]:
    return {"status": "UP"}, 200


@app.get("/api/market/symbols")
def symbols() -> tuple[dict, int]:
    return {"symbols": simulator.symbols()}, 200


@app.get("/api/market/ticks")
def ticks() -> tuple[dict, int]:
    symbol = request.args.get("symbol", "BTC-USD")
    limit = request.args.get("limit", type=int)

    df = simulator.ticks_for(symbol)
    if df is None:
        return {"error": f"Unknown symbol '{symbol}'. Available: {simulator.symbols()}"}, 404

    if limit is not None and limit > 0:
        df = df.tail(limit)

    df = df.copy()
    df["timestamp"] = df["timestamp"].dt.strftime("%Y-%m-%dT%H:%M:%S.%fZ")
    payload = df.round({"price": 2, "ma_short": 2, "ma_long": 2}).to_dict(orient="records")

    return {"symbol": symbol, "count": len(payload), "ticks": payload}, 200


@app.post("/api/chat")
def chat() -> tuple[dict, int]:
    body = request.get_json(silent=True) or {}
    message = body.get("message", "").strip()
    history = body.get("history", [])

    if not message:
        return {"error": "Field 'message' is required and cannot be empty."}, 400

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return {"error": "Missing or malformed Authorization header (expected 'Bearer <jwt>')."}, 401
    jwt_token = auth_header.removeprefix("Bearer ")

    try:
        reply = ai_assistant.chat(message, jwt_token, history=history)
    except Exception as exc:  # Ollama down, model not pulled, connection refused, etc.
        return {
            "error": "Could not reach the local Ollama model. Is Ollama running "
                      f"and has the model been pulled? ({exc})"
        }, 502

    return {"reply": reply}, 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True, use_reloader=False)