import React, { useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Check,
  Copy,
  Download,
  Lock,
  Plus,
  QrCode,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Unlock,
  X,
} from "lucide-react";
import type {
  ApiCallTelemetry,
  CrossChainInvoice,
  LedgerEntry,
  LedgerEventType,
  PaymentCheckRecord,
  ProfitSplitConfig,
  SourceChainOption,
  TreasuryMetrics,
  TreasuryPolicy,
} from "../lib/api";
import { GeometricQrCode } from "./GeometricQrCode";

interface TreasuryWorkbenchProps {
  metrics: TreasuryMetrics;
  policy: TreasuryPolicy;
  ledger: LedgerEntry[];
  invoices: CrossChainInvoice[];
  checks?: PaymentCheckRecord[];
  lastApiTelemetry: ApiCallTelemetry;
  activeTab: "ledger" | "invoice" | "checks";
  selectedReceipt?: LedgerEntry | null;
  onSelectReceipt?: (entry: LedgerEntry | null) => void;
  onChangeTab: (tab: "ledger" | "invoice" | "checks") => void;
  onUpdatePolicy: (
    patch: Partial<Omit<TreasuryPolicy, "profitSplit">> & {
      profitSplit?: ProfitSplitConfig;
    },
  ) => Promise<void>;
  onRunProfitSplit: (distributionAmountUsd?: number) => Promise<void>;
  onCreateInvoice: (input: {
    clientName: string;
    amountUsd: number;
    sourceChain: SourceChainOption;
    milestoneMemo?: string;
  }) => Promise<CrossChainInvoice>;
  onSimulateInvoicePayment: (invoiceId: string) => Promise<void>;
  onIssuePaymentCheck?: (input: {
    payeeLabel: string;
    amountUsd: number;
    memo: string;
  }) => Promise<void>;
  onExportCsv: () => Promise<void>;
  onResetSandbox: () => Promise<void>;
}

const SOURCE_CHAINS: SourceChainOption[] = [
  "Ethereum ETH",
  "Solana SOL",
  "Base USDC",
  "Arbitrum USDC",
];

function formatUsd(val: number): string {
  return (
    "$" +
    val.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function renderEventBadge(eventType: LedgerEventType) {
  switch (eventType) {
    case "INTENTS IN":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#1E3A2B] text-[#7CE3A6] font-mono text-[10px] font-semibold tracking-[0.06em]">
          INTENTS IN
        </span>
      );
    case "OUTLAYER OPEX":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#141514] text-[#F7F6F2] font-mono text-[10px] font-semibold tracking-[0.06em]">
          OUTLAYER OPEX
        </span>
      );
    case "RULE BLOCKED":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#3D1C1C] text-[#FCA5A5] font-mono text-[10px] font-semibold tracking-[0.06em]">
          RULE BLOCKED
        </span>
      );
    case "PROFIT SPLIT":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#3B2E17] text-[#FCD34D] font-mono text-[10px] font-semibold tracking-[0.06em]">
          PROFIT SPLIT
        </span>
      );
  }
}

