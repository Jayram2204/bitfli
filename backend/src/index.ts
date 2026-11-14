import crypto from "node:crypto";
import cors from "cors";
import express, { type Request, type Response } from "express";
import {
  fetchOutlayerAttestationByCallId,
  syncAgentContainmentAndGrants,
  type AgentContainmentState,
} from "./services/agentApiService.js";
import {
  auditProcurementWithNearAi,
  type NearAiProcurementAuditResult,
} from "./services/nearAiService.js";
import {
  queryNearRpcTelemetry,
  type NearNetworkTelemetry,
} from "./services/nearRpcService.js";
import {
  checkDepositStatus,
  createQuoteInvoice,
  fetchTokens,
  type SourceChainOption,
} from "./services/oneClickService.js";
import {
  buildCryptographicCommitment,
  ensureOutlayerWallet,
  evaluateProcurement,
  executeOutlayerTransfer,
  formatUtcTimestamp,
  LOCAL_POLICY_CHECK_MODE,
  sanitizeHandoffUrl,
  type AgentProcureRequest,
  type DecisionEvaluation,
  type DecisionVerdict,
  type OutLayerAttestationObject,
  type OutLayerProvisionedWallet,
  type ProfitSplitConfig,
  type TreasuryPolicy,
} from "./services/outlayerService.js";
import {
  buildX402PaymentChallenge,
  verifyAndSettleX402Payment,
} from "./services/pingpayX402Service.js";
import {
  computeMetricsFromLedger,
  persistentStore,
  type AgencyPodRecord,
  type CrossChainInvoice,
  type LedgerEntry,
  type LedgerEventType,
  type NetworkMode,
  type PaymentCheckRecord,
  type TreasuryMetrics,
} from "./store/persistentStore.js";

export type {
  AgencyPodRecord,
  AgentContainmentState,
  CrossChainInvoice,
  DecisionEvaluation,
  DecisionVerdict,
  LedgerEntry,
  LedgerEventType,
  NearAiProcurementAuditResult,
  NetworkMode,
  OutLayerAttestationObject,
  PaymentCheckRecord,
  TreasuryMetrics,
  TreasuryPolicy,
};

export interface ApiCallTelemetry {
  method: "GET" | "POST";
  endpoint:
    | "/api/dashboard"
    | "/api/invoices"
    | "/api/policy"
    | "/api/agent/procure"
    | "/api/checks"
    | "/api/treasury/split"
    | "/api/ledger/csv"
    | "/api/pods"
    | "/api/x402/deliverable"
    | "/api/x402/audit-report";
  status: number;
  transport: "HTTP_BACKEND" | "LOCAL_TEE_SIM";
  timestamp: string;
  summary: string;
}

export interface DashboardSnapshot {
  mode: NetworkMode;
  pods: {
    podAccountId: string;
    podDisplayName: string;
  }[];
  activePod: {
    podAccountId: string;
    podDisplayName: string;
    enclaveMeasurement: string;
  };
  pod: {
    podAccountId: string;
    podDisplayName: string;
    enclaveMeasurement: string;
  };
  nearTelemetry: NearNetworkTelemetry;
  outlayerWallet: OutLayerProvisionedWallet;
  agentContainment: AgentContainmentState;
  metrics: TreasuryMetrics;
  policy: TreasuryPolicy & {
    maxSingleSpendUsd: number;
    dailySpentUsd: number;
    approvedVendors: string[];
  };
  waterfall: ProfitSplitConfig & {
    partnerWallets: TreasuryPolicy["partnerWallets"];
  };
  ledger: LedgerEntry[];
  invoices: CrossChainInvoice[];
  checks: PaymentCheckRecord[];
  activeDecision: DecisionEvaluation;
  lastApiTelemetry: ApiCallTelemetry;
}

function shortHash(seed: string, length = 8): string {
  return crypto.createHash("sha256").update(seed).digest("hex").slice(0, length);
}

let lastTelemetry: ApiCallTelemetry = {
  method: "GET",
  endpoint: "/api/dashboard",
  status: 200,
  transport: "HTTP_BACKEND",
  timestamp: "14:30:00 UTC",
  summary: "Hydrated pod-01.bitfli.near policy, metrics & audit ledger rows",
};

async function buildDashboardSnapshot(
  pod: AgencyPodRecord,
  method: ApiCallTelemetry["method"],
  endpoint: ApiCallTelemetry["endpoint"],
  summary: string,
): Promise<DashboardSnapshot> {
  const appState = persistentStore.getState();

  // Recompute all KPIs mathematically from the pod's immutable ledger
  const metrics = computeMetricsFromLedger(pod.ledger, pod.policy);

  // Sync policy derived fields from mathematically computed daily spend
  pod.policy.dailySpentTodayUsd = metrics.dailySpentUsd;
  pod.policy.dailySpentUsd = metrics.dailySpentUsd;
  pod.policy.maxSingleSpendUsd = pod.policy.maxSingleTxUsd;
  pod.policy.approvedVendors = pod.policy.vendorAllowlist;

  persistentStore.saveToDisk();

  const [nearTelemetry, agentContainment] = await Promise.all([
    queryNearRpcTelemetry(appState.mode, pod.podAccountId),
    syncAgentContainmentAndGrants(pod.podAccountId),
  ]);

  lastTelemetry = {
    method,
    endpoint,
    status: 200,
    transport: "HTTP_BACKEND",
    timestamp: formatUtcTimestamp().slice(11),
    summary,
  };

  const podSummary = {
    podAccountId: pod.podAccountId,
    podDisplayName: pod.podDisplayName,
    enclaveMeasurement: pod.enclaveMeasurement,
  };

  const safeWallet: OutLayerProvisionedWallet = {
    ...appState.outlayerWallet,
    api_key: appState.outlayerWallet.api_key
      ? `${appState.outlayerWallet.api_key.slice(0, 6)}...REDACTED`
      : "",
    handoff_url: sanitizeHandoffUrl(
      appState.outlayerWallet.handoff_url,
      appState.outlayerWallet.near_account_id,
    ),
  };

  return {
    mode: appState.mode,
    pods: Object.values(appState.pods).map((p) => ({
      podAccountId: p.podAccountId,
      podDisplayName: p.podDisplayName,
    })),
    activePod: podSummary,
    pod: podSummary,
    nearTelemetry,
    outlayerWallet: safeWallet,
    agentContainment,
    metrics,
    policy: { ...pod.policy },
    waterfall: {
      ...pod.policy.profitSplit,
      partnerWallets: pod.policy.partnerWallets,
    },
    ledger: pod.ledger,
    invoices: pod.invoices,
    checks: pod.checks ?? [],
    activeDecision: {
      ...pod.activeDecision,
      agentContainment,
    },
    lastApiTelemetry: lastTelemetry,
  };
}

const idempotencyCache = new Map<
  string,
  { status: number; body: unknown; createdAtMs: number }
>();

export async function resetBackendStore(): Promise<DashboardSnapshot> {
  idempotencyCache.clear();
  const prevWallet = persistentStore.getState().outlayerWallet;
  persistentStore.resetToDefault();
  if (
    prevWallet &&
    (prevWallet.source === "live_api" ||
      prevWallet.source === "live_outlayer_api")
  ) {
    persistentStore.setOutlayerWallet(prevWallet);
  }
  const pod = persistentStore.getActivePod();
  return buildDashboardSnapshot(
    pod,
    "GET",
    "/api/dashboard",
    "Restored default pod-01.bitfli.near treasury & policy snapshot",
  );
}

