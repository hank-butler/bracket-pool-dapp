# Session Handoff

Update the handoff document at `docs/HANDOFF.md` with what was accomplished in this session and what comes next. This document is the single source of truth for project status — both Claude and the junior engineer on the team use it to pick up where the last session left off.

## Process

### Step 1: Gather current state

Before writing, gather facts — do not rely on memory or assumptions:

1. Read the current `docs/HANDOFF.md` to understand previous state
2. Run `git log --oneline -20` to see recent commits
3. Run `git branch --show-current` to confirm current branch
4. Run tests to confirm current pass/fail status:
   - `cd contracts && forge test` (contract tests)
   - `cd scorer && npm test` (scorer tests)
   - `cd web && npm run build` (frontend build)
5. Check for uncommitted changes: `git status`

### Step 2: Write the handoff

Replace the entire contents of `docs/HANDOFF.md` with a fresh document. Use this structure:

```markdown
# Handoff — YYYY-MM-DD — [INITIALS]

> **Author:** [INITIALS] | **Date:** YYYY-MM-DD

## Project Status

[2-3 sentence summary of overall project state]

| Layer | Status | Tests |
|-------|--------|-------|
| Smart Contracts (Foundry) | [status] | [X tests pass/fail] |
| Off-Chain Scorer (TypeScript) | [status] | [X tests pass/fail] |
| Frontend (Next.js + wagmi) | [status] | [build status] |

## What Was Done This Session

[Bullet list of what was accomplished. Be specific — include branch names, PR links, key decisions made.]

## What's Next

[Numbered list of upcoming work items, ordered by priority. Include enough context that someone unfamiliar with the session can pick up the work.]

## Current Branch State

[What branch are we on? Is there an open PR? Any uncommitted work?]

## Local Development Setup

[Keep this section from the previous handoff if still accurate. Update if anything changed.]

## Key Architecture Decisions

[Keep this section from the previous handoff. Add any new decisions made this session.]
```

### Step 2b: Determine author

Ask the user who is writing this handoff. Known team members:
- **CL** — Clayton Lowery
- **HB** — Hank Butler

Use their initials in the header and author field.

### Step 3: Confirm with user

Show the user the updated handoff document and ask if anything should be added or changed before committing.

### Step 4: Commit

```bash
git add docs/HANDOFF.md
git commit -m "docs: update handoff — YYYY-MM-DD"
```

## Rules

- **Always run tests** before writing the handoff — report actual results, not assumptions
- **Replace the entire file** — this is a living document, not an append log
- **Be specific** — include branch names, PR URLs, commit SHAs, exact test counts
- **Preserve setup instructions** — the Local Development Setup section should always be present and accurate
- **Don't editorialize** — state facts, not opinions about code quality or difficulty
