import crypto from "node:crypto";
import {
  fetchOutlayerAttestationByCallId,
  type ExternalDataSourceStatus,
  type OutLayerHardwareAttestation,
} from "./agentApiService.js";
import {
  formatUtcTimestamp,
  isDryRunEnabled,
  LOCAL_POLICY_CHECK_MODE,
  type AgentProcureRequest,
  type DecisionEvaluation,
  type DecisionVerdict,
  type ProfitSplitConfig,
  type TreasuryPolicy,
} from "./outlayerCustody.js";

const OUTLAYER_API_BASE =
  process.env.OUTLAYER_API_URL?.replace(/\/$/, "") || "https://api.outlayer.ai";

export {
  formatUtcTimestamp,
  isDryRunEnabled,
  LOCAL_POLICY_CHECK_MODE,
  type AgentProcureRequest,
  type DecisionEvaluation,
  type DecisionVerdict,
  type ProfitSplitConfig,
  type TreasuryPolicy,
};

export type StrictPolicyViolationCode =
  | "RULE_KILL_SWITCH_FROZEN"
  | "RULE_EMERGENCY_FREEZE_ACTIVE"
  | "RULE_MAX_SINGLE_TX_EXCEEDED"
  | "RULE_DAILY_SPEND_CAP_EXCEEDED"
  | "RULE_AVAILABLE_OPEX_EXCEEDED"
  | "RULE_VENDOR_NOT_ALLOWLISTED";

export interface OutLayerProvisionedWallet {
  api_key: string;
  near_account_id: string;
  handoff_url: string;
  enclaveMeasurement: string;
  provisionedAt: string;
  source: "live_api" | "live_outlayer_api" | "unconfigured_error" | "api_error";
  error?: string;
}

export interface OutLayerAttestationObject {
  enclaveMeasurement: string;
  podId: string;
  nearBlockHeight: number;
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
  violationCodes: StrictPolicyViolationCode[];
  nonce: string;
  timestamp: string;
  signature: string;
}

function sha256Hex(payload: string): string {
  return crypto.createHash("sha256").update(payload).digest("hex");
}

/**
 * Strips any raw secret key query parameter from an OutLayer handoff_url
 * so API keys are never persisted in state files or leaked in public health responses.
 */
export function sanitizeHandoffUrl(
  rawUrl: string | undefined,
  nearAccountId: string,
): string {
  const safeAccount = nearAccountId || "unconfigured";
  if (!rawUrl) {
    return `https://app.outlayer.ai/wallet?account=${safeAccount.slice(0, 16)}`;
  }
  return rawUrl.replace(/([?&]key=)[^&\s]+/g, `$1REDACTED`);
}

/**
 * Formula: availableOpexUsd = treasuryBalanceUsd * (1 - profitLockPct / 100)
 */
export function computeDynamicAvailableOpexUsd(
  treasuryBalanceUsd: number,
  profitLockPct: number,
): number {
  const unlockedRatio = Math.max(0, Math.min(1, 1 - profitLockPct / 100));
  return +(treasuryBalanceUsd * unlockedRatio).toFixed(2);
}

/**
 * Provisions a real OutLayer custody wallet via POST https://api.outlayer.ai/register
 * or loads OUTLAYER_API_KEY + OUTLAYER_NEAR_ACCOUNT from .env.
 * Never persists raw wallet keys to tracked files.
 */
