import React, { useState } from "react";
import { ArrowDown, ArrowRight, Check, Lock, ShieldCheck, Sliders } from "lucide-react";
import type { TreasuryPolicy } from "../lib/api";

interface HeroSectionProps {
  policy: TreasuryPolicy;
  onUpdatePolicy: (patch: Partial<TreasuryPolicy>) => Promise<void>;
  onOpenLiveTreasury: () => void;
  onSimulateClientInvoice: () => void;
}

interface EcosystemItem {
  id: string;
  label: string;
  tooltip: string;
  renderIcon: () => React.ReactNode;
}

const ECOSYSTEM_ITEMS: EcosystemItem[] = [
  {
    id: "near-intents",
    label: "NEAR Intents",
    tooltip: "1Click cross-chain solver settles ETH, SOL & Base invoices into NEAR USDC",
    renderIcon: () => (
      <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path
          d="M3.5 14.5V3.5L14.5 14.5V3.5"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: "outlayer-tee",
    label: "OutLayer TEE",
    tooltip: "Hardware-attested enclave custody signs txns only when policy rules pass",
    renderIcon: () => (
      <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <rect x="3" y="3" width="12" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
        <rect x="6.5" y="6.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    id: "claude",
    label: "Claude",
    tooltip: "Capped API procurement & MCP tool execution for Anthropic agent pods",
    renderIcon: () => (
      <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path
          d="M9 2.5V15.5M3.4 5.75L14.6 12.25M14.6 5.75L3.4 12.25"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: "openai",
    label: "OpenAI",
    tooltip: "Per-transaction spend guardrails for autonomous reasoning & batch jobs",
    renderIcon: () => (
      <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <circle cx="9" cy="9" r="5.75" stroke="currentColor" strokeWidth="1.5" />
        <polygon
          points="9,5.5 12,10.8 6,10.8"
          stroke="currentColor"
          strokeWidth="1.3"
          fill="none"
        />
      </svg>
    ),
  },
  {
    id: "base",
    label: "Base",
    tooltip: "Zero-bridge Base USDC client invoice intake via NEAR Intents 1Click",
    renderIcon: () => (
      <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
        <path d="M3.2 9H11.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "solana",
    label: "Solana",
    tooltip: "Accept client SOL/USDC & pay Solana design partners automatically",
    renderIcon: () => (
      <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path
          d="M4 5.2H14.2L12.6 7H2.8L4 5.2ZM2.8 8.3H13L14.2 10.1H4L2.8 8.3ZM4 11.4H14.2L12.6 13.2H2.8L4 11.4Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  {
    id: "pingpay-x402",
    label: "PingPay x402",
    tooltip: "HTTP 402 machine-payable API micro-settlement gated by OutLayer TEE",
    renderIcon: () => (
      <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path
          d="M3 9H7L9 4.5L11 13.5L13 9H15"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

export const HeroSection: React.FC<HeroSectionProps> = ({
  policy,
  onUpdatePolicy,
  onOpenLiveTreasury,
  onSimulateClientInvoice,
}) => {
  const [activeAgentNode, setActiveAgentNode] = useState<"billing" | "procurement" | "split">(
    "procurement",
  );
  const [hoveredEco, setHoveredEco] = useState<string | null>(null);

  const splitRatio = `${policy.profitSplit.leadDevPct}/${policy.profitSplit.designPartnerPct}/${policy.profitSplit.taxReservePct}`;

  return (
    <section id="top" className="w-full bg-[#F4F1EA]">
      {/* Main 2-Column Asymmetric Hero */}
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-14 lg:pt-16 lg:pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* Left Column (6 cols) */}
          <div className="lg:col-span-6 space-y-7">
            {/* Dual Trust Pills */}
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#141514] text-[#F7F6F2] border border-white/12 font-mono text-[11px] uppercase tracking-[0.1em]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#7CE3A6]" />
                Built on NEAR Intents
              </span>
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white text-[#181918] border border-[#DCD6C8] font-mono text-[11px] uppercase tracking-[0.1em] shadow-[0_1px_2px_rgba(24,25,24,0.04)]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#B86B4B]" />
                OutLayer TEE Custody
              </span>
            </div>

            {/* Display Headline */}
            <h1 className="text-[40px] sm:text-[50px] lg:text-[56px] font-bold leading-[1.04] tracking-[-0.03em] text-[#181918]">
              <span className="block">Let agency pods work.</span>
              <span className="block mt-1 text-[#181918]">
                Control <span className="text-[#B86B4B]">every dollar.</span>
              </span>
            </h1>

            {/* Editorial Subtitle */}
            <p className="text-[17px] leading-[1.6] text-[#5C5B57] max-w-[540px] font-normal">
              Policy-bound autonomous treasuries that accept client invoices from any chain via NEAR
              Intents, cap agent procurement in real time, and auto-split net profit to partners.
            </p>

            {/* Dual Pill CTA Buttons */}
            <div className="flex flex-wrap items-center gap-3.5 pt-1">
              <button
                type="button"
                onClick={onOpenLiveTreasury}
                className="inline-flex items-center gap-2.5 rounded-full bg-[#181918] hover:bg-[#2A2C2A] active:scale-[0.99] text-[#F7F6F2] text-[14.5px] font-semibold px-6 py-3.5 transition-all shadow-[0_6px_18px_rgba(20,21,20,0.14)] cursor-pointer"
              >
                <span>Open Live Treasury</span>
                <ArrowRight className="w-4 h-4 text-[#B86B4B]" />
              </button>

              <button
                type="button"
                onClick={onSimulateClientInvoice}
                className="inline-flex items-center gap-2.5 rounded-full bg-[#EFECE4] hover:bg-[#E6E1D5] active:scale-[0.99] text-[#181918] border border-[#DDD7C8] text-[14.5px] font-semibold px-6 py-3.5 transition-all cursor-pointer"
              >
                <span>Simulate Client Invoice</span>
                <ArrowDown className="w-4 h-4 text-[#5C5B57]" />
              </button>
            </div>

            {/* Live Vault Micro-Footnote */}
            <div className="pt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] font-mono text-[#5C5B57]">
              <span className="inline-flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[#1E3A2B]" />
                Zero seed-phrase exposure
              </span>
              <span className="text-[#D4CEC0]">•</span>
              <span>Active Vault: {policy.podAccountId}</span>
            </div>
          </div>

          {/* Right Column (6 cols): Architectural Human Constraint -> Agent Nodes SVG Visual */}
          <div className="lg:col-span-6">
            <div className="relative rounded-[20px] bg-[#EFECE4] border border-[#DFD9CC] p-5 sm:p-6 shadow-[0_14px_38px_rgba(24,25,24,0.06)] overflow-hidden">
              {/* Subtle Architectural Drafting Header */}
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#E2DDD0]">
                <div className="flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5 text-[#B86B4B]" />
                  <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#5C5B57]">
                    ARCH.01 — HUMAN CONSTRAINTS → TEE AGENT POD
                  </span>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-mono text-[10.5px] ${
                    policy.autonomousOpsActive
                      ? "bg-[#1E3A2B] text-[#7CE3A6]"
                      : "bg-[#3D1C1C] text-[#FCA5A5]"
                  }`}
                >
                  <Lock className="w-2.5 h-2.5" />
                  {policy.autonomousOpsActive ? "TEE GUARDRAILS ARMED" : "HUMAN LOCK ENGAGED"}
                </span>
              </div>

              {/* Interactive Architectural Diagram */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center relative">
                {/* Left Side: Human Constraint Sliders Module */}
                <div className="sm:col-span-5 rounded-[14px] bg-white border border-[#DED8CA] p-4 space-y-3.5 relative z-10 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#5C5B57]">
                      Human Policy Rail
                    </span>
                    <span className="font-mono text-[10px] text-[#B86B4B] font-semibold">
                      Live Sliders
                    </span>
                  </div>

                  {/* Constraint Track 1 */}
                  <div className="space-y-1">
                    <div className="flex justify-between font-mono text-[11px]">
                      <span className="text-[#5C5B57]">Per-Tx Cap</span>
                      <span className="text-[#181918] font-semibold">${policy.maxSingleTxUsd}</span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={1000}
                      step={5}
                      aria-label="Hero Per-Transaction Cap Slider"
                      value={policy.maxSingleTxUsd}
                      onChange={(e) => {
                        setActiveAgentNode("procurement");
                        onUpdatePolicy({ maxSingleTxUsd: Number(e.target.value) });
                      }}
                      className="w-full bitfli-slider"
                    />
                  </div>

                  {/* Constraint Track 2 */}
                  <div className="space-y-1">
                    <div className="flex justify-between font-mono text-[11px]">
                      <span className="text-[#5C5B57]">Daily Ceiling</span>
                      <span className="text-[#181918] font-semibold">
                        ${policy.dailySpendCapUsd}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={100}
                      max={5000}
                      step={25}
                      aria-label="Hero Daily Spend Cap Slider"
                      value={policy.dailySpendCapUsd}
                      onChange={(e) => {
                        setActiveAgentNode("procurement");
                        onUpdatePolicy({ dailySpendCapUsd: Number(e.target.value) });
                      }}
                      className="w-full bitfli-slider"
                    />
                  </div>

                  {/* Constraint Track 3 */}
                  <div className="space-y-1">
                    <div className="flex justify-between font-mono text-[11px]">
                      <span className="text-[#5C5B57]">Partner Split</span>
                      <span className="text-[#181918] font-semibold">{splitRatio}%</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden flex bg-[#EAE5DA]">
                      <div
                        style={{ width: `${policy.profitSplit.leadDevPct}%` }}
                        className="bg-[#181918]"
                      />
                      <div
                        style={{ width: `${policy.profitSplit.designPartnerPct}%` }}
                        className="bg-[#B86B4B]"
                      />
                      <div
                        style={{ width: `${policy.profitSplit.taxReservePct}%` }}
                        className="bg-[#9C9689]"
                      />
                    </div>
                  </div>

                  <div className="pt-1 border-t border-[#EAE5DA] flex items-center justify-between font-mono text-[10px] text-[#5C5B57]">
                    <span>Allowlist</span>
                    <span className="text-[#181918] font-medium">
                      {policy.vendorAllowlist.length} verified vendors
                    </span>
                  </div>
                </div>

                {/* Center SVG Terracotta Connector Strings */}
                <div className="hidden sm:flex sm:col-span-2 h-[250px] items-center justify-center relative">
                  <svg
                    className="w-full h-full overflow-visible"
                    viewBox="0 0 90 250"
                    fill="none"
                    aria-hidden="true"
                  >
                    {/* Upper string -> Billing Agent */}
                    <path
                      d="M 0 85 C 42 85, 42 42, 90 42"
                      stroke={activeAgentNode === "billing" ? "#B86B4B" : "#C9BFB0"}
                      strokeWidth={activeAgentNode === "billing" ? "2.2" : "1.4"}
                    />
                    {activeAgentNode === "billing" && (
                      <path
                        d="M 0 85 C 42 85, 42 42, 90 42"
                        stroke="#B86B4B"
                        strokeWidth="2.2"
                        className="animate-route-flow"
                      />
                    )}

                    {/* Middle string -> Procurement Agent */}
                    <path
                      d="M 0 125 C 45 125, 45 125, 90 125"
                      stroke={activeAgentNode === "procurement" ? "#B86B4B" : "#C9BFB0"}
                      strokeWidth={activeAgentNode === "procurement" ? "2.2" : "1.4"}
                    />
                    {activeAgentNode === "procurement" && (
                      <path
                        d="M 0 125 C 45 125, 45 125, 90 125"
                        stroke="#B86B4B"
                        strokeWidth="2.2"
                        className="animate-route-flow"
                      />
                    )}

                    {/* Lower string -> Profit-Split Agent */}
                    <path
                      d="M 0 165 C 42 165, 42 208, 90 208"
                      stroke={activeAgentNode === "split" ? "#B86B4B" : "#C9BFB0"}
                      strokeWidth={activeAgentNode === "split" ? "2.2" : "1.4"}
                    />
                    {activeAgentNode === "split" && (
                      <path
                        d="M 0 165 C 42 165, 42 208, 90 208"
                        stroke="#B86B4B"
                        strokeWidth="2.2"
                        className="animate-route-flow"
                      />
                    )}

                    {/* Anchor nodes */}
                    <circle cx="2" cy="85" r="3.5" fill="#B86B4B" />
                    <circle cx="2" cy="125" r="3.5" fill="#B86B4B" />
                    <circle cx="2" cy="165" r="3.5" fill="#B86B4B" />
                    <circle cx="88" cy="42" r="3.5" fill="#141514" />
                    <circle cx="88" cy="125" r="3.5" fill="#141514" />
                    <circle cx="88" cy="208" r="3.5" fill="#141514" />
                  </svg>
                </div>

                {/* Right Side: Three Connected Autonomous Agent Nodes in Matte Obsidian */}
                <div className="sm:col-span-5 space-y-2.5 relative z-10">
                  {/* Node 1: Billing Agent */}
                  <button
                    type="button"
                    onClick={() => setActiveAgentNode("billing")}
                    className={`w-full text-left rounded-[13px] bg-[#141514] text-[#F7F6F2] p-3.5 transition-all cursor-pointer border ${
                      activeAgentNode === "billing"
                        ? "border-[#B86B4B] ring-2 ring-[#B86B4B]/20"
                        : "border-white/12 hover:border-white/25"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#B86B4B]">
                        NODE 01 · INBOUND
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-[#1E3A2B] text-[#7CE3A6] font-mono text-[10px]">
                        1Click Ready
                      </span>
                    </div>
                    <div className="mt-1 font-semibold text-[13.5px] tracking-[-0.01em]">
                      Billing Agent
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] text-[#F7F6F2]/65">
                      ETH / SOL / Base → NEAR USDC
                    </div>
                  </button>

                  {/* Node 2: Procurement Agent */}
                  <button
                    type="button"
                    onClick={() => setActiveAgentNode("procurement")}
                    className={`w-full text-left rounded-[13px] bg-[#141514] text-[#F7F6F2] p-3.5 transition-all cursor-pointer border ${
                      activeAgentNode === "procurement"
                        ? "border-[#B86B4B] ring-2 ring-[#B86B4B]/20"
                        : "border-white/12 hover:border-white/25"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#B86B4B]">
                        NODE 02 · OPEX GUARD
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-[#1E3A2B] text-[#7CE3A6] font-mono text-[10px]">
                        ≤ ${policy.maxSingleTxUsd}/tx
                      </span>
                    </div>
                    <div className="mt-1 font-semibold text-[13.5px] tracking-[-0.01em]">
                      Procurement Agent
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] text-[#F7F6F2]/65">
                      x402 APIs · {policy.vendorAllowlist.length} allowlisted vendors
                    </div>
                  </button>

                  {/* Node 3: Profit-Split Agent */}
                  <button
                    type="button"
                    onClick={() => setActiveAgentNode("split")}
                    className={`w-full text-left rounded-[13px] bg-[#141514] text-[#F7F6F2] p-3.5 transition-all cursor-pointer border ${
                      activeAgentNode === "split"
                        ? "border-[#B86B4B] ring-2 ring-[#B86B4B]/20"
                        : "border-white/12 hover:border-white/25"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#B86B4B]">
                        NODE 03 · WATERFALL
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-[#3B2E17] text-[#FCD34D] font-mono text-[10px]">
                        {splitRatio}%
                      </span>
                    </div>
                    <div className="mt-1 font-semibold text-[13.5px] tracking-[-0.01em]">
                      Profit-Split Agent
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] text-[#F7F6F2]/65">
                      Auto-routes net margin to partners
                    </div>
                  </button>
                </div>
              </div>

              {/* Bottom Enclave Status Readout */}
              <div className="mt-4 pt-3.5 border-t border-[#E2DDD0] flex flex-wrap items-center justify-between gap-2 text-[11.5px] font-mono text-[#5C5B57]">
                <span>
                  {activeAgentNode === "billing" &&
                    "Active Route: Client pays native asset → NEAR Intents settles canonical USDC into pod vault."}
                  {activeAgentNode === "procurement" &&
                    `Active Guardrail: Enclave blocks any agent spend > $${policy.maxSingleTxUsd} or outside allowlist.`}
                  {activeAgentNode === "split" &&
                    `Active Waterfall: Net margin splits ${splitRatio}% across NEAR, Solana & Tax Reserve.`}
                </span>
                <span className="text-[#181918] font-medium">OutLayer SGX · Attested</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Full-Width Ecosystem Strip (1px top & bottom hairline borders) */}
      <div className="w-full border-y border-[#EAE5DA] bg-[#F1EDE4]/70">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left uppercase micro-label */}
          <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#5C5B57] shrink-0">
            FOR TREASURIES &amp; AGENTS BUILT ANYWHERE
          </div>

          {/* Right horizontal row of clean monochrome vector icons with hover tooltips + TEE ATTESTED circular seal */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 lg:justify-end">
            {ECOSYSTEM_ITEMS.map((item) => {
              const isHovered = hoveredEco === item.id;
              return (
                <div
                  key={item.id}
                  className="relative"
                  onMouseEnter={() => setHoveredEco(item.id)}
                  onMouseLeave={() => setHoveredEco(null)}
                >
                  <button
                    type="button"
                    onFocus={() => setHoveredEco(item.id)}
                    onBlur={() => setHoveredEco(null)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-transparent hover:border-[#DCD5C6] hover:bg-[#F4F1EA] text-[#181918]/80 hover:text-[#181918] transition-all text-[12.5px] font-medium cursor-default"
                  >
                    <span className="text-[#181918]">{item.renderIcon()}</span>
                    <span>{item.label}</span>
                  </button>

                  {isHovered && (
                    <div
                      role="tooltip"
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 p-2.5 rounded-xl bg-[#141514] text-[#F7F6F2] border border-white/12 shadow-lg z-30 pointer-events-none"
                    >
                      <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#B86B4B] mb-0.5">
                        {item.label}
                      </div>
                      <div className="text-[11.5px] leading-snug text-[#F7F6F2]/85">
                        {item.tooltip}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Circular TEE ATTESTED Seal Badge */}
            <div
              className="relative ml-1 group"
              title="Cryptographically attested OutLayer TEE hardware enclave"
            >
              <div className="w-12 h-12 rounded-full bg-[#141514] text-[#F7F6F2] border border-white/15 flex items-center justify-center shadow-xs">
                <svg viewBox="0 0 56 56" className="w-11 h-11" aria-label="TEE ATTESTED seal">
                  <defs>
                    <path
                      id="teeSealCircle"
                      d="M 28, 28 m -19, 0 a 19,19 0 1,1 38,0 a 19,19 0 1,1 -38,0"
                    />
                  </defs>
                  <text
                    fill="#F7F6F2"
                    fontSize="5.4"
                    fontFamily="JetBrains Mono, monospace"
                    letterSpacing="1.35"
                  >
                    <textPath href="#teeSealCircle" startOffset="4%">
                      TEE ATTESTED • OUTLAYER •
                    </textPath>
                  </text>
                  <circle
                    cx="28"
                    cy="28"
                    r="9.5"
                    fill="#1E3A2B"
                    stroke="#7CE3A6"
                    strokeWidth="0.9"
                  />
                  <path
                    d="M24.8 28.2L27 30.4L31.5 25.8"
                    stroke="#7CE3A6"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
