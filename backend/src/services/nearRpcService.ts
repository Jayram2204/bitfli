import type { ExternalDataSourceStatus } from "./agentApiService.js";
import { isDryRunEnabled } from "./outlayerCustody.js";

const NEAR_RPC_ENDPOINTS: Record<"mainnet" | "testnet", string[]> = {
  testnet: [
    process.env.NEAR_TESTNET_RPC_URL || "https://test.rpc.fastnear.com",
    "https://rpc.testnet.near.org",
  ],
  mainnet: [
    process.env.NEAR_MAINNET_RPC_URL || "https://free.rpc.fastnear.com",
    "https://rpc.mainnet.near.org",
  ],
};

export interface NearNetworkTelemetry {
  network: "mainnet" | "testnet";
  rpcUrl: string;
  blockHeight: number;
  blockHash: string;
  chainId: string;
  accountExists: boolean;
  accountAmountYocto?: string;
  syncedAt: string;
  source: ExternalDataSourceStatus;
  error?: string;
}

let cachedTelemetry: {
  network: "mainnet" | "testnet";
  data: NearNetworkTelemetry;
  fetchedAtMs: number;
} | null = null;

export async function queryNearRpcTelemetry(
  mode: "sandbox" | "testnet" = "testnet",
  accountId = "pod-01.bitfli.near",
): Promise<NearNetworkTelemetry> {
  const network: "mainnet" | "testnet" = mode === "sandbox" ? "testnet" : mode;
  const candidateUrls = NEAR_RPC_ENDPOINTS[network];

  if (
    cachedTelemetry &&
    cachedTelemetry.network === network &&
    Date.now() - cachedTelemetry.fetchedAtMs < 6000
  ) {
    return cachedTelemetry.data;
  }

  const skipLive =
    process.env.SKIP_LIVE_NETWORK === "true" || isDryRunEnabled();

  if (!skipLive) {
    for (const rpcUrl of candidateUrls) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3500);

        const statusRes = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: "bitfli-status",
            method: "status",
            params: [],
          }),
        });

        clearTimeout(timeout);

        if (statusRes.ok) {
          const statusJson = (await statusRes.json()) as {
            result?: {
              chain_id?: string;
              sync_info?: {
                latest_block_height?: number;
                latest_block_hash?: string;
              };
            };
          };

          if (statusJson.result?.sync_info?.latest_block_height) {
            const blockHeight = statusJson.result.sync_info.latest_block_height;
            const blockHash =
              statusJson.result.sync_info.latest_block_hash ?? "";
            const chainId = statusJson.result.chain_id ?? network;

            let accountExists = false;
            let accountAmountYocto: string | undefined;

            try {
              const accController = new AbortController();
              const accTimeout = setTimeout(() => accController.abort(), 2000);
              const accRes = await fetch(rpcUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                signal: accController.signal,
                body: JSON.stringify({
                  jsonrpc: "2.0",
                  id: "bitfli-account",
                  method: "query",
                  params: {
                    request_type: "view_account",
                    finality: "final",
                    account_id: accountId,
                  },
                }),
              });
              clearTimeout(accTimeout);
              if (accRes.ok) {
                const accJson = (await accRes.json()) as {
                  result?: { amount?: string };
                };
                if (accJson.result?.amount) {
                  accountExists = true;
                  accountAmountYocto = accJson.result.amount;
                }
              }
            } catch {
              // Account may be an unfunded implicit account or subaccount
            }

            const telemetry: NearNetworkTelemetry = {
              network,
              rpcUrl,
              blockHeight,
              blockHash,
              chainId,
              accountExists,
              accountAmountYocto,
              syncedAt: new Date().toISOString(),
              source: "live_api",
            };
            cachedTelemetry = {
              network,
              data: telemetry,
              fetchedAtMs: Date.now(),
            };
            return telemetry;
          }
        }
      } catch {
        // Try next candidate RPC URL
      }
    }
  }

  const baseBlock = network === "testnet" ? 189420000 : 142150000;
  const elapsedBlocks = Math.floor((Date.now() - 1747000000000) / 1200);
  const unconfigured: NearNetworkTelemetry = {
    network,
    rpcUrl: candidateUrls[0],
    blockHeight: baseBlock + Math.max(100, elapsedBlocks),
    blockHash: "",
    chainId: network,
    accountExists: false,
    syncedAt: new Date().toISOString(),
    source: skipLive ? "unconfigured_error" : "api_error",
    error: skipLive
      ? "DRY_RUN=true or SKIP_LIVE_NETWORK=true; live NEAR RPC query skipped."
      : "All configured NEAR RPC endpoints failed to respond.",
  };
  cachedTelemetry = { network, data: unconfigured, fetchedAtMs: Date.now() };
  return unconfigured;
}
