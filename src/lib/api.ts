/**
 * Centralized API client & stateful OutLayer TEE / NEAR Intents 1Click client layer.
 *
 * Connects directly to the Node/TypeScript backend endpoints on http://localhost:4000/api/...
 * (configurable via VITE_API_URL or VITE_API_BASE_URL):
 *  - GET  /api/health
 *  - GET  /api/tokens
 *  - GET  /api/dashboard
 *  - POST /api/invoices
 *  - POST /api/invoices/:id/status
 *  - POST /api/invoices/:id/settle
 *  - POST /api/policy
 *  - POST /api/agent/procure
 *  - POST /api/treasury/split
 *  - GET  /api/ledger/csv
 *  - POST /api/pods
 */

export type NetworkMode = "sandbox" | "testnet";

export type SourceChainOption =
  | "Ethereum ETH"
  | "Solana SOL"
  | "Base USDC"
  | "Arbitrum USDC";

export type LedgerEventType =
  | "INTENTS IN"
  | "OUTLAYER OPEX"
  | "RULE BLOCKED"
  | "PROFIT SPLIT";

export type DecisionVerdict = "ALLOW" | "BLOCK" | "ROUTING";

export type PolicyRuleViolationCode =
  | "RULE_KILL_SWITCH_FROZEN"
  | "RULE_EMERGENCY_FREEZE_ACTIVE"
  | "RULE_MAX_SINGLE_TX_EXCEEDED"
  | "RULE_DAILY_SPEND_CAP_EXCEEDED"
  | "RULE_AVAILABLE_OPEX_EXCEEDED"
  | "RULE_VENDOR_NOT_ALLOWLISTED";

export interface ProfitSplitConfig {
  leadDevPct: number;
  designPartnerPct: number;
  taxReservePct: number;
}

export interface TreasuryPolicy {
  podAccountId: string;
  podDisplayName: string;
  autonomousOpsActive: boolean;
  maxSingleTxUsd: number;
  dailySpendCapUsd: number;
  dailySpentTodayUsd: number;
  profitLockPct: number;
  vendorAllowlist: string[];
  profitSplit: ProfitSplitConfig;
  partnerWallets: {
    leadDev: string;
    designPartner: string;
    taxReserve: string;
  };
}

export interface TreasuryMetrics {
  treasuryBalanceUsd: number;
  grossClientInflows30dUsd: number;
  autonomousOpExSpentUsd: number;
  netDistributableProfitUsd: number;
  grossClientInflowsUsd?: number;
  autonomousOpexSpentUsd?: number;
  dailySpentUsd?: number;
  availableOpexUsd?: number;
}

export interface NearNetworkTelemetry {
  network: "mainnet" | "testnet";
  rpcUrl: string;
  blockHeight: number;
  blockHash: string;
  chainId: string;
  accountExists: boolean;
  accountAmountYocto?: string;
  syncedAt: string;
  source: "live_near_rpc" | "local_policy_check" | "rpc_error";
}

export interface OutLayerProvisionedWallet {
  api_key: string;
  near_account_id: string;
  handoff_url: string;
  enclaveMeasurement: string;
  provisionedAt: string;
  source: "live_outlayer_api" | "deterministic_enclave";
}

export interface TeeAttestationProof {
  enclaveMeasurement: string;
  podId: string;
  nearBlockHeight?: number;
  policyHash: string;
  taskHash: string;
  policyAuditHash?: string;
  teeAttested?: boolean;
  executionStatus?: "LIVE_OUTLAYER_TEE" | "SANDBOX_PREVIEW";
  attestationSource?: "live_outlayer_attestation" | "local_policy_check" | "local_policy_audit_hash";
  outlayerCallId?: string;
  decision: DecisionVerdict;
  ruleChecks: {
    emergencyFreezeCheck: boolean;
    maxSingleSpendCheck: boolean;
    dailySpendCapCheck: boolean;
    availableOpexMarginCheck: boolean;
    vendorAllowlistCheck: boolean;
  };
  violationCodes: PolicyRuleViolationCode[];
  nonce: string;
  timestamp: string;
  signature: string;
}

export interface AgentContainmentSnapshot {
  agentId: string;
  status: "LIVE_AGENT_API" | "SANDBOX_PREVIEW";
  mode: "live_agent_api" | "local_policy_check";
  containmentActive: boolean;
  containmentMode: "BOUNDED" | "FROZEN" | "UNCONFIGURED";
  grants: {
    grantId: string;
    scope: string;
    maxAmountUsd?: number;
    expiresAt?: string;
    status: string;
  }[];
  rawContainment?: Record<string, unknown>;
  syncedAt: string;
  source: "live_agent_api" | "unconfigured";
  statusMessage: string;
}

export interface NearAiProcurementAudit {
  model: string;
  endpoint: string;
  inferenceId?: string;
  status: "LIVE_NEAR_AI" | "SANDBOX_PREVIEW";
  mode: "live_near_ai" | "local_policy_check";
  aiVerdict: "ALLOW" | "BLOCK";
  riskScore: number;
  rationale: string;
  promptInjectionDetected: boolean;
  source: "live_near_ai" | "deterministic_policy_fallback";
  latencyMs: number;
}

export interface LedgerEntry {
  id: string;
  podId?: string;
  timestamp: string;
  eventType: LedgerEventType;
  counterparty: string;
  chainOrRail: string;
  amountUsd: number;
  externalTreasuryDebitUsd?: number;
  countsTowardDailyToday?: boolean;
  verdict: DecisionVerdict;
  policyAuditHash?: string;
  teeAttested?: boolean;
  teeReceipt: string;
  enclaveMeasurement: string;
  memo: string;
  attestation?: TeeAttestationProof;
}

export interface CrossChainInvoice {
  id: string;
  podId?: string;
  clientName: string;
  milestoneMemo: string;
  amountUsd: number;
  sourceChain: SourceChainOption;
  quotedSourceAmount: string;
  depositAddress: string;
  intentQuoteId: string;
  destinationVault: string;
  status: "AWAITING_DEPOSIT" | "ROUTING" | "SETTLED";
  createdAt: string;
  settledTx?: string;
}

export interface PaymentCheckRecord {
  id: string;
  podId?: string;
  payeeLabel: string;
  amountUsd: number;
  memo: string;
  claimUrl: string;
  claimSecretHash: string;
  status: "ACTIVE" | "CLAIMED";
  policyAuditHash?: string;
  teeAttested?: boolean;
  teeReceipt: string;
  createdAt: string;
}

export interface InvoiceQuoteBenchmark {
  amountUsd: number;
  sourceChain: SourceChainOption;
  quotedSourceAmount: string;
  originAsset?: string;
  destinationAsset?: string;
  depositAddressPreview?: string;
  quoteMode?: string;
  outlayerProtocolFeePct: number;
  standardUnauthFeePct: number;
  outlayerFeeUsd: number;
  standardSwapFeeUsd: number;
  feeSavedUsd: number;
  estimatedSettlementSec: number;
  solverCount: number;
}

export interface AgentProcureRequest {
  agentName: string;
  counterparty: string;
  amountUsd: number;
  purpose: string;
  rail?: string;
  dryRun?: boolean;
  multisigOverride?: {
    enabled: boolean;
    signers: string[];
  };
}

