import crypto from "node:crypto";
import type { ExternalDataSourceStatus } from "./agentApiService.js";

export type SourceChainOption =
  | "Ethereum ETH"
  | "Solana SOL"
  | "Base USDC"
  | "Arbitrum USDC"
  | "NEAR";

export const CANONICAL_NEAR_USDC_ASSET_ID =
  "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1";

const ONE_CLICK_BASE_URL =
  process.env.ONE_CLICK_API_URL?.replace(/\/$/, "") ||
  "https://1click.chaindefuser.com";

export interface OneClickToken {
  assetId: string;
  symbol: string;
  blockchain: string;
  decimals: number;
  price?: number;
}

export interface OneClickQuoteRequest {
  dry?: boolean;
  swapType: "EXACT_INPUT" | "EXACT_OUTPUT";
  slippageTolerance: number;
  originAsset: string;
  depositType: "ORIGIN_CHAIN" | "INTENTS";
  destinationAsset: string;
  amount: string;
  refundTo: string;
  refundType: "ORIGIN_CHAIN" | "INTENTS";
  recipient: string;
  recipientType: "DESTINATION_CHAIN" | "INTENTS";
  deadline: string;
}

export interface OneClickQuoteResponse {
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
}

export interface OneClickStatusResponse {
  depositAddress: string;
  status: "PENDING_DEPOSIT" | "PROCESSING" | "SUCCESS" | "REFUNDED" | "FAILED";
  txHash?: string;
  settledAmountUsd?: number;
  updatedAt: string;
  source: ExternalDataSourceStatus;
  error?: string;
}

const CHAIN_ASSET_MAP: Record<
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

export function isDryRunEnabled(): boolean {
  return (process.env.DRY_RUN ?? "false").toLowerCase() === "true";
}

function shortSha(seed: string, len = 16): string {
  return crypto.createHash("sha256").update(seed).digest("hex").slice(0, len);
}

export function quoteSourceAmount(
  amountUsd: number,
  sourceChain: SourceChainOption,
): string {
  const spec = CHAIN_ASSET_MAP[sourceChain] ?? CHAIN_ASSET_MAP["Ethereum ETH"];
  if (spec.symbol === "USDC") {
    return `${amountUsd.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} USDC`;
  }
  const units = amountUsd / spec.fallbackUsdPrice;
  return `${units.toFixed(4)} ${spec.symbol}`;
}

export class OneClickIntentsService {
  /**
   * GET https://1click.chaindefuser.com/v0/tokens
   */
  async getSupportedTokens(): Promise<OneClickToken[]> {
    if (!isDryRunEnabled()) {
      try {
        const headers: Record<string, string> = { Accept: "application/json" };
        const apiKey = process.env.ONECLICK_API_KEY || process.env.ONE_CLICK_JWT;
        if (apiKey) {
          headers.Authorization = `Bearer ${apiKey}`;
        }
        const res = await fetch(`${ONE_CLICK_BASE_URL}/v0/tokens`, { headers });
        if (res.ok) {
          const data = (await res.json()) as OneClickToken[];
          if (Array.isArray(data) && data.length > 0) {
            return data;
          }
        }
      } catch {
        // Return static token definitions below if network offline
      }
    }

    return [
      {
        assetId: CANONICAL_NEAR_USDC_ASSET_ID,
        symbol: "USDC",
        blockchain: "near",
        decimals: 6,
        price: 1.0,
      },
      {
        assetId: CHAIN_ASSET_MAP["Ethereum ETH"].assetId,
        symbol: "ETH",
        blockchain: "eth",
        decimals: 18,
        price: 2550,
      },
      {
        assetId: CHAIN_ASSET_MAP["Solana SOL"].assetId,
        symbol: "SOL",
        blockchain: "sol",
        decimals: 9,
        price: 148,
      },
      {
        assetId: CHAIN_ASSET_MAP["Base USDC"].assetId,
        symbol: "USDC",
        blockchain: "base",
        decimals: 6,
        price: 1.0,
      },
      {
        assetId: CHAIN_ASSET_MAP["Arbitrum USDC"].assetId,
        symbol: "USDC",
        blockchain: "arb",
        decimals: 6,
        price: 1.0,
      },
    ];
  }