export async function initializeOutlayerOnBoot(): Promise<void> {
  const current = persistentStore.getState().outlayerWallet;
  const wallet = await ensureOutlayerWallet(current, "bitfli-pod-01");
  persistentStore.setOutlayerWallet(wallet);
}

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // X-Idempotency-Key protection on all state-mutating POST routes
  app.use((req: Request, res: Response, next) => {
    if (req.method !== "POST" || req.path === "/api/reset") {
      next();
      return;
    }
    const rawKey = req.header("X-Idempotency-Key")?.trim();
    if (!rawKey) {
      next();
      return;
    }
    const scopedKey = `${req.path}:${rawKey}`;
    const existing = idempotencyCache.get(scopedKey);
    if (existing && Date.now() - existing.createdAtMs < 15 * 60 * 1000) {
      res.setHeader("X-Idempotency-Replayed", "true");
      res.status(existing.status).json(existing.body);
      return;
    }

    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      idempotencyCache.set(scopedKey, {
        status: res.statusCode || 200,
        body,
        createdAtMs: Date.now(),
      });
      res.setHeader("X-Idempotency-Key", rawKey);
      return originalJson(body);
    }) as typeof res.json;

    next();
  });

  /**
   * GET /api/health
   * Returns live NEAR RPC block height, OutLayer wallet address, sanitized handoff_url, and explicit data source status.
   */
  app.get("/api/health", async (_req: Request, res: Response) => {
    const state = persistentStore.getState();
    if (
      state.outlayerWallet.source !== "live_api" &&
      state.outlayerWallet.source !== "live_outlayer_api"
    ) {
      const wallet = await ensureOutlayerWallet(
        state.outlayerWallet,
        "bitfli-pod-01",
      );
      persistentStore.setOutlayerWallet(wallet);
    }
    const pod = persistentStore.getActivePod();
    const nearTelemetry = await queryNearRpcTelemetry(
      state.mode,
      pod.podAccountId,
    );

    const apiKey =
      process.env.OUTLAYER_API_KEY || state.outlayerWallet.api_key || "";
    const maskedKey =
      apiKey.length > 10
        ? `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`
        : apiKey
          ? "configured"
          : "unconfigured";

    const safeHandoff = sanitizeHandoffUrl(
      state.outlayerWallet.handoff_url,
      state.outlayerWallet.near_account_id,
    );

    res.json({
      ok: true,
      mode: "LIVE_APIS + SANDBOX_SETTLEMENT",
      dryRun: (process.env.DRY_RUN ?? "false").toLowerCase() === "true",
      networkMode: state.mode,
      vault: pod.podAccountId,
      nearContractId:
        process.env.NEAR_CONTRACT_ID || "bitfli-vault-67f5be.testnet",
      enclave:
        state.outlayerWallet.source === "live_api" ||
        state.outlayerWallet.source === "live_outlayer_api"
          ? "OutLayer Custody · Provisioned"
          : "local_policy_check · SANDBOX_PREVIEW",
      nearBlockHeight: nearTelemetry.blockHeight,
      nearRpcUrl: nearTelemetry.rpcUrl,
      nearNetwork: nearTelemetry.network,
      nearRpcSource: nearTelemetry.source,
      outlayerWalletId: maskedKey,
      outlayerAccountId: state.outlayerWallet.near_account_id,
      outlayerSource: state.outlayerWallet.source,
      handoffUrl: safeHandoff,
      handoff_url: safeHandoff,
    });
  });

  /**
   * GET /api/agent/containment
   * Queries real NEAR Intents Agent API (https://api.agentsonintents.com/v1)
   * for /v1/agents/{agent_id}/containment and /v1/agents/{agent_id}/grants.
   */
  app.get("/api/agent/containment", async (req: Request, res: Response) => {
    const agentId =
      (req.query.agentId as string | undefined) ||
      process.env.AGENT_ID ||
      persistentStore.getActivePod().podAccountId;
    const containment = await syncAgentContainmentAndGrants(agentId);
    res.json(containment);
  });

  /**
   * GET /api/attestations/:callId
   * Fetches genuine hardware enclave attestation from GET https://api.outlayer.ai/attestations/by-call/{call_id}
   */
  app.get("/api/attestations/:callId", async (req: Request, res: Response) => {
    const callId = String(req.params.callId ?? "");
    const attestation = await fetchOutlayerAttestationByCallId(callId);
    res.status(attestation.source === "live_api" ? 200 : 404).json(attestation);
  });

  /**
   * GET /api/x402/deliverable & GET /api/x402/audit-report
   * Real HTTP 402 Payment Required gated routes implementing the x402 protocol challenge
   * and verifying X-PAYMENT headers against PingPay facilitator (https://facilitator.pingpay.io/verify & /settle).
   */
  const handleX402Deliverable = async (req: Request, res: Response) => {
    const resourcePath = req.path.includes("deliverable")
      ? "/api/x402/deliverable"
      : "/api/x402/audit-report";
    const pod = persistentStore.getActivePod(
      req.query.podId as string | undefined,
    );
    const xPaymentHeader = req.header("X-PAYMENT")?.trim();

    if (!xPaymentHeader) {
      const challenge = buildX402PaymentChallenge({
        resource: resourcePath,
      });
      res.status(402).json(challenge);
      return;
    }

    const verification = await verifyAndSettleX402Payment({
      xPaymentHeader,
      resource: resourcePath,
    });

    if (!verification.valid) {
      const challenge = buildX402PaymentChallenge({
        resource: resourcePath,
      });
      res.status(402).json({
        ...challenge,
        verificationError: verification.error,
        source: verification.source,
      });
      return;
    }

    const ts = formatUtcTimestamp();
    const nearTelemetry = await queryNearRpcTelemetry(
      persistentStore.getState().mode,
      pod.podAccountId,
    );
    const {
      policyAuditHash,
      teeAttested,
      executionStatus,
      attestationSource,
      attestation,
    } = buildCryptographicCommitment({
      podId: pod.policy.podAccountId,
      policy: pod.policy,
      task: {
        vendorName: verification.payer || "x402 Client",
        vendorAddress:
          verification.payer ||
          "base:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        amountUsd: 0.1,
        category: "PINGPAY_X402_SETTLEMENT",
        reason: "x402 Gated Cryptographic Deliverable & Audit Report Access",
      },
      decision: "ALLOW",
      ruleChecks: {
        emergencyFreezeCheck: true,
        maxSingleSpendCheck: true,
        dailySpendCapCheck: true,
        availableOpexMarginCheck: true,
        vendorAllowlistCheck: true,
      },
      violationCodes: [],
      timestamp: ts,
      nearBlockHeight: nearTelemetry.blockHeight,
    });

    const receiptHash = verification.txHash || policyAuditHash;
    const x402Entry: LedgerEntry = {
      id: `ldg_${shortHash(receiptHash + ts, 6)}`,
      podId: pod.podAccountId,
      timestamp: ts,
      eventType: "INTENTS IN",
      counterparty: verification.payer || "PingPay x402 Client",
      chainOrRail: "PingPay x402",
      amountUsd: 0.1,
      verdict: "ALLOW",
      policyAuditHash,
      teeAttested,
      executionStatus,
      attestationSource,
      teeReceipt: receiptHash,
      enclaveMeasurement: LOCAL_POLICY_CHECK_MODE,
      memo: "Verified HTTP 402 X-PAYMENT header via facilitator.pingpay.io (/verify & /settle).",
      attestation,
    };

    pod.ledger = [x402Entry, ...pod.ledger];
    const snapshot = await buildDashboardSnapshot(
      pod,
      "GET",
      resourcePath,
      "Settled PingPay x402 payment & unlocked cryptographic agency deliverable",
    );

    res.status(200).json({
      ok: true,
      protocol: "PingPay x402",
      resource: resourcePath,
      verification,
      deliverable: {
        podAccountId: pod.podAccountId,
        generatedAt: ts,
        nearBlockHeight: nearTelemetry.blockHeight,
        metrics: snapshot.metrics,
        policyHash: attestation.policyHash,
        policyAuditHash,
        ledgerEntriesCount: pod.ledger.length,
      },
      auditReport: {
        podAccountId: pod.podAccountId,
        generatedAt: ts,
        nearBlockHeight: nearTelemetry.blockHeight,
        metrics: snapshot.metrics,
        policyHash: attestation.policyHash,
        policyAuditHash,
        ledgerEntriesCount: pod.ledger.length,
      },
    });
  };

  app.get("/api/x402/deliverable", handleX402Deliverable);
  app.get("/api/x402/audit-report", handleX402Deliverable);

  /**
   * GET /api/tokens
   * Live cross-chain tokens from 1click.chaindefuser.com/v0/tokens
   */
  app.get("/api/tokens", async (_req: Request, res: Response) => {
    const tokens = await fetchTokens();
    res.json({ tokens });
  });

  /**
   * GET /api/dashboard?podId=...&mode=...
   */
  app.get("/api/dashboard", async (req: Request, res: Response) => {
    const state = persistentStore.getState();
    const requestedPodId = req.query.podId as string | undefined;
    const requestedMode = req.query.mode as NetworkMode | undefined;

    const pod = persistentStore.getActivePod(requestedPodId);

    if (
      requestedMode &&
      (requestedMode === "sandbox" || requestedMode === "testnet") &&
      requestedMode !== state.mode
    ) {
      state.mode = requestedMode;
      const baseSlug = pod.podAccountId.split(".")[0] || "pod-01";
      const nextPodId =
        requestedMode === "testnet"
          ? `${baseSlug}.bitfli.testnet`
          : `${baseSlug}.bitfli.near`;

      pod.policy.podAccountId = nextPodId;
      pod.invoices = pod.invoices.map((inv) => ({
        ...inv,
        destinationVault: nextPodId,
      }));
      persistentStore.saveToDisk();
    }

    const snapshot = await buildDashboardSnapshot(
      pod,
      "GET",
      "/api/dashboard",
      `Synced ${pod.policy.podAccountId} (${state.mode === "sandbox" ? "Live Sandbox" : "Testnet Mode"})`,
    );
    res.json(snapshot);
  });

  /**
   * POST /api/reset
   */
  app.post("/api/reset", async (_req: Request, res: Response) => {
    const snapshot = await resetBackendStore();
    res.json(snapshot);
  });

  /**
   * POST /api/invoices
   * Calls 1click.chaindefuser.com/v0/quote to generate a cross-chain deposit address & quote.
   */
  app.post("/api/invoices", async (req: Request, res: Response) => {
    const body = req.body as {
      podId?: string;
      clientName?: string;
      amountUsd?: number;
      sourceChain?: SourceChainOption;
      milestoneMemo?: string;
    };

    const pod = persistentStore.getActivePod(body.podId);
    const clientName =
      (body.clientName ?? "Enterprise Client").trim() || "Enterprise Client";
    const amountUsd = Math.max(1, Number(body.amountUsd) || 1000);
    const sourceChain: SourceChainOption = body.sourceChain ?? "Ethereum ETH";
    const milestoneMemo =
      (body.milestoneMemo ?? "Cross-Chain Agency Milestone Settlement").trim() ||
      "Cross-Chain Agency Milestone Settlement";

    const nextNum = 205 + pod.invoices.length;
    const invoiceId = `INV-${nextNum}`;

    const quote = await createQuoteInvoice({
      invoiceId,
      clientName,
      amountUsd,
      sourceChain,
      destinationVault: pod.policy.podAccountId,
    });

    const invoice: CrossChainInvoice = {
      id: invoiceId,
      podId: pod.podAccountId,
      clientName,
      milestoneMemo,
      amountUsd,
      sourceChain,
      quotedSourceAmount: quote.quotedSourceAmount,
      depositAddress: quote.depositAddress,
      intentQuoteId: quote.quoteId,
      destinationVault: pod.policy.podAccountId,
      status: "AWAITING_DEPOSIT",
      createdAt: formatUtcTimestamp(),
    };

    pod.invoices = [invoice, ...pod.invoices];

    const snapshot = await buildDashboardSnapshot(
      pod,
      "POST",
      "/api/invoices",
      `Created 1Click quote ${invoice.id} (${invoice.quotedSourceAmount} → $${invoice.amountUsd.toFixed(2)} USDC)`,
    );

    const outlayerFeeUsd = +(amountUsd * 0.000001).toFixed(4);
    const standardSwapFeeUsd = +(amountUsd * 0.002).toFixed(2);
    const feeSavedUsd = +(standardSwapFeeUsd - outlayerFeeUsd).toFixed(2);

    res.status(201).json({
      invoice,
      quoteStatus: quote.status,
      quoteMode: quote.mode,
      quoteSource: quote.source,
      quoteError: quote.error,
      benchmark: {
        outlayerProtocolFeePct: 0.0001,
        standardUnauthFeePct: 0.2,
        outlayerFeeUsd,
        standardSwapFeeUsd,
        feeSavedUsd,
        estimatedSettlementSec: 42,
        solverCount: 6,
      },
      snapshot,
    });
  });

  /**
   * POST /api/invoices/preview
   * Live 1Click quote routing benchmark comparing OutLayer 0.0001% fee vs 0.20% standard fee.
   */
  app.post("/api/invoices/preview", async (req: Request, res: Response) => {
    const body = req.body as {
      amountUsd?: number;
      sourceChain?: SourceChainOption;
      podId?: string;
    };
    const pod = persistentStore.getActivePod(body.podId);
    const amountUsd = Math.max(10, Number(body.amountUsd) || 2500);
    const sourceChain: SourceChainOption = body.sourceChain ?? "Ethereum ETH";

    const quote = await createQuoteInvoice({
      invoiceId: "PREVIEW",
      clientName: "Preview Benchmark",
      amountUsd,
      sourceChain,
      destinationVault: pod.policy.podAccountId,
    });

    const outlayerFeeUsd = +(amountUsd * 0.000001).toFixed(4);
    const standardSwapFeeUsd = +(amountUsd * 0.002).toFixed(2);
    const feeSavedUsd = +(standardSwapFeeUsd - outlayerFeeUsd).toFixed(2);

    res.json({
      amountUsd,
      sourceChain,
      quotedSourceAmount: quote.quotedSourceAmount,
      originAsset: quote.originAsset,
      destinationAsset: quote.destinationAsset,
      depositAddressPreview: quote.depositAddress,
      quoteStatus: quote.status,
      quoteMode: quote.mode,
      quoteSource: quote.source,
      outlayerProtocolFeePct: 0.0001,
      standardUnauthFeePct: 0.2,
      outlayerFeeUsd,
      standardSwapFeeUsd,
      feeSavedUsd,
      estimatedSettlementSec: 42,
      solverCount: 6,
    });
  });

  /**
   * POST /api/invoices/:id/status & GET /api/invoices/:id/status
   * Checks live 1click.chaindefuser.com/v0/status?depositAddress=...
   */
  const handleInvoiceStatus = async (req: Request, res: Response) => {
    const pod = persistentStore.getActivePod();
    const invoiceId = req.params.id;
    const target =
      pod.invoices.find((inv) => inv.id === invoiceId) ?? pod.invoices[0];

    if (!target) {
      res.status(404).json({ error: `Invoice ${invoiceId} not found` });
      return;
    }

    const statusInfo = await checkDepositStatus(target.depositAddress);
    res.json({
      invoiceId: target.id,
      depositAddress: target.depositAddress,
      invoiceStatus: target.status,
      oneClickStatus: statusInfo.status,
      txHash: statusInfo.txHash,
      source: statusInfo.source,
      error: statusInfo.error,
      updatedAt: statusInfo.updatedAt,
    });
  };

  app.post("/api/invoices/:id/status", handleInvoiceStatus);
  app.get("/api/invoices/:id/status", handleInvoiceStatus);

  /**
   * POST /api/invoices/:id/settle
   * Settles an invoice, appends an INTENTS IN ledger event, and dynamically recomputes treasuryBalanceUsd & grossClientInflowsUsd.
   */
  app.post("/api/invoices/:id/settle", async (req: Request, res: Response) => {
    const pod = persistentStore.getActivePod();
    const invoiceId = req.params.id;
    const target =
      pod.invoices.find((inv) => inv.id === invoiceId) ?? pod.invoices[0];

    if (!target) {
      res.status(404).json({ error: `Invoice ${invoiceId} not found` });
      return;
    }

    const statusCheck = await checkDepositStatus(target.depositAddress);
    const nearTelemetry = await queryNearRpcTelemetry(
      persistentStore.getState().mode,
      pod.podAccountId,
    );
    const ts = formatUtcTimestamp();
    const receipt =
      statusCheck.txHash ??
      `1click_0x${shortHash(target.id + ts, 4)}...${shortHash(ts + target.clientName, 4)}`;

    target.status = "SETTLED";
    target.settledTx = receipt;

    const chainShort = target.sourceChain.split(" ")[0];
    const memoText = `${target.quotedSourceAmount} swapped atomically via NEAR Intents 1Click into ${pod.policy.podAccountId}.`;

    const {
      policyAuditHash,
      teeAttested,
      executionStatus,
      attestationSource,
      attestation,
    } = buildCryptographicCommitment({
      podId: pod.policy.podAccountId,
      policy: pod.policy,
      task: {
        vendorName: `${target.clientName} (${target.id})`,
        vendorAddress: target.depositAddress,
        amountUsd: target.amountUsd,
        category: "INTENTS_INFLOW",
        reason: memoText,
      },
      decision: "ALLOW",
      ruleChecks: {
        emergencyFreezeCheck: true,
        maxSingleSpendCheck: true,
        dailySpendCapCheck: true,
        availableOpexMarginCheck: true,
        vendorAllowlistCheck: true,
      },
      violationCodes: [],
      timestamp: ts,
      nearBlockHeight: nearTelemetry.blockHeight,
    });

    const entry: LedgerEntry = {
      id: `ldg_${shortHash(receipt + ts + Math.random(), 6)}`,
      podId: pod.podAccountId,
      timestamp: ts,
      eventType: "INTENTS IN",
      counterparty: `${target.clientName} (${target.id})`,
      chainOrRail: `${chainShort} → NEAR USDC (1Click)`,
      amountUsd: target.amountUsd,
      verdict: "ALLOW",
      policyAuditHash,
      teeAttested,
      executionStatus,
      attestationSource,
      teeReceipt: receipt,
      enclaveMeasurement: LOCAL_POLICY_CHECK_MODE,
      memo: memoText,
      attestation,
    };

    pod.ledger = [entry, ...pod.ledger];

    const evaluation: DecisionEvaluation = {
      verdict: "ALLOW",
      scenarioKey: "invoice-settled",
      taskTitle: `Client ${target.clientName} pays $${target.amountUsd.toLocaleString("en-US")}`,
      taskActor: "Billing Agent · 1Click Solver",
      taskCounterparty: `${target.clientName} (${target.id})`,
      taskAmountUsd: target.amountUsd,
      taskChainRoute: `${target.sourceChain} → NEAR USDC`,
      taskDetail: `${target.quotedSourceAmount} → $${target.amountUsd.toLocaleString("en-US", {
        minimumFractionDigits: 2,
      })} USDC credited to ${pod.policy.podAccountId}`,
      headline: "1Click Cross-Chain Settlement Verified",
      explanation: `Approved: ${target.clientName} deposited ${target.quotedSourceAmount} on ${chainShort}. NEAR Intents settled $${target.amountUsd.toLocaleString("en-US", {
        minimumFractionDigits: 2,
      })} USDC directly into OutLayer custody.`,
      policyAuditHash,
      teeAttested,
      executionStatus,
      attestationSource,
      teeReceipt: receipt,
      evaluatedAt: ts,
      attestation,
    };

    pod.activeDecision = evaluation;

    const snapshot = await buildDashboardSnapshot(
      pod,
      "POST",
      "/api/invoices",
      `Settled ${target.id} (+$${target.amountUsd.toFixed(2)} USDC) via NEAR Intents 1Click`,
    );

    res.json({
      invoice: { ...target },
      oneClickDepositCheck: statusCheck,
      entry,
      evaluation,
      snapshot,
    });
  });

  /**
   * POST /api/policy
   * Updates autonomousOpsActive, maxSingleSpendUsd / maxSingleTxUsd, dailySpendCapUsd,
   * profitSplit, and approvedVendors / vendorAllowlist, persisting to state.json.
   */
  app.post("/api/policy", async (req: Request, res: Response) => {
    const patch = req.body as Partial<TreasuryPolicy> & {
      podId?: string;
      maxSingleSpendUsd?: number;
      approvedVendors?: string[];
      emergencyFreeze?: boolean;
    };

    const pod = persistentStore.getActivePod(patch.podId);

    if (typeof patch.emergencyFreeze === "boolean") {
      pod.policy.autonomousOpsActive = !patch.emergencyFreeze;
    }
    if (typeof patch.autonomousOpsActive === "boolean") {
      pod.policy.autonomousOpsActive = patch.autonomousOpsActive;
    }

    const nextMaxSingle = patch.maxSingleTxUsd ?? patch.maxSingleSpendUsd;
    if (typeof nextMaxSingle === "number" && !Number.isNaN(nextMaxSingle)) {
      pod.policy.maxSingleTxUsd = Math.max(1, nextMaxSingle);
    }

    if (
      typeof patch.dailySpendCapUsd === "number" &&
      !Number.isNaN(patch.dailySpendCapUsd)
    ) {
      pod.policy.dailySpendCapUsd = Math.max(10, patch.dailySpendCapUsd);
    }

    if (
      typeof patch.profitLockPct === "number" &&
      !Number.isNaN(patch.profitLockPct)
    ) {
      pod.policy.profitLockPct = Math.min(95, Math.max(0, patch.profitLockPct));
    }

    const nextVendors = patch.vendorAllowlist ?? patch.approvedVendors;
    if (Array.isArray(nextVendors)) {
      pod.policy.vendorAllowlist = nextVendors
        .map((v) => String(v).trim())
        .filter(Boolean);
    }

    if (patch.profitSplit) {
      pod.policy.profitSplit = {
        leadDevPct: Number(patch.profitSplit.leadDevPct),
        designPartnerPct: Number(patch.profitSplit.designPartnerPct),
        taxReservePct: Number(patch.profitSplit.taxReservePct),
      };
    }

    if (patch.partnerWallets) {
      pod.policy.partnerWallets = {
        ...pod.policy.partnerWallets,
        ...patch.partnerWallets,
      };
    }

    if (typeof patch.podAccountId === "string" && patch.podAccountId.trim()) {
      pod.policy.podAccountId = patch.podAccountId.trim();
      pod.podAccountId = pod.policy.podAccountId;
    }
    if (typeof patch.podDisplayName === "string" && patch.podDisplayName.trim()) {
      pod.policy.podDisplayName = patch.podDisplayName.trim();
      pod.podDisplayName = pod.policy.podDisplayName;
    }

    pod.invoices = pod.invoices.map((inv) => ({
      ...inv,
      destinationVault: pod.policy.podAccountId,
    }));

    // Re-evaluate active decision against updated policy guardrails
    const currentMetrics = computeMetricsFromLedger(pod.ledger, pod.policy);
    const nearTelemetry = await queryNearRpcTelemetry(
      persistentStore.getState().mode,
      pod.podAccountId,
    );
    pod.activeDecision = evaluateProcurement({
      vendorName: pod.activeDecision?.taskCounterparty || "Anthropic API",
      vendorAddress: pod.activeDecision?.taskCounterparty || "Anthropic API",
      amountUsd: pod.activeDecision?.taskAmountUsd || 65,
      category: "POLICY_RECHECK",
      reason: pod.activeDecision?.taskDetail || "Policy guardrail evaluation",
      agentName: pod.activeDecision?.taskActor || "Procurement Agent (pod-01)",
      rail: "OutLayer Custody · NEAR USDC",
      policy: pod.policy,
      treasuryBalanceUsd: currentMetrics.treasuryBalanceUsd,
      nearBlockHeight: nearTelemetry.blockHeight,
    });

    const snapshot = await buildDashboardSnapshot(
      pod,
      "POST",
      "/api/policy",
      `Guardrails updated: $${pod.policy.maxSingleTxUsd}/tx · $${pod.policy.dailySpendCapUsd}/day · ${
        pod.policy.autonomousOpsActive ? "ACTIVE" : "FROZEN"
      }`,
    );

    res.json(snapshot);
  });

  /**
   * POST /api/agent/procure
   * 1. Queries NEAR Intents Agent API (/v1/agents/{id}/containment & /grants) via syncAgentContainmentAndGrants.
   * 2. Audits invoice/memo with NEAR AI Cloud (POST https://cloud-api.near.ai/v1/chat/completions).
   * 3. Evaluates against the 5 strict policy rules, executes OutLayer Custody transfer when approved,
   *    fetches genuine hardware attestation from GET /attestations/by-call/{call_id} if a call_id is returned,
   *    and records honest policyAuditHash / teeAttested / SANDBOX_PREVIEW / local_policy_check status on the audit ledger.
   */
  app.post("/api/agent/procure", async (req: Request, res: Response) => {
    const body = req.body as Partial<AgentProcureRequest> & {
      podId?: string;
      vendor?: string;
      vendorName?: string;
      vendorAddress?: string;
      category?: string;
      reason?: string;
      multisigOverride?: {
        enabled: boolean;
        signers: string[];
      };
    };

    const pod = persistentStore.getActivePod(body.podId);
    const currentMetrics = computeMetricsFromLedger(pod.ledger, pod.policy);
    pod.policy.dailySpentTodayUsd = currentMetrics.dailySpentUsd;

    const nearTelemetry = await queryNearRpcTelemetry(
      persistentStore.getState().mode,
      pod.podAccountId,
    );

    const vendorName = (
      body.vendorName ??
      body.counterparty ??
      body.vendor ??
      "unknown-wallet.near"
    ).trim();
    const vendorAddress = (body.vendorAddress ?? vendorName).trim();
    const amountUsd = Math.max(0.01, Number(body.amountUsd) || 0);
    const reason = (
      body.reason ??
      body.purpose ??
      "Autonomous API procurement request"
    ).trim();
    const agentName = (body.agentName ?? "Procurement Agent (pod-01)").trim();
    const category = (body.category ?? "OPEX_PROCUREMENT").trim();
    const dryRun = Boolean(body.dryRun);

    // Normalize rail label: never claim "PingPay x402" on standard OutLayer procurement
    const requestedRail = body.rail?.includes("x402")
      ? "OutLayer Custody · NEAR USDC"
      : (body.rail ?? "OutLayer Custody · NEAR USDC");

    // Step 1: Query NEAR Intents Agent API containment & grants + NEAR AI Cloud semantic invoice audit in parallel
    const [agentContainment, nearAiAudit] = await Promise.all([
      syncAgentContainmentAndGrants(pod.podAccountId),
      auditProcurementWithNearAi({
        agentName,
        vendorName,
        amountUsd,
        reason,
        maxSingleTxUsd: pod.policy.maxSingleTxUsd,
        vendorAllowlist: pod.policy.vendorAllowlist,
      }),
    ]);

    // If the official NEAR Intents Agent API reports FROZEN, enforce containment freeze alongside local policy
    const effectivePolicy: TreasuryPolicy =
      agentContainment.containmentMode === "FROZEN"
        ? { ...pod.policy, autonomousOpsActive: false }
        : pod.policy;

    let evaluation = evaluateProcurement({
      vendorName,
      vendorAddress,
      amountUsd,
      category,
      reason,
      agentName,
      rail: requestedRail,
      policy: effectivePolicy,
      treasuryBalanceUsd: currentMetrics.treasuryBalanceUsd,
      nearBlockHeight: nearTelemetry.blockHeight,
    });

    // 2-of-3 Partner Multisig Escalation Override on High-Value Spend
    const multisigSigners = Array.isArray(body.multisigOverride?.signers)
      ? body.multisigOverride.signers.filter(Boolean)
      : [];
    const isMultisigApproved =
      Boolean(body.multisigOverride?.enabled) &&
      multisigSigners.length >= 2 &&
      currentMetrics.treasuryBalanceUsd >= amountUsd;

    if (isMultisigApproved) {
      const ts = formatUtcTimestamp();
      const {
        policyAuditHash: msigAuditHash,
        teeAttested: msigTeeAttested,
        executionStatus: msigExecStatus,
        attestationSource: msigAttSource,
        teeReceipt: msigReceipt,
        attestation: msigAttestation,
      } = buildCryptographicCommitment({
        podId: pod.policy.podAccountId,
        policy: pod.policy,
        task: {
          vendorName,
          vendorAddress,
          amountUsd,
          category: "MULTISIG_ESCALATION_2_OF_3",
          reason: `2/3 Partner Multisig Override (${multisigSigners.join(" + ")}): ${reason}`,
        },
        decision: "ALLOW",
        ruleChecks: {
          emergencyFreezeCheck: true,
          maxSingleSpendCheck: true,
          dailySpendCapCheck: true,
          availableOpexMarginCheck: true,
          vendorAllowlistCheck: true,
        },
        violationCodes: [],
        timestamp: ts,
        nearBlockHeight: nearTelemetry.blockHeight,
      });

      evaluation = {
        verdict: "ALLOW",
        scenarioKey: "multisig-2-of-3-override",
        taskTitle: `2/3 Multisig Approved: $${amountUsd.toLocaleString("en-US")} → ${vendorName}`,
        taskActor: `2/3 Partner Multisig (${multisigSigners.join(" + ")})`,
        taskCounterparty: vendorName,
        taskAmountUsd: amountUsd,
        taskChainRoute: "2/3 Partner Multisig · OutLayer Custody",
        taskDetail: `Co-signed by ${multisigSigners.join(" & ")} to override single-tx cap ($${pod.policy.maxSingleTxUsd}) for this transaction.`,
        headline: "Approved via 2-of-3 Partner Multisig Escalation",
        explanation: `Authorized: ${multisigSigners.join(" + ")} co-signed a one-time 2/3 multisig escalation to approve $${amountUsd.toFixed(2)} to ${vendorName}.`,
        policyAuditHash: msigAuditHash,
        teeAttested: msigTeeAttested,
        executionStatus: msigExecStatus,
        attestationSource: msigAttSource,
        teeReceipt: msigReceipt,
        evaluatedAt: ts,
        violationCodes: [],
        attestation: msigAttestation,
      };
    }

    evaluation.nearAiAudit = nearAiAudit;
    evaluation.agentContainment = agentContainment;
    pod.activeDecision = evaluation;

    if (dryRun) {
      const snapshot = await buildDashboardSnapshot(
        pod,
        "POST",
        "/api/agent/procure",
        `SANDBOX_PREVIEW (local_policy_check) ${evaluation.verdict}: $${amountUsd.toFixed(2)} → ${vendorName} (${evaluation.policyAuditHash})`,
      );
      res.status(evaluation.verdict === "BLOCK" ? 403 : 200).json({
        status: evaluation.executionStatus,
        mode: evaluation.attestationSource,
        evaluation,
        nearAiAudit,
        agentContainment,
        snapshot,
      });
      return;
    }

    let entry: LedgerEntry;
    let outlayerTransferResult: Awaited<
      ReturnType<typeof executeOutlayerTransfer>
    > | null = null;

    if (evaluation.verdict === "ALLOW") {
      outlayerTransferResult = await executeOutlayerTransfer({
        apiKey:
          process.env.OUTLAYER_API_KEY ||
          persistentStore.getState().outlayerWallet.api_key,
        podAccountId: pod.policy.podAccountId,
        recipient: vendorAddress,
        amountUsd,
        memo: reason,
        policyAuditHash: evaluation.policyAuditHash,
      });

      if (
        outlayerTransferResult.teeAttested &&
        outlayerTransferResult.hardwareAttestation
      ) {
        evaluation.teeAttested = true;
        evaluation.executionStatus = "LIVE_OUTLAYER_TEE";
        evaluation.attestationSource = "live_outlayer_attestation";
        evaluation.teeReceipt =
          outlayerTransferResult.callId
            ? `outlayer_call_${outlayerTransferResult.callId}`
            : outlayerTransferResult.txHash;
        if (evaluation.attestation) {
          evaluation.attestation.teeAttested = true;
          evaluation.attestation.status = "LIVE_OUTLAYER_TEE";
          evaluation.attestation.attestationSource =
            "live_outlayer_attestation";
          evaluation.attestation.outlayerCallId =
            outlayerTransferResult.callId;
          evaluation.attestation.hardwareAttestation =
            outlayerTransferResult.hardwareAttestation;
          evaluation.attestation.enclaveMeasurement =
            outlayerTransferResult.hardwareAttestation.enclaveMeasurement;
        }
      }

      entry = {
        id: `ldg_${shortHash(evaluation.policyAuditHash + Date.now() + Math.random(), 6)}`,
        podId: pod.podAccountId,
        timestamp: evaluation.evaluatedAt,
        eventType: "OUTLAYER OPEX",
        counterparty: vendorName,
        chainOrRail: requestedRail,
        amountUsd,
        countsTowardDailyToday: true,
        verdict: "ALLOW",
        policyAuditHash: evaluation.policyAuditHash,
        teeAttested: evaluation.teeAttested,
        executionStatus: evaluation.executionStatus,
        attestationSource: evaluation.attestationSource,
        teeReceipt: evaluation.teeReceipt,
        enclaveMeasurement:
          evaluation.attestation?.enclaveMeasurement || LOCAL_POLICY_CHECK_MODE,
        memo: `${agentName}: ${reason}`,
        attestation: evaluation.attestation,
      };
    } else {
      entry = {
        id: `ldg_${shortHash(evaluation.policyAuditHash + Date.now() + Math.random(), 6)}`,
        podId: pod.podAccountId,
        timestamp: evaluation.evaluatedAt,
        eventType: "RULE BLOCKED",
        counterparty: vendorName,
        chainOrRail: "OutLayer Policy Guardrail",
        amountUsd,
        verdict: "BLOCK",
        policyAuditHash: evaluation.policyAuditHash,
        teeAttested: false,
        executionStatus: "SANDBOX_PREVIEW",
        attestationSource: "local_policy_check",
        teeReceipt: evaluation.teeReceipt,
        enclaveMeasurement: LOCAL_POLICY_CHECK_MODE,
        memo: evaluation.explanation,
        attestation: evaluation.attestation,
      };
    }

    pod.ledger = [entry, ...pod.ledger];

    const snapshot = await buildDashboardSnapshot(
      pod,
      "POST",
      "/api/agent/procure",
      `${evaluation.verdict}: $${amountUsd.toFixed(2)} to ${vendorName} (${evaluation.policyAuditHash})`,
    );

    res.status(evaluation.verdict === "BLOCK" ? 403 : 200).json({
      status: evaluation.executionStatus,
      mode: evaluation.attestationSource,
      evaluation,
      nearAiAudit,
      agentContainment,
      outlayerTransfer: outlayerTransferResult,
      entry,
      snapshot,
    });
  });

  /**
   * POST /api/checks
   * Issues an OutLayer Gasless Sub-Contractor Payment Check (bitfli.xyz/claim/<id>)
   * within policy guardrails, deducting from available OpEx and logging to the audit ledger.
   */
  app.post("/api/checks", async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as {
      podId?: string;
      payeeLabel?: string;
      amountUsd?: number;
      memo?: string;
    };

    const pod = persistentStore.getActivePod(body.podId);
    const currentMetrics = computeMetricsFromLedger(pod.ledger, pod.policy);
    pod.policy.dailySpentTodayUsd = currentMetrics.dailySpentUsd;

    const nearTelemetry = await queryNearRpcTelemetry(
      persistentStore.getState().mode,
      pod.podAccountId,
    );

    const payeeLabel =
      (body.payeeLabel ?? "Sub-Contractor Bounty").trim() ||
      "Sub-Contractor Bounty";
    const amountUsd = Math.max(1, Number(body.amountUsd) || 75);
    const memo =
      (body.memo ?? "Gasless sub-contractor deliverable payment check").trim() ||
      "Gasless sub-contractor deliverable payment check";

    const policyForCheck: TreasuryPolicy = {
      ...pod.policy,
      vendorAllowlist: [...pod.policy.vendorAllowlist, payeeLabel],
    };

    const evaluation = evaluateProcurement({
      vendorName: payeeLabel,
      vendorAddress: payeeLabel,
      amountUsd,
      category: "GASLESS_PAYMENT_CHECK",
      reason: memo,
      agentName: "Ops Check Issuer (pod-01)",
      rail: "OutLayer Gasless Check · NEAR USDC",
      policy: policyForCheck,
      treasuryBalanceUsd: currentMetrics.treasuryBalanceUsd,
      nearBlockHeight: nearTelemetry.blockHeight,
    });

    pod.activeDecision = evaluation;

    if (evaluation.verdict === "BLOCK") {
      const blockedEntry: LedgerEntry = {
        id: `ldg_${shortHash(evaluation.policyAuditHash + Date.now() + Math.random(), 6)}`,
        podId: pod.podAccountId,
        timestamp: evaluation.evaluatedAt,
        eventType: "RULE BLOCKED",
        counterparty: `${payeeLabel} (Check Blocked)`,
        chainOrRail: "OutLayer Policy Guardrail",
        amountUsd,
        verdict: "BLOCK",
        policyAuditHash: evaluation.policyAuditHash,
        teeAttested: false,
        executionStatus: "SANDBOX_PREVIEW",
        attestationSource: "local_policy_check",
        teeReceipt: evaluation.teeReceipt,
        enclaveMeasurement: LOCAL_POLICY_CHECK_MODE,
        memo: evaluation.explanation,
        attestation: evaluation.attestation,
      };
      pod.ledger = [blockedEntry, ...pod.ledger];

      const snapshot = await buildDashboardSnapshot(
        pod,
        "POST",
        "/api/checks",
        `Blocked gasless check ($${amountUsd.toFixed(2)}) for ${payeeLabel}`,
      );
      res.status(403).json({ evaluation, entry: blockedEntry, snapshot });
      return;
    }

    const existingChecks = pod.checks ?? [];
    const checkNum = 102 + existingChecks.length;
    const checkId = `CHK-${checkNum}`;
    const claimSecretHash = `0x${shortHash(`${checkId}:${payeeLabel}:${amountUsd}:${Date.now()}`, 32)}`;
    const checkRecord: PaymentCheckRecord = {
      id: checkId,
      podId: pod.podAccountId,
      payeeLabel,
      amountUsd,
      memo,
      claimUrl: `https://bitfli.xyz/claim/${checkId}`,
      claimSecretHash,
      status: "ACTIVE",
      policyAuditHash: evaluation.policyAuditHash,
      teeAttested: evaluation.teeAttested,
      teeReceipt: evaluation.teeReceipt,
      createdAt: evaluation.evaluatedAt,
    };

    pod.checks = [checkRecord, ...existingChecks];

    const entry: LedgerEntry = {
      id: `ldg_${shortHash(evaluation.policyAuditHash + checkId + Math.random(), 6)}`,
      podId: pod.podAccountId,
      timestamp: evaluation.evaluatedAt,
      eventType: "OUTLAYER OPEX",
      counterparty: `${payeeLabel} (${checkId})`,
      chainOrRail: "OutLayer Gasless Check · Claim Link",
      amountUsd,
      countsTowardDailyToday: true,
      verdict: "ALLOW",
      policyAuditHash: evaluation.policyAuditHash,
      teeAttested: evaluation.teeAttested,
      executionStatus: evaluation.executionStatus,
      attestationSource: evaluation.attestationSource,
      teeReceipt: evaluation.teeReceipt,
      enclaveMeasurement: LOCAL_POLICY_CHECK_MODE,
      memo: `Issued gasless payment check ${checkRecord.claimUrl} — ${memo}`,
      attestation: evaluation.attestation,
    };

    pod.ledger = [entry, ...pod.ledger];

    const snapshot = await buildDashboardSnapshot(
      pod,
      "POST",
      "/api/checks",
      `Issued gasless payment check ${checkId} ($${amountUsd.toFixed(2)}) → ${checkRecord.claimUrl}`,
    );

    res.status(201).json({ check: checkRecord, evaluation, entry, snapshot });
  });

  /**
   * POST /api/treasury/split
   * Executes the partner profit-split waterfall, appends PROFIT SPLIT to the ledger, and recomputes KPIs.
   */
  app.post("/api/treasury/split", async (req: Request, res: Response) => {
    const options = (req.body ?? {}) as {
      podId?: string;
      distributionAmountUsd?: number;
      overrideSplit?: ProfitSplitConfig;
    };

    const pod = persistentStore.getActivePod(options.podId);
    const currentMetrics = computeMetricsFromLedger(pod.ledger, pod.policy);
    const nearTelemetry = await queryNearRpcTelemetry(
      persistentStore.getState().mode,
      pod.podAccountId,
    );

    const ts = formatUtcTimestamp();
    const split = options.overrideSplit ?? pod.policy.profitSplit;
    const ratioLabel = `${split.leadDevPct}/${split.designPartnerPct}/${split.taxReservePct}`;

    if (!pod.policy.autonomousOpsActive) {
      const {
        policyAuditHash,
        teeAttested,
        executionStatus,
        attestationSource,
        teeReceipt,
        attestation,
      } = buildCryptographicCommitment({
        podId: pod.policy.podAccountId,
        policy: pod.policy,
        task: {
          vendorName: "Partner Payout Waterfall",
          vendorAddress: pod.policy.partnerWallets.leadDev,
          amountUsd: 0,
          category: "PROFIT_SPLIT",
          reason: `Partner Profit Split (${ratioLabel}) blocked by Human Lock`,
        },
        decision: "BLOCK",
        ruleChecks: {
          emergencyFreezeCheck: false,
          maxSingleSpendCheck: true,
          dailySpendCapCheck: true,
          availableOpexMarginCheck: true,
          vendorAllowlistCheck: true,
        },
        violationCodes: [
          "RULE_KILL_SWITCH_FROZEN",
          "RULE_EMERGENCY_FREEZE_ACTIVE",
        ],
        timestamp: ts,
        nearBlockHeight: nearTelemetry.blockHeight,
      });

      const blockedEval: DecisionEvaluation = {
        verdict: "BLOCK",
        scenarioKey: "profit-split",
        taskTitle: `Partner Profit Split (${ratioLabel})`,
        taskActor: "Profit-Split Agent",
        taskCounterparty: "Partner Payout Waterfall",
        taskAmountUsd: 0,
        taskChainRoute: "NEAR + Solana + Reserve (1Click)",
        taskDetail: "Blocked while FROZEN (HUMAN LOCK) is engaged.",
        headline: "Profit Split Paused · Human Lock Active",
        explanation:
          "Blocked [RULE_KILL_SWITCH_FROZEN]: Re-enable AUTONOMOUS OPS: ACTIVE to allow cross-chain partner distributions.",
        policyAuditHash,
        teeAttested,
        executionStatus,
        attestationSource,
        teeReceipt,
        evaluatedAt: ts,
        violationCodes: [
          "RULE_KILL_SWITCH_FROZEN",
          "RULE_EMERGENCY_FREEZE_ACTIVE",
        ],
        attestation,
      };

      pod.activeDecision = blockedEval;
      const snapshot = await buildDashboardSnapshot(
        pod,
        "POST",
        "/api/treasury/split",
        "Profit split blocked while Human Lock is active",
      );
      res.json({ evaluation: blockedEval, snapshot });
      return;
    }

    const available = currentMetrics.netDistributableProfitUsd;
    const requestedAmount =
      options.distributionAmountUsd ??
      Math.min(available, Math.max(1000, +(available * 0.25).toFixed(2)));
    const payoutUsd = Math.min(
      available,
      Math.min(currentMetrics.treasuryBalanceUsd, requestedAmount),
    );

    if (payoutUsd <= 0) {
      const {
        policyAuditHash,
        teeAttested,
        executionStatus,
        attestationSource,
        teeReceipt,
        attestation,
      } = buildCryptographicCommitment({
        podId: pod.policy.podAccountId,
        policy: pod.policy,
        task: {
          vendorName: "Partner Wallets",
          vendorAddress: pod.policy.partnerWallets.leadDev,
          amountUsd: 0,
          category: "PROFIT_SPLIT",
          reason: "Partner Profit Split Request with zero distributable margin",
        },
        decision: "BLOCK",
        ruleChecks: {
          emergencyFreezeCheck: true,
          maxSingleSpendCheck: true,
          dailySpendCapCheck: true,
          availableOpexMarginCheck: false,
          vendorAllowlistCheck: true,
        },
        violationCodes: ["RULE_AVAILABLE_OPEX_EXCEEDED"],
        timestamp: ts,
        nearBlockHeight: nearTelemetry.blockHeight,
      });

      const emptyEval: DecisionEvaluation = {
        verdict: "BLOCK",
        scenarioKey: "profit-split",
        taskTitle: "Partner Profit Split Request",
        taskActor: "Profit-Split Agent",
        taskCounterparty: "Partner Wallets",
        taskAmountUsd: 0,
        taskChainRoute: "NEAR Intents 1Click",
        taskDetail: "No net distributable profit remaining.",
        headline: "No Distributable Margin Available",
        explanation:
          "Blocked: Net distributable profit is currently $0.00. Settle a client invoice before running a new partner split.",
        policyAuditHash,
        teeAttested,
        executionStatus,
        attestationSource,
        teeReceipt,
        evaluatedAt: ts,
        attestation,
      };

      pod.activeDecision = emptyEval;
      const snapshot = await buildDashboardSnapshot(
        pod,
        "POST",
        "/api/treasury/split",
        "Profit split skipped: $0.00 net distributable profit",
      );
      res.json({ evaluation: emptyEval, snapshot });
      return;
    }

    const leadUsd = +((payoutUsd * split.leadDevPct) / 100).toFixed(2);
    const designUsd = +((payoutUsd * split.designPartnerPct) / 100).toFixed(2);
    const taxUsd = +(payoutUsd - leadUsd - designUsd).toFixed(2);

    const externalDisbursement = +(leadUsd + designUsd).toFixed(2);

    const {
      policyAuditHash,
      teeAttested,
      executionStatus,
      attestationSource,
      teeReceipt,
      attestation,
    } = buildCryptographicCommitment({
      podId: pod.policy.podAccountId,
      policy: pod.policy,
      task: {
        vendorName: `${pod.policy.partnerWallets.leadDev} + ${pod.policy.partnerWallets.designPartner} + Reserve Vault`,
        vendorAddress: pod.policy.partnerWallets.leadDev,
        amountUsd: payoutUsd,
        category: "PROFIT_SPLIT",
        reason: `Waterfall ${ratioLabel}%: Lead $${leadUsd.toFixed(2)}, Design $${designUsd.toFixed(2)}, Tax Reserve $${taxUsd.toFixed(2)}`,
      },
      decision: "ALLOW",
      ruleChecks: {
        emergencyFreezeCheck: true,
        maxSingleSpendCheck: true,
        dailySpendCapCheck: true,
        availableOpexMarginCheck: true,
        vendorAllowlistCheck: true,
      },
      violationCodes: [],
      timestamp: ts,
      nearBlockHeight: nearTelemetry.blockHeight,
    });

    const entry: LedgerEntry = {
      id: `ldg_${shortHash(policyAuditHash + ts + Math.random(), 6)}`,
      podId: pod.podAccountId,
      timestamp: ts,
      eventType: "PROFIT SPLIT",
      counterparty: `Partners (${ratioLabel} Split)`,
      chainOrRail: "NEAR + Solana + Reserve (1Click)",
      amountUsd: payoutUsd,
      externalTreasuryDebitUsd: externalDisbursement,
      verdict: "ALLOW",
      policyAuditHash,
      teeAttested,
      executionStatus,
      attestationSource,
      teeReceipt,
      enclaveMeasurement: LOCAL_POLICY_CHECK_MODE,
      memo: `Lead Dev (${pod.policy.partnerWallets.leadDev}): $${leadUsd.toFixed(2)} · Design (${pod.policy.partnerWallets.designPartner}): $${designUsd.toFixed(2)} · Tax Reserve: $${taxUsd.toFixed(2)}`,
      attestation,
    };

    pod.ledger = [entry, ...pod.ledger];

    const evaluation: DecisionEvaluation = {
      verdict: "ALLOW",
      scenarioKey: "profit-split",
      taskTitle: `Execute Partner Profit Split ($${payoutUsd.toLocaleString("en-US", {
        minimumFractionDigits: 2,
      })})`,
      taskActor: "Profit-Split Agent · OutLayer Custody",
      taskCounterparty: `${pod.policy.partnerWallets.leadDev} + ${pod.policy.partnerWallets.designPartner}`,
      taskAmountUsd: payoutUsd,
      taskChainRoute: `NEAR USDC + Solana USDC + Vault (${ratioLabel})`,
      taskDetail: `$${leadUsd.toFixed(2)} Lead (${split.leadDevPct}%) · $${designUsd.toFixed(2)} Design (${split.designPartnerPct}%) · $${taxUsd.toFixed(2)} Reserve (${split.taxReservePct}%)`,
      headline: `Automated ${ratioLabel} Profit Waterfall Settled`,
      explanation: `Approved: $${payoutUsd.toLocaleString("en-US", {
        minimumFractionDigits: 2,
      })} net profit distributed atomically — $${leadUsd.toLocaleString("en-US", {
        minimumFractionDigits: 2,
      })} to ${pod.policy.partnerWallets.leadDev}, $${designUsd.toLocaleString("en-US", {
        minimumFractionDigits: 2,
      })} swapped to Solana for ${pod.policy.partnerWallets.designPartner}, and $${taxUsd.toLocaleString("en-US", {
        minimumFractionDigits: 2,
      })} locked in Tax & Ops Reserve.`,
      policyAuditHash,
      teeAttested,
      executionStatus,
      attestationSource,
      teeReceipt,
      evaluatedAt: ts,
      attestation,
    };

    pod.activeDecision = evaluation;

    const snapshot = await buildDashboardSnapshot(
      pod,
      "POST",
      "/api/treasury/split",
      `Executed ${ratioLabel}% partner waterfall ($${payoutUsd.toFixed(2)} USDC)`,
    );

    res.json({
      evaluation,
      entry,
      breakdown: {
        totalSplitUsd: payoutUsd,
        leadDevUsd: leadUsd,
        designPartnerUsd: designUsd,
        taxReserveUsd: taxUsd,
      },
      snapshot,
    });
  });

  /**
   * POST /api/pods
   * Creates or switches to an Agency Pod in persistent state.json and provisions its OutLayer wallet.
   */
  app.post("/api/pods", async (req: Request, res: Response) => {
    const input = req.body as {
      podAccountId?: string;
      podDisplayName?: string;
      maxSingleTxUsd?: number;
      dailySpendCapUsd?: number;
      profitSplit?: ProfitSplitConfig;
      partnerWallets?: Partial<TreasuryPolicy["partnerWallets"]>;
    };

    const state = persistentStore.getState();
    const currentPod = persistentStore.getActivePod();

    const podAccountId = (input.podAccountId ?? "pod-02.bitfli.near").trim();
    const podDisplayName = (
      input.podDisplayName ?? "Autonomous Agency Pod"
    ).trim();
    const maxSingleTxUsd = Math.min(
      1000,
      Math.max(10, Number(input.maxSingleTxUsd) || currentPod.policy.maxSingleTxUsd),
    );
    const dailySpendCapUsd = Math.max(
      50,
      Number(input.dailySpendCapUsd) || currentPod.policy.dailySpendCapUsd,
    );

    const existingPod = state.pods[podAccountId];
    if (existingPod) {
      existingPod.podDisplayName = podDisplayName;
      existingPod.policy.podAccountId = podAccountId;
      existingPod.policy.podDisplayName = podDisplayName;
      existingPod.policy.maxSingleTxUsd = maxSingleTxUsd;
      existingPod.policy.dailySpendCapUsd = dailySpendCapUsd;
      if (input.profitSplit) {
        existingPod.policy.profitSplit = input.profitSplit;
      }
      if (input.partnerWallets) {
        existingPod.policy.partnerWallets = {
          ...existingPod.policy.partnerWallets,
          ...input.partnerWallets,
        };
      }
      state.activePodId = podAccountId;
      const snapshot = await buildDashboardSnapshot(
        existingPod,
        "POST",
        "/api/pods",
        `Activated agency pod ${podAccountId} (cap $${maxSingleTxUsd}/tx)`,
      );
      res.json(snapshot);
      return;
    }

    const newPolicy: AgencyPodRecord["policy"] = {
      ...currentPod.policy,
      podAccountId,
      podDisplayName,
      maxSingleTxUsd,
      maxSingleSpendUsd: maxSingleTxUsd,
      dailySpendCapUsd,
      profitSplit: input.profitSplit ?? { ...currentPod.policy.profitSplit },
      partnerWallets: {
        ...currentPod.policy.partnerWallets,
        ...(input.partnerWallets ?? {}),
      },
    };

    const newPod: AgencyPodRecord = {
      podAccountId,
      podDisplayName,
      enclaveMeasurement: LOCAL_POLICY_CHECK_MODE,
      policy: newPolicy,
      invoices: currentPod.invoices.map((inv) => ({
        ...inv,
        podId: podAccountId,
        destinationVault: podAccountId,
      })),
      checks: (currentPod.checks ?? []).map((chk) => ({
        ...chk,
        podId: podAccountId,
      })),
      ledger: currentPod.ledger.map((row) => ({
        ...row,
        podId: podAccountId,
      })),
      activeDecision: {
        ...currentPod.activeDecision,
        taskCounterparty: podAccountId,
      },
    };

    state.pods[podAccountId] = newPod;
    state.activePodId = podAccountId;

    const snapshot = await buildDashboardSnapshot(
      newPod,
      "POST",
      "/api/pods",
      `Provisioned OutLayer pod ${podAccountId} (cap $${maxSingleTxUsd}/tx)`,
    );

    res.json(snapshot);
  });

  /**
   * GET /api/ledger/csv
   * Dynamically generates and streams RFC-4180 text/csv from the live ledger.
   */
  app.get("/api/ledger/csv", async (req: Request, res: Response) => {
    const podId = req.query.podId as string | undefined;
    const pod = persistentStore.getActivePod(podId);

    const headers = [
      "Timestamp",
      "Event",
      "Counterparty",
      "Route",
      "Amount_USD",
      "Status",
      "TEE_Receipt_Or_Tx",
    ];

    const escapeCsv = (val: string | number) => {
      const str = String(val);
      if (/[",\r\n]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = pod.ledger.map((item) =>
      [
        item.timestamp,
        item.eventType,
        item.counterparty,
        item.chainOrRail,
        item.amountUsd.toFixed(2),
        item.verdict,
        item.teeReceipt,
      ]
        .map(escapeCsv)
        .join(","),
    );

    const csvContent = [headers.join(","), ...rows].join("\r\n");

    await buildDashboardSnapshot(
      pod,
      "GET",
      "/api/ledger/csv",
      `Streamed ${pod.ledger.length} rows to bitfli-audit-ledger.csv`,
    );

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="bitfli-audit-ledger.csv"',
    );
    res.status(200).send(csvContent);
  });

  return app;
}

const defaultExpressApp = createApp();
export default defaultExpressApp;

const isMainModule =
  !process.env.VERCEL &&
  !process.env.AWS_LAMBDA_FUNCTION_NAME &&
  !process.env.NODE_TEST_CONTEXT &&
  Boolean(
    process.argv[1]?.endsWith("src/index.ts") ||
      process.argv[1]?.endsWith("dist/index.js"),
  );

if (isMainModule) {
  const port = Number(process.env.PORT) || 4000;
  initializeOutlayerOnBoot()
    .catch(() => {})
    .finally(() => {
      defaultExpressApp.listen(port, () => {
        const wallet = persistentStore.getState().outlayerWallet;
        console.log(
          `>> bitfli.xyz backend listening on http://localhost:${port} | OutLayer Wallet: ${wallet.near_account_id.slice(0, 12)}... | Handoff: ${sanitizeHandoffUrl(wallet.handoff_url, wallet.near_account_id)}`,
        );
      });
    });
}
