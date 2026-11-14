import assert from "node:assert/strict";
import type { Server } from "node:http";
import { after, before, beforeEach, describe, it } from "node:test";
import { createApp, resetBackendStore, type DashboardSnapshot } from "../index.js";

describe("bitfli.xyz Backend & OutLayer TEE Policy Engine Verification Suite", () => {
  let server: Server;
  let baseUrl = "";

  before(async () => {
    process.env.DRY_RUN = "false";
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        const port = typeof addr === "object" && addr ? addr.port : 4000;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  beforeEach(async () => {
    await resetBackendStore();
  });

  it("1. GET /api/health & GET /api/dashboard return hydrated pod, metrics, policy, waterfall, ledger & activeDecision", async () => {
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthRes.status, 200);
    const health = (await healthRes.json()) as {
      ok: boolean;
      vault: string;
      enclave: string;
    };
    assert.equal(health.ok, true);
    assert.equal(health.vault, "pod-01.bitfli.near");
    assert.ok(health.enclave.length > 0);

    const dashRes = await fetch(`${baseUrl}/api/dashboard`);
    assert.equal(dashRes.status, 200);
    const dash = (await dashRes.json()) as DashboardSnapshot;
    assert.equal(dash.policy.podAccountId, "pod-01.bitfli.near");
    assert.equal(dash.metrics.treasuryBalanceUsd, 14820);
    assert.equal(dash.metrics.grossClientInflows30dUsd, 18500);
    assert.equal(dash.policy.maxSingleTxUsd, 150);
    assert.equal(dash.policy.dailySpendCapUsd, 500);
    assert.ok(dash.ledger.length >= 6);
    assert.ok(dash.activeDecision);
    assert.ok(dash.pod);
    assert.ok(dash.waterfall);
    assert.ok(dash.agentContainment);
    assert.ok(
      dash.agentContainment.status === "SANDBOX_PREVIEW" ||
        dash.agentContainment.status === "LIVE_AGENT_API",
    );
  });

  it("2. POST /api/invoices & POST /api/invoices/:id/settle create a 1Click quote and settle cross-chain USDC into the pod treasury", async () => {
    const createRes = await fetch(`${baseUrl}/api/invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientName: "Acme Protocol",
        amountUsd: 3200,
        sourceChain: "Ethereum ETH",
        milestoneMemo: "Milestone #04 — Cross-Chain Intents Checkout",
      }),
    });
    assert.equal(createRes.status, 201);
    const created = (await createRes.json()) as {
      invoice: { id: string; depositAddress: string; status: string; amountUsd: number };
      snapshot: DashboardSnapshot;
    };
    assert.equal(created.invoice.amountUsd, 3200);
    assert.equal(created.invoice.status, "AWAITING_DEPOSIT");
    assert.ok(created.invoice.depositAddress.startsWith("0x"));

    const settleRes = await fetch(
      `${baseUrl}/api/invoices/${encodeURIComponent(created.invoice.id)}/settle`,
      { method: "POST" },
    );
    assert.equal(settleRes.status, 200);
    const settled = (await settleRes.json()) as {
      invoice: { status: string; settledTx?: string };
      entry: { eventType: string; teeReceipt: string; amountUsd: number };
      snapshot: DashboardSnapshot;
    };

    assert.equal(settled.invoice.status, "SETTLED");
    assert.ok(settled.entry.teeReceipt.startsWith("1click_0x"));
    assert.equal(settled.entry.eventType, "INTENTS IN");
    assert.equal(settled.snapshot.metrics.treasuryBalanceUsd, 14820 + 3200);
    assert.equal(settled.snapshot.metrics.grossClientInflows30dUsd, 18500 + 3200);
  });

  it("3. POST /api/agent/procure approves valid $65 Anthropic API spend and logs honest policyAuditHash (audit_sha256_...)", async () => {
    const res = await fetch(`${baseUrl}/api/agent/procure`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentName: "Procurement Agent (pod-01)",
        counterparty: "Anthropic API",
        amountUsd: 65,
        purpose: "Claude 3.7 Sonnet inference batch via OutLayer Custody",
      }),
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      status: string;
      mode: string;
      evaluation: {
        verdict: string;
        policyAuditHash: string;
        teeAttested: boolean;
        executionStatus?: string;
        attestationSource?: string;
        teeReceipt: string;
        attestation?: { signature: string; enclaveMeasurement: string };
        nearAiAudit?: { model: string; status: string; mode: string };
        agentContainment?: { status: string; mode: string };
      };
      entry: { chainOrRail: string; policyAuditHash: string };
      snapshot: DashboardSnapshot;
    };

    assert.equal(body.evaluation.verdict, "ALLOW");
    assert.equal(body.status, "SANDBOX_PREVIEW");
    assert.equal(body.mode, "local_policy_check");
    assert.equal(body.evaluation.executionStatus, "SANDBOX_PREVIEW");
    assert.equal(body.evaluation.attestationSource, "local_policy_check");
    assert.equal(body.evaluation.nearAiAudit?.model, "deepseek-ai/DeepSeek-V3-0324");
    assert.ok(body.evaluation.agentContainment);
    assert.ok(body.evaluation.policyAuditHash.startsWith("audit_sha256_"));
    assert.ok(!body.evaluation.teeReceipt.startsWith("tee_sig_"));
    assert.equal(body.entry.chainOrRail, "OutLayer Custody · NEAR USDC");
    assert.ok(body.evaluation.attestation?.signature.startsWith("0x"));
    assert.equal(body.snapshot.policy.dailySpentTodayUsd, 185 + 65);
    assert.equal(body.snapshot.metrics.treasuryBalanceUsd, 14820 - 65);
  });

  it("4. POST /api/agent/procure blocks rogue $850 transfer (RULE_MAX_SINGLE_TX_EXCEEDED + RULE_VENDOR_NOT_ALLOWLISTED) and blocks when kill-switch freeze is active (RULE_EMERGENCY_FREEZE_ACTIVE)", async () => {
    // 4a. Rogue $850 transfer to unverified wallet
    const rogueRes = await fetch(`${baseUrl}/api/agent/procure`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentName: "Compromised Research Agent",
        counterparty: "unknown-wallet.near",
        amountUsd: 850,
        purpose: "Prompt-injected exfiltration attempt",
      }),
    });
    assert.equal(rogueRes.status, 403);
    const rogue = (await rogueRes.json()) as {
      evaluation: {
        verdict: string;
        violationCodes: string[];
        policyAuditHash: string;
        teeReceipt: string;
      };
      snapshot: DashboardSnapshot;
    };

    assert.equal(rogue.evaluation.verdict, "BLOCK");
    assert.ok(rogue.evaluation.violationCodes.includes("RULE_MAX_SINGLE_TX_EXCEEDED"));
    assert.ok(rogue.evaluation.violationCodes.includes("RULE_VENDOR_NOT_ALLOWLISTED"));
    assert.ok(rogue.evaluation.policyAuditHash.startsWith("audit_sha256_"));
    // Balance untouched
    assert.equal(rogue.snapshot.metrics.treasuryBalanceUsd, 14820);

    // 4b. Activate emergency kill-switch freeze via POST /api/policy
    const policyRes = await fetch(`${baseUrl}/api/policy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autonomousOpsActive: false }),
    });
    assert.equal(policyRes.status, 200);

    // Now even a $40 allowlisted vendor spend must block with RULE_EMERGENCY_FREEZE_ACTIVE
    const frozenRes = await fetch(`${baseUrl}/api/agent/procure`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentName: "Procurement Agent (pod-01)",
        counterparty: "Vercel Pro",
        amountUsd: 40,
        purpose: "Preview deployment bandwidth",
      }),
    });
    assert.equal(frozenRes.status, 403);
    const frozen = (await frozenRes.json()) as {
      evaluation: { verdict: string; violationCodes: string[] };
      snapshot: DashboardSnapshot;
    };
    assert.equal(frozen.evaluation.verdict, "BLOCK");
    assert.ok(frozen.evaluation.violationCodes.includes("RULE_EMERGENCY_FREEZE_ACTIVE"));
    assert.equal(frozen.snapshot.metrics.treasuryBalanceUsd, 14820);
  });

  it("5. POST /api/treasury/split executes partner profit-split waterfall math and GET /api/ledger/csv exports valid audit CSV", async () => {
    const splitRes = await fetch(`${baseUrl}/api/treasury/split`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        distributionAmountUsd: 4000,
      }),
    });
    assert.equal(splitRes.status, 200);
    const splitBody = (await splitRes.json()) as {
      evaluation: { verdict: string; teeReceipt: string; taskAmountUsd: number };
      breakdown: {
        totalSplitUsd: number;
        leadDevUsd: number;
        designPartnerUsd: number;
        taxReserveUsd: number;
      };
      snapshot: DashboardSnapshot;
    };

    assert.equal(splitBody.evaluation.verdict, "ALLOW");
    assert.ok(splitBody.evaluation.teeReceipt.startsWith("audit_sha256_"));
    // Default 55 / 30 / 15 split of $4,000 -> $2,200 Lead Dev, $1,200 Design Partner, $600 Tax Reserve
    assert.equal(splitBody.breakdown.totalSplitUsd, 4000);
    assert.equal(splitBody.breakdown.leadDevUsd, 2200);
    assert.equal(splitBody.breakdown.designPartnerUsd, 1200);
    assert.equal(splitBody.breakdown.taxReserveUsd, 600);

    // Verify GET /api/ledger/csv
    const csvRes = await fetch(`${baseUrl}/api/ledger/csv`);
    assert.equal(csvRes.status, 200);
    assert.match(csvRes.headers.get("content-type") ?? "", /text\/csv/);
    assert.match(
      csvRes.headers.get("content-disposition") ?? "",
      /bitfli-audit-ledger\.csv/,
    );
    const csvText = await csvRes.text();
    const lines = csvText.trim().split(/\r?\n/);
    assert.equal(
      lines[0],
      "Timestamp,Event,Counterparty,Route,Amount_USD,Status,TEE_Receipt_Or_Tx",
    );
    assert.ok(lines.length >= 7);

    // Verify GET /api/x402/deliverable returns HTTP 402 Payment Required challenge
    const x402Res = await fetch(`${baseUrl}/api/x402/deliverable`);
    assert.equal(x402Res.status, 402);
    const x402Challenge = (await x402Res.json()) as {
      x402Version: number;
      accepts: Array<{
        scheme: string;
        network: string;
        asset: string;
        payTo: string;
        maxAmountRequired: string;
        resource: string;
      }>;
    };
    assert.equal(x402Challenge.x402Version, 1);
    assert.equal(x402Challenge.accepts[0].scheme, "exact");
    assert.equal(x402Challenge.accepts[0].network, "base");
    assert.equal(x402Challenge.accepts[0].resource, "/api/x402/deliverable");
    assert.equal(
      x402Challenge.accepts[0].asset,
      "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    );
  });
});