export async function ensureOutlayerWallet(
  existing?: OutLayerProvisionedWallet | null,
  podName = "bitfli-pod-01",
): Promise<OutLayerProvisionedWallet> {
  const envKey = process.env.OUTLAYER_API_KEY || "";
  const envAccount = process.env.OUTLAYER_NEAR_ACCOUNT || "";
  const envHandoff = process.env.OUTLAYER_HANDOFF_URL || "";

  if (envKey && envAccount) {
    return {
      api_key: envKey,
      near_account_id: envAccount,
      handoff_url: sanitizeHandoffUrl(envHandoff, envAccount),
      enclaveMeasurement: LOCAL_POLICY_CHECK_MODE,
      provisionedAt: existing?.provisionedAt || new Date().toISOString(),
      source: "live_api",
    };
  }

  if (
    existing &&
    (existing.source === "live_api" || existing.source === "live_outlayer_api") &&
    existing.near_account_id
  ) {
    return {
      ...existing,
      api_key: envKey || existing.api_key || "",
      handoff_url: sanitizeHandoffUrl(
        existing.handoff_url,
        existing.near_account_id,
      ),
      source: "live_api",
    };
  }

  const skipLive =
    process.env.SKIP_LIVE_NETWORK === "true" || isDryRunEnabled();

  if (!skipLive) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(`${OUTLAYER_API_BASE}/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(envKey ? { Authorization: `Bearer ${envKey}` } : {}),
        },
        signal: controller.signal,
        body: JSON.stringify({
          name: podName,
          network: "near",
        }),
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = (await res.json()) as {
          api_key?: string;
          near_account_id?: string;
          account_id?: string;
          handoff_url?: string;
        };
        const apiKey = envKey || data.api_key || "";
        const nearAccountId =
          envAccount || data.near_account_id || data.account_id || "";
        const handoffUrl = sanitizeHandoffUrl(
          data.handoff_url,
          nearAccountId,
        );

        if (nearAccountId) {
          return {
            api_key: apiKey,
            near_account_id: nearAccountId,
            handoff_url: handoffUrl,
            enclaveMeasurement: LOCAL_POLICY_CHECK_MODE,
            provisionedAt: new Date().toISOString(),
            source: "live_api",
          };
        }
      }
    } catch {
      // Handled below with explicit status
    }
  }

  const fallbackAccountId =
    envAccount || existing?.near_account_id || "unconfigured.outlayer.near";
  return {
    api_key: envKey,
    near_account_id: fallbackAccountId,
    handoff_url: sanitizeHandoffUrl(envHandoff, fallbackAccountId),
    enclaveMeasurement: LOCAL_POLICY_CHECK_MODE,
    provisionedAt: new Date().toISOString(),
    source: "unconfigured_error",
    error:
      "OUTLAYER_API_KEY not configured and live POST /register did not return a wallet.",
  };
}

/**
 * Syncs live OutLayer wallet balance, policy, and audit log when OUTLAYER_API_KEY is active.
 */
export async function syncOutlayerWalletState(apiKey: string): Promise<{
  liveBalanceFetched: boolean;
  balanceUsd?: number;
  policyActive?: boolean;
  auditCount?: number;
  source: ExternalDataSourceStatus;
}> {
  const effectiveKey = apiKey || process.env.OUTLAYER_API_KEY || "";
  const skipLive =
    process.env.SKIP_LIVE_NETWORK === "true" ||
    Boolean(process.env.NODE_TEST_CONTEXT);
  if (skipLive || !effectiveKey) {
    return { liveBalanceFetched: false, source: "unconfigured_error" };
  }

  try {
    const headers = {
      Accept: "application/json",
      Authorization: `Bearer ${effectiveKey}`,
    };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const [balRes, polRes, audRes] = await Promise.allSettled([
      fetch(`${OUTLAYER_API_BASE}/wallet/v1/balance`, {
        headers,
        signal: controller.signal,
      }),
      fetch(`${OUTLAYER_API_BASE}/wallet/v1/policy`, {
        headers,
        signal: controller.signal,
      }),
      fetch(`${OUTLAYER_API_BASE}/wallet/v1/audit`, {
        headers,
        signal: controller.signal,
      }),
    ]);
    clearTimeout(timeout);

    let balanceUsd: number | undefined;
    if (balRes.status === "fulfilled" && balRes.value.ok) {
      const b = (await balRes.value.json()) as { balance_usd?: number };
      if (typeof b.balance_usd === "number") {
        balanceUsd = b.balance_usd;
      }
    }

    let policyActive: boolean | undefined;
    if (polRes.status === "fulfilled" && polRes.value.ok) {
      const p = (await polRes.value.json()) as { active?: boolean };
      policyActive = p.active;
    }

    let auditCount: number | undefined;
    if (audRes.status === "fulfilled" && audRes.value.ok) {
      const a = (await audRes.value.json()) as unknown[];
      if (Array.isArray(a)) auditCount = a.length;
    }

    return {
      liveBalanceFetched: balanceUsd !== undefined,
      balanceUsd,
      policyActive,
      auditCount,
      source: balanceUsd !== undefined ? "live_api" : "api_error",
    };
  } catch {
    return { liveBalanceFetched: false, source: "api_error" };
  }
}

/**
 * Executes an outbound transfer via POST https://api.outlayer.ai/wallet/v1/transfer.
 * When a real OutLayer call returns a `call_id`, fetches the genuine hardware attestation
 * from GET https://api.outlayer.ai/attestations/by-call/{call_id}.
 * When running a local policy pre-check or sandbox preview without on-chain funds,
 * labels status explicitly as "SANDBOX_PREVIEW" and mode as "local_policy_check".
 */
export async function executeOutlayerTransfer(params: {
  apiKey: string;
  podAccountId: string;
  recipient: string;
  amountUsd: number;
  memo: string;
  policyAuditHash: string;
}): Promise<{
  ok: boolean;
  txHash: string;
  callId?: string;
  teeAttested: boolean;
  status: "LIVE_OUTLAYER_TEE" | "SANDBOX_PREVIEW";
  mode: "live_outlayer_attestation" | "local_policy_check";
  hardwareAttestation?: OutLayerHardwareAttestation;
  source: ExternalDataSourceStatus;
  error?: string;
}> {
  const effectiveKey = params.apiKey || process.env.OUTLAYER_API_KEY || "";
  const skipLive =
    process.env.SKIP_LIVE_NETWORK === "true" ||
    Boolean(process.env.NODE_TEST_CONTEXT) ||
    isDryRunEnabled();

  if (skipLive || !effectiveKey) {
    return {
      ok: false,
      txHash: params.policyAuditHash,
      teeAttested: false,
      status: "SANDBOX_PREVIEW",
      mode: "local_policy_check",
      source: "unconfigured_error",
      error: !effectiveKey
        ? "OUTLAYER_API_KEY is not configured; recorded local_policy_check only."
        : "Live network calls skipped in test/sandbox preview context.",
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${OUTLAYER_API_BASE}/wallet/v1/transfer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${effectiveKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        recipient: params.recipient,
        amount_usd: params.amountUsd,
        token: "USDC",
        memo: params.memo,
        policy_audit_hash: params.policyAuditHash,
      }),
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = (await res.json()) as {
        tx_hash?: string;
        txHash?: string;
        call_id?: string;
        callId?: string;
      };
      const callId = data.call_id ?? data.callId;
      let hardwareAttestation: OutLayerHardwareAttestation | undefined;
      if (callId) {
        hardwareAttestation = await fetchOutlayerAttestationByCallId(
          callId,
          effectiveKey,
        );
      }
      const isAttested = Boolean(
        hardwareAttestation &&
          hardwareAttestation.source === "live_api" &&
          hardwareAttestation.verified,
      );
      return {
        ok: true,
        txHash:
          data.tx_hash ?? data.txHash ?? callId ?? params.policyAuditHash,
        callId,
        teeAttested: isAttested,
        status: isAttested ? "LIVE_OUTLAYER_TEE" : "SANDBOX_PREVIEW",
        mode: isAttested ? "live_outlayer_attestation" : "local_policy_check",
        hardwareAttestation,
        source: "live_api",
      };
    }

    return {
      ok: false,
      txHash: params.policyAuditHash,
      teeAttested: false,
      status: "SANDBOX_PREVIEW",
      mode: "local_policy_check",
      source: "api_error",
      error: `OutLayer /wallet/v1/transfer returned HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      ok: false,
      txHash: params.policyAuditHash,
      teeAttested: false,
      status: "SANDBOX_PREVIEW",
      mode: "local_policy_check",
      source: "api_error",
      error:
        err instanceof Error
          ? err.message
          : "OutLayer transfer endpoint unreachable",
    };
  }
}

