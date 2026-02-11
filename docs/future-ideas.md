# Future Ideas & Product Roadmap

> **Status:** Ideas log. Not scoped or committed to. Captured for future planning.
> **Date:** 2026-02-10

---

## 1. Credit Card Integration (Fiat On-Ramp)

**Problem:** Most sports fans don't have crypto wallets or USDC. Requiring a wallet is a massive adoption barrier.

**Idea:** Let users pay with a credit card. A fiat on-ramp service handles the USDC conversion and wallet creation behind the scenes. The user experience is: enter email, pick bracket, pay with card, done.

**Possible approaches:**
- **Embedded wallets** (Privy, Dynamic, Coinbase Smart Wallet) — create a wallet for the user automatically, abstract away all crypto UX
- **Fiat-to-USDC on-ramp** (MoonPay, Transak, Stripe crypto) — user pays in USD, service converts to USDC and submits the on-chain entry
- **Hybrid** — support both wallet connect (crypto-native users) and credit card (everyone else)

**Impact on contracts:** None. The contract receives USDC regardless of how the user acquired it. The on-ramp service or embedded wallet submits the transaction on behalf of the user.

---

## 2. Private Pools (Office Pools / Friend Groups)

**Problem:** People want to run their own bracket pools for their office, friend group, or community — not just join a big public pool.

**Idea:** Allow anyone to create a private pool with an invite code or access list. Same mechanics (USDC entry, Merkle claims) but restricted to invited participants.

**Possible approaches:**
- **Allowlist on-chain** — Pool creator provides a list of allowed addresses (Merkle tree of allowed entrants). `enter()` checks proof of inclusion. Gas-efficient for large lists.
- **Invite code off-chain** — Pool creator generates a code. Frontend gates access. Less decentralized but simpler UX.
- **Password-protected** — Pool stores `keccak256(password)` on-chain, `enter()` requires the password. Simple but password can leak.
- **Permissionless pool creation** — Remove `onlyOwner` from `createPool()` in the factory. Anyone can create a pool and become its admin. Combine with allowlist for private pools.

**Impact on contracts:**
- Add optional `bytes32 allowlistRoot` to pool constructor (bytes32(0) = public pool)
- Add Merkle proof check in `enter()` when allowlist is set
- Consider removing `onlyOwner` from factory's `createPool()` for permissionless creation
- Fee structure might change for private pools (lower fee? pool creator sets fee?)

---

## 3. Protocol Token & Revenue Sharing

**Problem:** Want to reward early users and create a community with aligned incentives.

**Idea:** Launch a protocol token. Distribute it to pool entrants as an airdrop — each entrant receives tokens equivalent in USD value to their entry fee. The token shares in protocol revenues (the 5% fee from all pools).

**Token mechanics (rough sketch):**
- **Airdrop:** When a user enters a pool paying X USDC, they receive Y tokens where Y's USD value ≈ X at current token price. Effectively a 1:1 rebate in protocol tokens.
- **Revenue sharing:** The 5% fee collected by the treasury is (partially or fully) distributed to token holders. This could be:
  - Direct USDC dividends to stakers
  - Buyback-and-burn using fee revenue
  - Fee distribution to LP providers
- **Governance potential:** Token holders could vote on supported sports, fee percentages, or treasury allocation

**Impact on contracts:**
- Treasury contract needs to handle revenue distribution (staking contract or dividend distributor)
- May need a token contract (ERC-20) with airdrop/claim mechanics
- Pool contract's fee transfer could go to a revenue splitter instead of a simple treasury address
- Regulatory considerations — revenue-sharing tokens may be securities depending on jurisdiction. Need legal review.

**Open questions:**
- Token supply and distribution schedule
- Vesting for airdropped tokens?
- What % of fee revenue goes to token holders vs. team/operations?
- Token launch timing relative to World Cup launch

---

## 4. Additional Sports & Game Types

### Bracket/Prediction Formats

All of these use the existing contract architecture (factory → pool → entries → scorer → Merkle claims). Each just needs a sport module (encoding + scoring) and a bracket picker UI.

| Sport | Format | Pick Type | Timing |
|-------|--------|-----------|--------|
| **FIFA World Cup 2026** | 48 teams, groups + knockout | Group order + advancing teams | June 2026 (primary launch) |
| **March Madness** | 68 teams, single elimination | Match winners per round | March each year |
| **NBA Playoffs** | 16 teams, conference brackets, best-of-7 | Series winners per round | April–June each year |
| **NHL Playoffs** | 16 teams, conference brackets, best-of-7 | Series winners per round | April–June each year |
| **College Football Playoff** | 12 teams, single elimination | Match winners per round | December–January each year |
| **NFL Playoffs / Divisional** | 14 teams, conference brackets | Match winners per round | January each year |
| **Formula 1** | 20 drivers, season-long | Predict race winners or season standings | March–December each year |

### New Game Types (Different Mechanics)

These may require new contract patterns beyond the current bracket pool:

| Game | How It Works | Contract Impact |
|------|-------------|-----------------|
| **Super Bowl Squares** | 10×10 grid, each square = random score digits, payout per quarter | Different from bracket pool — needs a squares grid contract with random assignment. Separate contract. |
| **Season-long predictions** | Predict division winners, conference standings, award winners | Long-running pool with multiple result-posting events throughout the season. May need partial scoring/leaderboard updates. |
| **Survivor/Eliminator pools** | Pick one team per week to win. If they lose, you're out. Can't pick same team twice. | Sequential weekly picks, not upfront bracket. Different contract pattern — weekly submission + elimination tracking. |

### Priority Order (Suggested)

