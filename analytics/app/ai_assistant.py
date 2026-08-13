"""
LangChain + Ollama integration for the OpenEx AI trading assistant.

Week 3, Day 12: chat only.
Week 3, Day 13: adds a wallet-balance tool so the assistant can look up the
user's simulated balances from the Kotlin backend before answering.
"""

from __future__ import annotations

import os

import requests
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_core.tools import tool
from langchain_ollama import ChatOllama

OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.2")
KOTLIN_API_BASE_URL = os.environ.get("KOTLIN_API_BASE_URL", "http://localhost:8080")

SYSTEM_PROMPT = """You are the OpenEx trading assistant, a helpful financial \
persona embedded in a simulated crypto exchange terminal. You help users \
understand their simulated wallet balances, orders, and basic trading \
concepts (limit vs market orders, bids vs asks, price-time priority).

You have access to a get_wallet_balances tool. Use it whenever the user \
asks about their balance, holdings, or how much of a currency they have -- \
never guess or make up a number.

Ground rules:
- All funds and trades on this platform are simulated -- never real money.
- Keep answers concise and terminal-appropriate (a few sentences, not essays).
- If you don't have the information needed to answer (e.g. a live balance \
you weren't given), say so plainly rather than guessing.
- You are not a licensed financial advisor; for anything resembling real \
investment advice, remind the user this is a simulated learning environment.
"""

_llm = ChatOllama(
    model=OLLAMA_MODEL,
    base_url=OLLAMA_BASE_URL,
    temperature=0.3,
)


def _make_wallet_tool(bearer_token: str | None):
    """Build a get_wallet_balances tool bound to this request's JWT.

    A fresh tool is built per chat() call (rather than a single module-level
    tool) because the Kotlin backend is JWT-scoped per user -- there is no
    shared/global wallet to look up, only "whoever this token belongs to".
    """

    @tool
    def get_wallet_balances() -> str:
        """Look up the current user's simulated wallet balances (all
        currencies) from the OpenEx exchange backend. Use this whenever the
        user asks about their balance, holdings, or how much of a currency
        they have."""
        if not bearer_token:
            return "No auth token was provided for this chat session, so I can't look up wallet balances."

        try:
            resp = requests.get(
                f"{KOTLIN_API_BASE_URL}/api/wallets",
                headers={"Authorization": f"Bearer {bearer_token}"},
                timeout=5,
            )
            resp.raise_for_status()
        except requests.RequestException as exc:
            return f"Could not reach the wallet service: {exc}"

        balances = resp.json()
        if not balances:
            return "The user has no wallet balances yet (no deposits made)."

        lines = [f"{b['currency']}: {b['balance']}" for b in balances]
        return "\n".join(lines)

    return get_wallet_balances


def chat(
    user_message: str,
    history: list[dict[str, str]] | None = None,
    bearer_token: str | None = None,
) -> str:
    """Send a message (with optional prior turns) to the local Ollama model
    and return the assistant's reply as plain text.

    `history` is a list of {"role": "user"|"assistant", "content": "..."}
    dicts representing prior turns in the conversation, oldest first.

    `bearer_token` is the caller's JWT (if any), forwarded so the
    get_wallet_balances tool can call the Kotlin backend as that user.
    """
    wallet_tool = _make_wallet_tool(bearer_token)
    llm_with_tools = _llm.bind_tools([wallet_tool])

    messages: list[SystemMessage | HumanMessage | AIMessage | ToolMessage] = [
        SystemMessage(content=SYSTEM_PROMPT)
    ]

    for turn in history or []:
        role = turn.get("role")
        content = turn.get("content", "")
        if role == "user":
            messages.append(HumanMessage(content=content))
        elif role == "assistant":
            messages.append(AIMessage(content=content))

    messages.append(HumanMessage(content=user_message))

    response = llm_with_tools.invoke(messages)

    # Tool-calling loop: the model may ask for the wallet tool one or more
    # times before giving a final text answer. Capped so a misbehaving model
    # can't loop forever.
    max_tool_iterations = 3
    for _ in range(max_tool_iterations):
        if not response.tool_calls:
            break

        messages.append(response)

        for tool_call in response.tool_calls:
            if tool_call["name"] == wallet_tool.name:
                result = wallet_tool.invoke(tool_call["args"])
            else:
                result = f"Unknown tool: {tool_call['name']}"

            messages.append(ToolMessage(content=str(result), tool_call_id=tool_call["id"]))

        response = llm_with_tools.invoke(messages)

    return response.content