/**
 * Computes a deterministic SHA-256 Policy Audit Hash (`audit_sha256_<hex>`) over
 * { podId, policySnapshot, task, decision, timestamp, nearBlockHeight }.
 * Labels local evaluations honestly as `SANDBOX_PREVIEW` and `local_policy_check`.
 */
export function buildCryptographicCommitment(params: {
  podId: string;
  policy: TreasuryPolicy;
  task: {
    vendorName: string;
    vendorAddress: string;
    amountUsd: number;
    category: string;
    reason: string;
  };
  decision: DecisionVerdict;
  ruleChecks: OutLayerAttestationObject["ruleChecks"];
  violationCodes: StrictPolicyViolationCode[];
  timestamp: string;
  nearBlockHeight: number;
  outlayerCallId?: string;
  hardwareAttestation?: OutLayerHardwareAttestation;
}): {
  policyAuditHash: string;
  teeAttested: boolean;
  executionStatus: "LIVE_OUTLAYER_TEE" | "SANDBOX_PREVIEW";
  attestationSource: "live_outlayer_attestation" | "local_policy_check";
  teeReceipt: string;
  attestation: OutLayerAttestationObject;
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
  const nonce = `0x${sha256Hex(`${params.podId}:${params.timestamp}:${params.nearBlockHeight}:${params.task.vendorName}`).slice(0, 16)}`;

  const commitmentPayload = JSON.stringify({
    podId: params.podId,
    policySnapshot,
    task: params.task,
    decision: params.decision,
    timestamp: params.timestamp,
    nearBlockHeight: params.nearBlockHeight,
  });

  const fullHash = sha256Hex(commitmentPayload);
  const policyAuditHash = `audit_sha256_${fullHash.slice(0, 12)}`;
  const teeAttested = Boolean(
    params.hardwareAttestation &&
      params.hardwareAttestation.source === "live_api" &&
      params.hardwareAttestation.verified,
  );
  const executionStatus = teeAttested ? "LIVE_OUTLAYER_TEE" : "SANDBOX_PREVIEW";
  const attestationSource = teeAttested
    ? "live_outlayer_attestation"
    : "local_policy_check";
  const receiptId =
    teeAttested && params.outlayerCallId
      ? `outlayer_call_${params.outlayerCallId}`
      : policyAuditHash;

  return {
    policyAuditHash,
    teeAttested,
    executionStatus,
    attestationSource,
    teeReceipt: receiptId,
    attestation: {
      enclaveMeasurement:
        teeAttested && params.hardwareAttestation?.enclaveMeasurement
          ? params.hardwareAttestation.enclaveMeasurement
          : LOCAL_POLICY_CHECK_MODE,
      podId: params.podId,
      nearBlockHeight: params.nearBlockHeight,
      policyHash,
      taskHash,
      policyAuditHash,
      teeAttested,
      status: executionStatus,
      attestationSource,
      outlayerCallId: params.outlayerCallId,
      hardwareAttestation: params.hardwareAttestation,
      decision: params.decision,
      ruleChecks: params.ruleChecks,
      violationCodes: params.violationCodes,
      nonce,
      timestamp: params.timestamp,
      signature: `0x${fullHash}`,
    },
  };
}

