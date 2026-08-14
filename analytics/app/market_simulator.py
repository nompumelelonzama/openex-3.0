"""
Simulated market data generator.

Produces a random-walk-with-drift price series per symbol, similar to how a
real crypto pair moves: mostly noise, with a small directional bias. Ticks
are generated once at process start (the "historical" series) and then a new
tick is appended on a fixed interval so `/api/market/ticks` always returns
fresh data without needing a real exchange feed.
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

import numpy as np
import pandas as pd

# Tunable parameters for the simulated random walk.
DRIFT_PER_TICK = 0.0002       # small upward bias per tick (~0.02%)
VOLATILITY_PER_TICK = 0.004   # standard deviation of each tick's % move
TICK_INTERVAL_SECONDS = 2     # how often a new live tick is appended
HISTORY_LENGTH = 200          # number of historical ticks to seed on startup
SHORT_WINDOW = 5              # short moving-average window (in ticks)
LONG_WINDOW = 20              # long moving-average window (in ticks)


@dataclass
class SymbolState:
    symbol: str
    starting_price: float
    rng: np.random.Generator
    ticks: pd.DataFrame = field(default_factory=lambda: pd.DataFrame(columns=["timestamp", "price"]))
    lock: threading.Lock = field(default_factory=threading.Lock)

    def seed_history(self, length: int, interval_seconds: int) -> None:
        now = datetime.now(timezone.utc)
        timestamps = [now - timedelta(seconds=interval_seconds * (length - i)) for i in range(length)]
        prices = self._generate_walk(self.starting_price, length)
        with self.lock:
            self.ticks = pd.DataFrame({"timestamp": timestamps, "price": prices})

    def append_tick(self) -> None:
        with self.lock:
            last_price = float(self.ticks["price"].iloc[-1]) if not self.ticks.empty else self.starting_price
        next_price = self._generate_walk(last_price, 1)[0]
        row = pd.DataFrame({"timestamp": [datetime.now(timezone.utc)], "price": [next_price]})
        with self.lock:
            self.ticks = pd.concat([self.ticks, row], ignore_index=True)
            # Keep an unbounded-but-reasonable buffer so memory doesn't grow forever.
            if len(self.ticks) > 5000:
                self.ticks = self.ticks.iloc[-5000:].reset_index(drop=True)

    def snapshot(self) -> pd.DataFrame:
        with self.lock:
            df = self.ticks.copy()
        df["ma_short"] = df["price"].rolling(window=SHORT_WINDOW, min_periods=1).mean()
        df["ma_long"] = df["price"].rolling(window=LONG_WINDOW, min_periods=1).mean()
        return df

    def _generate_walk(self, start_price: float, length: int) -> np.ndarray:
        pct_changes = self.rng.normal(loc=DRIFT_PER_TICK, scale=VOLATILITY_PER_TICK, size=length)
        prices = start_price * np.cumprod(1 + pct_changes)
        return np.maximum(prices, 0.01)  # guard against a negative/zero price


class MarketSimulator:
    """Owns simulated price series for a fixed set of symbols and keeps them
    updating in a background thread for the lifetime of the Flask process."""

    def __init__(self, symbols: dict[str, float], seed: int = 42) -> None:
        self._states: dict[str, SymbolState] = {
            symbol: SymbolState(symbol=symbol, starting_price=price, rng=np.random.default_rng(seed + i))
            for i, (symbol, price) in enumerate(symbols.items())
        }
        for state in self._states.values():
            state.seed_history(HISTORY_LENGTH, TICK_INTERVAL_SECONDS)
        self._stop_event = threading.Event()
        self._thread = threading.Thread(target=self._run_loop, daemon=True)

    def start(self) -> None:
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()

    def symbols(self) -> list[str]:
        return list(self._states.keys())

    def ticks_for(self, symbol: str) -> pd.DataFrame | None:
        state = self._states.get(symbol)
        return state.snapshot() if state else None

    def _run_loop(self) -> None:
        while not self._stop_event.is_set():
            for state in self._states.values():
                state.append_tick()
            time.sleep(TICK_INTERVAL_SECONDS)
