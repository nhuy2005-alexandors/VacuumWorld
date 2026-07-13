# CLAUDE.md — Vacuum World

Đồ án môn Nền tảng Trí tuệ Nhân tạo: phân tích không gian trạng thái Vacuum World, so sánh giải thuật tìm kiếm mù (BFS/DFS/IDS) vs có thông tin (A*).

## Stack
- JavaScript thuần (ES modules), không phụ thuộc thư viện. Solver chạy được cả Node lẫn trình duyệt.
- Test/run (dev): `node <file>.js` (Node v22). Build: không cần (JS thuần). Run web: mở file HTML (LÀM SAU).

## Subagent Orchestration (when the primary model is Opus)
Opus = orchestrator + reviewer. Sonnet subagent = executor. Delegate via the `Agent` tool with `subagent_type: executor` (global agent `~/.claude/agents/executor.md`, hard-pinned to `kr/claude-sonnet-5`) for token-heavy work (recon, mechanical code, build/test + summarize). Independent work → multiple subs in parallel. Sequential work / 1-2 line fixes → do it yourself. Sub prompts must be self-contained. Trust but verify — read the actual diff before reporting done.

## Spec & Checkpoint Workflow (REQUIRED)
- START of session: read `docs/CHECKPOINT.md`.
- BEFORE a feature: read `docs/specs/<feature>.md`. Doesn't exist → discuss the spec with the user first.
- AFTER a major feature + verify passes: write `docs/technical_specs/<feature>.md`.
- New feature/bugfix: write a failing test FIRST (red), make it pass (green), then refactor. Don't write implementation before the test exists.
- BEFORE merge: audit (`/code-review` or a review-subagent).
- END of a major task: update `docs/CHECKPOINT.md`.
- UI task with no `docs/design-principles.md` yet → ask the user for their style preferences first, don't guess.
- Architectural decision → record in `docs/DECISIONS.md`. Pitfall → `docs/GOTCHAS.md`.
