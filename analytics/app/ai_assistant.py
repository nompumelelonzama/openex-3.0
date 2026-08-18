"""
LangChain + Groq integration for the OpenEx AI trading assistant.

Week 3, Day 12: a plain chat endpoint with a financial-assistant persona.
Week 3, Day 13: adds a "get_wallet_balances" tool so the assistant can query
the user's *real* simulated balances from the Kotlin API and answer with
actual numbers instead of guessing.
Later: adds a "get_recent_trades" tool (same pattern) and a few speed/latency
fixes -- capping response length and trimming how much prior conversation
gets resent on every turn.
Later still: swapped from a locally-hosted Ollama model to Groq's hosted
API, so the assistant works in deployed/cloud environments without needing
a local Ollama instance running alongside the app.
"""

from __future__ import annotations

import os

import requests
from langchain.agents import create_agent
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.tools import tool
from langchain_groq import ChatGroq

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
GROQ_MODEL = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")
KOTLIN_API_BASE_URL = os.environ.get("KOTLIN_API_BASE_URL", "http://localhost:8080")

# Only the last N turns are resent to the model each request. Keeps prompt
# size (and therefore latency) roughly constant instead of growing with
# every message in a long conversation.
MAX_HISTORY_TURNS = 6

SYSTEM_PROMPT = """You are the OpenEx trading assistant: a concise, accurate \
financial persona embedded in a simulated crypto exchange terminal.

Ground rules:
- All funds and trades on this platform are simulated -- never real money.
- Answer in 1-3 short sentences. This is a terminal, not a chat essay.
- If asked about balance, wallet, or funds: call get_wallet_balances and use
  the real numbers it returns. Never guess a balance.
- If asked about trades, trade history, or recent activity: call
  get_recent_trades and use the real data it returns. Never invent a trade.
- If a tool call fails, say so plainly rather than making up numbers.
- You are not a licensed financial advisor; for anything resembling real \
investment advice, remind the user this is a simulated learning environment.
"""

_llm = ChatGroq(
    model=GROQ_MODEL,
    api_key=GROQ_API_KEY,
    temperature=0.3,
    # Groq is a hosted API, so there's no local model process to keep warm
    # (no keep_alive concept). max_tokens replaces num_predict as the
    # response-length cap, working with the "1-3 short sentences" system
    # prompt instruction to bound worst-case latency.
    max_tokens=200,
)


def _make_wallet_tool(jwt_token: str):
    """Builds a get_wallet_balances tool bound to one specific user's JWT.

    Built fresh per request (rather than as one shared/global tool) so a
    request from user A can never accidentally use user B's credentials --
    the token is captured in this closure, not passed around as an LLM
    argument the model could hallucinate or mix up.
    """

    @tool
    def get_wallet_balances() -> str:
        """Fetch the current user's real simulated wallet balances (all
        currencies) from the OpenEx exchange. Use this whenever the user
        asks about their balance, funds, or wallet."""
        try:
            response = requests.get(
                f"{KOTLIN_API_BASE_URL}/api/wallets",
                headers={"Authorization": f"Bearer {jwt_token}"},
                timeout=5,
            )
            response.raise_for_status()
        except requests.RequestException as exc:
            return f"Could not reach the wallet service: {exc}"

        balances = response.json()
        if not balances:
            return "The user has no wallet balances yet (nothing deposited)."

        lines = [f"{b['currency']}: {b['balance']}" for b in balances]
        return "Current balances -- " + ", ".join(lines)

    return get_wallet_balances


def _make_trade_history_tool(jwt_token: str):
    """Builds a get_recent_trades tool bound to one specific user's JWT,
    same pattern and same reasoning as the wallet tool above."""

    @tool
    def get_recent_trades() -> str:
        """Fetch the current user's real recent trade history (both sides,
        newest first) from the OpenEx exchange. Use this whenever the user
        asks about trades, trade history, or recent activity."""
        try:
            response = requests.get(
                f"{KOTLIN_API_BASE_URL}/api/trades",
                headers={"Authorization": f"Bearer {jwt_token}"},
                timeout=5,
            )
            response.raise_for_status()
        except requests.RequestException as exc:
            return f"Could not reach the trade history service: {exc}"

        trades = response.json()
        if not trades:
            return "The user has no trades yet."

        # Cap to the 5 most recent so the tool result itself stays small --
        # a smaller tool-result also means less for the model to process
        # before it can compose its final answer.
        lines = [
            f"{t['side']} {t['quantity']} {t['symbol']} @ {t['price']} ({t['createdAt']})"
            for t in trades[:5]
        ]
        return "Recent trades -- " + "; ".join(lines)

    return get_recent_trades


def chat(
    user_message: str,
    jwt_token: str,
    history: list[dict[str, str]] | None = None,
) -> str:
    """Send a message (with optional prior turns) to the Groq-hosted model,
    giving it access to wallet-balance and trade-history tools scoped to
    this specific user, and return the assistant's final reply as plain text.

    `history` is a list of {"role": "user"|"assistant", "content": "..."}
    dicts representing prior turns in the conversation, oldest first. Only
    the most recent MAX_HISTORY_TURNS are actually sent to the model.
    """
    wallet_tool = _make_wallet_tool(jwt_token)
    trade_tool = _make_trade_history_tool(jwt_token)
    agent = create_agent(_llm, tools=[wallet_tool, trade_tool], system_prompt=SYSTEM_PROMPT)

    trimmed_history = (history or [])[-MAX_HISTORY_TURNS:]

    messages: list[SystemMessage | HumanMessage | AIMessage] = []
    for turn in trimmed_history:
        role = turn.get("role")
        content = turn.get("content", "")
        if role == "user":
            messages.append(HumanMessage(content=content))
        elif role == "assistant":
            messages.append(AIMessage(content=content))
    messages.append(HumanMessage(content=user_message))

    result = agent.invoke({"messages": messages})
    final_message = result["messages"][-1]
    return final_message.content
