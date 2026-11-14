import crypto from "node:crypto";
import type { ExternalDataSourceStatus } from "./agentApiService.js";
import {
  oneClickIntents,
  CANONICAL_NEAR_USDC_ASSET_ID,
  isDryRunEnabled,
  quoteSourceAmount,
  type OneClickToken,
  type SourceChainOption,
} from "./oneClickIntents.js";

const ONE_CLICK_BASE_URL =
  process.env.ONE_CLICK_API_URL?.replace(/\/$/, "") ||
  "https://1click.chaindefuser.com";

export {
  CANONICAL_NEAR_USDC_ASSET_ID,
  isDryRunEnabled,
  quoteSourceAmount,
  type OneClickToken,
  type SourceChainOption,
};

const SOURCE_CHAIN_METADATA: Record<
  string,
  {
    assetId: string;
    symbol: string;
    decimals: number;
    fallbackUsdPrice: number;
    refundAddress: string;
  }
> = {
  "Ethereum ETH": {
    assetId: "nep141:eth.omft.near",
    symbol: "ETH",
    decimals: 18,
    fallbackUsdPrice: 2550,
    refundAddress: "0x71c98f4c1c00b17f1148a3e9129e2a0011223344",
  },
  "Solana SOL": {
    assetId: "nep141:sol.omft.near",
    symbol: "SOL",
    decimals: 9,
    fallbackUsdPrice: 148,
    refundAddress: "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
  },
  "Base USDC": {
    assetId: "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near",
    symbol: "USDC",
    decimals: 6,
    fallbackUsdPrice: 1.0,
    refundAddress: "0x88b28f4c1c00b17f1148a3e9129e2a0055667788",
  },
  "Arbitrum USDC": {
    assetId: "nep141:arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831.omft.near",
    symbol: "USDC",
    decimals: 6,
    fallbackUsdPrice: 1.0,
    refundAddress: "0x44a98f4c1c00b17f1148a3e9129e2a0099aabbcc",
  },
  NEAR: {
    assetId: "nep141:wrap.near",
    symbol: "NEAR",
    decimals: 24,
    fallbackUsdPrice: 5.2,
    refundAddress:
      "cf92f332f3e6b0b95b0d02d1c16f54e98f56094c80269975567e67399cd4adc8",
  },
};

function shortSha(seed: string, len = 8): string {
  return crypto.createHash("sha256").update(seed).digest("hex").slice(0, len);
}

let cachedTokens: { tokens: OneClickToken[]; fetchedAtMs: number } | null = null;

/**
 * GET https://1click.chaindefuser.com/v0/tokens
 */
