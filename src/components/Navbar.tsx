import React from "react";
import { Activity, ArrowRight, BookOpen, ExternalLink, KeyRound, ShieldCheck } from "lucide-react";
import type { ApiCallTelemetry, NetworkMode } from "../lib/api";

interface NavbarProps {
  mode: NetworkMode;
  podAccountId: string;
  autonomousOpsActive: boolean;
  nearBlockHeight?: number;
  handoffUrl?: string;
  isApiLoading?: boolean;
  activeApiEndpoint?: string | null;
  traceEnabled?: boolean;
  lastApiTelemetry?: ApiCallTelemetry;
  nep413ConnectedAccount?: string | null;
  onToggleTrace?: () => void;
  onToggleMode: (mode: NetworkMode) => void;
  onScrollToWorkbench: () => void;
  onOpenCheckoutDrawer: () => void;
  onExportCsv: () => void;
  onOpenLaunchPod: () => void;
  onOpenDocsModal?: () => void;
  onOpenWalletModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  mode,
  podAccountId,
  autonomousOpsActive,
  nearBlockHeight,
  handoffUrl,
  isApiLoading = false,
  activeApiEndpoint = null,
  traceEnabled = true,
  lastApiTelemetry,
  nep413ConnectedAccount = null,
  onToggleTrace,
  onToggleMode,
  onScrollToWorkbench,
  onOpenCheckoutDrawer,
  onExportCsv,
  onOpenLaunchPod,
  onOpenDocsModal,
  onOpenWalletModal,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full bg-[#F4F1EA]/92 backdrop-blur-md border-b border-[#EAE5DA] transition-bitfli">
      {/* Sleek 0.4s Top Progress Hairline Bar */}
      <div className="relative w-full h-[2px] bg-transparent overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r from-[#B86B4B]/20 via-[#B86B4B] to-[#7CE3A6] transition-opacity duration-300 ${
            isApiLoading ? "opacity-100 animate-top-hairline" : "opacity-0"
          }`}
        />
      </div>

      <div className="max-w-[1440px] mx-auto px-6 h-16 flex items-center justify-between gap-4">
        {/* Left Group: >> bitfli brand logo FIRST on the far left, followed by compact status pill */}
        <div className="flex items-center gap-3 shrink-0">
          <a
            href="#top"
            className="group inline-flex items-center gap-2 text-[#181918] focus:outline-none whitespace-nowrap shrink-0"
            aria-label="bitfli.xyz home"
          >
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[#141514] text-[#F7F6F2] border border-white/12 transition-transform duration-200 group-hover:scale-105 shrink-0">
              <svg
                width="15"
                height="15"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M3.25 4.25L7 8L3.25 11.75"
                  stroke="#B86B4B"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M8.5 4.25L12.25 8L8.5 11.75"
                  stroke="#F7F6F2"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="font-mono text-[13px] text-[#B86B4B] font-semibold tracking-tight whitespace-nowrap">
              &gt;&gt;
            </span>
            <span className="text-[20px] font-extrabold tracking-[-0.04em] text-[#181918] whitespace-nowrap">
              bitfli
            </span>
          </a>

          <div className="hidden md:inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-full bg-[#EFECE4] border border-[#DFD9CC] text-[11px] whitespace-nowrap shrink-0">
            <span className="inline-flex items-center gap-1.5 font-medium text-[#181918] whitespace-nowrap shrink-0">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  !autonomousOpsActive
                    ? "bg-[#FCA5A5] ring-2 ring-[#3D1C1C]/20"
                    : mode === "sandbox"
                      ? "bg-[#2E8B57] ring-2 ring-[#2E8B57]/25"
                      : "bg-[#B86B4B] ring-2 ring-[#B86B4B]/25"
                }`}
              />
              <span className="tracking-[-0.01em] whitespace-nowrap">NEAR + TEE</span>
            </span>

            {typeof nearBlockHeight === "number" && (
              <span
                className="hidden xl:inline-flex items-center px-2 py-0.5 rounded-full bg-white/80 border border-[#DFD9CC] font-mono text-[10px] text-[#5C5B57] whitespace-nowrap shrink-0"
                title="Live NEAR RPC Block Height"
              >
                #{nearBlockHeight.toLocaleString("en-US")}
              </span>
            )}

            {/* Interactive API & Enclave Trace Toggle (Trace: Live) */}
            {onToggleTrace && (
              <button
                type="button"
                onClick={onToggleTrace}
                className={`hidden xl:inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[10px] transition-bitfli cursor-pointer whitespace-nowrap shrink-0 ${
                  traceEnabled
                    ? "bg-[#141514] text-[#7CE3A6] border border-[#7CE3A6]/30"
                    : "bg-white/75 text-[#5C5B57] border border-[#DFD9CC] hover:text-[#181918]"
                }`}
                title="Toggle Live Internal API & OutLayer Enclave Trace Bar"
              >
                <Activity className={`w-2.5 h-2.5 ${isApiLoading ? "animate-spin text-[#B86B4B]" : ""}`} />
                <span className="whitespace-nowrap">Trace: {traceEnabled ? "Live" : "Off"}</span>
              </button>
            )}

            {handoffUrl && (
              <a
                href={handoffUrl}
                target="_blank"
                rel="noreferrer"
                className="hidden 2xl:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#141514] text-[#7CE3A6] hover:text-white font-mono text-[10px] transition-colors whitespace-nowrap shrink-0"
                title="Open OutLayer TEE Custody Handoff URL"
              >
                <span className="whitespace-nowrap">Handoff</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}

            <div
              role="group"
              aria-label="Execution network mode"
              className="inline-flex items-center rounded-full bg-[#E3DDD0] p-0.5 font-mono text-[10px] whitespace-nowrap shrink-0"
            >
              <button
                type="button"
                onClick={() => onToggleMode("sandbox")}
                className={`px-2 py-0.5 rounded-full transition-bitfli cursor-pointer whitespace-nowrap ${
                  mode === "sandbox"
                    ? "bg-[#141514] text-[#F7F6F2] shadow-xs"
                    : "text-[#5C5B57] hover:text-[#181918]"
                }`}
              >
                Sandbox
              </button>
              <button
                type="button"
                onClick={() => onToggleMode("testnet")}
                className={`px-2 py-0.5 rounded-full transition-bitfli cursor-pointer whitespace-nowrap ${
                  mode === "testnet"
                    ? "bg-[#141514] text-[#FCD34D] shadow-xs"
                    : "text-[#5C5B57] hover:text-[#181918]"
                }`}
              >
                Testnet
              </button>
            </div>
          </div>
        </div>

        {/* Center Group: Workbench, Client Checkout, Docs */}
        <nav className="hidden lg:flex items-center gap-6 shrink-0">
          <button
            type="button"
            onClick={onScrollToWorkbench}
            className="inline-flex items-center text-[13px] font-medium text-[#5C5B57] hover:text-[#181918] transition-bitfli cursor-pointer whitespace-nowrap shrink-0"
          >
            Workbench
          </button>
          <button
            type="button"
            onClick={onOpenCheckoutDrawer}
            className="inline-flex items-center text-[13px] font-medium text-[#5C5B57] hover:text-[#181918] transition-bitfli cursor-pointer whitespace-nowrap shrink-0"
          >
            Client Checkout
          </button>
          {onOpenDocsModal && (
            <button
              type="button"
              onClick={onOpenDocsModal}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#5C5B57] hover:text-[#181918] transition-bitfli cursor-pointer whitespace-nowrap shrink-0"
            >
              <BookOpen className="w-3.5 h-3.5 text-[#B86B4B] shrink-0" />
              <span className="whitespace-nowrap">Docs</span>
            </button>
          )}
          <button
            type="button"
            onClick={onExportCsv}
            className="hidden 2xl:inline-flex items-center text-[13px] font-medium text-[#5C5B57] hover:text-[#181918] transition-bitfli cursor-pointer whitespace-nowrap shrink-0"
          >
            Audit CSV
          </button>
        </nav>

        {/* Right Group: NEP-413 / Sandbox pill + Launch Agency Pod button */}
        <div className="flex items-center gap-2.5 shrink-0">
          {onOpenWalletModal && (
            <button
              type="button"
              onClick={onOpenWalletModal}
              className={`hidden sm:inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[11px] border transition-bitfli cursor-pointer whitespace-nowrap shrink-0 ${
                nep413ConnectedAccount
                  ? "bg-[#1E3A2B] text-[#7CE3A6] border-[#7CE3A6]/30"
                  : "bg-[#EFECE4] hover:bg-white text-[#181918] border-[#DAD3C4]"
              }`}
              title="Hybrid Auth: Judge Sandbox Mode or NEP-413 NEAR Wallet Sign-In"
            >
              <KeyRound className="w-3 h-3 text-[#B86B4B] shrink-0" />
              <span className="whitespace-nowrap">
                {nep413ConnectedAccount ? nep413ConnectedAccount : "NEP-413 / Sandbox"}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenLaunchPod}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#181918] hover:bg-[#272927] active:scale-[0.99] text-[#F7F6F2] text-[12.5px] font-semibold px-4 py-2 transition-bitfli shadow-xs cursor-pointer whitespace-nowrap shrink-0"
          >
            <span className="whitespace-nowrap">Launch Agency Pod</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#B86B4B] shrink-0" />
          </button>
        </div>
      </div>

      {/* Expandable Live API & Enclave Trace Bar (When Trace: Live is active) */}
      {traceEnabled && lastApiTelemetry && (
        <div className="border-t border-[#EAE5DA] bg-[#141514] text-[#F7F6F2] px-4 sm:px-6 lg:px-8 py-1.5 transition-bitfli">
          <div className="max-w-[1320px] mx-auto flex flex-wrap items-center justify-between gap-2 font-mono text-[10.5px]">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  isApiLoading ? "bg-[#FCD34D] animate-ping" : "bg-[#7CE3A6]"
                }`}
              />
              <span className="text-[#7CE3A6] font-semibold shrink-0">
                {isApiLoading && activeApiEndpoint
                  ? `SYNCING ${activeApiEndpoint}...`
                  : `${lastApiTelemetry.method} ${lastApiTelemetry.endpoint}`}
              </span>
              <span className="text-[#F7F6F2]/40 shrink-0">•</span>
              <span className="text-[#F7F6F2]/85 truncate">{lastApiTelemetry.summary}</span>
            </div>
            <div className="hidden sm:flex items-center gap-3 text-[#F7F6F2]/60 shrink-0">
              <span className="inline-flex items-center gap-1 text-[#7CE3A6]">
                <ShieldCheck className="w-3 h-3" />
                <span>Intel TDX / SGX Enclave</span>
              </span>
              <span>|</span>
              <span>Vault: {podAccountId}</span>
              <span>|</span>
              <span className="text-[#FCD34D]">X-Idempotency-Key: Active</span>
            </div>
          </div>
        </div>
      )}

      {/* Compact Tablet/Mobile Mode & Nav Strip */}
      <div className="lg:hidden border-t border-[#EAE5DA] px-4 py-2 flex flex-wrap items-center justify-between gap-2.5 bg-[#EFECE4]/70">
        <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#181918]">
          <span
            className={`w-2 h-2 rounded-full ${
              mode === "sandbox" ? "bg-[#2E8B57]" : "bg-[#B86B4B]"
            }`}
          />
          <span>NEAR Intents + OutLayer TEE Live</span>
          {typeof nearBlockHeight === "number" && (
            <span className="font-mono text-[10px] text-[#5C5B57]">
              (#{nearBlockHeight.toLocaleString("en-US")})
            </span>
          )}
        </div>
        <div className="flex items-center gap-3.5 text-[11.5px] font-medium text-[#5C5B57]">
          <button type="button" onClick={onScrollToWorkbench} className="hover:text-[#181918]">
            Workbench
          </button>
          <button type="button" onClick={onOpenCheckoutDrawer} className="hover:text-[#181918]">
            Client Checkout
          </button>
          <button type="button" onClick={onExportCsv} className="hover:text-[#181918]">
            Audit CSV
          </button>
          {handoffUrl && (
            <a
              href={handoffUrl}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[10.5px] text-[#B86B4B] hover:underline"
            >
              TEE Handoff
            </a>
          )}
        </div>
        <div className="inline-flex md:hidden rounded-full bg-[#E3DDD0] p-0.5 font-mono text-[10px]">
          <button
            type="button"
            onClick={() => onToggleMode("sandbox")}
            className={`px-2 py-0.5 rounded-full ${
              mode === "sandbox" ? "bg-[#141514] text-[#F7F6F2]" : "text-[#5C5B57]"
            }`}
          >
            Live Sandbox
          </button>
          <button
            type="button"
            onClick={() => onToggleMode("testnet")}
            className={`px-2 py-0.5 rounded-full ${
              mode === "testnet" ? "bg-[#141514] text-[#FCD34D]" : "text-[#5C5B57]"
            }`}
          >
            Testnet Mode
          </button>
        </div>
      </div>
    </header>
  );
};