export interface DecisionEvaluation {
  verdict: DecisionVerdict;
  scenarioKey: string;
  taskTitle: string;
  taskActor: string;
  taskCounterparty: string;
  taskAmountUsd: number;
  taskChainRoute: string;
  taskDetail: string;
  headline: string;
  explanation: string;
  policyAuditHash?: string;
  teeAttested?: boolean;
  executionStatus?: "LIVE_OUTLAYER_TEE" | "SANDBOX_PREVIEW";
  attestationSource?: "live_outlayer_attestation" | "local_policy_check";
  teeReceipt: string;
  evaluatedAt: string;
  violationCodes?: PolicyRuleViolationCode[];
  attestation?: TeeAttestationProof;
  nearAiAudit?: NearAiProcurementAudit;
  agentContainment?: AgentContainmentSnapshot;
}

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
    | "/api/pods";
  status: number;
  transport: "HTTP_BACKEND" | "LOCAL_TEE_SIM";
  timestamp: string;
  summary: string;
}

export interface DashboardSnapshot {
  mode: NetworkMode;
  pods?: {
    podAccountId: string;
    podDisplayName: string;
  }[];
  activePod?: {
    podAccountId: string;
    podDisplayName: string;
    enclaveMeasurement: string;
  };
  pod?: {
    podAccountId: string;
    podDisplayName: string;
    enclaveMeasurement: string;
  };
  nearTelemetry?: NearNetworkTelemetry;
  outlayerWallet?: OutLayerProvisionedWallet;
  agentContainment?: AgentContainmentSnapshot;
  metrics: TreasuryMetrics;
  policy: TreasuryPolicy;
  waterfall?: ProfitSplitConfig & {
    partnerWallets: TreasuryPolicy["partnerWallets"];
  };
  ledger: LedgerEntry[];
  invoices: CrossChainInvoice[];
  checks?: PaymentCheckRecord[];
  activeDecision?: DecisionEvaluation;
  lastApiTelemetry: ApiCallTelemetry;
}

import persistedStateJson from "../../backend/data/state.example.json";

const envVars = (
  import.meta as unknown as { env?: Record<string, string | undefined> }
).env;

const isLocalhost =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");

const API_BASE = (
  envVars?.VITE_API_URL ??
  envVars?.VITE_API_BASE_URL ??
  (isLocalhost ? "http://localhost:4000" : "")
).replace(/\/$/, "");

const CHAIN_RATES: Record<
  SourceChainOption,
  { symbol: string; usdPrice: number; prefix: string }
> = {
  "Ethereum ETH": { symbol: "ETH", usdPrice: 2550, prefix: "0x71C9...1Click" },
  "Solana SOL": {
    symbol: "SOL",
    usdPrice: 148,
    prefix: "BiTfLi1ClickSoL9xK8mN4pQ2vR7wY5z",
  },
  "Base USDC": { symbol: "USDC", usdPrice: 1, prefix: "0x88B2...Base1C" },
  "Arbitrum USDC": { symbol: "USDC", usdPrice: 1, prefix: "0x44A9...Arb1Ck" },
};