  /**
   * POST https://1click.chaindefuser.com/v0/quote
   */
  async createSwapQuote(params: {
    invoiceId: string;
    clientName: string;
    amountUsd: number;
    sourceChain: SourceChainOption;
    destinationVault: string;
  }): Promise<OneClickQuoteResponse> {
    const spec =
      CHAIN_ASSET_MAP[params.sourceChain] ?? CHAIN_ASSET_MAP["Ethereum ETH"];
    const deadline = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const quotedSource = quoteSourceAmount(params.amountUsd, params.sourceChain);
    const seed = `${params.invoiceId}:${params.clientName}:${params.amountUsd}:${params.sourceChain}`;

    const tokenUnits = params.amountUsd / spec.fallbackUsdPrice;
    const atomicInputAmount =
      BigInt(
        Math.max(1, Math.round(tokenUnits * 10 ** Math.min(spec.decimals, 8))),
      ) * BigInt(10 ** Math.max(0, spec.decimals - 8));

    const recipientAccount = /^[0-9a-f]{64}$/.test(params.destinationVault)
      ? params.destinationVault
      : crypto
          .createHash("sha256")
          .update(`bitfli:vault:${params.destinationVault}`)
          .digest("hex");

    const quotePayload: OneClickQuoteRequest = {
      dry: isDryRunEnabled(),
      swapType: "EXACT_INPUT",
      slippageTolerance: 100,
      originAsset: spec.assetId,
      depositType: "ORIGIN_CHAIN",
      destinationAsset: CANONICAL_NEAR_USDC_ASSET_ID,
      amount: atomicInputAmount.toString(),
      refundTo: spec.refundAddress,
      refundType: "ORIGIN_CHAIN",
      recipient: recipientAccount,
      recipientType: "DESTINATION_CHAIN",
      deadline,
    };

    if (!isDryRunEnabled()) {
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          Accept: "application/json",
        };
        const apiKey = process.env.ONECLICK_API_KEY || process.env.ONE_CLICK_JWT;
        if (apiKey) {
          headers.Authorization = `Bearer ${apiKey}`;
        }
        const res = await fetch(`${ONE_CLICK_BASE_URL}/v0/quote`, {
          method: "POST",
          headers,
          body: JSON.stringify(quotePayload),
        });
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
                : quotedSource,
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
          quotedSourceAmount: quotedSource,
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
          quotedSourceAmount: quotedSource,
          amountOutUsd: params.amountUsd,
          deadline,
          status: "SANDBOX_PREVIEW",
          mode: "local_policy_check",
          source: "api_error",
          error:
            err instanceof Error ? err.message : "1Click quote API unreachable",
        };
      }
    }

    return {
      quoteId: `qt_preview_${shortSha(seed, 6)}`,
      depositAddress: spec.refundAddress,
      originAsset: spec.assetId,
      destinationAsset: CANONICAL_NEAR_USDC_ASSET_ID,
      quotedSourceAmount: quotedSource,
      amountOutUsd: params.amountUsd,
      deadline,
      status: "SANDBOX_PREVIEW",
      mode: "local_policy_check",
      source: "unconfigured_error",
      error: "Live 1Click quote disabled or unconfigured.",
    };
  }

  /**
   * GET https://1click.chaindefuser.com/v0/status?depositAddress=...
   */
  async getDepositStatus(depositAddress: string): Promise<OneClickStatusResponse> {
    if (!isDryRunEnabled()) {
      try {
        const url = `${ONE_CLICK_BASE_URL}/v0/status?depositAddress=${encodeURIComponent(depositAddress)}`;
        const res = await fetch(url, {
          headers: { Accept: "application/json" },
        });
        if (res.ok) {
          const data = (await res.json()) as {
            status?: OneClickStatusResponse["status"];
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
      error: "DRY_RUN=true; no live deposit verified on 1Click.",
    };
  }
}

export const oneClickIntents = new OneClickIntentsService();
