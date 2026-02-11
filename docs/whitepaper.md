# Bracket Pool Protocol

### Trustless Prediction Pools for the World's Biggest Tournaments

*Draft — February 2026*

---

## The Opportunity

Every year, tens of millions of people fill out brackets and enter prediction pools for major sporting events. March Madness alone generates an estimated $15 billion in wagers annually. The FIFA World Cup, NBA Playoffs, NFL Playoffs, and other tournaments drive similar engagement worldwide.

Yet the way people participate hasn't changed in decades. Office pools run on spreadsheets and trust. Online platforms take excessive fees, control the funds, and can't prove they're paying out fairly. Users have no transparency into prize calculations and no guarantee their money is safe.

**Bracket Pool Protocol** brings prediction pools on-chain — transparent, trustless, and open to anyone in the world.

---

## How It Works

The experience is simple:

1. **Pick a pool.** Browse available tournament pools — World Cup, March Madness, NBA Playoffs — at entry tiers that fit your budget ($100, $1,000, or $10,000).

2. **Fill out your bracket.** Predict group stage outcomes, which teams advance through each round, and who wins the tournament. Enter a tiebreaker prediction.

3. **Pay and enter.** Pay the entry fee in USDC (or via credit card in a future release). Your predictions are cryptographically committed on-chain — nobody can alter them after submission, including us.

4. **Watch and compete.** Track your ranking on a live leaderboard as the tournament unfolds. See how your picks compare to reality in real time.

5. **Claim your winnings.** When the tournament ends, results are posted on-chain, scores are calculated by an open-source scorer, and the prize distribution is locked into a Merkle tree. Winners claim directly from the smart contract using a Merkle proof — no middleman, no delays, no trust required.

---

## What Makes This Different

**Transparent prize pools.** Every entry fee is visible on-chain. The total prize pool, the 5% protocol fee, and every payout amount are publicly verifiable. No hidden rake, no black-box calculations.

**Immutable picks.** Your bracket predictions are hashed and stored on-chain at the moment of entry. They can't be changed — not by you, not by the platform, not by anyone. This eliminates the most common form of cheating in traditional pools.

**Trustless payouts.** Prize distribution is determined by an open-source scoring algorithm. The results are encoded in a Merkle tree and verified by the smart contract. Winners claim directly — there's no custodian holding funds and deciding who gets paid.

**Global access.** Anyone with a wallet (or eventually a credit card) can enter from anywhere in the world. No geographic restrictions, no banking requirements, no KYC for on-chain participation.

**Bonding curve pricing.** Early entries cost less than late entries, rewarding users who commit early and creating natural buzz as the pool grows. The price curve is transparent and deterministic.

---

## World Cup 2026: The Launch Event

The first major tournament on Bracket Pool Protocol is the **FIFA World Cup 2026**, kicking off June 11, 2026 in the United States, Canada, and Mexico.

This is the first 48-team World Cup — the biggest in history, with matches across three countries and a global audience exceeding 5 billion viewers. The expanded format creates a richer prediction challenge with group stages, third-place advancement picks, and a full knockout bracket.

### How World Cup Predictions Work

**Group Stage:** 48 teams are divided into 12 groups of 4. Users predict the finishing order (1st through 4th) in every group, plus which 8 third-place teams advance to the knockout round.

**Knockout Stage:** Since matchups aren't determined until groups finish, users predict *which teams survive* to each round — not individual match winners. Pick the 16 teams in the Round of 16, the 8 quarterfinalists, the 4 semifinalists, the 2 finalists, the champion, and the third-place winner.

**Tiebreaker:** Predict the total goals scored in the Final.

### Scoring

Points are awarded for correct predictions, with higher value for harder picks:

| Prediction | Points |
|-----------|--------|
| Correct group winner (1st) | 10 |
| Correct group runner-up (2nd) | 8 |
| Correct group 3rd place | 5 |
| Correct group 4th place | 3 |
| Correct advancing 3rd-place team | 5 |
| Correct team in Round of 16 | 10 |
| Correct team in Quarterfinals | 20 |
| Correct team in Semifinals | 40 |
| Correct finalist | 80 |
| Correct champion | 100 |
| Correct 3rd place winner | 40 |

A perfect prediction scores **1,132 points**. The group stage accounts for about 31% of total points, with the knockout stage making up 69% — rewarding deep tournament knowledge while still making the group stage meaningful.

### Entry Tiers

| Tier | Entry Fee | Target |
|------|-----------|--------|
| Minnow | $100 | Casual fans, first-time users |
| Shark | $1,000 | Serious sports fans |
| Whale | $10,000 | High-stakes competition |

Each tier is a separate pool with its own prize pot. Users can enter multiple tiers. The bonding curve means early entrants in each pool pay less — creating incentive to enter early and share with friends.

