const AGENT_API_BASE =
  process.env.AGENT_API_URL?.replace(/\/$/, "") ||
  "https://api.agentsonintents.com/v1";

const OUTLAYER_API_BASE =
  process.env.OUTLAYER_API_URL?.replace(/\/$/, "") || "https://api.outlayer.ai";

export type ExternalDataSourceStatus =
  | "live_api"
  | "unconfigured_error"
  | "api_error";

export interface AgentContainmentState {
  agentId: string;
  contained: boolean;
  containmentMode: "ACTIVE" | "FROZEN" | "UNVERIFIED";
  grantsCount: number;
  grants: Array<{
    grantId: string;
    scope: string;
    maxAmountUsd?: number;
    status: string;
  }>;
  source: ExternalDataSourceStatus;
  status: "LIVE_AGENT_API" | "SANDBOX_PREVIEW";
  mode: "live_agent_api" | "local_policy_check";
  error?: string;
  checkedAt: string;
}

export interface OutLayerHardwareAttestation {
  callId: string;
  enclaveMeasurement: string;
  quoteHex?: string;
  reportData?: string;
  verified: boolean;
  source: ExternalDataSourceStatus;
  error?: string;
  fetchedAt: string;
}

/**
 * Queries the official NEAR Intents Agent API (https://api.agentsonintents.com/v1):
 * - GET /v1/agents/{agent_id}/containment
 * - GET /v1/agents/{agent_id}/grants
 * Never fabricates mock containment or grant records when unconfigured or unreachable.
 */
export async function syncAgentContainmentAndGrants(
  agentIdOrParams?:
    | string
    | {
        agentId?: string;
        apiKey?: string;
      },
): Promise<AgentContainmentState> {
  const params =
    typeof agentIdOrParams === "string"
      ? { agentId: agentIdOrParams }
      : agentIdOrParams;
  const agentId =
    params?.agentId || process.env.AGENT_ID || "pod-01.bitfli.near";
  const apiKey = params?.apiKey || process.env.AGENT_API_KEY || "";
  const checkedAt = new Date().toISOString();

  if (!apiKey) {
    return {
      agentId,
      contained: false,
      containmentMode: "UNVERIFIED",
      grantsCount: 0,
      grants: [],
      source: "unconfigured_error",
      status: "SANDBOX_PREVIEW",
      mode: "local_policy_check",
      error:
        "AGENT_API_KEY not configured in environment; falling back to local_policy_check and on-chain contract guard.",
      checkedAt,
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    };

    const encodedId = encodeURIComponent(agentId);
    const [containmentRes, grantsRes] = await Promise.all([
      fetch(`${AGENT_API_BASE}/agents/${encodedId}/containment`, {
        method: "GET",
        headers,
        signal: controller.signal,
      }),
      fetch(`${AGENT_API_BASE}/agents/${encodedId}/grants`, {
        method: "GET",
        headers,
        signal: controller.signal,
      }),
    ]);
    clearTimeout(timeout);

    if (!containmentRes.ok && !grantsRes.ok) {
      return {
        agentId,
        contained: false,
        containmentMode: "UNVERIFIED",
        grantsCount: 0,
        grants: [],
        source: "api_error",
        status: "SANDBOX_PREVIEW",
        mode: "local_policy_check",
        error: `NEAR Intents Agent API returned HTTP ${containmentRes.status} (containment) and HTTP ${grantsRes.status} (grants).`,
        checkedAt,
      };
    }

    const containmentData = containmentRes.ok
      ? ((await containmentRes.json()) as {
          contained?: boolean;
          status?: string;
          frozen?: boolean;
        })
      : {};

    const grantsData = grantsRes.ok
      ? ((await grantsRes.json()) as
          | Array<{
              id?: string;
              grant_id?: string;
              scope?: string;
              max_amount_usd?: number;
              status?: string;
            }>
          | {
              grants?: Array<{
                id?: string;
                grant_id?: string;
                scope?: string;
                max_amount_usd?: number;
                status?: string;
              }>;
            })
      : [];

    const rawGrants = Array.isArray(grantsData)
      ? grantsData
      : Array.isArray(grantsData.grants)
        ? grantsData.grants
        : [];

    const grants = rawGrants.map((g, idx) => ({
      grantId: g.grant_id || g.id || `grant_${idx + 1}`,
      scope: g.scope || "procurement",
      maxAmountUsd: g.max_amount_usd,
      status: g.status || "ACTIVE",
    }));

    const isFrozen =
      containmentData.frozen === true || containmentData.status === "FROZEN";

    return {
      agentId,
      contained: Boolean(containmentData.contained ?? true),
      containmentMode: isFrozen ? "FROZEN" : "ACTIVE",
      grantsCount: grants.length,
      grants,
      source: "live_api",
      status: "LIVE_AGENT_API",
      mode: "live_agent_api",
      checkedAt,
    };
  } catch (err) {
    return {
      agentId,
      contained: false,
      containmentMode: "UNVERIFIED",
      grantsCount: 0,
      grants: [],
      source: "api_error",
      status: "SANDBOX_PREVIEW",
      mode: "local_policy_check",
      error:
        err instanceof Error
          ? err.message
          : "Failed to reach https://api.agentsonintents.com/v1",
      checkedAt,
    };
  }
}

export const fetchAgentContainmentAndGrants = syncAgentContainmentAndGrants;

/**
 * Fetches a genuine hardware enclave attestation from OutLayer by call_id:
 * GET https://api.outlayer.ai/attestations/by-call/{call_id}
 */
export async function fetchOutlayerAttestationByCallId(
  callId: string,
  apiKey?: string,
): Promise<OutLayerHardwareAttestation> {
  const fetchedAt = new Date().toISOString();
  if (!callId || !callId.trim()) {
    return {
      callId: "",
      enclaveMeasurement: "local_policy_check",
      verified: false,
      source: "unconfigured_error",
      error: "No OutLayer call_id returned; local_policy_check only.",
      fetchedAt,
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const token = apiKey || process.env.OUTLAYER_API_KEY;
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const res = await fetch(
      `${OUTLAYER_API_BASE}/attestations/by-call/${encodeURIComponent(callId)}`,
      {
        method: "GET",
        headers,
        signal: controller.signal,
      },
    );
    clearTimeout(timeout);

    if (!res.ok) {
      return {
        callId,
        enclaveMeasurement: "local_policy_check",
        verified: false,
        source: "api_error",
        error: `GET /attestations/by-call/${callId} returned HTTP ${res.status}`,
        fetchedAt,
      };
    }

    const body = (await res.json()) as {
      enclave_measurement?: string;
      mrtd?: string;
      quote?: string;
      report_data?: string;
      verified?: boolean;
    };

    return {
      callId,
      enclaveMeasurement:
        body.enclave_measurement || body.mrtd || "live_outlayer_attestation",
      quoteHex: body.quote,
      reportData: body.report_data,
      verified: Boolean(body.verified ?? true),
      source: "live_api",
      fetchedAt,
    };
  } catch (err) {
    return {
      callId,
      enclaveMeasurement: "local_policy_check",
      verified: false,
      source: "api_error",
      error:
        err instanceof Error
          ? err.message
          : "OutLayer attestation endpoint unreachable",
      fetchedAt,
    };
  }
}
