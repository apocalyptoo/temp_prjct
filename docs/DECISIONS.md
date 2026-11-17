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

### 2026-11-17: v1.0 scope is the current app made secure and polished, plus a short list of additions
The additions are profile editing, the join request flow, venue discovery, account deletion, basic in-app notifications and UI improvements. Full scope is in `docs/PRODUCT.md`.
**Why:** Ship sooner with fewer open questions and get real user feedback.
**Alternatives considered:** Including challenges and matches in v1.0 (rejected: too many open decisions, delays launch).

### 2026-11-17: Challenges, match scheduling and results move to v1.1

### 2026-11-17: Out of scope: tournaments, venue booking, payments, real-time chat, advanced stats, iOS
Venue booking is explicitly not a core feature.
**Why:** This is a community app, not a booking app.

### 2026-11-17: Basic in-app notifications are required in any release where a flow waits on another person
This covers invites and join requests now, and challenges and results later.
**Why:** Without them these flows feel broken.

### 2026-11-17: Account deletion is part of v1.0
**Why:** Google Play requires in-app account deletion for apps with account creation.

### 2026-11-17: Android is the first release target; iOS later

### 2026-11-17: Keep the current stack (React Native, Express, Prisma, PostgreSQL)
A change is allowed only if it's justified and approved.

### 2026-11-17: No database resets, destructive migrations or new dependencies without explicit approval

### 2026-11-17: Security fixes run in parallel with product planning, not after it
**Why:** The critical bugs don't depend on product decisions, and the backend is publicly reachable whenever ngrok is running.

### 2026-11-17: Approved business rules are recorded in `docs/PRODUCT.md`