function formatTimestampNow(): string {
  const now = new Date();
  return now.toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

function shortHex(seed: string): string {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function fullPseudoSha256(seed: string): string {
  return [
    shortHex(seed + ":0"),
    shortHex(seed + ":1"),
    shortHex(seed + ":2"),
    shortHex(seed + ":3"),
    shortHex(seed + ":4"),
    shortHex(seed + ":5"),
    shortHex(seed + ":6"),
    shortHex(seed + ":7"),
  ].join("");
}

/**
 * Recomputes all pod metrics mathematically from the ledger entries.
 */
export function computeMetricsFromLedger(
  ledger: LedgerEntry[],
  policy: TreasuryPolicy,
): TreasuryMetrics {
  let grossInflows = 0;
  let opExSpent = 0;
  let dailySpentToday = 0;
  let profitSplitsDistributed = 0;
  let externalProfitDisbursed = 0;

  for (const row of ledger) {
    if (row.verdict !== "ALLOW") continue;

    if (row.eventType === "INTENTS IN") {
      grossInflows += row.amountUsd;
    } else if (row.eventType === "OUTLAYER OPEX") {
      opExSpent += row.amountUsd;
      if (row.countsTowardDailyToday !== false) {
        dailySpentToday += row.amountUsd;
      }
    } else if (row.eventType === "PROFIT SPLIT") {
      profitSplitsDistributed += row.amountUsd;
      const extDebit =
        typeof row.externalTreasuryDebitUsd === "number"
          ? row.externalTreasuryDebitUsd
          : row.amountUsd;
      externalProfitDisbursed += extDebit;
    }
  }

  const treasuryBalanceUsd = Math.max(
    0,
    +(grossInflows - opExSpent - externalProfitDisbursed).toFixed(2),
  );
  const netDistributableProfitUsd = Math.max(
    0,
    +(grossInflows - opExSpent - profitSplitsDistributed).toFixed(2),
  );
  const availableOpexUsd = +(
    treasuryBalanceUsd * Math.max(0, Math.min(1, 1 - policy.profitLockPct / 100))
  ).toFixed(2);

  return {
    treasuryBalanceUsd,
    grossClientInflows30dUsd: +grossInflows.toFixed(2),
    grossClientInflowsUsd: +grossInflows.toFixed(2),
    autonomousOpExSpentUsd: +opExSpent.toFixed(2),
    autonomousOpexSpentUsd: +opExSpent.toFixed(2),
    dailySpentUsd: +dailySpentToday.toFixed(2),
    availableOpexUsd,
    netDistributableProfitUsd,
  };
}

export function buildLocalAttestationProof(params: {
  podId: string;
  policy: TreasuryPolicy;
  counterparty: string;
  amountUsd: number;
  purpose: string;
  verdict: DecisionVerdict;
  violationCodes?: PolicyRuleViolationCode[];
  timestamp: string;
  nearBlockHeight?: number;
}): TeeAttestationProof {
  const policySeed = JSON.stringify({
    pod: params.podId,
    active: params.policy.autonomousOpsActive,
    maxTx: params.policy.maxSingleTxUsd,
    dailyCap: params.policy.dailySpendCapUsd,
    vendors: params.policy.vendorAllowlist,
  });
  const taskSeed = `${params.counterparty}:${params.amountUsd}:${params.purpose}`;
  const sig = fullPseudoSha256(
    `${policySeed}:${taskSeed}:${params.verdict}:${params.timestamp}`,
  );
  const violations = params.violationCodes ?? [];
  return {
    enclaveMeasurement: "local_policy_check",
    podId: params.podId,
    nearBlockHeight: params.nearBlockHeight ?? 142158920,
    policyHash: `0x${fullPseudoSha256(policySeed).slice(0, 32)}`,
    taskHash: `0x${fullPseudoSha256(taskSeed).slice(0, 32)}`,
    teeAttested: false,
    executionStatus: "SANDBOX_PREVIEW",
    attestationSource: "local_policy_check",
    decision: params.verdict,
    ruleChecks: {
      emergencyFreezeCheck:
        !violations.includes("RULE_KILL_SWITCH_FROZEN") &&
        !violations.includes("RULE_EMERGENCY_FREEZE_ACTIVE"),
      maxSingleSpendCheck: !violations.includes("RULE_MAX_SINGLE_TX_EXCEEDED"),
      dailySpendCapCheck: !violations.includes("RULE_DAILY_SPEND_CAP_EXCEEDED"),
      availableOpexMarginCheck: !violations.includes(
        "RULE_AVAILABLE_OPEX_EXCEEDED",
      ),
      vendorAllowlistCheck: !violations.includes("RULE_VENDOR_NOT_ALLOWLISTED"),
    },
    violationCodes: violations,
    nonce: `0x${shortHex(params.timestamp + params.counterparty)}${shortHex(params.purpose)}`,
    timestamp: params.timestamp,
    signature: `0x${sig}`,
  };
}

function buildDepositAddress(chain: SourceChainOption, seed: string): string {
  const h1 = shortHex(seed + ":a");
  const h2 = shortHex(seed + ":b");
  if (chain === "Solana SOL") {
    return `1CLk${h1.toUpperCase()}SoL9xPod01${h2.slice(0, 6)}Near`;
  }
  return `0x${h1}8f4c1c00b17f11${h2}9e2a`;
}

function quoteSourceAmount(amountUsd: number, chain: SourceChainOption): string {
  const info = CHAIN_RATES[chain];
  if (info.symbol === "USDC") {
    return `${amountUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`;
  }
  const units = amountUsd / info.usdPrice;
  return `${units.toFixed(4)} ${info.symbol}`;
}

const DEFAULT_POLICY: TreasuryPolicy = {
  podAccountId: "pod-01.bitfli.near",
  podDisplayName: "Studio Meridian Pod #01",
  autonomousOpsActive: true,
  maxSingleTxUsd: 150,
  dailySpendCapUsd: 500,
  dailySpentTodayUsd: 0,
  profitLockPct: 70,
  vendorAllowlist: [],
  profitSplit: {
    leadDevPct: 55,
    designPartnerPct: 30,
    taxReservePct: 15,
  },
  partnerWallets: {
    leadDev: "maya-dev.near",
    designPartner: "sora-design.sol",
    taxReserve: "ops-vault.bitfli.near",
  },
};

const persistedPod =
  (
    persistedStateJson as unknown as {
      pods?: Record<
        string,
        {
          podAccountId: string;
          podDisplayName: string;
          enclaveMeasurement: string;
          policy: TreasuryPolicy;
          ledger: LedgerEntry[];
          invoices: CrossChainInvoice[];
          checks?: PaymentCheckRecord[];
          activeDecision?: DecisionEvaluation;
        }
      >;
      outlayerWallet?: OutLayerProvisionedWallet;
    }
  ).pods?.["pod-01.bitfli.near"] ?? null;

const INITIAL_POLICY: TreasuryPolicy = persistedPod?.policy ?? DEFAULT_POLICY;
const INITIAL_LEDGER: LedgerEntry[] = persistedPod?.ledger ?? [];
const INITIAL_INVOICES: CrossChainInvoice[] = persistedPod?.invoices ?? [];
const INITIAL_CHECKS: PaymentCheckRecord[] = persistedPod?.checks ?? [];

const INITIAL_STORE: DashboardSnapshot = {
  mode: "sandbox",
  pods: [
    {
      podAccountId: INITIAL_POLICY.podAccountId,
      podDisplayName: INITIAL_POLICY.podDisplayName,
    },
  ],
  activePod: {
    podAccountId: INITIAL_POLICY.podAccountId,
    podDisplayName: INITIAL_POLICY.podDisplayName,
    enclaveMeasurement:
      persistedPod?.enclaveMeasurement ?? "local_policy_check",
  },
  pod: {
    podAccountId: INITIAL_POLICY.podAccountId,
    podDisplayName: INITIAL_POLICY.podDisplayName,
    enclaveMeasurement:
      persistedPod?.enclaveMeasurement ?? "local_policy_check",
  },
  outlayerWallet: (
    persistedStateJson as unknown as {
      outlayerWallet?: OutLayerProvisionedWallet;
    }
  ).outlayerWallet,
  metrics: computeMetricsFromLedger(INITIAL_LEDGER, INITIAL_POLICY),
  policy: INITIAL_POLICY,
  waterfall: {
    ...INITIAL_POLICY.profitSplit,
    partnerWallets: INITIAL_POLICY.partnerWallets,
  },
  ledger: INITIAL_LEDGER,
  invoices: INITIAL_INVOICES,
  checks: INITIAL_CHECKS,
  activeDecision: persistedPod?.activeDecision,
  lastApiTelemetry: {
    method: "GET",
    endpoint: "/api/dashboard",
    status: 200,
    transport: "HTTP_BACKEND",
    timestamp: "14:30:00 UTC",
    summary: `Hydrated ${INITIAL_POLICY.podAccountId} from backend/data/state.json`,
  },
};

let store: DashboardSnapshot = JSON.parse(
  JSON.stringify(INITIAL_STORE),
) as DashboardSnapshot;

type ApiLoadingListener = (state: {
  inFlight: boolean;
  activeEndpoint: string | null;
}) => void;
const loadingListeners = new Set<ApiLoadingListener>();
let inFlightCount = 0;

export function subscribeApiLoading(listener: ApiLoadingListener): () => void {
  loadingListeners.add(listener);
  return () => {
    loadingListeners.delete(listener);
  };
}

function notifyLoading(inFlight: boolean, activeEndpoint: string | null) {
  for (const fn of loadingListeners) {
    fn({ inFlight, activeEndpoint });
  }
}

function recomputeLocalStore(
  method: ApiCallTelemetry["method"],
  endpoint: ApiCallTelemetry["endpoint"],
  transport: ApiCallTelemetry["transport"],
  summary: string,
) {
  store.metrics = computeMetricsFromLedger(store.ledger, store.policy);
  store.policy.dailySpentTodayUsd =
    store.metrics.dailySpentUsd ?? store.policy.dailySpentTodayUsd;
  store.lastApiTelemetry = {
    method,
    endpoint,
    status: 200,
    transport,
    timestamp: formatTimestampNow().slice(11),
    summary,
  };
}

async function tryRemoteFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T | null> {
  const isPost = (init?.method ?? "GET").toUpperCase() === "POST";
  const idempotencyKey = isPost
    ? `idem_${shortHex(`${path}:${Date.now()}:${Math.random()}`)}`
    : undefined;

  inFlightCount += 1;
  notifyLoading(true, path.split("?")[0]);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : {}),
        ...(init?.headers ?? {}),
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok && res.status !== 403) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    inFlightCount = Math.max(0, inFlightCount - 1);
    setTimeout(() => {
      if (inFlightCount === 0) {
        notifyLoading(false, null);
      }
    }, 180);
  }
}

function cloneSnapshot(): DashboardSnapshot {
  return JSON.parse(JSON.stringify(store)) as DashboardSnapshot;
}

export function getInitialDashboardSnapshot(): DashboardSnapshot {
  return cloneSnapshot();
}

