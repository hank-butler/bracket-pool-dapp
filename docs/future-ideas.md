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

## 6. Entry Tiers (Minnow / Shark / Whale)

**Idea:** Offer three price tiers per tournament so casual fans and high-rollers both have a home.

| Tier | Entry Fee | Target Audience |
|------|-----------|-----------------|
| Minnow | $100 USDC | Casual fans, first-timers. Likely L2-only due to gas economics. |
| Shark | $1,000 USDC | Serious players, sports bettors |
| Whale | $10,000 USDC | High-stakes, headline prize pools |

**Implementation:** Three separate pools per tournament, created by the factory with different `basePrice` values. Each tier has its own prize pot and its own set of winners. Users can enter multiple tiers if they want.

Example for World Cup 2026:
```
createPool(usdc, treasury, "World Cup 2026 - Minnow",  "worldcup2026", 88, ..., 100_000_000,  priceSlope)
createPool(usdc, treasury, "World Cup 2026 - Shark",   "worldcup2026", 88, ..., 1_000_000_000, priceSlope)
createPool(usdc, treasury, "World Cup 2026 - Whale",   "worldcup2026", 88, ..., 10_000_000_000, priceSlope)
```

**Contract changes:** None. The factory already supports creating multiple pools with different parameters. The frontend groups pools by sport and displays the tier.

**Note:** The Minnow tier at $100 is only viable on L2 where gas costs are negligible. On L1, gas alone could approach the entry fee. This tier should be introduced when the L2 deployment is ready.

---

## 7. Known Limitations & Required Fixes

Issues in the current architecture that need to be addressed before mainnet or as the product scales.

### 7a. L1 Gas Costs (CRITICAL — Decide Before Mainnet)

The entire stack currently targets Ethereum L1. An `enter()` call with 88 bytes32 values in calldata + USDC approve costs ~$15-40+ in gas at current prices, on top of the entry fee. This is acceptable for the Whale tier but prohibitive for Minnow and painful for Shark.

**Decision needed:** Deploy on L2 (Base, Arbitrum, Optimism) for production. The contracts are fully compatible — it's just a deployment target and RPC config change. The sooner this is decided, the less Sepolia testnet work gets redone.

**Recommendation:** Deploy on Base. Coinbase ecosystem aligns with the credit card on-ramp story (Coinbase Smart Wallet). Gas costs are sub-cent. USDC is native on Base.

### 7b. Multi-Token Support (CRITICAL — Before Mainnet)

The pool is currently hardcoded to a single ERC20 token (USDC) passed in the constructor. This needs to change before mainnet for several reasons:

- Different L2s have different USDC addresses (native USDC vs. bridged)
- Users may want to pay with USDT, DAI, or other stablecoins
- Future pools might be denominated in ETH or other tokens
- Cross-chain deployment needs flexibility

**Options:**
1. **Accept any ERC20** — Pool constructor already takes an `_usdc` address param (poorly named). Rename to `_token` and accept any ERC20. Frontend displays the token symbol. Minimal change.
2. **Multi-token per pool** — Accept multiple tokens at current exchange rates. More complex, needs a price oracle. Probably overkill for now.
3. **Native ETH support** — Accept ETH directly, wrap to WETH internally. Different code path in `enter()` and `refund()`.

**Recommendation:** Option 1 for now. Rename `usdc` → `token` throughout, accept any ERC20 address. This is a small refactor (rename + update tests) that unlocks multi-chain and multi-token deployment. Add native ETH support later if needed.

### 7c. Tiered Payouts (Before World Cup Launch)

Currently `distributePrizes()` only pays rank-1 winners. Every real bracket pool pays top 3 (or more). With thousands of entries in a World Cup pool, a single winner taking the entire pot is unappealing.

**Proposed default payout structure:**
- 1st place: 60%
- 2nd place: 25%
- 3rd place: 15%

**Implementation:** This is a scorer-only change — no contract modification needed. The scorer's `distributePrizes()` function gets a payout table instead of winner-take-all. The Merkle tree includes leaves for 1st, 2nd, and 3rd place (or more).

**Possible future enhancement:** Make the payout structure configurable per pool. Store a `payoutBPS` array (e.g., `[6000, 2500, 1500]`) on-chain or as part of the pool metadata. For now, hardcode in the scorer.

### 7d. Live Leaderboard (Before World Cup Launch)

The current architecture is all-or-nothing: wait for the tournament to end, post all results at once, score everything. The World Cup runs 5+ weeks. Users will expect live standings as the group stage plays out.

**Implementation:**
- Scorer runs in "partial mode" against whatever results are available so far
- Frontend polls or subscribes to a leaderboard API
- No contract changes needed — partial scoring is purely off-chain
- The on-chain flow (setResults → setMerkleRoot → claim) only happens at the end

**Note:** For season-long formats (F1, NFL) this becomes essential, not just nice-to-have.

### 7e. Results Correction

`setResults()` can only be called once (checks `gameResults.length == 0`). If the admin or Chainlink oracle posts wrong results, there's no fix — the pool would need to be cancelled.

**Recommendation:** Add an `updateResults()` function that allows results to be corrected before `setMerkleRoot()` is called. Once the Merkle root is set, results are final.

```solidity
function updateResults(bytes32[] calldata results) external {
    require(msg.sender == admin, "Not authorized");
    require(gameResults.length > 0, "No results to update");
    require(merkleRoot == bytes32(0), "Already finalized");
    require(results.length == gameCount, "Invalid results length");
    gameResults = results;
    emit ResultsUpdated(results);
}
```

### 7f. Entry Cap

