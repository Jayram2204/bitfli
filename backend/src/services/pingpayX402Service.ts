import type { ExternalDataSourceStatus } from "./agentApiService.js";

const PINGPAY_FACILITATOR_BASE =
  process.env.PINGPAY_FACILITATOR_URL?.replace(/\/$/, "") ||
  "https://facilitator.pingpay.io";

export const BASE_USDC_ASSET_ADDRESS =
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

export interface X402PaymentAcceptEntry {
  scheme: "exact";
  network: "base";
  asset: string;
  payTo: string;
  maxAmountRequired: string;
  resource: string;
  description: string;
  mimeType: string;
}

export interface X402ChallengePayload {
  x402Version: 1;
  error: string;
  accepts: X402PaymentAcceptEntry[];
  facilitatorUrl: string;
}

export interface X402VerificationResult {
  valid: boolean;
  settled: boolean;
  txHash?: string;
  payer?: string;
  source: ExternalDataSourceStatus;
  error?: string;
}

/**
 * Builds a standard HTTP 402 Payment Required challenge payload per the x402 specification.
 */
export function buildX402PaymentChallenge(params: {
  payTo?: string;
  maxAmountRequiredAtomic?: string;
  resource?: string;
}): X402ChallengePayload {
  const payTo =
    params.payTo ||
    process.env.PINGPAY_PAY_TO_ADDRESS ||
    "0x71C98f4c1c00b17f1148a3e9129e2a0011223344";
  const maxAmountRequired = params.maxAmountRequiredAtomic || "100000"; // $0.10 Base USDC (6 decimals)
  const resource = params.resource || "/api/x402/deliverable";

  return {
    x402Version: 1,
    error: "X-PAYMENT header is required to access this x402 gated resource.",
    facilitatorUrl: PINGPAY_FACILITATOR_BASE,
    accepts: [
      {
        scheme: "exact",
        network: "base",
        asset: BASE_USDC_ASSET_ADDRESS,
        payTo,
        maxAmountRequired,
        resource,
        description:
          "bitfli.xyz Cryptographic Agency Deliverable & Pod Audit Report (x402 Gated)",
        mimeType: "application/json",
      },
    ],
  };
}

/**
 * Verifies and settles an incoming X-PAYMENT header against the PingPay x402 facilitator:
 * - POST https://facilitator.pingpay.io/verify
 * - POST https://facilitator.pingpay.io/settle
 * Never fakes verification when the facilitator rejects the payment proof.
 */
export async function verifyAndSettleX402Payment(params: {
  xPaymentHeader: string;
  payTo?: string;
  maxAmountRequiredAtomic?: string;
  resource?: string;
}): Promise<X402VerificationResult> {
  const challenge = buildX402PaymentChallenge({
    payTo: params.payTo,
    maxAmountRequiredAtomic: params.maxAmountRequiredAtomic,
    resource: params.resource,
  });
  const paymentRequirement = challenge.accepts[0];

  let decodedPayment: unknown = params.xPaymentHeader;
  try {
    const jsonStr = Buffer.from(params.xPaymentHeader, "base64").toString(
      "utf-8",
    );
    if (jsonStr.trim().startsWith("{")) {
      decodedPayment = JSON.parse(jsonStr);
    }
  } catch {
    // Keep raw header if not base64 JSON
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const verifyRes = await fetch(`${PINGPAY_FACILITATOR_BASE}/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        x402Version: 1,
        paymentHeader: params.xPaymentHeader,
        paymentPayload: decodedPayment,
        paymentRequirements: paymentRequirement,
      }),
    });

    if (!verifyRes.ok) {
      clearTimeout(timeout);
      const errBody = await verifyRes.text().catch(() => "");
      return {
        valid: false,
        settled: false,
        source: "api_error",
        error: `PingPay facilitator /verify returned HTTP ${verifyRes.status}${errBody ? `: ${errBody.slice(0, 120)}` : ""}`,
      };
    }

    const verifyJson = (await verifyRes.json()) as {
      isValid?: boolean;
      valid?: boolean;
      invalidReason?: string;
      payer?: string;
    };

    const isValid = Boolean(verifyJson.isValid ?? verifyJson.valid);
    if (!isValid) {
      clearTimeout(timeout);
      return {
        valid: false,
        settled: false,
        payer: verifyJson.payer,
        source: "live_api",
        error:
          verifyJson.invalidReason ||
          "PingPay facilitator rejected X-PAYMENT signature.",
      };
    }

    const settleRes = await fetch(`${PINGPAY_FACILITATOR_BASE}/settle`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        x402Version: 1,
        paymentHeader: params.xPaymentHeader,
        paymentPayload: decodedPayment,
        paymentRequirements: paymentRequirement,
      }),
    });
    clearTimeout(timeout);

    if (!settleRes.ok) {
      const errBody = await settleRes.text().catch(() => "");
      return {
        valid: true,
        settled: false,
        payer: verifyJson.payer,
        source: "api_error",
        error: `PingPay facilitator /settle returned HTTP ${settleRes.status}${errBody ? `: ${errBody.slice(0, 120)}` : ""}`,
      };
    }

    const settleJson = (await settleRes.json()) as {
      success?: boolean;
      txHash?: string;
      transaction?: string;
    };

    return {
      valid: true,
      settled: Boolean(settleJson.success ?? true),
      txHash: settleJson.txHash || settleJson.transaction,
      payer: verifyJson.payer,
      source: "live_api",
    };
  } catch (err) {
    return {
      valid: false,
      settled: false,
      source: "api_error",
      error:
        err instanceof Error
          ? `PingPay facilitator error: ${err.message}`
          : "Failed to contact https://facilitator.pingpay.io",
    };
  }
}
