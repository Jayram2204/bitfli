import crypto from "node:crypto";
import {
  fetchOutlayerAttestationByCallId,
  type AgentContainmentState,
  type ExternalDataSourceStatus,
  type OutLayerHardwareAttestation,
} from "./agentApiService.js";
import type { NearAiProcurementAuditResult } from "./nearAiService.js";

const OUTLAYER_API_BASE =
  process.env.OUTLAYER_API_URL?.replace(/\/$/, "") || "https://api.outlayer.ai";

export const LOCAL_POLICY_CHECK_MODE = "local_policy_check";

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

export interface AgentProcureRequest {
  agentName: string;
  counterparty: string;
  amountUsd: number;
  purpose: string;
  rail?: string;
  dryRun?: boolean;
}

export interface TeeAttestationProof {
  enclaveMeasurement: string;
  podId: string;
  policyHash: string;
  taskHash: string;
  policyAuditHash: string;
  teeAttested: boolean;
  status: "LIVE_OUTLAYER_TEE" | "SANDBOX_PREVIEW";
  attestationSource: "live_outlayer_attestation" | "local_policy_check";
  outlayerCallId?: string;
  hardwareAttestation?: OutLayerHardwareAttestation;
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
  policyAuditHash: string;
  teeAttested: boolean;
  executionStatus: "LIVE_OUTLAYER_TEE" | "SANDBOX_PREVIEW";
  attestationSource: "live_outlayer_attestation" | "local_policy_check";
  teeReceipt: string;
  evaluatedAt: string;
  violationCodes?: PolicyRuleViolationCode[];
  attestation?: TeeAttestationProof;
  nearAiAudit?: NearAiProcurementAuditResult;
  agentContainment?: AgentContainmentState;
}

export function isDryRunEnabled(): boolean {
  return (process.env.DRY_RUN ?? "false").toLowerCase() === "true";
}