No maximum entries per pool. For very large pools, the scorer must process all `EntrySubmitted` events. This could hit RPC rate limits or memory issues with tens of thousands of entries.

**Recommendation:** Add optional `maxEntries` to the pool constructor (0 = unlimited). The scorer should also be optimized for batch event fetching with pagination.

---

## 8. Summary of Contract Architecture Impact

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
| Entry tiers (Minnow/Shark/Whale) | None — three separate pools with different `basePrice` |
| L2 deployment | None — redeploy same contracts to L2 |
| Multi-token support | Rename `usdc` → `token`, accept any ERC20 |
| Tiered payouts (1st/2nd/3rd) | None — scorer-only change |
| Live leaderboard | None — off-chain partial scoring |
| Results correction | Add `updateResults()` function (before Merkle root is set) |
| Entry cap | Add optional `maxEntries` to constructor |

The core BracketPool contract handles the vast majority of the product vision with zero or minimal changes. The most impactful contract changes before mainnet are multi-token support (rename `usdc` → `token`) and results correction (`updateResults()`). Everything else is either a deployment decision (L2), scorer change (tiered payouts, live leaderboard), or factory usage pattern (entry tiers).

---

## 9. World Cup Launch Prioritization

Everything below is prioritized for the **June 11, 2026 World Cup kickoff**.

### Must Ship (Launch Blockers)

These items are required for a credible mainnet launch. Without any one of them, the product either doesn't work, doesn't attract users, or loses them mid-tournament.

| # | Item | Why It Blocks Launch | Effort | Timing |
|---|------|---------------------|--------|--------|
| 1 | **L2 deployment (Base)** | Gas on L1 makes the $100 Minnow tier impossible and Shark painful. Mass market requires sub-cent gas. Base aligns with credit card story (Coinbase ecosystem). | Low | Week 4 |
| 2 | **Multi-token rename (usdc→token)** | Required for L2 deployment (different USDC addresses per chain). Clean up now before more code depends on the `usdc` naming. | Low | Week 4 |
| 3 | **sportId parameter** | Frontend needs to know which bracket picker to render. One constructor param addition. | Low | Week 4 |
| 4 | **Results correction (updateResults)** | One bad `setResults()` call with no fix = cancelled pool and PR disaster on launch day. Tiny change, massive risk reduction. | Low | Week 4 |
| 5 | **Entry cap (maxEntries)** | If a pool goes viral, uncapped entries could break the scorer. Cheap insurance. | Low | Week 4 |
| 6 | **World Cup scorer module** | Core product. Scoring, validation, encoding for the 88-pick World Cup format. | Medium | Weeks 5-8 |
| 7 | **World Cup bracket picker UI** | Core product. Group stage tables + 3rd-place picker + knockout advancement. Most complex frontend work. | Medium-High | Weeks 5-9 |
| 8 | **Tiered payouts (1st/2nd/3rd)** | Winner-take-all with thousands of entries is a dealbreaker. Default: 60% / 25% / 15%. Scorer-only change. | Low | Week 7 |
| 9 | **All three entry tiers** | Minnow ($100) is essential — asking $1,000 minimum for a brand-new app is a non-starter. Need a low barrier to entry. Shark ($1K) and Whale ($10K) for serious players. Just three `createPool` calls. | Zero | Launch day |
| 10 | **Live leaderboard** | The World Cup runs 5+ weeks. No standings = users forget the product exists. Engagement is everything. Partial scorer mode + leaderboard UI. | Medium | Weeks 9-11 |

**Total contract changes (items 1-5):** `sportId` param, rename `usdc`→`token`, add `updateResults()`, add `maxEntries`. All small, all done in one sprint.

### Should Ship (High Value, Launch is Viable Without)

| Item | Why It's High Value | Why It Can Slip |
|------|--------------------|-----------------|
| **Credit card / fiat on-ramp** | Opens the product to non-crypto users — 100x the addressable market. | Complex integration (Privy, MoonPay, Coinbase Smart Wallet). Can add 2-4 weeks post-launch. Crypto-native users are enough to prove the product. |
| **Private pools (allowlist)** | Office pools are a massive viral vector. "I made a bracket pool for our team" drives organic growth. | Requires allowlist contract change. Can launch public-only and add private pools in v2. |

### Post-Launch

| Item | Why It Can Wait |
|------|-----------------|
| Protocol token + revenue sharing | Needs legal review, tokenomics design, and audit. Don't rush tokens. Launch after product-market fit is proven. |
| Chainlink CRE oracle | Still Early Access. Admin multisig + IPFS-auditable scorer output is sufficient for launch. Decentralize once the product has users. |
| Additional sports (NBA, NHL, F1, NFL, CFB) | Ship after World Cup, using lessons learned. Each is just a sport module + bracket picker. |
| Super Bowl Squares / Survivor pools | New contract patterns. Post-launch product expansion. |
| Optimistic scoring / full decentralization | Long-term roadmap. Not expected at launch. |

### Critical Path (Week-by-Week)

```
Weeks 1-3:   Finish March Madness PoC (demo-ready for raises)
Week 4:      Contract updates — sportId, token rename, updateResults, maxEntries
Weeks 5-6:   Shared sports config refactor + scorer modularity
Weeks 7-9:   World Cup scorer + bracket picker + tiered payouts
Weeks 9-11:  Live leaderboard + Base L2 deployment + testing
Weeks 12-14: E2E testing, audit, Base mainnet deploy
Weeks 15-17: Buffer (3 weeks before June 11 kickoff)
```

~17 weeks from now to kickoff. ~14 weeks of work with 3 weeks buffer. Tight but achievable if scope stays disciplined.
