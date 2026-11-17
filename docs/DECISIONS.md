# Decisions

One entry per real decision. Newest at the bottom. If a decision changes, add a new entry that replaces the old one. Don't delete history.

---

### 2026-11-17: Improve the existing app step by step, no rewrite
**Why:** The app already works. Small, tested changes are safer and teach more than starting over.
**Alternatives considered:** Full rewrite (rejected: high risk, and the working features would be lost for weeks).

### 2026-11-17: Fix security issues before new features or deployment
**Why:** The audit found an account-takeover bug (password reset token injection) and leaked secrets. Real users can't be invited until these are fixed.

### 2026-11-17: Source code is the source of truth
**Why:** The project had little documentation, and docs can drift. When docs and code disagree, the code wins, and the doc gets fixed.

### 2026-11-17: `docs/ROADMAP.md` is the task tracker
**Why:** Solo developer. One checklist in the repo is simpler than GitHub Issues for now. Can revisit later.

### 2026-11-17: Every change gets a plain-language explanation and, for backend changes, a test
**Why:** The owner relies on Claude Code to write the code, so explanations and tests are how changes get checked.
