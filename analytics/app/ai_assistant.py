"""
LangChain + Ollama integration for the OpenEx AI trading assistant.

Week 3, Day 12: a plain chat endpoint with a financial-assistant persona.
Week 3, Day 13: adds a "get_wallet_balances" tool so the assistant can query
the user's *real* simulated balances from the Kotlin API and answer with
actual numbers instead of guessing.
"""

from __future__ import annotations

import os

import requests
from langchain.agents import create_agent
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.tools import tool
from langchain_ollama import ChatOllama

OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.2")
KOTLIN_API_BASE_URL = os.environ.get("KOTLIN_API_BASE_URL", "http://localhost:8080")

SYSTEM_PROMPT = """You are the OpenEx trading assistant, a helpful financial \
persona embedded in a simulated crypto exchange terminal. You help users \
understand their simulated wallet balances, orders, and basic trading \
concepts (limit vs market orders, bids vs asks, price-time priority).

Ground rules:
- All funds and trades on this platform are simulated -- never real money.
- Keep answers concise and terminal-appropriate (a few sentences, not essays).
- If the user asks about their balance, wallet, or funds, use the
  get_wallet_balances tool to fetch their real current balances rather than
  guessing or saying you don't have access -- you do, via the tool.
- If a tool call fails, say so plainly rather than making up numbers.
- You are not a licensed financial advisor; for anything resembling real \
investment advice, remind the user this is a simulated learning environment.
"""

_llm = ChatOllama(
    model=OLLAMA_MODEL,
    base_url=OLLAMA_BASE_URL,
    temperature=0.3,
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


def chat(
    user_message: str,
    jwt_token: str,
    history: list[dict[str, str]] | None = None,
) -> str:
    """Send a message (with optional prior turns) to the local Ollama model,
    giving it access to a wallet-balance tool scoped to this specific user,
    and return the assistant's final reply as plain text.

    `history` is a list of {"role": "user"|"assistant", "content": "..."}
    dicts representing prior turns in the conversation, oldest first.
    """
    wallet_tool = _make_wallet_tool(jwt_token)
    agent = create_agent(_llm, tools=[wallet_tool], system_prompt=SYSTEM_PROMPT)

    messages: list[SystemMessage | HumanMessage | AIMessage] = []
    for turn in history or []:
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