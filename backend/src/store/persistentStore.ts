import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { SourceChainOption } from "../services/oneClickService.js";
import {
  buildCryptographicCommitment,
  computeDynamicAvailableOpexUsd,
  evaluateProcurement,
  formatUtcTimestamp,
  LOCAL_POLICY_CHECK_MODE,
  sanitizeHandoffUrl,
  type DecisionEvaluation,
  type DecisionVerdict,
  type OutLayerAttestationObject,
  type OutLayerProvisionedWallet,
  type ProfitSplitConfig,
  type TreasuryPolicy,
} from "../services/outlayerService.js";

const defaultLocalStatePath = fs.existsSync(
  path.resolve(process.cwd(), "backend/data"),
)
  ? path.resolve(process.cwd(), "backend/data/state.json")
  : path.resolve(process.cwd(), "data/state.json");

export const STATE_FILE_PATH =
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
    ? "/tmp/bitfli-state.json"
    : defaultLocalStatePath;

export type NetworkMode = "sandbox" | "testnet";

export type LedgerEventType =
  | "INTENTS IN"
  | "OUTLAYER OPEX"
  | "RULE BLOCKED"
  | "PROFIT SPLIT";

export interface TreasuryMetrics {
  treasuryBalanceUsd: number;
  grossClientInflows30dUsd: number;
  grossClientInflowsUsd: number;
  autonomousOpExSpentUsd: number;
  autonomousOpexSpentUsd: number;
  dailySpentUsd: number;
  availableOpexUsd: number;
  netDistributableProfitUsd: number;
}

export interface LedgerEntry {
  id: string;
  podId: string;
  timestamp: string;
  eventType: LedgerEventType;
  counterparty: string;
  chainOrRail: string;
  amountUsd: number;
  externalTreasuryDebitUsd?: number;
  countsTowardDailyToday?: boolean;
  verdict: DecisionVerdict;
  policyAuditHash: string;
  teeAttested: boolean;
  executionStatus?: "LIVE_OUTLAYER_TEE" | "SANDBOX_PREVIEW";
  attestationSource?: "live_outlayer_attestation" | "local_policy_check";
  teeReceipt: string;
  enclaveMeasurement: string;
  memo: string;
  attestation?: OutLayerAttestationObject;
}

export interface CrossChainInvoice {
  id: string;
  podId: string;
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
  podId: string;
  payeeLabel: string;
  amountUsd: number;
  memo: string;
  claimUrl: string;
  claimSecretHash: string;
  status: "ACTIVE" | "CLAIMED";
  policyAuditHash: string;
  teeAttested: boolean;
  teeReceipt: string;
  createdAt: string;
}

export interface AgencyPodRecord {
  podAccountId: string;
  podDisplayName: string;
  enclaveMeasurement: string;
  policy: TreasuryPolicy & {
    maxSingleSpendUsd: number;
    dailySpentUsd: number;
    approvedVendors: string[];
  };
  invoices: CrossChainInvoice[];
  checks?: PaymentCheckRecord[];
  ledger: LedgerEntry[];
  activeDecision: DecisionEvaluation;
}

export interface PersistentAppState {
  version: number;
  mode: NetworkMode;
  activePodId: string;
  outlayerWallet: OutLayerProvisionedWallet;
  pods: Record<string, AgencyPodRecord>;
  updatedAt: string;
}

function shortSha(seed: string, len = 8): string {
  return crypto.createHash("sha256").update(seed).digest("hex").slice(0, len);
}