1. **World Cup 2026** — primary launch, biggest global audience
2. **March Madness 2027** — already built as PoC, easy to ship
3. **NFL Playoffs 2027** — huge US audience, simple bracket format
4. **NBA/NHL Playoffs 2026** — can ship quickly after World Cup, same bracket pattern
5. **Super Bowl Squares** — different mechanic, fan favorite, good for virality
6. **Formula 1** — niche but passionate audience, season-long engagement
7. **College Football Playoff** — growing format (expanded to 12 teams)

---

## 5. Decentralization: Chainlink CRE & Removing Admin Trust

**Problem:** Right now the admin multisig posts game results (`setResults()`) and the Merkle root (`setMerkleRoot()`). Users have to trust that the admin posted correct results and ran the scorer honestly. This is the biggest centralization risk in the protocol — a malicious or compromised admin could post wrong results and steal the prize pool.

**Goal:** Remove the admin as a single point of trust for result posting and scoring. Users should be able to verify that results came from an independent, decentralized source.

### Phase 1: Chainlink CRE for Result Posting

**Chainlink Compute Runtime Environment (CRE)** can fetch sports results from external APIs (ESPN, SportsDataIO, etc.), reach consensus across a Decentralized Oracle Network (DON), and post the verified results on-chain.

**How it works:**
- A CRE workflow is configured to fetch game results from multiple sports data providers
- The DON nodes independently fetch results, compare, and reach consensus
- Once consensus is reached, the workflow calls `setResults()` on the pool contract
- The contract accepts results from an authorized `oracle` address (the CRE DON) instead of (or in addition to) the admin

**Contract changes:**
- Add `address public oracle` role alongside `admin`
- `setResults()` accepts calls from either `admin` or `oracle`
- Consider: `setResults()` only callable by `oracle` once the oracle is set, with admin as fallback if oracle fails to post within a deadline

**Status:** Chainlink CRE is in Early Access (launched Nov 2025). API availability and pricing may change. The contract architecture already separates `setResults()` from `setMerkleRoot()`, which was designed with this upgrade path in mind.

### Phase 2: Decentralized Scoring

Even with Chainlink posting results, the scorer is still run off-chain by the admin. The admin computes the Merkle root and posts it. A dishonest admin could compute a wrong Merkle root that awards prizes to the wrong people.

**Approaches to decentralize scoring:**

1. **Verifiable scoring via CRE** — The CRE workflow not only fetches results but also runs the scoring logic, builds the Merkle tree, and posts the root. The entire pipeline (results → scores → rankings → prizes → Merkle root) runs in the DON, removing the admin from the scoring path entirely. This is the cleanest solution but depends on CRE supporting the compute complexity.

2. **On-chain scoring (partial)** — Move the scoring logic on-chain. After `setResults()`, anyone can call a `computeScores()` function that iterates entries and computes scores. Problem: gas limits. With many entries, this is prohibitively expensive on L1. Could work on L2 or with batched computation.

3. **Optimistic scoring with disputes** — Admin posts the Merkle root with a challenge period (e.g., 48 hours). During the challenge period, anyone can submit a fraud proof showing the root is incorrect. If a valid challenge is submitted, the root is rejected and can be resubmitted. This is similar to optimistic rollup mechanics.

4. **Multi-party scoring** — Multiple independent parties run the scorer. The contract requires N-of-M matching Merkle roots before accepting. If they all agree, the root is valid. If they disagree, fall back to a dispute resolution process.

**Recommended path:**
- **Short term (World Cup launch):** Admin multisig posts results and Merkle root. Scorer output is pinned to IPFS and fully auditable — anyone can re-run the scorer and verify the root matches.
- **Medium term:** Add Chainlink CRE oracle for `setResults()` to remove admin from result posting. Admin still runs scorer and posts Merkle root.
- **Long term:** Move scoring into CRE or implement optimistic scoring with disputes. Fully trustless end-to-end.

### Impact on Contract Architecture

| Change | When | Difficulty |
|--------|------|------------|
| Add `oracle` role for `setResults()` | Medium term | Small — one new address, one require change |
| CRE workflow for result posting | Medium term | Medium — CRE config, sports API integration |
| Optimistic Merkle root with challenge period | Long term | Large — new contract logic for disputes, bonds, challenge windows |
| Full CRE scoring pipeline | Long term | Large — depends on CRE compute capabilities |

The current architecture was designed for this upgrade path. The separation of `setResults()` (data input) and `setMerkleRoot()` (scored output) means each can be decentralized independently.

---

## 6. Summary of Contract Architecture Impact

| Feature | Contract Changes Needed |
|---------|------------------------|
| New bracket sports (NBA, NHL, NFL, etc.) | None — just new `gameCount` and sport module |
| Credit card / fiat on-ramp | None — on-ramp handles USDC + wallet |
| Private pools (allowlist) | Add optional `allowlistRoot` + proof check in `enter()` |
| Permissionless pool creation | Remove `onlyOwner` from `createPool()` |
| Protocol token airdrop | New ERC-20 token contract + airdrop claim contract |
| Revenue sharing | Treasury → revenue splitter/staking contract |
| Super Bowl Squares | New contract (different game mechanic) |
| Survivor pools | New contract (weekly sequential picks) |
| Season-long predictions | Possibly new contract or multi-phase result posting |
| Chainlink CRE oracle for results | Add `oracle` role, modify `setResults()` auth |
| Optimistic scoring (disputes) | New challenge/dispute logic on `setMerkleRoot()` |
| Full CRE scoring pipeline | CRE runs scorer + posts root, minimal contract change |

The core BracketPool contract handles the majority of sports with zero changes. The decentralization path (Chainlink CRE → optimistic scoring) is the most architecturally significant future work.
