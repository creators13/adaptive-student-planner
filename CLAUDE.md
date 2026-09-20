@AGENTS.md

# Claude-specific notes

- Use Claude Code primarily for planning, exploration, specs, architecture, handoffs, and learning.
- Claude Code may implement code when explicitly asked or when the change is small and clearly scoped.
- Use plan mode for uncertain or multi-file changes.
- Use subagents for broad investigation or independent review when useful.
- Before stopping in the middle of unfinished work, switching tools, compacting context, or ending a long session, update `plan/active.md` so Codex or another tool can continue without needing the Claude chat history.