/**
 * Recomputes all pod KPIs mathematically from the pod's immutable audit ledger.
 * Zero hardcoded static KPI figures: every balance is derived directly from ledger rows.
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
  const availableOpexUsd = computeDynamicAvailableOpexUsd(
    treasuryBalanceUsd,
    policy.profitLockPct,
  );

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

function buildSeededPodRecord(): AgencyPodRecord {
  const podId = "pod-01.bitfli.near";
  const basePolicy: TreasuryPolicy = {
    podAccountId: podId,
    podDisplayName: "Studio Meridian Pod #01",
    autonomousOpsActive: true,
    maxSingleTxUsd: 150,
    dailySpendCapUsd: 500,
    dailySpentTodayUsd: 185,
    profitLockPct: 70,
    vendorAllowlist: ["Anthropic API", "AWS Cloud", "Figma Team", "Vercel Pro"],
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

  // Ledger entries whose mathematical sum produces:
  // - Gross Inflows: $2,400 + $6,400 + $9,700 = $18,500.00
  // - Autonomous OpEx Spent: $65 (today) + $120 (today) + $1,245 (prior sprint) = $1,430.00 (dailyToday = $185.00)
  // - Profit Splits Distributed: $3,680.00 ($2,250 external partner payouts + $1,430 retained in vault reserve)
  // -> treasuryBalanceUsd = $18,500 - $1,430 - $2,250 = $14,820.00
  // -> netDistributableProfitUsd = $18,500 - $1,430 - $3,680 = $13,390.00
  const seedRows: Array<
    Omit<
      LedgerEntry,
      | "attestation"
      | "policyAuditHash"
      | "teeAttested"
      | "executionStatus"
      | "attestationSource"
      | "teeReceipt"
    > & {
      fixedReceipt?: string;
    }
  > = [
    {
      id: "ldg_0106",
      podId,
      timestamp: "2025-05-14 14:22:09 UTC",
      eventType: "INTENTS IN",
      counterparty: "Horizon Labs (Milestone #02)",
      chainOrRail: "ETH → NEAR USDC (1Click)",
      amountUsd: 2400.0,
      verdict: "ALLOW",
      fixedReceipt: "1click_0x94a2...e81b",
      enclaveMeasurement: LOCAL_POLICY_CHECK_MODE,
      memo: "Client milestone #02 settled atomically via NEAR Intents 1Click solver.",
    },
    {
      id: "ldg_0105",
      podId,
      timestamp: "2025-05-14 13:48:31 UTC",
      eventType: "OUTLAYER OPEX",
      counterparty: "Anthropic API",
      chainOrRail: "OutLayer Custody · NEAR USDC",
      amountUsd: 65.0,
      countsTowardDailyToday: true,
      verdict: "ALLOW",
      enclaveMeasurement: LOCAL_POLICY_CHECK_MODE,
      memo: "Procurement Agent replenished Claude 3.7 Sonnet batch credits within $150 cap.",
    },
    {
      id: "ldg_0104",
      podId,
      timestamp: "2025-05-14 12:15:04 UTC",
      eventType: "RULE BLOCKED",
      counterparty: "unknown-wallet.near",
      chainOrRail: "OutLayer Policy Guardrail",
      amountUsd: 850.0,
      verdict: "BLOCK",
      enclaveMeasurement: LOCAL_POLICY_CHECK_MODE,
      memo: "Blocked prompt-injected transfer: exceeded $150 per-tx cap and failed vendor allowlist.",
    },
    {
      id: "ldg_0103",
      podId,
      timestamp: "2025-05-14 09:30:18 UTC",
      eventType: "OUTLAYER OPEX",
      counterparty: "AWS Cloud",
      chainOrRail: "OutLayer Custody · NEAR USDC",
      amountUsd: 120.0,
      countsTowardDailyToday: true,
      verdict: "ALLOW",
      enclaveMeasurement: LOCAL_POLICY_CHECK_MODE,
      memo: "Staging GPU worker cluster auto-settled under verified vendor allowlist.",
    },
    {
      id: "ldg_0102",
      podId,
      timestamp: "2025-05-12 18:05:44 UTC",
      eventType: "PROFIT SPLIT",
      counterparty: "Partners (55 / 30 / 15 Split)",
      chainOrRail: "NEAR + Solana + Vault (1Click)",
      amountUsd: 3680.0,
      externalTreasuryDebitUsd: 2250.0,
      verdict: "ALLOW",
      fixedReceipt: "1click_split_2a19...f73e",
      enclaveMeasurement: LOCAL_POLICY_CHECK_MODE,
      memo: "Bi-weekly net margin waterfall settled cross-chain to Lead Dev, Design Partner & Tax Reserve.",
    },
    {
      id: "ldg_0101",
      podId,
      timestamp: "2025-05-10 16:11:27 UTC",
      eventType: "INTENTS IN",
      counterparty: "Kinetix Protocol (Retainer)",
      chainOrRail: "Base USDC → NEAR USDC (1Click)",
      amountUsd: 6400.0,
      verdict: "ALLOW",
      fixedReceipt: "1click_0x63f0...12d4",
      enclaveMeasurement: LOCAL_POLICY_CHECK_MODE,
      memo: "Monthly product engineering retainer routed zero-slippage via NEAR Intents.",
    },
    {
      id: "ldg_0100",
      podId,
      timestamp: "2025-05-03 11:20:05 UTC",
      eventType: "OUTLAYER OPEX",
      counterparty: "AWS Cloud",
      chainOrRail: "OutLayer Custody · NEAR USDC",
      amountUsd: 1245.0,
      countsTowardDailyToday: false,
      verdict: "ALLOW",
      enclaveMeasurement: LOCAL_POLICY_CHECK_MODE,
      memo: "Monthly multi-region GPU & Figma Team seat provisioning settled across prior 30d window.",
    },
    {
      id: "ldg_0099",
      podId,
      timestamp: "2025-05-01 09:00:12 UTC",
      eventType: "INTENTS IN",
      counterparty: "Solana Foundation Grant (Milestone #01)",
      chainOrRail: "SOL → NEAR USDC (1Click)",
      amountUsd: 9700.0,
      verdict: "ALLOW",
      fixedReceipt: "1click_0x41b9...77e2",
      enclaveMeasurement: LOCAL_POLICY_CHECK_MODE,
      memo: "Cross-chain architecture milestone #01 settled via NEAR Intents 1Click.",
    },
  ];

  const ledger: LedgerEntry[] = seedRows.map((row, idx) => {
    const {
      policyAuditHash,
      teeAttested,
      executionStatus,
      attestationSource,
      attestation,
    } = buildCryptographicCommitment({
      podId,
      policy: basePolicy,
      task: {
        vendorName: row.counterparty,
        vendorAddress: row.counterparty,
        amountUsd: row.amountUsd,
        category: row.eventType,
        reason: row.memo,
      },
      decision: row.verdict,
      ruleChecks: {
        emergencyFreezeCheck: true,
        maxSingleSpendCheck: row.verdict === "ALLOW",
        dailySpendCapCheck: true,
        availableOpexMarginCheck: true,
        vendorAllowlistCheck: row.verdict === "ALLOW",
      },
      violationCodes:
        row.verdict === "BLOCK"
          ? ["RULE_MAX_SINGLE_TX_EXCEEDED", "RULE_VENDOR_NOT_ALLOWLISTED"]
          : [],
      timestamp: row.timestamp,
      nearBlockHeight: 142150000 - idx * 420,
    });

    const { fixedReceipt, ...restRow } = row;
    const receipt = fixedReceipt ?? policyAuditHash;
    return {
      ...restRow,
      policyAuditHash,
      teeAttested,
      executionStatus,
      attestationSource,
      teeReceipt: receipt,
      attestation,
    };
  });

  const computed = computeMetricsFromLedger(ledger, basePolicy);
  basePolicy.dailySpentTodayUsd = computed.dailySpentUsd;

  const initialDecision = evaluateProcurement({
    vendorName: "Anthropic API",
    vendorAddress: "Anthropic API",
    amountUsd: 65,
    category: "LLM_INFERENCE",
    reason: "Replenish Claude 3.7 Sonnet inference credits via OutLayer Custody",
    agentName: "Procurement Agent (pod-01)",
    rail: "OutLayer Custody · NEAR USDC",
    policy: basePolicy,
    treasuryBalanceUsd: computed.treasuryBalanceUsd,
    nearBlockHeight: 142158920,
  });

  const chkAuditHash = `audit_sha256_${shortSha("CHK-101:Elena Vance", 12)}`;

  return {
    podAccountId: podId,
    podDisplayName: basePolicy.podDisplayName,
    enclaveMeasurement: LOCAL_POLICY_CHECK_MODE,
    policy: {
      ...basePolicy,
      maxSingleSpendUsd: basePolicy.maxSingleTxUsd,
      dailySpentUsd: basePolicy.dailySpentTodayUsd,
      approvedVendors: basePolicy.vendorAllowlist,
    },
    invoices: [
      {
        id: "INV-204",
        podId,
        clientName: "Horizon Labs",
        milestoneMemo: "Sprint 03 — Autonomous Checkout & Indexing",
        amountUsd: 2400,
        sourceChain: "Ethereum ETH",
        quotedSourceAmount: "0.9412 ETH",
        depositAddress: "0x71c98f4c1c00b17f1148a3e9129e2a",
        intentQuoteId: "qt_1click_99281a",
        destinationVault: podId,
        status: "AWAITING_DEPOSIT",
        createdAt: "2025-05-14 14:30:00 UTC",
      },
    ],
    checks: [
      {
        id: "CHK-101",
        podId,
        payeeLabel: "Elena Vance · Motion & SVG Systems",
        amountUsd: 110,
        memo: "Gasless sub-contractor micro-bounty — WebGL convergence shader",
        claimUrl: "https://bitfli.xyz/claim/CHK-101",
        claimSecretHash: "0x94a2e81b71d04c9a55c190fa3e88b102",
        status: "ACTIVE",
        policyAuditHash: chkAuditHash,
        teeAttested: false,
        teeReceipt: chkAuditHash,
        createdAt: "2025-05-14 14:10:00 UTC",
      },
    ],
    ledger,
    activeDecision: initialDecision,
  };
}

export function buildDefaultState(): PersistentAppState {
  const defaultPod = buildSeededPodRecord();
  const envAccount =
    process.env.OUTLAYER_NEAR_ACCOUNT ||
    shortSha("bitfli:outlayer:pod-01", 64);
  const envKey = process.env.OUTLAYER_API_KEY || "";

  return {
    version: 1,
    mode: "sandbox",
    activePodId: defaultPod.podAccountId,
    outlayerWallet: {
      api_key: envKey,
      near_account_id: envAccount,
      handoff_url: sanitizeHandoffUrl(
        process.env.OUTLAYER_HANDOFF_URL,
        envAccount,
      ),
      enclaveMeasurement: LOCAL_POLICY_CHECK_MODE,
      provisionedAt: "2025-05-14T14:00:00.000Z",
      source: envKey ? "live_api" : "unconfigured_error",
    },
    pods: {
      [defaultPod.podAccountId]: defaultPod,
    },
    updatedAt: new Date().toISOString(),
  };
}

export class PersistentStore {
  private state: PersistentAppState;

  constructor() {
    this.state = this.loadFromDiskOrInit();
  }

  private loadFromDiskOrInit(): PersistentAppState {
    try {
      if (fs.existsSync(STATE_FILE_PATH)) {
        const raw = fs.readFileSync(STATE_FILE_PATH, "utf-8");
        const parsed = JSON.parse(raw) as PersistentAppState;
        if (parsed && parsed.pods && parsed.activePodId) {
          // Hydrate api_key from environment if redacted on disk
          if (process.env.OUTLAYER_API_KEY) {
            parsed.outlayerWallet.api_key = process.env.OUTLAYER_API_KEY;
            parsed.outlayerWallet.source = "live_api";
          }
          if (process.env.OUTLAYER_NEAR_ACCOUNT) {
            parsed.outlayerWallet.near_account_id =
              process.env.OUTLAYER_NEAR_ACCOUNT;
          }
          parsed.outlayerWallet.handoff_url = sanitizeHandoffUrl(
            parsed.outlayerWallet.handoff_url,
            parsed.outlayerWallet.near_account_id,
          );
          return parsed;
        }
      }
    } catch {
      // Re-initialize if corrupted
    }
    const fresh = buildDefaultState();
    this.saveToDisk(fresh);
    return fresh;
  }

  /**
   * Writes state to disk atomically while stripping any raw secret keys
   * so credentials are never stored in JSON state files.
   */
  public saveToDisk(nextState: PersistentAppState = this.state): void {
    this.state = nextState;
    this.state.updatedAt = new Date().toISOString();

    const diskSafeCopy: PersistentAppState = {
      ...this.state,
      outlayerWallet: {
        ...this.state.outlayerWallet,
        api_key: "", // Never persist raw API keys to disk
        handoff_url: sanitizeHandoffUrl(
          this.state.outlayerWallet.handoff_url,
          this.state.outlayerWallet.near_account_id,
        ),
      },
    };

    const serialized = JSON.stringify(diskSafeCopy, null, 2);
    try {
      const dir = path.dirname(STATE_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const tmpFilePath = `${STATE_FILE_PATH}.tmp.${process.pid}.${Date.now()}`;
      fs.writeFileSync(tmpFilePath, serialized, "utf-8");
      fs.renameSync(tmpFilePath, STATE_FILE_PATH);
    } catch {
      try {
        const fallbackTmp = `/tmp/bitfli-state.json.tmp.${process.pid}`;
        fs.writeFileSync(fallbackTmp, serialized, "utf-8");
        fs.renameSync(fallbackTmp, "/tmp/bitfli-state.json");
      } catch {
        // Keep in-memory state if filesystem is read-only
      }
    }
  }

  public resetToDefault(): PersistentAppState {
    const fresh = buildDefaultState();
    if (
      this.state?.outlayerWallet?.source === "live_api" ||
      this.state?.outlayerWallet?.source === "live_outlayer_api"
    ) {
      fresh.outlayerWallet = {
        ...this.state.outlayerWallet,
        handoff_url: sanitizeHandoffUrl(
          this.state.outlayerWallet.handoff_url,
          this.state.outlayerWallet.near_account_id,
        ),
      };
    }
    this.saveToDisk(fresh);
    return this.state;
  }

  public getState(): PersistentAppState {
    return this.state;
  }

  public getActivePod(requestedPodId?: string): AgencyPodRecord {
    if (requestedPodId && this.state.pods[requestedPodId]) {
      this.state.activePodId = requestedPodId;
    }
    return (
      this.state.pods[this.state.activePodId] ??
      Object.values(this.state.pods)[0]
    );
  }

  public setOutlayerWallet(wallet: OutLayerProvisionedWallet): void {
    this.state.outlayerWallet = {
      ...wallet,
      handoff_url: sanitizeHandoffUrl(
        wallet.handoff_url,
        wallet.near_account_id,
      ),
    };
    this.saveToDisk();
  }
}

export const persistentStore = new PersistentStore();