export const TreasuryWorkbench: React.FC<TreasuryWorkbenchProps> = ({
  metrics,
  policy,
  ledger,
  invoices,
  checks = [],
  lastApiTelemetry,
  activeTab,
  selectedReceipt: externalSelectedReceipt,
  onSelectReceipt: onExternalSelectReceipt,
  onChangeTab,
  onUpdatePolicy,
  onRunProfitSplit,
  onCreateInvoice,
  onSimulateInvoicePayment,
  onIssuePaymentCheck,
  onExportCsv,
  onResetSandbox,
}) => {
  const [newVendor, setNewVendor] = useState("");
  const [ledgerFilter, setLedgerFilter] = useState<"ALL" | LedgerEventType>("ALL");
  const [internalSelectedReceipt, setInternalSelectedReceipt] = useState<LedgerEntry | null>(null);
  const selectedReceipt =
    externalSelectedReceipt !== undefined ? externalSelectedReceipt : internalSelectedReceipt;
  const setSelectedReceipt = (entry: LedgerEntry | null) => {
    setInternalSelectedReceipt(entry);
    onExternalSelectReceipt?.(entry);
  };
  const [isSplitting, setIsSplitting] = useState(false);
  const [splitTranchePct, setSplitTranchePct] = useState<25 | 50 | 100>(25);

  // Gasless Payment Check State (POST /api/checks)
  const [checkPayee, setCheckPayee] = useState("Elena Vance · Motion & SVG Systems");
  const [checkAmount, setCheckAmount] = useState("85");
  const [checkMemo, setCheckMemo] = useState("Gasless sub-contractor bounty — WebGL shader");
  const [isIssuingCheck, setIsIssuingCheck] = useState(false);
  const [copiedCheckUrl, setCopiedCheckUrl] = useState<string | null>(null);

  // Cross-Chain Invoice Generator Form State
  const [clientName, setClientName] = useState("Linear Studio");
  const [invoiceAmount, setInvoiceAmount] = useState("3200");
  const [sourceChain, setSourceChain] = useState<SourceChainOption>("Ethereum ETH");
  const [milestoneMemo, setMilestoneMemo] = useState(
    "Milestone #04 — Autonomous Multi-Chain Checkout",
  );
  const [activeGeneratedInvoiceId, setActiveGeneratedInvoiceId] = useState<string | null>(
    invoices[0]?.id ?? null,
  );
  const [settlingInvoiceId, setSettlingInvoiceId] = useState<string | null>(null);
  const [copiedAddr, setCopiedAddr] = useState(false);

  const opExPctOfGross =
    metrics.grossClientInflows30dUsd > 0
      ? ((metrics.autonomousOpExSpentUsd / metrics.grossClientInflows30dUsd) * 100).toFixed(1)
      : "0.0";

  const dailyUsagePct = Math.min(
    100,
    Math.round((policy.dailySpentTodayUsd / Math.max(1, policy.dailySpendCapUsd)) * 100),
  );

  const filteredLedger =
    ledgerFilter === "ALL" ? ledger : ledger.filter((entry) => entry.eventType === ledgerFilter);

  const currentInvoice =
    invoices.find((inv) => inv.id === activeGeneratedInvoiceId) ?? invoices[0] ?? null;

  const handleAddVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newVendor.trim();
    if (!trimmed) return;
    if (
      policy.vendorAllowlist.some((existing) => existing.toLowerCase() === trimmed.toLowerCase())
    ) {
      setNewVendor("");
      return;
    }
    await onUpdatePolicy({
      vendorAllowlist: [...policy.vendorAllowlist, trimmed],
    });
    setNewVendor("");
  };

  const handleRemoveVendor = async (vendorToRemove: string) => {
    await onUpdatePolicy({
      vendorAllowlist: policy.vendorAllowlist.filter((v) => v !== vendorToRemove),
    });
  };

  const handleAdjustLeadDevSplit = async (newLead: number) => {
    const clampedLead = Math.max(20, Math.min(80, newLead));
    const maxDesignAllowed = 95 - clampedLead;
    const newDesign = Math.max(5, Math.min(maxDesignAllowed, policy.profitSplit.designPartnerPct));
    const newTax = 100 - clampedLead - newDesign;
    await onUpdatePolicy({
      profitSplit: {
        leadDevPct: clampedLead,
        designPartnerPct: newDesign,
        taxReservePct: newTax,
      },
    });
  };

  const handleAdjustDesignSplit = async (newDesign: number) => {
    const clampedDesign = Math.max(5, Math.min(70, newDesign));
    const maxLeadAllowed = 95 - clampedDesign;
    const newLead = Math.max(20, Math.min(maxLeadAllowed, policy.profitSplit.leadDevPct));
    const newTax = 100 - newLead - clampedDesign;
    await onUpdatePolicy({
      profitSplit: {
        leadDevPct: newLead,
        designPartnerPct: clampedDesign,
        taxReservePct: newTax,
      },
    });
  };

  const plannedSplitUsd = +((metrics.netDistributableProfitUsd * splitTranchePct) / 100).toFixed(2);

  const handleTriggerSplit = async () => {
    setIsSplitting(true);
    try {
      await onRunProfitSplit(plannedSplitUsd);
    } finally {
      setIsSplitting(false);
    }
  };

  const handleGenerateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmt = Math.max(10, Number(invoiceAmount) || 1000);
    const created = await onCreateInvoice({
      clientName: clientName.trim() || "Enterprise Client",
      amountUsd: parsedAmt,
      sourceChain,
      milestoneMemo,
    });
    setActiveGeneratedInvoiceId(created.id);
  };

  const handleSimulatePay = async (invoiceId: string) => {
    setSettlingInvoiceId(invoiceId);
    await new Promise((resolve) => setTimeout(resolve, 650));
    try {
      await onSimulateInvoicePayment(invoiceId);
    } finally {
      setSettlingInvoiceId(null);
    }
  };

  const handleCopyAddress = (addr: string) => {
    navigator.clipboard?.writeText(addr);
    setCopiedAddr(true);
    setTimeout(() => setCopiedAddr(false), 1800);
  };

  return (
    <section id="workbench" className="w-full bg-[#F4F1EA] py-16">
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Workbench Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#B86B4B] font-semibold">
              LIVE AGENCY WORKBENCH · {policy.podAccountId.toUpperCase()}
            </div>
            <h2 className="mt-1 text-[28px] sm:text-[34px] font-bold tracking-[-0.03em] text-[#181918]">
              Autonomous Treasury &amp; Profit-Split Controls
            </h2>
          </div>
          <div className="flex items-center gap-2 font-mono text-[11.5px] text-[#5C5B57]">
            <ShieldCheck className="w-4 h-4 text-[#1E3A2B]" />
            <span>OutLayer SGX Enclave Custody · Real-Time State</span>
          </div>
        </div>

        {/* 1. Top 4-Card KPI Strip (Monospace Numerals) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI 1: Treasury Balance */}
          <div className="rounded-[16px] bg-white border border-[#E2DDD0] p-5 shadow-[0_2px_10px_rgba(24,25,24,0.03)]">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#5C5B57]">
                Treasury Balance (USDC)
              </span>
              <span className="w-2 h-2 rounded-full bg-[#1E3A2B]" />
            </div>
            <div className="mt-3 font-mono text-[28px] font-bold tracking-[-0.02em] text-[#181918]">
              {formatUsd(metrics.treasuryBalanceUsd)}
            </div>
            <div className="mt-1.5 font-mono text-[11px] text-[#5C5B57]">
              Canonical NEAR USDC · TEE Vault
            </div>
          </div>

          {/* KPI 2: Gross Client Inflows (30d) */}
          <div className="rounded-[16px] bg-white border border-[#E2DDD0] p-5 shadow-[0_2px_10px_rgba(24,25,24,0.03)]">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#5C5B57]">
                Gross Client Inflows (30d)
              </span>
              <ArrowUpRight className="w-4 h-4 text-[#B86B4B]" />
            </div>
            <div className="mt-3 font-mono text-[28px] font-bold tracking-[-0.02em] text-[#181918]">
              {formatUsd(metrics.grossClientInflows30dUsd)}
            </div>
            <div className="mt-1.5 font-mono text-[11px] text-[#5C5B57]">
              Settled via NEAR Intents 1Click
            </div>
          </div>

          {/* KPI 3: Autonomous OpEx Spent */}
          <div className="rounded-[16px] bg-white border border-[#E2DDD0] p-5 shadow-[0_2px_10px_rgba(24,25,24,0.03)]">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#5C5B57]">
                Autonomous OpEx Spent
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[#EFECE4] font-mono text-[10.5px] text-[#181918] font-medium">
                {opExPctOfGross}% of gross
              </span>
            </div>
            <div className="mt-3 font-mono text-[28px] font-bold tracking-[-0.02em] text-[#181918]">
              {formatUsd(metrics.autonomousOpExSpentUsd)}
            </div>
            <div className="mt-1.5 font-mono text-[11px] text-[#5C5B57]">
              Policy-capped LLM &amp; cloud APIs
            </div>
          </div>

          {/* KPI 4: Net Distributable Profit */}
          <div className="rounded-[16px] bg-[#141514] text-[#F7F6F2] border border-white/12 p-5 shadow-[0_10px_28px_rgba(20,21,20,0.14)]">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#F7F6F2]/65">
                Net Distributable Profit
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[#1E3A2B] text-[#7CE3A6] font-mono text-[10px]">
                Ready
              </span>
            </div>
            <div className="mt-3 font-mono text-[28px] font-bold tracking-[-0.02em] text-[#F7F6F2]">
              {formatUsd(metrics.netDistributableProfitUsd)}
            </div>
            <div className="mt-1.5 font-mono text-[11px] text-[#B86B4B]">
              Waterfall {policy.profitSplit.leadDevPct}/{policy.profitSplit.designPartnerPct}/
              {policy.profitSplit.taxReservePct}% armed
            </div>
          </div>
        </div>

        {/* Main 12-Column Bento Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* 2. Left 5 Columns — Human Guardrails & Profit-Split Configurator */}
          <div className="lg:col-span-5 rounded-[18px] bg-white border border-[#E2DDD0] p-6 space-y-6 shadow-[0_4px_18px_rgba(24,25,24,0.03)]">
            {/* Global Emergency Kill-Switch Toggle */}
            <div
              className={`rounded-[14px] p-4 border transition-colors ${
                policy.autonomousOpsActive
                  ? "bg-[#141514] text-[#F7F6F2] border-white/12"
                  : "bg-[#3D1C1C] text-[#FCA5A5] border-[#FCA5A5]/30"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] opacity-70">
                    Global Emergency Kill-Switch
                  </div>
                  <div className="font-mono text-[13px] font-bold tracking-[0.02em] flex items-center gap-2">
                    {policy.autonomousOpsActive ? (
                      <>
                        <Unlock className="w-4 h-4 text-[#7CE3A6]" />
                        <span className="text-[#7CE3A6]">AUTONOMOUS OPS: ACTIVE</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4 text-[#FCA5A5]" />
                        <span className="text-[#FCA5A5]">FROZEN (HUMAN LOCK)</span>
                      </>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={policy.autonomousOpsActive}
                  onClick={() =>
                    onUpdatePolicy({ autonomousOpsActive: !policy.autonomousOpsActive })
                  }
                  className={`relative inline-flex h-7 w-13 shrink-0 items-center rounded-full transition-colors cursor-pointer p-1 ${
                    policy.autonomousOpsActive ? "bg-[#1E3A2B]" : "bg-black/40"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 rounded-full transition-transform ${
                      policy.autonomousOpsActive
                        ? "translate-x-6 bg-[#7CE3A6]"
                        : "translate-x-0 bg-[#FCA5A5]"
                    }`}
                  />
                </button>
              </div>
              <p className="mt-2 text-[12px] opacity-75 leading-relaxed">
                {policy.autonomousOpsActive
                  ? "OutLayer TEE signs allowlisted agent procurements within your numeric spend caps."
                  : "Hardware enclave signing is frozen. Zero agent transactions or payouts can execute."}
              </p>
            </div>

            {/* Interactive Spend Guardrail Sliders */}
            <div className="space-y-5 pt-1">
              {/* Slider 1: Max Single Agent Spend ($) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="slider-max-tx"
                    className="text-[13.5px] font-semibold text-[#181918]"
                  >
                    Max Single Agent Spend ($)
                  </label>
                  <span className="font-mono text-[14px] font-bold text-[#181918] bg-[#EFECE4] border border-[#DDD6C7] px-2.5 py-0.5 rounded-md">
                    ${policy.maxSingleTxUsd}
                  </span>
                </div>
                <input
                  id="slider-max-tx"
                  type="range"
                  min={10}
                  max={1000}
                  step={5}
                  value={policy.maxSingleTxUsd}
                  onChange={(e) => onUpdatePolicy({ maxSingleTxUsd: Number(e.target.value) })}
                  className="w-full bitfli-slider"
                />
                <div className="flex justify-between font-mono text-[10.5px] text-[#5C5B57]">
                  <span>$10 min</span>
                  <span>Try &lt; $65 to block Scenario #2</span>
                  <span>$1,000 max</span>
                </div>
              </div>

              {/* Slider 2: Daily Spend Cap ($) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="slider-daily-cap"
                    className="text-[13.5px] font-semibold text-[#181918]"
                  >
                    Daily Spend Cap ($)
                  </label>
                  <span className="font-mono text-[14px] font-bold text-[#181918] bg-[#EFECE4] border border-[#DDD6C7] px-2.5 py-0.5 rounded-md">
                    ${policy.dailySpendCapUsd.toLocaleString("en-US")}
                  </span>
                </div>
                <input
                  id="slider-daily-cap"
                  type="range"
                  min={100}
                  max={5000}
                  step={25}
                  value={policy.dailySpendCapUsd}
                  onChange={(e) => onUpdatePolicy({ dailySpendCapUsd: Number(e.target.value) })}
                  className="w-full bitfli-slider"
                />
                <div className="flex items-center justify-between font-mono text-[10.5px] text-[#5C5B57]">
                  <span>$100</span>
                  <span>
                    Used today: ${policy.dailySpentTodayUsd.toFixed(0)} ({dailyUsagePct}%)
                  </span>
                  <span>$5,000</span>
                </div>
              </div>
            </div>

            {/* Partner Profit Split Waterfall */}
            <div className="pt-4 border-t border-[#EAE5DA] space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[13.5px] font-semibold text-[#181918]">
                  Partner Profit Split Waterfall
                </span>
                <div className="flex items-center gap-1 font-mono text-[10.5px]">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdatePolicy({
                        profitSplit: { leadDevPct: 55, designPartnerPct: 30, taxReservePct: 15 },
                      })
                    }
                    className={`px-2 py-0.5 rounded border cursor-pointer ${
                      policy.profitSplit.leadDevPct === 55
                        ? "bg-[#181918] text-white border-[#181918]"
                        : "bg-[#EFECE4] text-[#5C5B57] border-[#DDD6C7]"
                    }`}
                  >
                    55/30/15
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdatePolicy({
                        profitSplit: { leadDevPct: 60, designPartnerPct: 30, taxReservePct: 10 },
                      })
                    }
                    className={`px-2 py-0.5 rounded border cursor-pointer ${
                      policy.profitSplit.leadDevPct === 60
                        ? "bg-[#181918] text-white border-[#181918]"
                        : "bg-[#EFECE4] text-[#5C5B57] border-[#DDD6C7]"
                    }`}
                  >
                    60/30/10
                  </button>
                </div>
              </div>

              {/* Interactive Stacked Horizontal Bar */}
              <div className="h-4 w-full rounded-full overflow-hidden flex border border-[#DDD6C7] p-0.5 bg-[#EFECE4] gap-0.5">
                <div
                  style={{ width: `${policy.profitSplit.leadDevPct}%` }}
                  className="bg-[#181918] rounded-l-full transition-all duration-200"
                  title={`Lead Dev (${policy.profitSplit.leadDevPct}%)`}
                />
                <div
                  style={{ width: `${policy.profitSplit.designPartnerPct}%` }}
                  className="bg-[#B86B4B] transition-all duration-200"
                  title={`Design Partner (${policy.profitSplit.designPartnerPct}%)`}
                />
                <div
                  style={{ width: `${policy.profitSplit.taxReservePct}%` }}
                  className="bg-[#8D877A] rounded-r-full transition-all duration-200"
                  title={`Tax & Ops Reserve (${policy.profitSplit.taxReservePct}%)`}
                />
              </div>

              {/* Adjust Lead Share Fine Slider */}
              <div className="grid grid-cols-2 gap-3 pt-0.5">
                <div className="space-y-1">
                  <div className="flex justify-between font-mono text-[10px] text-[#5C5B57]">
                    <span>Lead Dev %</span>
                    <span className="text-[#181918] font-semibold">
                      {policy.profitSplit.leadDevPct}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={25}
                    max={75}
                    step={5}
                    value={policy.profitSplit.leadDevPct}
                    onChange={(e) => handleAdjustLeadDevSplit(Number(e.target.value))}
                    aria-label="Adjust Lead Dev profit split percentage"
                    className="w-full bitfli-slider"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between font-mono text-[10px] text-[#5C5B57]">
                    <span>Design %</span>
                    <span className="text-[#B86B4B] font-semibold">
                      {policy.profitSplit.designPartnerPct}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={55}
                    step={5}
                    value={policy.profitSplit.designPartnerPct}
                    onChange={(e) => handleAdjustDesignSplit(Number(e.target.value))}
                    aria-label="Adjust Design Partner profit split percentage"
                    className="w-full bitfli-slider"
                  />
                </div>
              </div>

              {/* Split Legend Breakdown */}
              <div className="grid grid-cols-3 gap-2 text-[11.5px]">
                <div className="rounded-lg bg-[#F4F1EA] p-2.5 border border-[#E5DFD2]">
                  <div className="flex items-center gap-1.5 font-medium text-[#181918]">
                    <span className="w-2 h-2 rounded-full bg-[#181918]" />
                    <span className="truncate">Lead Dev</span>
                  </div>
                  <div className="mt-1 font-mono font-bold text-[13px] text-[#181918]">
                    {policy.profitSplit.leadDevPct}%
                  </div>
                  <div className="font-mono text-[10px] text-[#5C5B57] truncate">
                    {policy.partnerWallets.leadDev}
                  </div>
                </div>

                <div className="rounded-lg bg-[#F4F1EA] p-2.5 border border-[#E5DFD2]">
                  <div className="flex items-center gap-1.5 font-medium text-[#181918]">
                    <span className="w-2 h-2 rounded-full bg-[#B86B4B]" />
                    <span className="truncate">Design Partner</span>
                  </div>
                  <div className="mt-1 font-mono font-bold text-[13px] text-[#B86B4B]">
                    {policy.profitSplit.designPartnerPct}%
                  </div>
                  <div className="font-mono text-[10px] text-[#5C5B57] truncate">
                    {policy.partnerWallets.designPartner}
                  </div>
                </div>

                <div className="rounded-lg bg-[#F4F1EA] p-2.5 border border-[#E5DFD2]">
                  <div className="flex items-center gap-1.5 font-medium text-[#181918]">
                    <span className="w-2 h-2 rounded-full bg-[#8D877A]" />
                    <span className="truncate">Tax &amp; Ops</span>
                  </div>
                  <div className="mt-1 font-mono font-bold text-[13px] text-[#5C5B57]">
                    {policy.profitSplit.taxReservePct}%
                  </div>
                  <div className="font-mono text-[10px] text-[#5C5B57] truncate">Reserve Vault</div>
                </div>
              </div>

              {/* Tranche Size Selector */}
              <div className="flex items-center justify-between gap-2 pt-1 font-mono text-[10.5px]">
                <span className="text-[#5C5B57]">Payout Tranche:</span>
                <div className="inline-flex rounded-lg bg-[#EFECE4] p-0.5 border border-[#DDD6C7]">
                  {([25, 50, 100] as const).map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setSplitTranchePct(pct)}
                      className={`px-2 py-0.5 rounded-md cursor-pointer transition-colors ${
                        splitTranchePct === pct
                          ? "bg-[#181918] text-[#F7F6F2]"
                          : "text-[#5C5B57] hover:text-[#181918]"
                      }`}
                    >
                      {pct}% ({formatUsd((metrics.netDistributableProfitUsd * pct) / 100)})
                    </button>
                  ))}
                </div>
              </div>

              {/* Run Profit Split Now Obsidian Button */}
              <button
                type="button"
                disabled={isSplitting}
                onClick={handleTriggerSplit}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#141514] hover:bg-[#262826] active:scale-[0.99] text-[#F7F6F2] text-[13.5px] font-semibold px-4 py-3 transition-all shadow-sm cursor-pointer disabled:opacity-60"
              >
                <Sparkles className="w-4 h-4 text-[#B86B4B]" />
                <span>
                  {isSplitting ? "Signing Cross-Chain Split in TEE..." : "Run Profit Split Now"}
                </span>
              </button>
            </div>

            {/* Approved Vendor Allowlist Pills */}
            <div className="pt-4 border-t border-[#EAE5DA] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[13.5px] font-semibold text-[#181918]">
                  Approved Vendor Allowlist
                </span>
                <span className="font-mono text-[11px] text-[#5C5B57]">
                  {policy.vendorAllowlist.length} active
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {policy.vendorAllowlist.map((vendor) => (
                  <span
                    key={vendor}
                    className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1 rounded-full bg-[#EFECE4] border border-[#DBD4C5] text-[12px] font-medium text-[#181918]"
                  >
                    <span>{vendor}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveVendor(vendor)}
                      aria-label={`Remove ${vendor} from allowlist`}
                      className="w-4 h-4 rounded-full hover:bg-[#181918]/10 inline-flex items-center justify-center text-[#5C5B57] hover:text-[#181918] cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>

              <form onSubmit={handleAddVendor} className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={newVendor}
                  onChange={(e) => setNewVendor(e.target.value)}
                  placeholder="+ Add Vendor (e.g. OpenAI API, Supabase)"
                  className="flex-1 rounded-lg bg-[#F4F1EA] border border-[#DAD3C4] px-3 py-2 text-[12.5px] text-[#181918] placeholder:text-[#5C5B57]/75 focus:outline-none focus:border-[#B86B4B]"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 rounded-lg bg-[#181918] hover:bg-[#2B2D2B] text-[#F7F6F2] text-[12px] font-semibold px-3.5 py-2 transition-colors cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 text-[#B86B4B]" />
                  <span>Add Vendor</span>
                </button>
              </form>
            </div>
          </div>

          {/* 3. Right 7 Columns — Live Execution Ledger & Cross-Chain Invoice Generator */}
          <div className="lg:col-span-7 rounded-[18px] bg-white border border-[#E2DDD0] overflow-hidden shadow-[0_4px_18px_rgba(24,25,24,0.03)]">
            {/* Tabbed Header */}
            <div className="px-5 sm:px-6 py-4 bg-[#FAF8F4] border-b border-[#EAE5DA] flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex flex-wrap items-center gap-1.5 bg-[#EFECE4] p-1 rounded-xl border border-[#DFD9CC]">
                <button
                  type="button"
                  onClick={() => onChangeTab("ledger")}
                  className={`px-3.5 py-1.5 rounded-lg text-[12.5px] font-semibold transition-all cursor-pointer ${
                    activeTab === "ledger"
                      ? "bg-[#141514] text-[#F7F6F2] shadow-2xs"
                      : "text-[#5C5B57] hover:text-[#181918]"
                  }`}
                >
                  Live Audit Ledger ({ledger.length})
                </button>
                <button
                  type="button"
                  onClick={() => onChangeTab("invoice")}
                  className={`px-3.5 py-1.5 rounded-lg text-[12.5px] font-semibold transition-bitfli cursor-pointer ${
                    activeTab === "invoice"
                      ? "bg-[#141514] text-[#F7F6F2] shadow-2xs"
                      : "text-[#5C5B57] hover:text-[#181918]"
                  }`}
                >
                  + Create Cross-Chain Invoice (1Click)
                </button>
                <button
                  type="button"
                  onClick={() => onChangeTab("checks")}
                  className={`px-3.5 py-1.5 rounded-lg text-[12.5px] font-semibold transition-bitfli cursor-pointer ${
                    activeTab === "checks"
                      ? "bg-[#141514] text-[#F7F6F2] shadow-2xs"
                      : "text-[#5C5B57] hover:text-[#181918]"
                  }`}
                >
                  Gasless Checks ({checks.length})
                </button>
              </div>

              <button
                type="button"
                onClick={onExportCsv}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#EFECE4] hover:bg-[#E4DFD3] border border-[#D8D1C2] px-3.5 py-2 font-mono text-[11.5px] font-semibold text-[#181918] transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-[#B86B4B]" />
                <span>Export Accountant CSV</span>
              </button>
            </div>

            {/* TAB 1: Live Audit Ledger */}
            {activeTab === "ledger" && (
              <div className="p-5 sm:p-6 space-y-4">
                {/* Filter Pills */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(
                      [
                        "ALL",
                        "INTENTS IN",
                        "OUTLAYER OPEX",
                        "RULE BLOCKED",
                        "PROFIT SPLIT",
                      ] as const
                    ).map((flt) => (
                      <button
                        key={flt}
                        type="button"
                        onClick={() => setLedgerFilter(flt)}
                        className={`px-2.5 py-1 rounded-md font-mono text-[10.5px] transition-colors cursor-pointer ${
                          ledgerFilter === flt
                            ? "bg-[#181918] text-[#F7F6F2]"
                            : "bg-[#F4F1EA] text-[#5C5B57] hover:text-[#181918]"
                        }`}
                      >
                        {flt}
                      </button>
                    ))}
                  </div>
                  <span className="font-mono text-[11px] text-[#5C5B57]">
                    Click any TEE receipt to inspect attestation
                  </span>
                </div>

                {/* Selected Cryptographic Receipt Inspector & Modal */}
                {selectedReceipt && (
                  <>
                    <div className="rounded-xl bg-[#141514] text-[#F7F6F2] border border-white/12 p-4 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#7CE3A6]">
                          OUTLAYER TEE CRYPTOGRAPHIC ATTESTATION · {selectedReceipt.id}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedReceipt(null)}
                          className="text-[#F7F6F2]/60 hover:text-white cursor-pointer"
                          aria-label="Close attestation inspector"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-[11.5px] text-[#F7F6F2]/80">
                        <div>
                          <span className="text-[#F7F6F2]/45">Receipt / Tx: </span>
                          <span className="text-[#FCD34D]">{selectedReceipt.teeReceipt}</span>
                        </div>
                        <div>
                          <span className="text-[#F7F6F2]/45">MRENCLAVE: </span>
                          <span>{selectedReceipt.enclaveMeasurement}</span>
                        </div>
                      </div>
                      <p className="text-[12.5px] text-[#F7F6F2]/75 pt-1 border-t border-white/10">
                        {selectedReceipt.memo}
                      </p>
                    </div>

                    {/* Full JSON TEE Attestation Proof Modal */}
                    <div
                      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141514]/60 backdrop-blur-xs"
                      role="dialog"
                      aria-modal="true"
                      aria-label="OutLayer TEE Cryptographic Attestation Proof"
                      onClick={() => setSelectedReceipt(null)}
                    >
                      <div
                        className="w-full max-w-[600px] rounded-[20px] bg-[#141514] text-[#F7F6F2] border border-white/15 shadow-2xl overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="px-6 py-4 bg-white/[0.03] border-b border-white/10 flex items-center justify-between gap-3">
                          <div className="space-y-0.5">
                            <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-[#7CE3A6] flex items-center gap-1.5">
                              <ShieldCheck className="w-3.5 h-3.5 text-[#7CE3A6]" />
                              <span>
                                {selectedReceipt.teeAttested ||
                                selectedReceipt.attestation?.teeAttested
                                  ? "LIVE_OUTLAYER_TEE · HARDWARE ATTESTED"
                                  : "SANDBOX_PREVIEW · local_policy_check"}
                              </span>
                            </div>
                            <h3 className="text-[17px] font-bold tracking-[-0.02em] text-white">
                              Receipt {selectedReceipt.teeReceipt} · {selectedReceipt.eventType}
                            </h3>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedReceipt(null)}
                            aria-label="Close attestation modal"
                            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/15 inline-flex items-center justify-center text-[#F7F6F2] cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="p-6 space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-[11.5px]">
                            <div className="rounded-xl bg-white/[0.04] border border-white/10 p-3">
                              <div className="text-[10px] uppercase text-[#F7F6F2]/45">
                                enclaveMeasurement (MRENCLAVE)
                              </div>
                              <div className="mt-1 text-[#7CE3A6] break-all">
                                {selectedReceipt.attestation?.enclaveMeasurement ??
                                  selectedReceipt.enclaveMeasurement}
                              </div>
                            </div>
                            <div className="rounded-xl bg-white/[0.04] border border-white/10 p-3">
                              <div className="text-[10px] uppercase text-[#F7F6F2]/45">
                                policyHash (SHA-256)
                              </div>
                              <div className="mt-1 text-[#FCD34D] break-all">
                                {selectedReceipt.attestation?.policyHash ??
                                  "0x8f31c09d4a2b71d055c190fa3e88b102"}
                              </div>
                            </div>
                            <div className="rounded-xl bg-white/[0.04] border border-white/10 p-3">
                              <div className="text-[10px] uppercase text-[#F7F6F2]/45">
                                nearBlockHeight &amp; Timestamp
                              </div>
                              <div className="mt-1 text-[#F7F6F2]/90 break-all">
                                #{selectedReceipt.attestation?.nearBlockHeight ?? 142158920} · {selectedReceipt.timestamp}
                              </div>
                            </div>
                            <div className="rounded-xl bg-white/[0.04] border border-white/10 p-3">
                              <div className="text-[10px] uppercase text-[#F7F6F2]/45">
                                Verification Status &amp; Verdict
                              </div>
                              <div
                                className={`mt-1 font-semibold ${
                                  selectedReceipt.verdict === "ALLOW"
                                    ? "text-[#7CE3A6]"
                                    : "text-[#FCA5A5]"
                                }`}
                              >
                                {selectedReceipt.teeAttested ||
                                selectedReceipt.attestation?.teeAttested
                                  ? "LIVE_OUTLAYER_TEE (OutLayer Enclave)"
                                  : "SANDBOX_PREVIEW · local_policy_check"}{" "}
                                · {selectedReceipt.verdict} (${selectedReceipt.amountUsd.toFixed(2)})
                              </div>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <div className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-[#F7F6F2]/50">
                              Full Cryptographic Attestation Payload (JSON)
                            </div>
                            <pre className="rounded-xl bg-black/60 border border-white/10 p-4 font-mono text-[11px] leading-relaxed text-[#7CE3A6] overflow-x-auto max-h-[240px]">
                              {JSON.stringify(
                                {
                                  ledgerId: selectedReceipt.id,
                                  podId:
                                    selectedReceipt.attestation?.podId ?? policy.podAccountId,
                                  enclaveMeasurement:
                                    selectedReceipt.attestation?.enclaveMeasurement ??
                                    selectedReceipt.enclaveMeasurement,
                                  policyHash:
                                    selectedReceipt.attestation?.policyHash ??
                                    "0x8f31c09d4a2b71d055c190fa3e88b102",
                                  nonce:
                                    selectedReceipt.attestation?.nonce ??
                                    `0x${selectedReceipt.id.replace(/[^a-f0-9]/gi, "")}94a2e81b`,
                                  signature:
                                    selectedReceipt.attestation?.signature ??
                                    `0x${selectedReceipt.teeReceipt}_sgx_attested_sha256`,
                                  decision: selectedReceipt.verdict,
                                  counterparty: selectedReceipt.counterparty,
                                  amountUsd: selectedReceipt.amountUsd,
                                  ruleChecks: selectedReceipt.attestation?.ruleChecks ?? {
                                    emergencyFreezeCheck: true,
                                    maxSingleSpendCheck: selectedReceipt.verdict === "ALLOW",
                                    dailySpendCapCheck: true,
                                    availableOpexMarginCheck: true,
                                    vendorAllowlistCheck: selectedReceipt.verdict === "ALLOW",
                                  },
                                  violationCodes:
                                    selectedReceipt.attestation?.violationCodes ?? [],
                                  timestamp: selectedReceipt.timestamp,
                                },
                                null,
                                2,
                              )}
                            </pre>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-white/10">
                            <span className="font-mono text-[11px] text-[#F7F6F2]/55">
                              {selectedReceipt.teeAttested ||
                              selectedReceipt.attestation?.teeAttested
                                ? "Hardware Attested via OutLayer /attestations/by-call"
                                : "Deterministic SHA-256 Policy Audit Hash (Local Rule Check)"}
                            </span>
                            <button
                              type="button"
                              onClick={() => setSelectedReceipt(null)}
                              className="px-4 py-2 rounded-full bg-[#7CE3A6] text-[#141514] font-semibold text-[12px] cursor-pointer"
                            >
                              Done
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Crisp Audit Ledger Table */}
                <div className="overflow-x-auto -mx-5 sm:mx-0">
                  <table className="w-full text-left border-collapse min-w-[640px]">
                    <thead>
                      <tr className="border-b border-[#EAE5DA] font-mono text-[10.5px] uppercase tracking-[0.12em] text-[#5C5B57]">
                        <th className="py-2.5 pl-5 sm:pl-2 pr-3">Timestamp</th>
                        <th className="py-2.5 px-3">Event</th>
                        <th className="py-2.5 px-3">Counterparty</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                        <th className="py-2.5 pl-3 pr-5 sm:pr-2 text-right">TEE Receipt / Tx</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F0ECE2] text-[13px]">
                      {filteredLedger.map((row) => {
                        const isInflow = row.eventType === "INTENTS IN";
                        const isBlocked = row.eventType === "RULE BLOCKED";
                        return (
                          <tr key={row.id} className="hover:bg-[#FAF8F3] transition-bitfli animate-ledger-row group">
                            <td className="py-3.5 pl-5 sm:pl-2 pr-3 font-mono text-[11px] text-[#5C5B57] whitespace-nowrap">
                              {row.timestamp.slice(5, 16)}
                            </td>
                            <td className="py-3.5 px-3 whitespace-nowrap">
                              {renderEventBadge(row.eventType)}
                            </td>
                            <td className="py-3.5 px-3">
                              <div className="font-medium text-[#181918] leading-snug">
                                {row.counterparty}
                              </div>
                              <div className="font-mono text-[10.5px] text-[#5C5B57]">
                                {row.chainOrRail}
                              </div>
                            </td>
                            <td className="py-3.5 px-3 text-right font-mono text-[13px] font-semibold whitespace-nowrap">
                              {isInflow && (
                                <span className="text-[#1E3A2B]">+{formatUsd(row.amountUsd)}</span>
                              )}
                              {isBlocked && (
                                <span className="text-[#9E2A2B] line-through">
                                  {formatUsd(row.amountUsd)}
                                </span>
                              )}
                              {!isInflow && !isBlocked && (
                                <span className="text-[#181918]">-{formatUsd(row.amountUsd)}</span>
                              )}
                            </td>
                            <td className="py-3.5 pl-3 pr-5 sm:pr-2 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => setSelectedReceipt(row)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#F4F1EA] group-hover:bg-[#EFECE4] border border-[#E0D9CA] font-mono text-[11px] text-[#181918] hover:border-[#B86B4B] transition-colors cursor-pointer"
                              >
                                <span>{row.teeReceipt}</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 2: Create Cross-Chain Invoice (1Click) */}
            {activeTab === "invoice" && (
              <div className="p-5 sm:p-6 space-y-6">
                <form
                  onSubmit={handleGenerateInvoice}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-4 bg-[#FAF8F4] border border-[#EAE5DA] rounded-2xl p-4 sm:p-5"
                >
                  <div className="sm:col-span-5">
                    <label className="block font-mono text-[10.5px] uppercase tracking-[0.12em] text-[#5C5B57] mb-1.5">
                      Client Name
                    </label>
                    <input
                      type="text"
                      required
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="e.g. Acme Protocol"
                      className="w-full rounded-xl bg-white border border-[#DAD3C4] px-3.5 py-2.5 text-[13.5px] text-[#181918] focus:outline-none focus:border-[#B86B4B]"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block font-mono text-[10.5px] uppercase tracking-[0.12em] text-[#5C5B57] mb-1.5">
                      Amount (USD)
                    </label>
                    <input
                      type="number"
                      required
                      min="10"
                      step="10"
                      value={invoiceAmount}
                      onChange={(e) => setInvoiceAmount(e.target.value)}
                      className="w-full rounded-xl bg-white border border-[#DAD3C4] px-3.5 py-2.5 font-mono text-[13.5px] text-[#181918] focus:outline-none focus:border-[#B86B4B]"
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block font-mono text-[10.5px] uppercase tracking-[0.12em] text-[#5C5B57] mb-1.5">
                      Client Source Chain
                    </label>
                    <select
                      value={sourceChain}
                      onChange={(e) => setSourceChain(e.target.value as SourceChainOption)}
                      className="w-full rounded-xl bg-white border border-[#DAD3C4] px-3.5 py-2.5 text-[13.5px] text-[#181918] focus:outline-none focus:border-[#B86B4B]"
                    >
                      {SOURCE_CHAINS.map((ch) => (
                        <option key={ch} value={ch}>
                          {ch}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-8">
                    <label className="block font-mono text-[10.5px] uppercase tracking-[0.12em] text-[#5C5B57] mb-1.5">
                      Deliverable / Milestone Memo
                    </label>
                    <input
                      type="text"
                      value={milestoneMemo}
                      onChange={(e) => setMilestoneMemo(e.target.value)}
                      className="w-full rounded-xl bg-white border border-[#DAD3C4] px-3.5 py-2 text-[13px] text-[#181918] focus:outline-none focus:border-[#B86B4B]"
                    />
                  </div>

                  <div className="sm:col-span-4 flex items-end">
                    <button
                      type="submit"
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#181918] hover:bg-[#292B29] text-[#F7F6F2] text-[13px] font-semibold px-4 py-2.5 transition-all cursor-pointer"
                    >
                      <QrCode className="w-4 h-4 text-[#B86B4B]" />
                      <span>Generate 1Click Address</span>
                    </button>
                  </div>
                </form>

                {/* Live Generated 1Click Deposit Address Card */}
                {currentInvoice && (
                  <div className="rounded-[16px] bg-[#141514] text-[#F7F6F2] border border-white/12 p-5 sm:p-6 space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-white/10">
                      <div>
                        <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-[#B86B4B]">
                          NEAR INTENTS 1CLICK DEPOSIT QUOTE · {currentInvoice.id}
                        </div>
                        <div className="mt-0.5 text-[16px] font-semibold">
                          {currentInvoice.clientName} —{" "}
                          <span className="font-mono">{formatUsd(currentInvoice.amountUsd)}</span>
                        </div>
                      </div>

                      {settlingInvoiceId === currentInvoice.id ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#3B2E17] text-[#FCD34D] border border-[#FCD34D]/25 font-mono text-[11.5px]">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Routing via 1Click...
                        </span>
                      ) : currentInvoice.status === "SETTLED" ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1E3A2B] text-[#7CE3A6] border border-[#7CE3A6]/25 font-mono text-[11.5px]">
                          ✓ Settled in Pod Vault
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#3B2E17] text-[#FCD34D] border border-[#FCD34D]/25 font-mono text-[11.5px]">
                          Awaiting {currentInvoice.sourceChain} Deposit
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                      <GeometricQrCode value={currentInvoice.depositAddress} size={116} />

                      <div className="flex-1 space-y-3 min-w-0 w-full">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 font-mono text-[12px]">
                          <div className="rounded-lg bg-white/[0.04] border border-white/10 p-2.5">
                            <div className="text-[10px] uppercase text-[#F7F6F2]/50">
                              Client Sends ({currentInvoice.sourceChain})
                            </div>
                            <div className="mt-0.5 text-[#FCD34D] font-semibold">
                              {currentInvoice.quotedSourceAmount}
                            </div>
                          </div>
                          <div className="rounded-lg bg-white/[0.04] border border-white/10 p-2.5">
                            <div className="text-[10px] uppercase text-[#F7F6F2]/50">
                              Pod Vault Receives
                            </div>
                            <div className="mt-0.5 text-[#7CE3A6] font-semibold">
                              {formatUsd(currentInvoice.amountUsd)} NEAR USDC
                            </div>
                          </div>
                        </div>

                        <div className="rounded-lg bg-black/40 border border-white/10 px-3 py-2 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-[#F7F6F2]/45">
                              1Click Atomic Deposit Address
                            </div>
                            <div className="font-mono text-[12px] text-[#F7F6F2] truncate">
                              {currentInvoice.depositAddress}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopyAddress(currentInvoice.depositAddress)}
                            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white/10 hover:bg-white/15 font-mono text-[10.5px] text-[#F7F6F2] cursor-pointer"
                          >
                            {copiedAddr ? (
                              <>
                                <Check className="w-3 h-3 text-[#7CE3A6]" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                      <span className="font-mono text-[11px] text-[#F7F6F2]/55">
                        Quote ID: {currentInvoice.intentQuoteId} → {currentInvoice.destinationVault}
                      </span>

                      {currentInvoice.status === "SETTLED" ? (
                        <button
                          type="button"
                          onClick={() => onChangeTab("ledger")}
                          className="inline-flex items-center gap-2 rounded-full bg-[#1E3A2B] text-[#7CE3A6] border border-[#7CE3A6]/30 px-5 py-2.5 text-[13px] font-semibold cursor-pointer"
                        >
                          <Check className="w-4 h-4" />
                          <span>View Settled Entry in Ledger →</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={settlingInvoiceId === currentInvoice.id}
                          onClick={() => handleSimulatePay(currentInvoice.id)}
                          className="inline-flex items-center gap-2 rounded-full bg-[#B86B4B] hover:bg-[#c57756] text-[#F7F6F2] px-5 py-2.5 text-[13px] font-semibold transition-all cursor-pointer disabled:opacity-60"
                        >
                          <span>
                            {settlingInvoiceId === currentInvoice.id
                              ? "Simulating 1Click Deposit..."
                              : "Simulate Client Payment"}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: OutLayer Gasless Payment Checks (POST /api/checks) */}
            {activeTab === "checks" && (
              <div className="p-5 sm:p-6 space-y-6">
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!onIssuePaymentCheck) return;
                    setIsIssuingCheck(true);
                    try {
                      await onIssuePaymentCheck({
                        payeeLabel: checkPayee.trim() || "Sub-Contractor Bounty",
                        amountUsd: Math.max(1, Number(checkAmount) || 85),
                        memo: checkMemo.trim() || "Gasless sub-contractor deliverable check",
                      });
                    } finally {
                      setIsIssuingCheck(false);
                    }
                  }}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-4 bg-[#FAF8F4] border border-[#EAE5DA] rounded-2xl p-4 sm:p-5"
                >
                  <div className="sm:col-span-5">
                    <label className="block font-mono text-[10.5px] uppercase tracking-[0.12em] text-[#5C5B57] mb-1.5">
                      Sub-Contractor / Payee Label
                    </label>
                    <input
                      type="text"
                      required
                      value={checkPayee}
                      onChange={(e) => setCheckPayee(e.target.value)}
                      className="w-full rounded-xl bg-white border border-[#DAD3C4] px-3.5 py-2.5 text-[13.5px] text-[#181918] focus:outline-none focus:border-[#B86B4B]"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block font-mono text-[10.5px] uppercase tracking-[0.12em] text-[#5C5B57] mb-1.5">
                      Check Amount (USD)
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={checkAmount}
                      onChange={(e) => setCheckAmount(e.target.value)}
                      className="w-full rounded-xl bg-white border border-[#DAD3C4] px-3.5 py-2.5 font-mono text-[13.5px] text-[#181918] focus:outline-none focus:border-[#B86B4B]"
                    />
                  </div>
                  <div className="sm:col-span-4 flex items-end">
                    <button
                      type="submit"
                      disabled={isIssuingCheck}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#181918] hover:bg-[#292B29] text-[#F7F6F2] text-[13px] font-semibold px-4 py-2.5 transition-bitfli cursor-pointer disabled:opacity-55"
                    >
                      <Sparkles className="w-4 h-4 text-[#B86B4B]" />
                      <span>{isIssuingCheck ? "Signing in TEE..." : "Issue Gasless Check"}</span>
                    </button>
                  </div>
                  <div className="sm:col-span-12">
                    <label className="block font-mono text-[10.5px] uppercase tracking-[0.12em] text-[#5C5B57] mb-1.5">
                      Deliverable / Bounty Memo (Enforced by ${policy.maxSingleTxUsd} Per-Tx Cap)
                    </label>
                    <input
                      type="text"
                      value={checkMemo}
                      onChange={(e) => setCheckMemo(e.target.value)}
                      className="w-full rounded-xl bg-white border border-[#DAD3C4] px-3.5 py-2 text-[13px] text-[#181918] focus:outline-none focus:border-[#B86B4B]"
                    />
                  </div>
                </form>

                {/* Issued Gasless Payment Checks List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#5C5B57]">
                      ACTIVE GASLESS PAYMENT CHECKS · POST /api/checks
                    </span>
                    <span className="font-mono text-[11px] text-[#1E3A2B]">
                      Zero gas required for recipient claim
                    </span>
                  </div>

                  {checks.map((chk) => (
                    <div
                      key={chk.id}
                      className="rounded-[16px] bg-[#141514] text-[#F7F6F2] border border-white/12 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-bitfli"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] px-2.5 py-0.5 rounded-full bg-[#1E3A2B] text-[#7CE3A6] font-semibold">
                            {chk.id} · {chk.status}
                          </span>
                          <span className="font-mono text-[11px] text-[#FCD34D]">
                            {chk.teeReceipt}
                          </span>
                        </div>
                        <div className="text-[15px] font-semibold text-white">
                          {chk.payeeLabel} —{" "}
                          <span className="font-mono text-[#7CE3A6]">
                            {formatUsd(chk.amountUsd)} USDC
                          </span>
                        </div>
                        <div className="text-[12.5px] text-[#F7F6F2]/70">{chk.memo}</div>
                        <div className="font-mono text-[11.5px] text-[#B86B4B] pt-0.5">
                          {chk.claimUrl}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(chk.claimUrl);
                            setCopiedCheckUrl(chk.id);
                            setTimeout(() => setCopiedCheckUrl(null), 1600);
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/10 hover:bg-white/15 font-mono text-[11.5px] text-[#F7F6F2] transition-bitfli cursor-pointer"
                        >
                          {copiedCheckUrl === chk.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-[#7CE3A6]" />
                              <span>Copied Link</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy Claim Link</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Live API Client Layer Telemetry Strip */}
        <div className="rounded-[14px] bg-[#EFECE4] border border-[#DDD6C7] px-4 py-3 flex flex-wrap items-center justify-between gap-3 font-mono text-[11px]">
          <div className="flex flex-wrap items-center gap-2 text-[#181918]">
            <Activity className="w-3.5 h-3.5 text-[#B86B4B]" />
            <span className="px-2 py-0.5 rounded bg-[#141514] text-[#7CE3A6] font-semibold">
              {lastApiTelemetry.method} {lastApiTelemetry.endpoint}
            </span>
            <span className="text-[#5C5B57]">{lastApiTelemetry.status} OK ·</span>
            <span className="text-[#181918]">{lastApiTelemetry.summary}</span>
          </div>
          <button
            type="button"
            onClick={onResetSandbox}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white hover:bg-[#F4F1EA] border border-[#D8D1C2] text-[#5C5B57] hover:text-[#181918] transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Demo State</span>
          </button>
        </div>
      </div>
    </section>
  );
};