export async function fetchTokens(): Promise<OneClickToken[]> {
  if (cachedTokens && Date.now() - cachedTokens.fetchedAtMs < 60_000) {
    return cachedTokens.tokens;
  }

  const skipLive =
    process.env.SKIP_LIVE_NETWORK === "true" || isDryRunEnabled();

  if (!skipLive) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);
      const headers: Record<string, string> = { Accept: "application/json" };
      const apiKey = process.env.ONECLICK_API_KEY || process.env.ONE_CLICK_JWT;
      if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`;
      }
      const res = await fetch(`${ONE_CLICK_BASE_URL}/v0/tokens`, {
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data = (await res.json()) as OneClickToken[];
        if (Array.isArray(data) && data.length > 0) {
          cachedTokens = { tokens: data, fetchedAtMs: Date.now() };
          return data;
        }
      }
    } catch {
      // Fall back to static asset definitions if offline
    }
  }

  const fallback = await oneClickIntents.getSupportedTokens();
  cachedTokens = { tokens: fallback, fetchedAtMs: Date.now() };
  return fallback;
}

/**
 * POST https://1click.chaindefuser.com/v0/quote
 * Generates a live cross-chain invoice deposit address & quote using swapType: "EXACT_INPUT"
 * settling into canonical NEAR USDC (nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1).
 */
export async function createQuoteInvoice(params: {
  invoiceId: string;
  clientName: string;
  amountUsd: number;
  sourceChain: SourceChainOption;
  destinationVault: string;
  refundTo?: string;
}): Promise<{
  quoteId: string;
  depositAddress: string;
  originAsset: string;
  destinationAsset: string;
  quotedSourceAmount: string;
  amountOutUsd: number;
  deadline: string;
  status: "LIVE_1CLICK_QUOTE" | "SANDBOX_PREVIEW";
  mode: "live_1click" | "local_policy_check" | "unconfigured_error";
  source: ExternalDataSourceStatus;
  error?: string;
}> {
  const spec =
    SOURCE_CHAIN_METADATA[params.sourceChain] ??
    SOURCE_CHAIN_METADATA["Ethereum ETH"];
  const deadline = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const quotedSourceAmount = quoteSourceAmount(
    params.amountUsd,
    params.sourceChain,
  );
  const seed = `${params.invoiceId}:${params.clientName}:${params.amountUsd}:${params.sourceChain}`;

  const tokenUnits = params.amountUsd / spec.fallbackUsdPrice;
  const atomicInputAmount =
    BigInt(
      Math.max(1, Math.round(tokenUnits * 10 ** Math.min(spec.decimals, 8))),
    ) * BigInt(10 ** Math.max(0, spec.decimals - 8));

  const apiKey = process.env.ONECLICK_API_KEY || process.env.ONE_CLICK_JWT;
  const recipientAccount = /^[0-9a-f]{64}$/.test(params.destinationVault)
    ? params.destinationVault
    : crypto
        .createHash("sha256")
        .update(`bitfli:vault:${params.destinationVault}`)
        .digest("hex");

  const quotePayload = {
    dry: false,
    swapType: "EXACT_INPUT",
    slippageTolerance: 100,
    originAsset: spec.assetId,
    depositType: "ORIGIN_CHAIN",
    destinationAsset: CANONICAL_NEAR_USDC_ASSET_ID,
    amount: atomicInputAmount.toString(),
    refundTo: (params.refundTo ?? spec.refundAddress).startsWith("0x")
      ? (params.refundTo ?? spec.refundAddress).toLowerCase()
      : (params.refundTo ?? spec.refundAddress),
    refundType: "ORIGIN_CHAIN",
    recipient: recipientAccount,
    recipientType: "DESTINATION_CHAIN",
    deadline,
  };

  const skipLive =
    process.env.SKIP_LIVE_NETWORK === "true" || isDryRunEnabled();

  if (!skipLive) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };
      if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`;
      }
      const res = await fetch(`${ONE_CLICK_BASE_URL}/v0/quote`, {
        method: "POST",
        headers,
        signal: controller.signal,
        body: JSON.stringify(quotePayload),
      });
      clearTimeout(timeout);
      if (res.ok) {
        const liveData = (await res.json()) as {
          id?: string;
          correlationId?: string;
          quote?: { depositAddress?: string; amountInFormatted?: string };
          depositAddress?: string;
        };
        const depositAddr =
          liveData.quote?.depositAddress ?? liveData.depositAddress ?? "";

        if (depositAddr) {
          return {
            quoteId:
              liveData.id ??
              liveData.correlationId ??
              `qt_1click_${shortSha(seed, 6)}`,
            depositAddress: depositAddr,
            originAsset: spec.assetId,
            destinationAsset: CANONICAL_NEAR_USDC_ASSET_ID,
            quotedSourceAmount: liveData.quote?.amountInFormatted
              ? `${liveData.quote.amountInFormatted} ${spec.symbol}`
              : quotedSourceAmount,
            amountOutUsd: params.amountUsd,
            deadline,
            status: "LIVE_1CLICK_QUOTE",
            mode: "live_1click",
            source: "live_api",
          };
        }
      }
      return {
        quoteId: `qt_preview_${shortSha(seed, 6)}`,
        depositAddress: spec.refundAddress,
        originAsset: spec.assetId,
        destinationAsset: CANONICAL_NEAR_USDC_ASSET_ID,
        quotedSourceAmount,
        amountOutUsd: params.amountUsd,
        deadline,
        status: "SANDBOX_PREVIEW",
        mode: "local_policy_check",
        source: "api_error",
        error: `1Click /v0/quote returned HTTP ${res.status}`,
      };
    } catch (err) {
      return {
        quoteId: `qt_preview_${shortSha(seed, 6)}`,
        depositAddress: spec.refundAddress,
        originAsset: spec.assetId,
        destinationAsset: CANONICAL_NEAR_USDC_ASSET_ID,
        quotedSourceAmount,
        amountOutUsd: params.amountUsd,
        deadline,
        status: "SANDBOX_PREVIEW",
        mode: "local_policy_check",
        source: "api_error",
        error:
          err instanceof Error ? err.message : "1Click quote endpoint error",
      };
    }
  }

  return {
    quoteId: `qt_preview_${shortSha(seed, 6)}`,
    depositAddress: spec.refundAddress,
    originAsset: spec.assetId,
    destinationAsset: CANONICAL_NEAR_USDC_ASSET_ID,
    quotedSourceAmount,
    amountOutUsd: params.amountUsd,
    deadline,
    status: "SANDBOX_PREVIEW",
    mode: "local_policy_check",
    source: "unconfigured_error",
    error: "DRY_RUN=true or SKIP_LIVE_NETWORK=true; live 1Click quote skipped.",
  };
}

/**
 * GET https://1click.chaindefuser.com/v0/status?depositAddress=...
 * Never fabricates a "SUCCESS" status when the remote 1Click API has not confirmed deposit.
 */
export async function checkDepositStatus(depositAddress: string): Promise<{
  depositAddress: string;
  status: "PENDING_DEPOSIT" | "PROCESSING" | "SUCCESS" | "REFUNDED" | "FAILED";
  txHash?: string;
  updatedAt: string;
  source: ExternalDataSourceStatus;
  error?: string;
}> {
  const skipLive =
    process.env.SKIP_LIVE_NETWORK === "true" ||
    Boolean(process.env.NODE_TEST_CONTEXT) ||
    isDryRunEnabled();

  if (!skipLive) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);
      const url = `${ONE_CLICK_BASE_URL}/v0/status?depositAddress=${encodeURIComponent(depositAddress)}`;
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data = (await res.json()) as {
          status?: "PENDING_DEPOSIT" | "PROCESSING" | "SUCCESS" | "REFUNDED" | "FAILED";
          txHash?: string;
          updatedAt?: string;
        };
        return {
          depositAddress,
          status: data.status ?? "PENDING_DEPOSIT",
          txHash: data.txHash,
          updatedAt: data.updatedAt ?? new Date().toISOString(),
          source: "live_api",
        };
      }
      return {
        depositAddress,
        status: "PENDING_DEPOSIT",
        updatedAt: new Date().toISOString(),
        source: "api_error",
        error: `1Click /v0/status returned HTTP ${res.status}`,
      };
    } catch (err) {
      return {
        depositAddress,
        status: "PENDING_DEPOSIT",
        updatedAt: new Date().toISOString(),
        source: "api_error",
        error:
          err instanceof Error
            ? err.message
            : "1Click status endpoint unreachable",
      };
    }
  }

  return {
    depositAddress,
    status: "PENDING_DEPOSIT",
    updatedAt: new Date().toISOString(),
    source: "unconfigured_error",
    error:
      "Live 1Click status check skipped in test/dry-run mode; no on-chain deposit verified.",
  };
}