### Prize Distribution

Prizes are split among the top finishers:
- **1st place:** 60% of the prize pool
- **2nd place:** 25%
- **3rd place:** 15%

Ties at any position split the combined prize evenly.

---

## Multi-Sport Expansion

The protocol is designed to be **sport-agnostic**. The smart contracts know nothing about soccer, basketball, or any specific sport. They handle entries, payments, and prize claims. The sport-specific logic — bracket structure, scoring rules, team data — lives entirely in off-chain modules that can be swapped for any tournament format.

### Planned Sports

| Tournament | Format | Target Launch |
|-----------|--------|---------------|
| FIFA World Cup 2026 | Group stage + knockout bracket | June 2026 (primary launch) |
| March Madness | 68-team single elimination | March 2027 |
| NBA Playoffs | Conference brackets, best-of-7 | April 2027 |
| NHL Playoffs | Conference brackets, best-of-7 | April 2027 |
| NFL Playoffs | Conference brackets | January 2027 |
| College Football Playoff | 12-team single elimination | December 2026 |
| Formula 1 | Season-long standings prediction | 2027 |

Adding a new sport requires **zero smart contract changes**. Each sport needs:
1. A team/participant configuration file
2. A scoring module (how to calculate points)
3. A bracket picker UI component

The contracts, payment flow, Merkle distribution, and claim mechanism are all reused as-is.

### New Game Types (Future)

Beyond bracket predictions, the platform can expand to other pool formats:

- **Super Bowl Squares** — the classic 10x10 grid game
- **Survivor / Eliminator pools** — pick one team per week, wrong pick eliminates you
- **Season-long predictions** — predict division winners, MVP, award winners

These formats require different smart contract designs but share the same frontend infrastructure, user base, and token ecosystem.

---

## Revenue Model

### Protocol Fee

Every pool charges a **5% fee** on total entries. The fee is taken automatically when results are finalized — it's encoded in the smart contract and cannot be changed by the operator.

For context: traditional sports betting platforms take 10-15% vig. Fantasy sports platforms charge 10-15% entry fees. Bracket Pool's 5% is transparent, on-chain, and significantly lower.

### Revenue Projections (Illustrative)

| Scenario | Entries | Avg Fee | Total Pool Value | Protocol Revenue (5%) |
|----------|---------|---------|-----------------|----------------------|
| World Cup — Conservative | 1,000 | $500 | $500K | $25K |
| World Cup — Moderate | 10,000 | $500 | $5M | $250K |
| World Cup — Aggressive | 50,000 | $300 | $15M | $750K |
| Multi-sport annual (Year 2) | 100,000 | $400 | $40M | $2M |

These numbers assume multiple entry tiers and multiple tournaments per year.

---

## Protocol Token (Planned)

A protocol token will be introduced to align incentives between the platform and its users.

### Airdrop Mechanism

When a user enters a pool, they receive protocol tokens equivalent in USD value to their entry fee. A $100 entry earns $100 worth of tokens. This effectively functions as a loyalty reward — users get their entry fee back in protocol tokens while still competing for USDC prizes.

### Revenue Sharing

Token holders share in protocol revenues. The 5% fee collected from all pools is distributed (in whole or in part) to token stakers. This creates a flywheel:

1. More users enter pools → more fee revenue
2. More fee revenue → higher token yield
3. Higher token yield → more demand for the token
4. Token airdrop → incentivizes more pool entries
5. Repeat

### Governance (Future)

Token holders may eventually vote on protocol parameters: supported sports, fee percentages, payout structures, and treasury allocation.

*Note: Token design, distribution schedule, and legal structure are under development. Revenue-sharing tokens require careful regulatory consideration.*

---

## Decentralization Roadmap

At launch, a multisig admin posts tournament results and triggers the scoring process. This is a pragmatic starting point, but the protocol is designed to progressively decentralize.

### Phase 1: Auditable Admin (Launch)

The admin multisig posts results and the Merkle root. However, all scorer logic is open-source and all outputs are pinned to IPFS. Anyone can independently re-run the scorer and verify that the results, scores, rankings, and prize amounts are correct. Trust is required but verification is always possible.

### Phase 2: Oracle-Based Results (Post-Launch)

Integrate **Chainlink's Compute Runtime Environment (CRE)** to fetch tournament results from multiple sports data providers. A decentralized oracle network reaches consensus on results and posts them on-chain — removing the admin from the data input step entirely.

### Phase 3: Trustless Scoring (Long-Term)

Move the entire scoring pipeline into the oracle network or implement an optimistic scoring model with on-chain dispute resolution. At this stage, no single party controls any step from result posting to prize distribution. The protocol becomes fully trustless.

The smart contract architecture was designed from day one with this upgrade path in mind. Result posting (`setResults`) and prize finalization (`setMerkleRoot`) are separate functions that can be decentralized independently.

