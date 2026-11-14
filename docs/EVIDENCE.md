# Bitfli Verification Guide & Cryptographic Evidence

This document provides the complete cryptographic receipts, on-chain NEAR Testnet transaction hashes, external API correlation identifiers, reproduction commands, and explicit trust boundaries for **Bitfli** ([`Jayram2204/bitfli`](https://github.com/Jayram2204/bitfli)).

---

## 1. Deployed NEAR Testnet Smart Contract (`contracts/src/lib.rs`)

The Rust pod-vault contract ([`../contracts/src/lib.rs`](../contracts/src/lib.rs)) is compiled to `wasm32-unknown-unknown` (`165 KB` release binary) and deployed on **NEAR Testnet**:

- **Deployed Contract Account ID:** [`bitfli-vault-67f5be.testnet`](https://testnet.nearblocks.io/address/bitfli-vault-67f5be.testnet)
- **Contract Signer Public Key:** `ed25519:H8pVUpHKTMKaLWM5Pxd98VUCGdbfB1GYqES9dSDkHyfz`
- **NEAR Testnet RPC Endpoint:** `https://test.rpc.fastnear.com`

### Verified On-Chain Transactions

| Step | Contract Method | NEAR Testnet Transaction Hash | Explorer Verification | On-Chain State Mutation / NEP-297 Event |
| :--- | :--- | :--- | :--- | :--- |
| **1** | `DeployContract` + `init` | `F8MAYKa8vovd2DdVz1kiSLRTCjPtM6C13MVbhnEK9RuQ` | [NearBlocks Tx](https://testnet.nearblocks.io/txns/F8MAYKa8vovd2DdVz1kiSLRTCjPtM6C13MVbhnEK9RuQ) | Deployed `bitfli_pod_vault.wasm` and initialized pod policy (`max_single_tx_usd_cents: 15000`, `daily_cap_usd_cents: 50000`, `55/30/15` split) |
| **2** | `record_policy` (`update_policy`) | `9pqUdqaFFz6GBDfDbxTgBUWaDs59tA9Reh3n6TGao885` | [NearBlocks Tx](https://testnet.nearblocks.io/txns/9pqUdqaFFz6GBDfDbxTgBUWaDs59tA9Reh3n6TGao885) | Recorded owner policy update on-chain (`max_tx_usd_cents: 15000`, `daily_cap_usd_cents: 50000`, `frozen: false`) |
| **3** | `verify_procurement` | `2kJxKCQCeL1Bcmke5PMqxJAnrrVG2w2onoRC9sGLvVWM` | [NearBlocks Tx](https://testnet.nearblocks.io/txns/2kJxKCQCeL1Bcmke5PMqxJAnrrVG2w2onoRC9sGLvVWM) | Verified `$65.00` (`6500` cents) `Anthropic API` procurement against on-chain caps and emitted NEP-297 `procurement_verified` event |
| **4** | `execute_profit_split` | `BRtxMoRxzS7DJJW2HsGuM3oaP3P3bvGQZjFYpAKUF5vk` | [NearBlocks Tx](https://testnet.nearblocks.io/txns/BRtxMoRxzS7DJJW2HsGuM3oaP3P3bvGQZjFYpAKUF5vk) | Verified `$4,000.00` (`400000` cents) `55/30/15` waterfall (`$2,200` / `$1,200` / `$600`) and emitted NEP-297 `profit_split_executed` event |

### Emitted NEP-297 Event Logs (From Testnet Receipts)

**Procurement Verification Event (`2kJxKCQCeL1Bcmke5PMqxJAnrrVG2w2onoRC9sGLvVWM`):**
```json
EVENT_JSON:{"standard":"bitfli-pod-vault","version":"1.0.0","event":"procurement_verified","data":[{"pod_account_id":"bitfli-vault-67f5be.testnet","vendor":"Anthropic API","amount_usd_cents":6500,"daily_spent_usd_cents":6500,"verdict":"ALLOW","tee_receipt":"audit_sha256_71d04c9a90fa"}]}
```

**Partner Profit-Split Event (`BRtxMoRxzS7DJJW2HsGuM3oaP3P3bvGQZjFYpAKUF5vk`):**
```json
EVENT_JSON:{"standard":"bitfli-pod-vault","version":"1.0.0","event":"profit_split_executed","data":[{"pod_account_id":"bitfli-vault-67f5be.testnet","total_amount_usd_cents":400000,"lead_dev_wallet":"bitfli-vault-67f5be.testnet","lead_dev_usd_cents":220000,"design_partner_wallet":"sora-design.sol","design_partner_usd_cents":120000,"tax_reserve_usd_cents":60000,"tee_receipt":"1click_split_2a19f73e"}]}
```

---

## 2. Verified External NEAR Ecosystem API Receipts

### A. NEAR Intents 1Click Swap API (`https://1click.chaindefuser.com`)
- **Implementation:** [`../backend/src/services/oneClickIntents.ts`](../backend/src/services/oneClickIntents.ts) and [`../backend/src/services/oneClickService.ts`](../backend/src/services/oneClickService.ts)
- **Live `POST /v0/quote` Verification Receipt (`dry: false`, `swapType: "EXACT_INPUT"`):**
  - **Quote ID / Correlation ID:** `37b5ab92-657f-4f6e-9975-5fb6709de67a`
  - **Generated Live Deposit Address:** `0x6a846d70D1Eec114a096Acfa539a37Dd5d25F218`
  - **Origin Asset:** `nep141:eth.omft.near` (`0.94117647 ETH` for `$2,400.00`)
  - **Destination Asset:** `nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1` (Canonical NEAR USDC)
  - **Destination Recipient:** `7cc3d2d8b5245fe4730af499fefd50267584f791ca5dec33360c5bdbe63fe24c`
  - **Response Status & Mode:** `status: "LIVE_1CLICK_QUOTE"`, `mode: "live_1click"`, `source: "live_api"`
- **Additional Historical Live Quote Receipt:**
  - **Quote Correlation ID:** `c09353bb-d2a1-443f-af08-bf5a6afacb9f`
  - **Deposit Address:** `0xF0Cd716bD1a6799470c506Eb8EdBa0ACceEB5BC9`
  - **Status Poll Correlation ID (`GET /v0/status`):** `8cc1f809-03b2-4de5-9d8c-28faa043f556` (`status: "PENDING_DEPOSIT"`)

### B. OutLayer Custody & Attestation API (`https://api.outlayer.ai`)
- **Implementation:** [`../backend/src/services/outlayerCustody.ts`](../backend/src/services/outlayerCustody.ts), [`../backend/src/services/outlayerService.ts`](../backend/src/services/outlayerService.ts), and [`../backend/src/services/agentApiService.ts`](../backend/src/services/agentApiService.ts)
- **Live Provisioned Custody Account (`POST https://api.outlayer.ai/register`):**
  - **Provisioned NEAR Account ID (`OUTLAYER_NEAR_ACCOUNT`):** `7cc3d2d8b5245fe4730af499fefd50267584f791ca5dec33360c5bdbe63fe24c`
  - **Secret Hygiene:** `OUTLAYER_API_KEY` is stored strictly in untracked `.env`. [`../backend/src/store/persistentStore.ts`](../backend/src/store/persistentStore.ts) strips `api_key` and redacts `?key=[REDACTED]` from `handoff_url` before writing runtime state to disk.
- **Hardware Attestation Verification (`GET https://api.outlayer.ai/attestations/by-call/{call_id}`):**
  - When a live OutLayer wallet call returns a `call_id`, the backend queries `GET /attestations/by-call/{call_id}` and records `executionStatus: "LIVE_OUTLAYER_TEE"`, `attestationSource: "live_outlayer_attestation"`, and `teeAttested: true`.
  - When running a local policy check or unfunded preview without an OutLayer `call_id`, the backend labels the response `status: "SANDBOX_PREVIEW"`, `mode: "local_policy_check"`, and `teeAttested: false`.

### C. NEAR Intents Agent API (`https://api.agentsonintents.com/v1`)
- **Implementation:** [`../backend/src/services/agentApiService.ts`](../backend/src/services/agentApiService.ts) (`syncAgentContainmentAndGrants(agentId)`)
- **Endpoints Wired:**
  - `GET https://api.agentsonintents.com/v1/agents/{agent_id}/containment`
  - `GET https://api.agentsonintents.com/v1/agents/{agent_id}/grants`
- **Behavior:** Synced on `GET /api/dashboard`, `GET /api/agent/containment`, and `POST /api/agent/procure`. If `containmentMode === "FROZEN"`, procurement execution is blocked immediately. Without `AGENT_API_KEY`, returns `status: "SANDBOX_PREVIEW"` and `mode: "local_policy_check"`.

### D. NEAR AI Cloud (`https://cloud-api.near.ai/v1`)
- **Implementation:** [`../backend/src/services/nearAiService.ts`](../backend/src/services/nearAiService.ts) (`auditProcurementWithNearAi`)
- **Endpoint Wired:** `POST https://cloud-api.near.ai/v1/chat/completions` (`model: "deepseek-ai/DeepSeek-V3-0324"`)
- **Behavior:** Evaluates procurement memos and counterparties inside `POST /api/agent/procure` for prompt-injection or anomalous spend patterns, returning `aiVerdict`, `riskScore`, `rationale`, and `inferenceId`. Without `NEAR_AI_API_KEY`, returns `status: "SANDBOX_PREVIEW"` and `mode: "local_policy_check"`.

### E. PingPay `x402` Machine-to-Machine Facilitator (`https://facilitator.pingpay.io`)
- **Implementation:** [`../backend/src/services/pingpayX402Service.ts`](../backend/src/services/pingpayX402Service.ts)
- **Endpoints Wired:**
  - `GET /api/x402/deliverable` and `GET /api/x402/audit-report` return HTTP `402 Payment Required` with an `x402Version: 1` challenge (`scheme: "exact"`, `network: "base"`, `asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"`).
  - Incoming `X-PAYMENT` headers are verified and settled via `POST https://facilitator.pingpay.io/verify` and `POST https://facilitator.pingpay.io/settle`.

---

## 3. Exact Reproduction Commands

### Step 1: Install Dependencies & Configure Environment
```bash
npm install
npm --prefix backend install
cp .env.example .env
```

### Step 2: Run the Automated Backend & Policy Verification Suites (10/10 Passing)
```bash
npm test
```
This executes [`../backend/src/tests/bitfli.test.ts`](../backend/src/tests/bitfli.test.ts) and [`../backend/src/tests/dynamic.test.ts`](../backend/src/tests/dynamic.test.ts), verifying:
1. `GET /api/health` and `GET /api/dashboard` (live NEAR RPC block height, OutLayer wallet state, `agentContainment`, and ledger-derived KPI math).
2. `POST /api/invoices` and `POST /api/invoices/:id/settle` (live `1Click` quote creation and dynamic treasury balance updates).
3. `POST /api/agent/procure` (`$65.00` `Anthropic API` approval with `policyAuditHash: "audit_sha256_..."`, `status: "SANDBOX_PREVIEW"`, `mode: "local_policy_check"`, and `nearAiAudit`).
4. `POST /api/agent/procure` (`$850.00` rogue transfer blocked by `RULE_MAX_SINGLE_TX_EXCEEDED` + `RULE_VENDOR_NOT_ALLOWLISTED`, and emergency freeze enforcement via `RULE_EMERGENCY_FREEZE_ACTIVE`).
5. `POST /api/treasury/split`, `GET /api/ledger/csv`, and `GET /api/x402/deliverable` (HTTP `402 Payment Required` challenge verification).
6. Persistent store recovery, multi-pod creation (`POST /api/pods`), gasless payment check issuance (`POST /api/checks`), `X-Idempotency-Key` replay protection, and 2-of-3 partner multisig escalation overrides.

### Step 3: Build Frontend & Backend Production Bundles
```bash
npm run build
npm --prefix backend run build
```

### Step 4: Compile & Test the NEAR Rust Smart Contract
```bash
cargo test --manifest-path contracts/Cargo.toml
RUSTFLAGS='-C target-cpu=mvp -C link-arg=-s' cargo build --manifest-path contracts/Cargo.toml --target wasm32-unknown-unknown --release
```

### Step 5: Run Full-Stack Application in Development Mode
```bash
npm run dev:all
```

---

## 4. Residual Trust Assumptions & Stated Limits

1. **Off-Chain vs. On-Chain Enforcement Boundary:** Interactive dashboard mutations (`POST /api/policy`, `POST /api/agent/procure`, `POST /api/treasury/split`) are evaluated by the Node.js policy engine and persisted to `backend/data/state.json`. While the NEAR Testnet contract (`bitfli-vault-67f5be.testnet`) enforces identical rules on-chain when called via NEAR RPC, the Express backend does not automatically relay every HTTP request into an on-chain NEAR transaction unless a funded NEAR signer key is wired into the request path.
2. **Unfunded Custody & Sandbox Settlement:** Generating a cross-chain deposit address via `POST /api/invoices` calls the live NEAR Intents `1Click` API (`https://1click.chaindefuser.com/v0/quote`). Clicking "Simulate Client Payment" (`POST /api/invoices/:id/settle`) records a sandbox ledger credit so evaluators can test downstream OpEx rules and profit-split math without depositing real mainnet assets.
3. **OutLayer Hardware Attestation Availability:** Genuine hardware enclave attestations (`GET https://api.outlayer.ai/attestations/by-call/{call_id}`) require a funded OutLayer execution call that produces a `call_id`. When no `call_id` is present (for example, during unfunded transfers or local rule pre-checks), Bitfli computes a deterministic SHA-256 policy commitment (`audit_sha256_...`) and explicitly labels the result `SANDBOX_PREVIEW` / `local_policy_check`.
4. **Partner Profit-Split Disbursements:** `POST /api/treasury/split` computes exact partner allocations (`55/30/15` default) and attempts OutLayer transfers when `OUTLAYER_API_KEY` holds sufficient balance; otherwise, it records the allocation breakdown in the local audit ledger labeled `SANDBOX_PREVIEW` / `local_policy_check`.