/**
 * Evaluates an agent procurement request against the 5 strict policy rules:
 *  1. autonomousOpsActive === true (if false -> RULE_KILL_SWITCH_FROZEN & RULE_EMERGENCY_FREEZE_ACTIVE)
 *  2. amountUsd <= maxSingleSpendUsd (RULE_MAX_SINGLE_TX_EXCEEDED)
 *  3. (dailySpentUsd + amountUsd) <= dailySpendCapUsd (RULE_DAILY_SPEND_CAP_EXCEEDED)
 *  4. amountUsd <= availableOpexUsd (treasuryBalanceUsd * (1 - profitLockPct / 100)) (RULE_AVAILABLE_OPEX_EXCEEDED)
 *  5. approvedVendors includes vendorName (case-insensitive match) (RULE_VENDOR_NOT_ALLOWLISTED)
 */
export function evaluateProcurement(params: {
  vendorName: string;
  vendorAddress?: string;
  amountUsd: number;
  category?: string;
  reason: string;
  agentName?: string;
  rail?: string;
  policy: TreasuryPolicy;
  treasuryBalanceUsd: number;
  nearBlockHeight?: number;
}): DecisionEvaluation & {
  violationCodes: StrictPolicyViolationCode[];
  attestation: OutLayerAttestationObject;
} {
  const {
    vendorName,
    vendorAddress = vendorName,
    amountUsd,
    category = "OPEX_PROCUREMENT",
    reason,
    agentName = "Procurement Agent (pod-01)",
    rail,
    policy,
    treasuryBalanceUsd,
    nearBlockHeight = 142158920,
  } = params;

  const timestamp = formatUtcTimestamp();
  const availableOpexUsd = computeDynamicAvailableOpexUsd(
    treasuryBalanceUsd,
    policy.profitLockPct,
  );

  const rule1Pass = policy.autonomousOpsActive === true;
  const rule2Pass = amountUsd <= policy.maxSingleTxUsd;
  const rule3Pass =
    policy.dailySpentTodayUsd + amountUsd <= policy.dailySpendCapUsd;
  const rule4Pass = amountUsd <= availableOpexUsd;

  const normalizedTarget = vendorName.trim().toLowerCase();
  const rule5Pass = policy.vendorAllowlist.some(
    (v) => v.trim().toLowerCase() === normalizedTarget,
  );

  const violationCodes: StrictPolicyViolationCode[] = [];
  if (!rule1Pass) {
    violationCodes.push("RULE_KILL_SWITCH_FROZEN");
    violationCodes.push("RULE_EMERGENCY_FREEZE_ACTIVE");
  }
  if (!rule2Pass) {
    violationCodes.push("RULE_MAX_SINGLE_TX_EXCEEDED");
  }
  if (!rule3Pass) {
    violationCodes.push("RULE_DAILY_SPEND_CAP_EXCEEDED");
  }
  if (!rule4Pass) {
    violationCodes.push("RULE_AVAILABLE_OPEX_EXCEEDED");
  }
  if (!rule5Pass) {
    violationCodes.push("RULE_VENDOR_NOT_ALLOWLISTED");
  }

  const verdict: DecisionVerdict =
    violationCodes.length === 0 ? "ALLOW" : "BLOCK";

  const {
    policyAuditHash,
    teeAttested,
    executionStatus,
    attestationSource,
    teeReceipt,
    attestation,
  } = buildCryptographicCommitment({
    podId: policy.podAccountId,
    policy,
    task: {
      vendorName,
      vendorAddress,
      amountUsd,
      category,
      reason,
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
    nearBlockHeight,
  });

  if (!rule1Pass) {
    return {
      verdict: "BLOCK",
      scenarioKey: "custom-procure",
      taskTitle: `${agentName} requests $${amountUsd.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      taskActor: agentName,
      taskCounterparty: vendorName,
      taskAmountUsd: amountUsd,
      taskChainRoute: rail ?? "OutLayer Policy Guardrail",
      taskDetail: reason,
      headline: "Blocked by Human Kill-Switch ($0.00 moved)",
      explanation: `Blocked [RULE_KILL_SWITCH_FROZEN]: Autonomous operations on ${policy.podAccountId} are currently FROZEN (HUMAN LOCK). Policy engine refused transfer of $${amountUsd.toFixed(2)} to ${vendorName}.`,
      policyAuditHash,
      teeAttested,
      executionStatus,
      attestationSource,
      teeReceipt,
      evaluatedAt: timestamp,
      violationCodes,
      attestation,
    };
  }

  if (verdict === "BLOCK") {
    const reasons: string[] = [];
    if (!rule2Pass) {
      reasons.push(
        `$${policy.maxSingleTxUsd} single-tx limit (RULE_MAX_SINGLE_TX_EXCEEDED)`,
      );
    }
    if (!rule3Pass) {
      const remaining = Math.max(
        0,
        policy.dailySpendCapUsd - policy.dailySpentTodayUsd,
      );
      reasons.push(
        `remaining $${remaining.toFixed(0)} of $${policy.dailySpendCapUsd} daily cap (RULE_DAILY_SPEND_CAP_EXCEEDED)`,
      );
    }
    if (!rule4Pass) {
      reasons.push(
        `available OpEx margin buffer $${availableOpexUsd.toFixed(2)} (RULE_AVAILABLE_OPEX_EXCEEDED)`,
      );
    }
    if (!rule5Pass) {
      reasons.push("vendor allowlist (RULE_VENDOR_NOT_ALLOWLISTED)");
    }

    return {
      verdict: "BLOCK",
      scenarioKey: "custom-procure",
      taskTitle: `${agentName} attempts $${amountUsd.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} transfer`,
      taskActor: agentName,
      taskCounterparty: vendorName,
      taskAmountUsd: amountUsd,
      taskChainRoute: rail ?? "OutLayer Policy Firewall",
      taskDetail: reason,
      headline: "Policy Violation · Transfer Refused",
      explanation: `Blocked: $${amountUsd.toFixed(2)} to ${vendorName} violates your ${reasons.join(" and ")}. Zero funds moved.`,
      policyAuditHash,
      teeAttested,
      executionStatus,
      attestationSource,
      teeReceipt,
      evaluatedAt: timestamp,
      violationCodes,
      attestation,
    };
  }

  return {
    verdict: "ALLOW",
    scenarioKey: "custom-procure",
    taskTitle: `${agentName} procures $${amountUsd.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} credits`,
    taskActor: agentName,
    taskCounterparty: vendorName,
    taskAmountUsd: amountUsd,
    taskChainRoute: rail ?? "OutLayer Custody · NEAR USDC",
    taskDetail: reason,
    headline: "Policy Guardrails Passed · OutLayer Custody Authorized",
    explanation: `Approved: $${amountUsd.toFixed(2)} to ${vendorName} passed all 5 policy rules ($${policy.maxSingleTxUsd} per-tx cap, $${policy.dailySpendCapUsd} daily cap, $${availableOpexUsd.toFixed(2)} available OpEx, and verified vendor allowlist).`,
    policyAuditHash,
    teeAttested,
    executionStatus,
    attestationSource,
    teeReceipt,
    evaluatedAt: timestamp,
    violationCodes: [],
    attestation,
  };
}
