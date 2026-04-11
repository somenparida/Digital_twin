"""Vercel ASGI entrypoint for the Digital Twin backend.

This adapter strips the leading /api prefix (used by frontend calls)
before forwarding requests to the FastAPI app defined in backend/main.py.
"""
from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

from backend.main import app as backend_app

Scope = dict[str, Any]
Receive = Callable[[], Awaitable[dict[str, Any]]]
Send = Callable[[dict[str, Any]], Awaitable[None]]


class StripApiPrefixASGI:
    """ASGI wrapper that maps /api/* requests to backend routes."""

    def __init__(self, app: Callable[[Scope, Receive, Send], Awaitable[None]]) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope.get("type") in {"http", "websocket"}:
            path = scope.get("path", "")
            if path.startswith("/api"):
                new_scope = dict(scope)
                stripped = path[4:] or "/"
                new_scope["path"] = stripped
                await self.app(new_scope, receive, send)
                return
        await self.app(scope, receive, send)


app = StripApiPrefixASGI(backend_app)