---

## Technical Architecture

### Smart Contracts (Solidity)

```
BracketPoolFactory (deploys pools)
    │
    ├── BracketPool: "World Cup 2026 - Minnow"  (gameCount=88, entry=$100)
    ├── BracketPool: "World Cup 2026 - Shark"   (gameCount=88, entry=$1,000)
    ├── BracketPool: "World Cup 2026 - Whale"   (gameCount=88, entry=$10,000)
    ├── BracketPool: "March Madness 2027"        (gameCount=67, entry=$50)
    └── ...any tournament, any sport
```

Each BracketPool contract is fully self-contained:
- Accepts entries with USDC payment (bonding curve pricing)
- Stores a cryptographic hash of each user's picks (gas-efficient)
- Emits the full picks in an event log (for scoring)
- Distributes prizes via Merkle proof claims (no loops, no gas limits)
- Supports three independent refund paths (cancelled, insufficient entries, deadline expired)
- Enforces a claim deadline with admin sweep of unclaimed funds

The contracts are **sport-agnostic**. The same contract handles World Cup brackets, March Madness brackets, NBA playoff predictions, or any other format. The sport-specific logic lives entirely off-chain.

### Off-Chain Scorer (TypeScript)

A modular TypeScript pipeline that:
1. Reads entry data from on-chain events
2. Loads the appropriate sport scoring module
3. Validates pick consistency (e.g., knockout picks must follow from group picks)
4. Scores every entry against actual results
5. Ranks entries by score and tiebreaker
6. Calculates prize distribution
7. Builds a Merkle tree for on-chain verification
8. Publishes proofs to IPFS for permanent availability

Each sport plugs into the pipeline via a standard interface — only the scoring rules and validation logic change.

### Frontend (Next.js)

A web application with:
- Wallet connection (RainbowKit) and future credit card support
- Sport-specific bracket picker components (loaded based on pool type)
- Live leaderboard during tournaments
- One-click claim and refund flows
- Pool browsing with tier and sport filtering

### Deployment

Target deployment on **Base** (Ethereum L2) for sub-cent gas costs, with USDC as the primary denomination. The smart contracts are chain-agnostic and can be deployed to any EVM-compatible chain.

---

## Current Status

This is not a concept — working code exists today.

| Component | Status |
|-----------|--------|
| Smart contracts (BracketPool + Factory) | Complete — 64 tests passing, 100% coverage |
| Off-chain scorer (scoring, ranking, Merkle tree) | Complete — 23 tests passing |
| Frontend (pool list, pool detail, wallet connect) | Partial — read-only pages working, build passes |
| March Madness PoC | In progress — serves as demo for investor meetings |
| World Cup 2026 format | Designed — pick encoding, scoring, and architecture documented |

The codebase is on GitHub with comprehensive documentation including architecture decisions, analysis of edge cases, and a detailed implementation plan.

---

## Roadmap

| Phase | Timeline | Milestone |
|-------|----------|-----------|
| PoC Complete | March 2026 | March Madness demo ready for investor meetings |
| Contract Updates | March 2026 | sportId, multi-token, results correction, entry cap |
| Scorer Refactor | April 2026 | Multi-sport module system, shared config |
| World Cup Build | April–May 2026 | Bracket picker, World Cup scorer, tiered payouts, live leaderboard |
| Base L2 Deployment | May 2026 | Testnet → mainnet on Base |
| **World Cup Launch** | **June 11, 2026** | **All three entry tiers live for FIFA World Cup 2026** |
| Fiat On-Ramp | Summer 2026 | Credit card entry for non-crypto users |
| Additional Sports | Fall 2026+ | NFL, College Football, NBA, NHL, F1 |
| Protocol Token | TBD | Airdrop + revenue sharing (pending legal review) |
| Decentralization | 2027+ | Chainlink CRE oracle integration, trustless scoring |

---

## What We're Looking For

We're building the team to take this from working prototype to World Cup launch. Key roles:

- **Frontend / Full-Stack Engineer** — React/Next.js, wagmi, blockchain UI. Own the bracket picker and user experience.
- **Smart Contract / Backend Engineer** — Solidity, Foundry, TypeScript. Own the scorer pipeline and contract upgrades.
- **Designer** — Make the bracket picker intuitive and the overall product polished. Sports fans need to love using this.
- **Growth / Marketing** — Sports community building, partnerships, launch strategy for World Cup.

The core architecture is built. The contracts work. The scorer works. What's needed now is execution — shipping the World Cup experience and getting users in the door before June 11.

---

*For technical details, see the full documentation in the project repository:*
- *World Cup design: `docs/plans/2025-02-10-world-cup-pivot-design.md`*
- *Future roadmap: `docs/future-ideas.md`*