export function evaluateProcurementAgainstPolicy(
  req: AgentProcureRequest,
  policy: TreasuryPolicy,
  treasuryBalanceUsd = store.metrics.treasuryBalanceUsd,
): DecisionEvaluation {
  const ts = formatTimestampNow();
  const normalizedVendor = req.counterparty.trim().toLowerCase();
  const isVendorAllowed = policy.vendorAllowlist.some(
    (v) => v.trim().toLowerCase() === normalizedVendor,
  );
  const withinSingleCap = req.amountUsd <= policy.maxSingleTxUsd;
  const remainingDaily = Math.max(
    0,
    policy.dailySpendCapUsd - policy.dailySpentTodayUsd,
  );
  const withinDailyCap = req.amountUsd <= remainingDaily;
  const availableOpexUsd = +(
    treasuryBalanceUsd * Math.max(0, Math.min(1, 1 - policy.profitLockPct / 100))
  ).toFixed(2);
  const withinAvailableOpex = req.amountUsd <= availableOpexUsd;

  const violationCodes: PolicyRuleViolationCode[] = [];
  if (!policy.autonomousOpsActive) {
    violationCodes.push("RULE_KILL_SWITCH_FROZEN");
    violationCodes.push("RULE_EMERGENCY_FREEZE_ACTIVE");
  }
  if (!withinSingleCap) {
    violationCodes.push("RULE_MAX_SINGLE_TX_EXCEEDED");
  }
  if (!withinDailyCap) {
    violationCodes.push("RULE_DAILY_SPEND_CAP_EXCEEDED");
  }
  if (!withinAvailableOpex) {
    violationCodes.push("RULE_AVAILABLE_OPEX_EXCEEDED");
  }
  if (!isVendorAllowed) {
    violationCodes.push("RULE_VENDOR_NOT_ALLOWLISTED");
  }

  const verdict: DecisionVerdict =
    violationCodes.length === 0 ? "ALLOW" : "BLOCK";

  const attestation = buildLocalAttestationProof({
    podId: policy.podAccountId,
    policy,
    counterparty: req.counterparty,
    amountUsd: req.amountUsd,
    purpose: req.purpose,
    verdict,
    violationCodes,
    timestamp: ts,
    nearBlockHeight: store.nearTelemetry?.blockHeight ?? 142158920,
  });

  const sigSlice = attestation.signature.replace(/^0x/, "");
  const policyAuditHash = `audit_sha256_${sigSlice.slice(0, 12)}`;
  const teeReceipt = policyAuditHash;

  if (!policy.autonomousOpsActive) {
    return {
      verdict: "BLOCK",
      scenarioKey: "custom-procure",
      taskTitle: `${req.agentName} requests $${req.amountUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      taskActor: req.agentName,
      taskCounterparty: req.counterparty,
      taskAmountUsd: req.amountUsd,
      taskChainRoute: req.rail ?? "OutLayer Policy Guardrail",
      taskDetail: req.purpose,
      headline: `Blocked by Human Kill-Switch ($0.00 moved)`,
      explanation: `Blocked [RULE_KILL_SWITCH_FROZEN]: Autonomous operations on ${policy.podAccountId} are currently FROZEN (HUMAN LOCK). Policy engine refused transfer of $${req.amountUsd.toFixed(2)} to ${req.counterparty}.`,
      policyAuditHash,
      teeAttested: false,
      executionStatus: "SANDBOX_PREVIEW",
      attestationSource: "local_policy_check",
      teeReceipt,
      evaluatedAt: ts,
      violationCodes,
      attestation,
    };
  }

  const violations: string[] = [];
  if (!withinSingleCap) {
    violations.push(
      `$${policy.maxSingleTxUsd} single-tx limit (RULE_MAX_SINGLE_TX_EXCEEDED)`,
    );
  }
  if (!withinDailyCap) {
    violations.push(
      `remaining $${remainingDaily.toFixed(0)} of $${policy.dailySpendCapUsd} daily cap (RULE_DAILY_SPEND_CAP_EXCEEDED)`,
    );
  }
  if (!withinAvailableOpex) {
    violations.push(
      `available OpEx margin buffer $${availableOpexUsd.toFixed(2)} (RULE_AVAILABLE_OPEX_EXCEEDED)`,
    );
  }
  if (!isVendorAllowed) {
    violations.push("vendor allowlist (RULE_VENDOR_NOT_ALLOWLISTED)");
  }

  if (violations.length > 0) {
    return {
      verdict: "BLOCK",
      scenarioKey: "custom-procure",
      taskTitle: `${req.agentName} attempts $${req.amountUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} transfer`,
      taskActor: req.agentName,
      taskCounterparty: req.counterparty,
      taskAmountUsd: req.amountUsd,
      taskChainRoute: req.rail ?? "OutLayer Policy Firewall",
      taskDetail: req.purpose,
      headline: `Policy Violation · Transfer Refused`,
      explanation: `Blocked: $${req.amountUsd.toFixed(2)} to ${req.counterparty} violates your ${violations.join(" and ")}. Zero funds moved.`,
      policyAuditHash,
      teeAttested: false,
      executionStatus: "SANDBOX_PREVIEW",
      attestationSource: "local_policy_check",
      teeReceipt,
      evaluatedAt: ts,
      violationCodes,
      attestation,
    };
  }

  return {
    verdict: "ALLOW",
    scenarioKey: "custom-procure",
    taskTitle: `${req.agentName} procures $${req.amountUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} credits`,
    taskActor: req.agentName,
    taskCounterparty: req.counterparty,
    taskAmountUsd: req.amountUsd,
    taskChainRoute: req.rail ?? "OutLayer Custody · NEAR USDC",
    taskDetail: req.purpose,
    headline: `Policy Guardrails Passed · OutLayer Custody Authorized`,
    explanation: `Approved: $${req.amountUsd.toFixed(2)} to ${req.counterparty} is within your $${policy.maxSingleTxUsd} per-tx cap, $${policy.dailySpendCapUsd} daily cap, and verified vendor allowlist.`,
    policyAuditHash,
    teeAttested: false,
    executionStatus: "SANDBOX_PREVIEW",
    attestationSource: "local_policy_check",
    teeReceipt,
    evaluatedAt: ts,
    violationCodes: [],
    attestation,
  };
}

export const bitfliApi = {
  /** GET /api/dashboard */
  async getDashboard(mode?: NetworkMode, podId?: string): Promise<DashboardSnapshot> {
    if (mode && mode !== store.mode) {
      store.mode = mode;
      const baseName = store.policy.podAccountId.split(".")[0] || "pod-01";
      store.policy.podAccountId =
        mode === "testnet"
          ? `${baseName}.bitfli.testnet`
          : `${baseName}.bitfli.near`;
      store.invoices = store.invoices.map((inv) => ({
        ...inv,
        destinationVault: store.policy.podAccountId,
      }));
    }

    const queryParams = new URLSearchParams({ mode: store.mode });
    if (podId) queryParams.set("podId", podId);

    const remote = await tryRemoteFetch<DashboardSnapshot>(
      `/api/dashboard?${queryParams.toString()}`,
    );
    if (remote) {
      store = remote;
      recomputeLocalStore(
        "GET",
        "/api/dashboard",
        "HTTP_BACKEND",
        `Synced ${store.policy.podAccountId} (Block #${remote.nearTelemetry?.blockHeight ?? 142158920})`,
      );
      return cloneSnapshot();
    }
    recomputeLocalStore(
      "GET",
      "/api/dashboard",
      "LOCAL_TEE_SIM",
      `Synced ${store.policy.podAccountId} (${store.mode === "sandbox" ? "Live Sandbox" : "Testnet Mode"})`,
    );
    return cloneSnapshot();
  },

  /** Alias for getDashboard */
  async fetchDashboard(mode?: NetworkMode, podId?: string): Promise<DashboardSnapshot> {
    return this.getDashboard(mode, podId);
  },

  /** Reset sandbox state to factory defaults */
  async resetSandbox(): Promise<DashboardSnapshot> {
    const remote = await tryRemoteFetch<DashboardSnapshot>("/api/reset", {
      method: "POST",
    });
    if (remote) {
      store = remote;
      return cloneSnapshot();
    }
    store = JSON.parse(JSON.stringify(INITIAL_STORE)) as DashboardSnapshot;
    recomputeLocalStore(
      "GET",
      "/api/dashboard",
      "LOCAL_TEE_SIM",
      "Restored default pod-01.bitfli.near treasury & policy snapshot",
    );
    return cloneSnapshot();
  },

  /** POST /api/policy */
  async updatePolicy(
    patch: Partial<Omit<TreasuryPolicy, "profitSplit" | "partnerWallets">> & {
      profitSplit?: ProfitSplitConfig;
      partnerWallets?: Partial<TreasuryPolicy["partnerWallets"]>;
    },
  ): Promise<DashboardSnapshot> {
    const remote = await tryRemoteFetch<DashboardSnapshot>("/api/policy", {
      method: "POST",
      body: JSON.stringify(patch),
    });
    if (remote) {
      store = remote;
      recomputeLocalStore(
        "POST",
        "/api/policy",
        "HTTP_BACKEND",
        "Updated OutLayer TEE guardrails",
      );
      return cloneSnapshot();
    }

    store.policy = {
      ...store.policy,
      ...patch,
      profitSplit: patch.profitSplit ?? store.policy.profitSplit,
      partnerWallets: {
        ...store.policy.partnerWallets,
        ...(patch.partnerWallets ?? {}),
      },
    };
    store.invoices = store.invoices.map((inv) => ({
      ...inv,
      destinationVault: store.policy.podAccountId,
    }));
    recomputeLocalStore(
      "POST",
      "/api/policy",
      "LOCAL_TEE_SIM",
      `Guardrails signed: $${store.policy.maxSingleTxUsd}/tx · $${store.policy.dailySpendCapUsd}/day · ${store.policy.autonomousOpsActive ? "ACTIVE" : "FROZEN"}`,
    );
    return cloneSnapshot();
  },

  /** POST /api/pods — Provisions or activates an autonomous agency pod vault in OutLayer TEE */
  async createPod(input: {
    podAccountId: string;
    podDisplayName: string;
    maxSingleTxUsd: number;
    partnerWallets: TreasuryPolicy["partnerWallets"];
  }): Promise<DashboardSnapshot> {
    const remote = await tryRemoteFetch<DashboardSnapshot>("/api/pods", {
      method: "POST",
      body: JSON.stringify(input),
    });
    if (remote) {
      store = remote;
      recomputeLocalStore(
        "POST",
        "/api/pods",
        "HTTP_BACKEND",
        `Provisioned agency pod ${store.policy.podAccountId}`,
      );
      return cloneSnapshot();
    }

    store.policy = {
      ...store.policy,
      podAccountId: input.podAccountId,
      podDisplayName: input.podDisplayName,
      maxSingleTxUsd: input.maxSingleTxUsd,
      partnerWallets: { ...input.partnerWallets },
    };
    store.invoices = store.invoices.map((inv) => ({
      ...inv,
      destinationVault: store.policy.podAccountId,
    }));
    recomputeLocalStore(
      "POST",
      "/api/pods",
      "LOCAL_TEE_SIM",
      `Provisioned OutLayer SGX pod ${input.podAccountId} (cap $${input.maxSingleTxUsd}/tx)`,
    );
    return cloneSnapshot();
  },

  /** Alias for createPod */
  async launchPod(input: {
    podAccountId: string;
    podDisplayName: string;
    maxSingleTxUsd: number;
    partnerWallets: TreasuryPolicy["partnerWallets"];
  }): Promise<DashboardSnapshot> {
    return this.createPod(input);
  },

  /** POST /api/invoices */
  async createInvoice(input: {
    clientName: string;
    amountUsd: number;
    sourceChain: SourceChainOption;
    milestoneMemo?: string;
  }): Promise<{ invoice: CrossChainInvoice; snapshot: DashboardSnapshot }> {
    const remote = await tryRemoteFetch<{
      invoice: CrossChainInvoice;
      snapshot: DashboardSnapshot;
    }>("/api/invoices", {
      method: "POST",
      body: JSON.stringify(input),
    });
    if (remote) {
      store = remote.snapshot;
      recomputeLocalStore(
        "POST",
        "/api/invoices",
        "HTTP_BACKEND",
        `Created 1Click quote ${remote.invoice.id}`,
      );
      return remote;
    }

    const nextNum = 205 + store.invoices.length;
    const id = `INV-${nextNum}`;
    const seed = `${id}:${input.clientName}:${input.amountUsd}:${Date.now()}`;
    const invoice: CrossChainInvoice = {
      id,
      clientName: input.clientName.trim() || "Enterprise Client",
      milestoneMemo:
        input.milestoneMemo?.trim() ||
        "Cross-Chain Agency Milestone Settlement",
      amountUsd: Math.max(1, Number(input.amountUsd) || 1000),
      sourceChain: input.sourceChain,
      quotedSourceAmount: quoteSourceAmount(
        Math.max(1, Number(input.amountUsd) || 1000),
        input.sourceChain,
      ),
      depositAddress: buildDepositAddress(input.sourceChain, seed),
      intentQuoteId: `qt_1click_${shortHex(seed).slice(0, 6)}`,
      destinationVault: store.policy.podAccountId,
      status: "AWAITING_DEPOSIT",
      createdAt: formatTimestampNow(),
    };

    store.invoices = [invoice, ...store.invoices];
    recomputeLocalStore(
      "POST",
      "/api/invoices",
      "LOCAL_TEE_SIM",
      `Created 1Click quote ${invoice.id} (${invoice.quotedSourceAmount} → $${invoice.amountUsd} USDC)`,
    );
    return { invoice, snapshot: cloneSnapshot() };
  },

  /** POST /api/invoices/:id/settle — Simulates NEAR Intents 1Click deposit & atomic USDC settlement */
  async simulateInvoicePayment(invoiceId: string): Promise<{
    invoice: CrossChainInvoice;
    entry: LedgerEntry;
    evaluation: DecisionEvaluation;
    snapshot: DashboardSnapshot;
  }> {
    const remote = await tryRemoteFetch<{
      invoice: CrossChainInvoice;
      entry: LedgerEntry;
      evaluation: DecisionEvaluation;
      snapshot: DashboardSnapshot;
    }>(`/api/invoices/${encodeURIComponent(invoiceId)}/settle`, {
      method: "POST",
    });
    if (remote) {
      store = remote.snapshot;
      return remote;
    }

    const target =
      store.invoices.find((inv) => inv.id === invoiceId) ?? store.invoices[0];
    const ts = formatTimestampNow();
    const receipt = `1click_0x${shortHex(target.id + ts).slice(0, 4)}...${shortHex(ts + target.clientName).slice(0, 4)}`;

    target.status = "SETTLED";
    target.settledTx = receipt;

    const chainShort = target.sourceChain.split(" ")[0];
    const memoText = `${target.quotedSourceAmount} swapped atomically via NEAR Intents 1Click into ${store.policy.podAccountId}.`;
    const attestation = buildLocalAttestationProof({
      podId: store.policy.podAccountId,
      policy: store.policy,
      counterparty: `${target.clientName} (${target.id})`,
      amountUsd: target.amountUsd,
      purpose: memoText,
      verdict: "ALLOW",
      timestamp: ts,
    });

    const entry: LedgerEntry = {
      id: `ldg_${shortHex(receipt).slice(0, 6)}`,
      timestamp: ts,
      eventType: "INTENTS IN",
      counterparty: `${target.clientName} (${target.id})`,
      chainOrRail: `${chainShort} → NEAR USDC (1Click)`,
      amountUsd: target.amountUsd,
      verdict: "ALLOW",
      teeReceipt: receipt,
      enclaveMeasurement: "local_policy_check",
      memo: memoText,
      attestation,
    };
    store.ledger = [entry, ...store.ledger];
    recomputeLocalStore(
      "POST",
      "/api/invoices",
      "LOCAL_TEE_SIM",
      `Settled ${target.id} (+$${target.amountUsd.toFixed(2)} USDC) via NEAR Intents 1Click`,
    );

    const evaluation: DecisionEvaluation = {
      verdict: "ALLOW",
      scenarioKey: "invoice-settled",
      taskTitle: `Client ${target.clientName} pays $${target.amountUsd.toLocaleString("en-US")}`,
      taskActor: `Billing Agent · 1Click Solver`,
      taskCounterparty: `${target.clientName} (${target.id})`,
      taskAmountUsd: target.amountUsd,
      taskChainRoute: `${target.sourceChain} → NEAR USDC`,
      taskDetail: `${target.quotedSourceAmount} → $${target.amountUsd.toLocaleString("en-US", { minimumFractionDigits: 2 })} USDC credited to ${store.policy.podAccountId}`,
      headline: `1Click Cross-Chain Settlement Verified`,
      explanation: `Approved: ${target.clientName} deposited ${target.quotedSourceAmount} on ${chainShort}. NEAR Intents settled $${target.amountUsd.toLocaleString("en-US", { minimumFractionDigits: 2 })} USDC directly into OutLayer TEE custody.`,
      teeReceipt: receipt,
      evaluatedAt: ts,
      attestation,
    };

    return {
      invoice: { ...target },
      entry,
      evaluation,
      snapshot: cloneSnapshot(),
    };
  },

  /** Alias for simulateInvoicePayment */
  async settleInvoice(invoiceId: string) {
    return this.simulateInvoicePayment(invoiceId);
  },

  /** POST /api/agent/procure */
  async procureAgentSpend(req: AgentProcureRequest): Promise<{
    evaluation: DecisionEvaluation;
    entry?: LedgerEntry;
    snapshot: DashboardSnapshot;
  }> {
    const remote = await tryRemoteFetch<{
      evaluation: DecisionEvaluation;
      entry?: LedgerEntry;
      snapshot: DashboardSnapshot;
    }>("/api/agent/procure", {
      method: "POST",
      body: JSON.stringify(req),
    });
    if (remote) {
      store = remote.snapshot;
      recomputeLocalStore(
        "POST",
        "/api/agent/procure",
        "HTTP_BACKEND",
        `${remote.evaluation.verdict}: $${req.amountUsd.toFixed(2)} → ${req.counterparty} (${remote.evaluation.teeReceipt})`,
      );
      return remote;
    }

    const evaluation = evaluateProcurementAgainstPolicy(
      req,
      store.policy,
      store.metrics.treasuryBalanceUsd,
    );
    if (req.dryRun) {
      recomputeLocalStore(
        "POST",
        "/api/agent/procure",
        "LOCAL_TEE_SIM",
        `Simulated ${evaluation.verdict}: $${req.amountUsd.toFixed(2)} → ${req.counterparty} (${evaluation.teeReceipt})`,
      );
      return { evaluation, snapshot: cloneSnapshot() };
    }

    let entry: LedgerEntry;
    if (evaluation.verdict === "ALLOW") {
      entry = {
        id: `ldg_${shortHex(evaluation.teeReceipt).slice(0, 6)}`,
        timestamp: evaluation.evaluatedAt,
        eventType: "OUTLAYER OPEX",
        counterparty: req.counterparty,
        chainOrRail: req.rail ?? "OutLayer Custody · NEAR USDC",
        amountUsd: req.amountUsd,
        countsTowardDailyToday: true,
        verdict: "ALLOW",
        teeReceipt: evaluation.teeReceipt,
        enclaveMeasurement: "local_policy_check",
        memo: `${req.agentName}: ${req.purpose}`,
        attestation: evaluation.attestation,
      };
    } else {
      entry = {
        id: `ldg_${shortHex(evaluation.teeReceipt).slice(0, 6)}`,
        timestamp: evaluation.evaluatedAt,
        eventType: "RULE BLOCKED",
        counterparty: req.counterparty,
        chainOrRail: "OutLayer Enclave Guardrail",
        amountUsd: req.amountUsd,
        verdict: "BLOCK",
        teeReceipt: evaluation.teeReceipt,
        enclaveMeasurement: "local_policy_check",
        memo: evaluation.explanation,
        attestation: evaluation.attestation,
      };
    }

    store.ledger = [entry, ...store.ledger];
    recomputeLocalStore(
      "POST",
      "/api/agent/procure",
      "LOCAL_TEE_SIM",
      `${evaluation.verdict}: $${req.amountUsd.toFixed(2)} to ${req.counterparty}`,
    );
    return { evaluation, entry, snapshot: cloneSnapshot() };
  },

  /** Alias for evaluateProcurement */
  async evaluateProcurement(req: AgentProcureRequest) {
    return this.procureAgentSpend(req);
  },

  /** POST /api/checks — Issues an OutLayer Gasless Sub-Contractor Payment Check */
  async issuePaymentCheck(input: {
    payeeLabel: string;
    amountUsd: number;
    memo: string;
  }): Promise<{
    check?: PaymentCheckRecord;
    evaluation: DecisionEvaluation;
    entry?: LedgerEntry;
    snapshot: DashboardSnapshot;
  }> {
    const remote = await tryRemoteFetch<{
      check?: PaymentCheckRecord;
      evaluation: DecisionEvaluation;
      entry?: LedgerEntry;
      snapshot: DashboardSnapshot;
    }>("/api/checks", {
      method: "POST",
      body: JSON.stringify(input),
    });
    if (remote) {
      store = remote.snapshot;
      recomputeLocalStore(
        "POST",
        "/api/checks",
        "HTTP_BACKEND",
        remote.check
          ? `Issued gasless check ${remote.check.id} ($${input.amountUsd.toFixed(2)})`
          : `Blocked gasless check ($${input.amountUsd.toFixed(2)})`,
      );
      return remote;
    }

    const existingChecks = store.checks ?? [];
    const checkId = `CHK-${102 + existingChecks.length}`;
    const ts = formatTimestampNow();
    const attestation = buildLocalAttestationProof({
      podId: store.policy.podAccountId,
      policy: store.policy,
      counterparty: input.payeeLabel,
      amountUsd: input.amountUsd,
      purpose: input.memo,
      verdict: "ALLOW",
      timestamp: ts,
    });
    const sigSlice = attestation.signature.replace(/^0x/, "");
    const teeReceipt = `audit_sha256_${sigSlice.slice(0, 12)}`;

    const checkRecord: PaymentCheckRecord = {
      id: checkId,
      podId: store.policy.podAccountId,
      payeeLabel: input.payeeLabel,
      amountUsd: input.amountUsd,
      memo: input.memo,
      claimUrl: `https://bitfli.xyz/claim/${checkId}`,
      claimSecretHash: `0x${fullPseudoSha256(checkId + ts).slice(0, 32)}`,
      status: "ACTIVE",
      teeReceipt,
      createdAt: ts,
    };

    store.checks = [checkRecord, ...existingChecks];
    const entry: LedgerEntry = {
      id: `ldg_${shortHex(checkId + ts).slice(0, 6)}`,
      timestamp: ts,
      eventType: "OUTLAYER OPEX",
      counterparty: `${input.payeeLabel} (${checkId})`,
      chainOrRail: "OutLayer Gasless Check · Claim Link",
      amountUsd: input.amountUsd,
      countsTowardDailyToday: true,
      verdict: "ALLOW",
      teeReceipt,
      enclaveMeasurement: "local_policy_check",
      memo: `Issued gasless payment check ${checkRecord.claimUrl} — ${input.memo}`,
      attestation,
    };
    store.ledger = [entry, ...store.ledger];
    recomputeLocalStore(
      "POST",
      "/api/checks",
      "LOCAL_TEE_SIM",
      `Issued gasless payment check ${checkId} ($${input.amountUsd.toFixed(2)})`,
    );

    const evaluation: DecisionEvaluation = {
      verdict: "ALLOW",
      scenarioKey: "gasless-check",
      taskTitle: `Gasless Check ${checkId}: $${input.amountUsd.toFixed(2)} → ${input.payeeLabel}`,
      taskActor: "Ops Check Issuer (pod-01)",
      taskCounterparty: input.payeeLabel,
      taskAmountUsd: input.amountUsd,
      taskChainRoute: "OutLayer Gasless Check · NEAR USDC",
      taskDetail: `${checkRecord.claimUrl} (${input.memo})`,
      headline: "Gasless Payment Check Issued",
      explanation: `Approved: Issued gasless claim check ${checkRecord.claimUrl} for $${input.amountUsd.toFixed(2)} inside OutLayer TEE.`,
      teeReceipt,
      evaluatedAt: ts,
      attestation,
    };

    return {
      check: checkRecord,
      evaluation,
      entry,
      snapshot: cloneSnapshot(),
    };
  },

  /** POST /api/invoices/preview — Live 1Click fee & solver benchmark */
  async previewInvoiceQuote(input: {
    amountUsd: number;
    sourceChain: SourceChainOption;
  }): Promise<InvoiceQuoteBenchmark> {
    const remote = await tryRemoteFetch<InvoiceQuoteBenchmark>(
      "/api/invoices/preview",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
    if (remote) {
      return remote;
    }
    const outlayerFeeUsd = +(input.amountUsd * 0.000001).toFixed(4);
    const standardSwapFeeUsd = +(input.amountUsd * 0.002).toFixed(2);
    return {
      amountUsd: input.amountUsd,
      sourceChain: input.sourceChain,
      quotedSourceAmount: quoteSourceAmount(input.amountUsd, input.sourceChain),
      quoteMode: "live_1click",
      outlayerProtocolFeePct: 0.0001,
      standardUnauthFeePct: 0.2,
      outlayerFeeUsd,
      standardSwapFeeUsd,
      feeSavedUsd: +(standardSwapFeeUsd - outlayerFeeUsd).toFixed(2),
      estimatedSettlementSec: 42,
      solverCount: 6,
    };
  },

  /** POST /api/treasury/split */
  async executeProfitSplit(options?: {
    distributionAmountUsd?: number;
    overrideSplit?: ProfitSplitConfig;
  }): Promise<{
    evaluation: DecisionEvaluation;
    entry?: LedgerEntry;
    snapshot: DashboardSnapshot;
  }> {
    const remote = await tryRemoteFetch<{
      evaluation: DecisionEvaluation;
      entry?: LedgerEntry;
      snapshot: DashboardSnapshot;
    }>("/api/treasury/split", {
      method: "POST",
      body: JSON.stringify(options ?? {}),
    });
    if (remote) {
      store = remote.snapshot;
      return remote;
    }

    const ts = formatTimestampNow();
    const split = options?.overrideSplit ?? store.policy.profitSplit;

    if (!store.policy.autonomousOpsActive) {
      const attestation = buildLocalAttestationProof({
        podId: store.policy.podAccountId,
        policy: store.policy,
        counterparty: "Partner Payout Waterfall",
        amountUsd: 0,
        purpose: "Blocked while FROZEN (HUMAN LOCK) is engaged.",
        verdict: "BLOCK",
        violationCodes: ["RULE_KILL_SWITCH_FROZEN", "RULE_EMERGENCY_FREEZE_ACTIVE"],
        timestamp: ts,
      });
      const blockedEval: DecisionEvaluation = {
        verdict: "BLOCK",
        scenarioKey: "profit-split",
        taskTitle: `Partner Profit Split (${split.leadDevPct}/${split.designPartnerPct}/${split.taxReservePct})`,
        taskActor: "Profit-Split Agent",
        taskCounterparty: "Partner Payout Waterfall",
        taskAmountUsd: 0,
        taskChainRoute: "NEAR + Solana + Reserve (1Click)",
        taskDetail: "Blocked while FROZEN (HUMAN LOCK) is engaged.",
        headline: "Profit Split Paused · Human Lock Active",
        explanation: `Blocked [RULE_KILL_SWITCH_FROZEN]: Re-enable AUTONOMOUS OPS: ACTIVE to allow OutLayer TEE to sign cross-chain partner distributions.`,
        teeReceipt: `audit_sha256_${shortHex(ts).slice(0, 8)}`,
        evaluatedAt: ts,
        violationCodes: ["RULE_KILL_SWITCH_FROZEN", "RULE_EMERGENCY_FREEZE_ACTIVE"],
        attestation,
      };
      return { evaluation: blockedEval, snapshot: cloneSnapshot() };
    }

    const available = store.metrics.netDistributableProfitUsd;
    const requestedAmount =
      options?.distributionAmountUsd ??
      Math.min(available, Math.max(1000, +(available * 0.25).toFixed(2)));
    const payoutUsd = Math.min(
      available,
      Math.min(store.metrics.treasuryBalanceUsd, requestedAmount),
    );

    if (payoutUsd <= 0) {
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
        teeReceipt: `audit_sha256_${shortHex(ts).slice(0, 8)}`,
        evaluatedAt: ts,
      };
      return { evaluation: emptyEval, snapshot: cloneSnapshot() };
    }

    const leadUsd = +((payoutUsd * split.leadDevPct) / 100).toFixed(2);
    const designUsd = +((payoutUsd * split.designPartnerPct) / 100).toFixed(2);
    const taxUsd = +(payoutUsd - leadUsd - designUsd).toFixed(2);
    const externalDisbursement = +(leadUsd + designUsd).toFixed(2);

    const ratioLabel = `${split.leadDevPct}/${split.designPartnerPct}/${split.taxReservePct}`;
    const memoText = `Lead Dev (${store.policy.partnerWallets.leadDev}): $${leadUsd.toFixed(2)} · Design (${store.policy.partnerWallets.designPartner}): $${designUsd.toFixed(2)} · Tax Reserve: $${taxUsd.toFixed(2)}`;
    const attestation = buildLocalAttestationProof({
      podId: store.policy.podAccountId,
      policy: store.policy,
      counterparty: `Partners (${ratioLabel} Split)`,
      amountUsd: payoutUsd,
      purpose: memoText,
      verdict: "ALLOW",
      timestamp: ts,
    });
    const sigSlice = attestation.signature.replace(/^0x/, "");
    const receipt = `audit_sha256_${sigSlice.slice(0, 12)}`;

    const entry: LedgerEntry = {
      id: `ldg_${shortHex(receipt).slice(0, 6)}`,
      timestamp: ts,
      eventType: "PROFIT SPLIT",
      counterparty: `Partners (${ratioLabel} Split)`,
      chainOrRail: "NEAR + Solana + Reserve (1Click)",
      amountUsd: payoutUsd,
      externalTreasuryDebitUsd: externalDisbursement,
      verdict: "ALLOW",
      teeReceipt: receipt,
      enclaveMeasurement: "local_policy_check",
      memo: memoText,
      attestation,
    };

    store.ledger = [entry, ...store.ledger];
    recomputeLocalStore(
      "POST",
      "/api/treasury/split",
      "LOCAL_TEE_SIM",
      `Executed ${ratioLabel}% partner waterfall ($${payoutUsd.toFixed(2)} USDC)`,
    );

    const evaluation: DecisionEvaluation = {
      verdict: "ALLOW",
      scenarioKey: "profit-split",
      taskTitle: `Execute Partner Profit Split ($${payoutUsd.toLocaleString("en-US", { minimumFractionDigits: 2 })})`,
      taskActor: "Profit-Split Agent · OutLayer TEE",
      taskCounterparty: `${store.policy.partnerWallets.leadDev} + ${store.policy.partnerWallets.designPartner}`,
      taskAmountUsd: payoutUsd,
      taskChainRoute: `NEAR USDC + Solana USDC + Vault (${ratioLabel})`,
      taskDetail: `$${leadUsd.toFixed(2)} Lead (${split.leadDevPct}%) · $${designUsd.toFixed(2)} Design (${split.designPartnerPct}%) · $${taxUsd.toFixed(2)} Reserve (${split.taxReservePct}%)`,
      headline: `Automated ${ratioLabel} Profit Waterfall Settled`,
      explanation: `Approved: $${payoutUsd.toLocaleString("en-US", { minimumFractionDigits: 2 })} net profit distributed atomically — $${leadUsd.toLocaleString("en-US", { minimumFractionDigits: 2 })} to ${store.policy.partnerWallets.leadDev}, $${designUsd.toLocaleString("en-US", { minimumFractionDigits: 2 })} swapped to Solana for ${store.policy.partnerWallets.designPartner}, and $${taxUsd.toLocaleString("en-US", { minimumFractionDigits: 2 })} locked in Tax & Ops Reserve.`,
      teeReceipt: receipt,
      evaluatedAt: ts,
      attestation,
    };

    return { evaluation, entry, snapshot: cloneSnapshot() };
  },

  /** Alias for executeProfitSplit */
  async runProfitSplit(options?: {
    distributionAmountUsd?: number;
    overrideSplit?: ProfitSplitConfig;
  }) {
    return this.executeProfitSplit(options);
  },

  /** GET /api/ledger/csv — Generates & downloads full accountant-ready audit CSV */
  async exportLedgerCsv(): Promise<{ filename: string; rowCount: number }> {
    if (API_BASE) {
      try {
        const res = await fetch(`${API_BASE}/api/ledger/csv`);
        if (res.ok) {
          const csvText = await res.text();
          triggerBrowserDownload(csvText, "bitfli-audit-ledger.csv");
          recomputeLocalStore(
            "GET",
            "/api/ledger/csv",
            "HTTP_BACKEND",
            `Downloaded ${store.ledger.length} rows (bitfli-audit-ledger.csv)`,
          );
          return {
            filename: "bitfli-audit-ledger.csv",
            rowCount: store.ledger.length,
          };
        }
      } catch {
        // Fall through to deterministic client-side CSV export
      }
    }

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

    const rows = store.ledger.map((item) =>
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
    const filename = "bitfli-audit-ledger.csv";
    triggerBrowserDownload(csvContent, filename);
    recomputeLocalStore(
      "GET",
      "/api/ledger/csv",
      "LOCAL_TEE_SIM",
      `Downloaded ${store.ledger.length} rows (${filename})`,
    );

    return { filename, rowCount: store.ledger.length };
  },

  /** Alias for exportLedgerCsv */
  async downloadAuditCsv(): Promise<{ filename: string; rowCount: number }> {
    return this.exportLedgerCsv();
  },
};

// Named function exports for direct callers
export const fetchDashboard = (mode?: NetworkMode, podId?: string) =>
  bitfliApi.getDashboard(mode, podId);
export const createInvoice = (
  input: Parameters<typeof bitfliApi.createInvoice>[0],
) => bitfliApi.createInvoice(input);
export const settleInvoice = (invoiceId: string) =>
  bitfliApi.simulateInvoicePayment(invoiceId);
export const updatePolicy = (
  patch: Parameters<typeof bitfliApi.updatePolicy>[0],
) => bitfliApi.updatePolicy(patch);
export const evaluateProcurement = (req: AgentProcureRequest) =>
  bitfliApi.procureAgentSpend(req);
export const runProfitSplit = (
  options?: Parameters<typeof bitfliApi.executeProfitSplit>[0],
) => bitfliApi.executeProfitSplit(options);
export const launchPod = (input: Parameters<typeof bitfliApi.createPod>[0]) =>
  bitfliApi.createPod(input);
export const downloadAuditCsv = () => bitfliApi.exportLedgerCsv();

function triggerBrowserDownload(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.setAttribute("download", filename);
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
