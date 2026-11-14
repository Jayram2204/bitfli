import assert from "node:assert/strict";
import fs from "node:fs";
import type { Server } from "node:http";
import { after, before, beforeEach, describe, it } from "node:test";
import {
  createApp,
  resetBackendStore,
  type DashboardSnapshot,
} from "../index.js";
import { STATE_FILE_PATH } from "../store/persistentStore.js";

describe("bitfli.xyz 100% Dynamic Architecture & Persistent Store Verification Suite", () => {
  let server: Server;
  let baseUrl = "";

  before(async () => {
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

  it("1. Persists state to backend/data/state.json and exposes live NEAR RPC block height + OutLayer handoff_url via GET /api/health", async () => {
    assert.equal(fs.existsSync(STATE_FILE_PATH), true);

    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthRes.status, 200);
    const health = (await healthRes.json()) as {
      ok: boolean;
      mode: string;
      vault: string;
      nearBlockHeight: number;
      handoff_url: string;
    };
    assert.equal(health.ok, true);
    assert.equal(health.mode, "LIVE_APIS + SANDBOX_SETTLEMENT");
    assert.equal(health.vault, "pod-01.bitfli.near");
    assert.ok(health.nearBlockHeight > 100_000_000);
    assert.ok(health.handoff_url.startsWith("https://app.outlayer.ai/"));
  });

  it("2. Recomputes all dashboard KPIs mathematically from the ledger on invoice settlement, agent procurement, and profit split", async () => {
    // Initial dashboard check
    const dash0 = (await (
      await fetch(`${baseUrl}/api/dashboard`)
    ).json()) as DashboardSnapshot;
    const initialTreasury = dash0.metrics.treasuryBalanceUsd;
    const initialInflows = dash0.metrics.grossClientInflowsUsd!;
    const initialNetProfit = dash0.metrics.netDistributableProfitUsd;

    // Create and settle a $1,500 cross-chain invoice
    const invRes = await fetch(`${baseUrl}/api/invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientName: "Dynamic Studio Client",
        amountUsd: 1500,
        sourceChain: "Solana SOL",
        milestoneMemo: "Dynamic Verification Milestone",
      }),
    });
    const { invoice } = (await invRes.json()) as {
      invoice: { id: string; depositAddress: string };
    };

    // Check 1Click deposit status endpoint
    const statusRes = await fetch(
      `${baseUrl}/api/invoices/${encodeURIComponent(invoice.id)}/status`,
      { method: "POST" },
    );
    assert.equal(statusRes.status, 200);

    // Settle invoice
    const settleRes = await fetch(
      `${baseUrl}/api/invoices/${encodeURIComponent(invoice.id)}/settle`,
      { method: "POST" },
    );
    const settled = (await settleRes.json()) as { snapshot: DashboardSnapshot };
    assert.equal(
      settled.snapshot.metrics.treasuryBalanceUsd,
      initialTreasury + 1500,
    );
    assert.equal(
      settled.snapshot.metrics.grossClientInflowsUsd,
      initialInflows + 1500,
    );
    assert.equal(
      settled.snapshot.metrics.netDistributableProfitUsd,
      initialNetProfit + 1500,
    );
  });

  it("3. Enforces RULE_KILL_SWITCH_FROZEN when autonomousOpsActive is toggled off and blocks unapproved vendors or over-cap spend", async () => {
    // Toggle Kill Switch OFF
    await fetch(`${baseUrl}/api/policy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autonomousOpsActive: false }),
    });

    const blockedFreezeRes = await fetch(`${baseUrl}/api/agent/procure`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vendorName: "Anthropic API",
        amountUsd: 50,
        reason: "Should block under kill switch",
      }),
    });
    const blockedFreeze = (await blockedFreezeRes.json()) as {
      evaluation: { verdict: string; violationCodes: string[] };
    };
    assert.equal(blockedFreeze.evaluation.verdict, "BLOCK");
    assert.ok(
      blockedFreeze.evaluation.violationCodes.includes(
        "RULE_KILL_SWITCH_FROZEN",
      ),
    );

    // Re-enable Autonomous Ops and add a custom vendor "Supabase Pro"
    await fetch(`${baseUrl}/api/policy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        autonomousOpsActive: true,
        approvedVendors: ["Anthropic API", "Supabase Pro"],
      }),
    });

    const allowedCustomRes = await fetch(`${baseUrl}/api/agent/procure`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vendorName: "Supabase Pro",
        amountUsd: 45,
        reason: "Database vector indexing",
      }),
    });
    const allowedCustom = (await allowedCustomRes.json()) as {
      evaluation: {
        verdict: string;
        attestation: { nearBlockHeight: number; signature: string };
      };
    };
    assert.equal(allowedCustom.evaluation.verdict, "ALLOW");
    assert.ok(allowedCustom.evaluation.attestation.nearBlockHeight > 0);
    assert.ok(allowedCustom.evaluation.attestation.signature.startsWith("0x"));
  });

  it("4. Launches a brand-new Agency Pod via POST /api/pods and persists it in state.json", async () => {
    const podRes = await fetch(`${baseUrl}/api/pods`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        podAccountId: "pod-99.bitfli.near",
        podDisplayName: "Hyperion AI Pod #99",
        maxSingleTxUsd: 250,
        partnerWallets: {
          leadDev: "alex.near",
          designPartner: "mina.sol",
          taxReserve: "reserve-99.bitfli.near",
        },
      }),
    });
    assert.equal(podRes.status, 200);
    const snapshot = (await podRes.json()) as DashboardSnapshot;
    assert.equal(snapshot.policy.podAccountId, "pod-99.bitfli.near");
    assert.equal(snapshot.policy.maxSingleTxUsd, 250);
    assert.ok(
      snapshot.pods.some((p) => p.podAccountId === "pod-99.bitfli.near"),
    );
  });

  it("5. Issues OutLayer Gasless Payment Checks (POST /api/checks), enforces X-Idempotency-Key replay protection, and supports 2-of-3 Partner Multisig Escalation", async () => {
    const dashBefore = (await (
      await fetch(`${baseUrl}/api/dashboard`)
    ).json()) as DashboardSnapshot;
    const initialTreasury = dashBefore.metrics.treasuryBalanceUsd;

    // 5a. Issue a $90 Gasless Payment Check with X-Idempotency-Key
    const idemKey = "test-idem-check-001";
    const checkRes1 = await fetch(`${baseUrl}/api/checks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Idempotency-Key": idemKey,
      },
      body: JSON.stringify({
        payeeLabel: "Elena Vance · Motion & SVG Systems",
        amountUsd: 90,
        memo: "Sub-contractor shader milestone",
      }),
    });
    assert.equal(checkRes1.status, 201);
    const checkBody1 = (await checkRes1.json()) as {
      check: { id: string; claimUrl: string; amountUsd: number };
      snapshot: DashboardSnapshot;
    };
    assert.ok(checkBody1.check.claimUrl.startsWith("https://bitfli.xyz/claim/CHK-"));
    assert.equal(
      checkBody1.snapshot.metrics.treasuryBalanceUsd,
      initialTreasury - 90,
    );

    // 5b. Replay the exact same POST /api/checks with the same X-Idempotency-Key -> must NOT deduct again
    const checkRes2 = await fetch(`${baseUrl}/api/checks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Idempotency-Key": idemKey,
      },
      body: JSON.stringify({
        payeeLabel: "Elena Vance · Motion & SVG Systems",
        amountUsd: 90,
        memo: "Sub-contractor shader milestone",
      }),
    });
    assert.equal(checkRes2.status, 201);
    assert.equal(checkRes2.headers.get("x-idempotency-replayed"), "true");
    const dashAfterReplay = (await (
      await fetch(`${baseUrl}/api/dashboard`)
    ).json()) as DashboardSnapshot;
    assert.equal(dashAfterReplay.metrics.treasuryBalanceUsd, initialTreasury - 90);

    // 5c. 2-of-3 Partner Multisig Escalation on $850 high-value spend (exceeding $150 single-tx cap)
    const msigRes = await fetch(`${baseUrl}/api/agent/procure`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentName: "Infra Provisioner Agent",
        counterparty: "AWS Cloud",
        amountUsd: 850,
        purpose: "Dedicated H100 training reservation",
        multisigOverride: {
          enabled: true,
          signers: [
            "Lead Dev (maya-dev.near)",
            "Design Partner (sora-design.sol)",
          ],
        },
      }),
    });
    assert.equal(msigRes.status, 200);
    const msigBody = (await msigRes.json()) as {
      evaluation: { verdict: string; scenarioKey: string };
      snapshot: DashboardSnapshot;
    };
    assert.equal(msigBody.evaluation.verdict, "ALLOW");
    assert.equal(msigBody.evaluation.scenarioKey, "multisig-2-of-3-override");
    assert.equal(
      msigBody.snapshot.metrics.treasuryBalanceUsd,
      initialTreasury - 90 - 850,
    );
  });
});