export function formatUtcTimestamp(date = new Date()): string {
  return date.toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

function sha256Hex(payload: string): string {
  return crypto.createHash("sha256").update(payload).digest("hex");
}

export function computeAvailableOpexUsd(params: {
  treasuryBalanceUsd: number;
  grossClientInflows30dUsd: number;
  profitLockPct: number;
}): number {
  const lockedMarginFloor =
    (params.grossClientInflows30dUsd * params.profitLockPct) / 100;
  const unlockedFromGross =
    (params.grossClientInflows30dUsd * (100 - params.profitLockPct)) / 100;
  const unlockedInTreasury = Math.max(
    0,
    params.treasuryBalanceUsd - lockedMarginFloor * 0.5,
  );
  return Math.max(unlockedFromGross, unlockedInTreasury);
}

/**
 * Generates an honest deterministic SHA-256 Policy Audit Hash (`audit_sha256_<hex>`)
 * for local rule checks. Explicitly labels local checks as `SANDBOX_PREVIEW` and `local_policy_check`.
 */
export function generatePolicyAuditCommitment(params: {
  podId: string;
  policy: TreasuryPolicy;
  task: {
    actor: string;
    counterparty: string;
    amountUsd: number;
    purpose: string;
  };
  decision: DecisionVerdict;
  ruleChecks: TeeAttestationProof["ruleChecks"];
  violationCodes: PolicyRuleViolationCode[];
  timestamp: string;
}): {
  policyAuditHash: string;
  teeReceipt: string;
  attestation: TeeAttestationProof;
} {
  const policySnapshot = {
    podAccountId: params.policy.podAccountId,
    autonomousOpsActive: params.policy.autonomousOpsActive,
    maxSingleTxUsd: params.policy.maxSingleTxUsd,
    dailySpendCapUsd: params.policy.dailySpendCapUsd,
    dailySpentTodayUsd: params.policy.dailySpentTodayUsd,
    profitLockPct: params.policy.profitLockPct,
    vendorAllowlist: [...params.policy.vendorAllowlist].sort(),
    profitSplit: params.policy.profitSplit,
  };

  const policyHash = `0x${sha256Hex(JSON.stringify(policySnapshot)).slice(0, 32)}`;
  const taskHash = `0x${sha256Hex(JSON.stringify(params.task)).slice(0, 32)}`;
  const nonce = `0x${sha256Hex(`${params.podId}:${params.timestamp}:${params.task.counterparty}`).slice(0, 16)}`;

  const canonicalPayload = JSON.stringify({
    podId: params.podId,
    policySnapshot,
    task: params.task,
    decision: params.decision,
    timestamp: params.timestamp,
  });

  const fullHashHex = sha256Hex(canonicalPayload);
  const policyAuditHash = `audit_sha256_${fullHashHex.slice(0, 12)}`;

  return {
    policyAuditHash,
    teeReceipt: policyAuditHash,
    attestation: {
      enclaveMeasurement: LOCAL_POLICY_CHECK_MODE,
      podId: params.podId,
      policyHash,
      taskHash,
      policyAuditHash,
      teeAttested: false,
      status: "SANDBOX_PREVIEW",
      attestationSource: "local_policy_check",
      decision: params.decision,
      ruleChecks: params.ruleChecks,
      violationCodes: params.violationCodes,
      nonce,
      timestamp: params.timestamp,
      signature: `0x${fullHashHex}`,
    },
  };
}

export class OutLayerCustodyService {
  /**
   * POST https://api.outlayer.ai/register
   * Provisions an OutLayer enclave custody wallet for an autonomous agency pod.
   */
  async registerPodWallet(params: {
    podAccountId: string;
    podDisplayName: string;
  }): Promise<{
    podAccountId: string;
    enclaveMeasurement: string;
    publicKey: string;
    source: ExternalDataSourceStatus;
    error?: string;
  }> {
    if (isDryRunEnabled()) {
      return {
        podAccountId: params.podAccountId,
        enclaveMeasurement: LOCAL_POLICY_CHECK_MODE,
        publicKey: "",
        source: "unconfigured_error",
        error: "DRY_RUN=true is enabled; skipped live OutLayer wallet registration.",
      };
    }

    try {
      const apiKey = process.env.OUTLAYER_API_KEY;
      const res = await fetch(`${OUTLAYER_API_BASE}/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          name: params.podAccountId,
          network: "near",
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          publicKey?: string;
          near_account_id?: string;
        };
        return {
          podAccountId: data.near_account_id || params.podAccountId,
          enclaveMeasurement: LOCAL_POLICY_CHECK_MODE,
          publicKey: data.publicKey || data.near_account_id || "",
          source: "live_api",
        };
      }
      return {
        podAccountId: params.podAccountId,
        enclaveMeasurement: LOCAL_POLICY_CHECK_MODE,
        publicKey: "",
        source: "api_error",
        error: `OutLayer /register returned HTTP ${res.status}`,
      };
    } catch (err) {
      return {
        podAccountId: params.podAccountId,
        enclaveMeasurement: LOCAL_POLICY_CHECK_MODE,
        publicKey: "",
        source: "api_error",
        error: err instanceof Error ? err.message : "OutLayer unreachable",
      };
    }
  }

  /**
   * POST https://api.outlayer.ai/wallet/v1/transfer
   * Executes an outbound USDC transfer via OutLayer Custody and fetches genuine hardware
   * attestation from GET https://api.outlayer.ai/attestations/by-call/{call_id} when call_id is returned.
   */
  async executeEnclaveTransfer(params: {
    podAccountId: string;
    recipient: string;
    amountUsd: number;
    memo: string;
    policyAuditHash: string;
  }): Promise<{
    ok: boolean;
    txHash: string;
    callId?: string;
    hardwareAttestation?: OutLayerHardwareAttestation;
    status: "LIVE_OUTLAYER_TEE" | "SANDBOX_PREVIEW";
    mode: "live_outlayer_attestation" | "local_policy_check";
    source: ExternalDataSourceStatus;
    error?: string;
  }> {
    const apiKey = process.env.OUTLAYER_API_KEY;
    if (!apiKey) {
      return {
        ok: false,
        txHash: params.policyAuditHash,
        status: "SANDBOX_PREVIEW",
        mode: "local_policy_check",
        source: "unconfigured_error",
        error: "OUTLAYER_API_KEY not configured in environment.",
      };
    }

    try {
      const res = await fetch(`${OUTLAYER_API_BASE}/wallet/v1/transfer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          fromAccountId: params.podAccountId,
          toAccountId: params.recipient,
          amountAtomic: Math.round(params.amountUsd * 1_000_000).toString(),
          memo: params.memo,
          policyAuditHash: params.policyAuditHash,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          txHash?: string;
          tx_hash?: string;
          call_id?: string;
          callId?: string;
        };
        const callId = data.call_id || data.callId;
        const hardwareAttestation = callId
          ? await fetchOutlayerAttestationByCallId(callId, apiKey)
          : undefined;
        return {
          ok: true,
          txHash: data.txHash || data.tx_hash || callId || params.policyAuditHash,
          callId,
          hardwareAttestation,
          status: "LIVE_OUTLAYER_TEE",
          mode: "live_outlayer_attestation",
          source: "live_api",
        };
      }
      return {
        ok: false,
        txHash: params.policyAuditHash,
        status: "SANDBOX_PREVIEW",
        mode: "local_policy_check",
        source: "api_error",
        error: `OutLayer /wallet/v1/transfer returned HTTP ${res.status}`,
      };
    } catch (err) {
      return {
        ok: false,
        txHash: params.policyAuditHash,
        status: "SANDBOX_PREVIEW",
        mode: "local_policy_check",
        source: "api_error",
        error: err instanceof Error ? err.message : "OutLayer transfer error",
      };
    }
  }

  /**
   * Enforces the 5 deterministic policy rules on every agent procurement request.
   */
  evaluateProcurement(params: {
    req: AgentProcureRequest;
    policy: TreasuryPolicy;
    availableOpexUsd: number;
  }): DecisionEvaluation {
    const { req, policy, availableOpexUsd } = params;
    const timestamp = formatUtcTimestamp();

    const emergencyFreeze = !policy.autonomousOpsActive;
    const rule1Pass = emergencyFreeze === false;
    const rule2Pass = req.amountUsd <= policy.maxSingleTxUsd;
    const rule3Pass =
      policy.dailySpentTodayUsd + req.amountUsd <= policy.dailySpendCapUsd;
    const rule4Pass = req.amountUsd <= availableOpexUsd;

    const normalizedVendor = req.counterparty.trim().toLowerCase();
    const rule5Pass = policy.vendorAllowlist.some(
      (v) => v.trim().toLowerCase() === normalizedVendor,
    );

    const violationCodes: PolicyRuleViolationCode[] = [];
    if (!rule1Pass) violationCodes.push("RULE_EMERGENCY_FREEZE_ACTIVE");
    if (!rule2Pass) violationCodes.push("RULE_MAX_SINGLE_TX_EXCEEDED");
    if (!rule3Pass) violationCodes.push("RULE_DAILY_SPEND_CAP_EXCEEDED");
    if (!rule4Pass) violationCodes.push("RULE_AVAILABLE_OPEX_EXCEEDED");
    if (!rule5Pass) violationCodes.push("RULE_VENDOR_NOT_ALLOWLISTED");

    const verdict: DecisionVerdict =
      violationCodes.length === 0 ? "ALLOW" : "BLOCK";

    const { policyAuditHash, teeReceipt, attestation } =
      generatePolicyAuditCommitment({
        podId: policy.podAccountId,
        policy,
        task: {
          actor: req.agentName,
          counterparty: req.counterparty,
          amountUsd: req.amountUsd,
          purpose: req.purpose,
        },
        decision: verdict,
        ruleChecks: {
          emergencyFreezeCheck: rule1Pass,
          maxSingleSpendCheck: rule2Pass,
          dailySpendCapCheck: rule3Pass,
          availableOpexMarginCheck: rule4Pass,
          vendorAllowlistCheck: rule5Pass,
        },
        violationCodes,
        timestamp,
      });

    if (!rule1Pass) {
      return {
        verdict: "BLOCK",
        scenarioKey: "custom-procure",
        taskTitle: `${req.agentName} requests $${req.amountUsd.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
        taskActor: req.agentName,
        taskCounterparty: req.counterparty,
        taskAmountUsd: req.amountUsd,
        taskChainRoute: req.rail ?? "OutLayer Policy Guardrail",
        taskDetail: req.purpose,
        headline: "Blocked by Human Kill-Switch ($0.00 moved)",
        explanation: `Blocked [RULE_EMERGENCY_FREEZE_ACTIVE]: Autonomous operations on ${policy.podAccountId} are currently FROZEN (HUMAN LOCK). Policy engine refused transfer of $${req.amountUsd.toFixed(2)} to ${req.counterparty}.`,
        policyAuditHash,
        teeAttested: false,
        executionStatus: "SANDBOX_PREVIEW",
        attestationSource: "local_policy_check",
        teeReceipt,
        evaluatedAt: timestamp,
        violationCodes,
        attestation,
      };
    }

    if (verdict === "BLOCK") {
      const humanReasons: string[] = [];
      if (!rule2Pass) {
        humanReasons.push(
          `$${policy.maxSingleTxUsd} single-tx limit (RULE_MAX_SINGLE_TX_EXCEEDED)`,
        );
      }
      if (!rule3Pass) {
        const remaining = Math.max(
          0,
          policy.dailySpendCapUsd - policy.dailySpentTodayUsd,
        );
        humanReasons.push(
          `remaining $${remaining.toFixed(0)} of $${policy.dailySpendCapUsd} daily cap (RULE_DAILY_SPEND_CAP_EXCEEDED)`,
        );
      }
      if (!rule4Pass) {
        humanReasons.push(
          `available OpEx margin buffer $${availableOpexUsd.toFixed(2)} (RULE_AVAILABLE_OPEX_EXCEEDED)`,
        );
      }
      if (!rule5Pass) {
        humanReasons.push("vendor allowlist (RULE_VENDOR_NOT_ALLOWLISTED)");
      }

      return {
        verdict: "BLOCK",
        scenarioKey: "custom-procure",
        taskTitle: `${req.agentName} attempts $${req.amountUsd.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} transfer`,
        taskActor: req.agentName,
        taskCounterparty: req.counterparty,
        taskAmountUsd: req.amountUsd,
        taskChainRoute: req.rail ?? "OutLayer Policy Firewall",
        taskDetail: req.purpose,
        headline: "Policy Violation · Transfer Refused",
        explanation: `Blocked: $${req.amountUsd.toFixed(2)} to ${req.counterparty} violates your ${humanReasons.join(" and ")}. Zero funds moved.`,
        policyAuditHash,
        teeAttested: false,
        executionStatus: "SANDBOX_PREVIEW",
        attestationSource: "local_policy_check",
        teeReceipt,
        evaluatedAt: timestamp,
        violationCodes,
        attestation,
      };
    }

    return {
      verdict: "ALLOW",
      scenarioKey: "custom-procure",
      taskTitle: `${req.agentName} procures $${req.amountUsd.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} credits`,
      taskActor: req.agentName,
      taskCounterparty: req.counterparty,
      taskAmountUsd: req.amountUsd,
      taskChainRoute: req.rail ?? "OutLayer Custody · NEAR USDC",
      taskDetail: req.purpose,
      headline: "Policy Guardrails Passed · OutLayer Custody Authorized",
      explanation: `Approved: $${req.amountUsd.toFixed(2)} to ${req.counterparty} passed all 5 policy rules ($${policy.maxSingleTxUsd} per-tx cap, $${policy.dailySpendCapUsd} daily cap, margin lock, and verified vendor allowlist).`,
      policyAuditHash,
      teeAttested: false,
      executionStatus: "SANDBOX_PREVIEW",
      attestationSource: "local_policy_check",
      teeReceipt,
      evaluatedAt: timestamp,
      violationCodes: [],
      attestation,
    };
  }
}

export const outlayerCustody = new OutLayerCustodyService();
