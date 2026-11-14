import React, { useState } from "react";
import { ArrowRight, Check, Hourglass, KeyRound, Play, ShieldAlert, ShieldCheck, Terminal, Users, X } from "lucide-react";
import type {
  AgentContainmentSnapshot,
  DecisionEvaluation,
  LedgerEntry,
  TreasuryPolicy,
} from "../lib/api";
import { PRESET_SCENARIOS, type PresetScenarioId } from "../lib/scenarios";

interface DecisionEngineSectionProps {
  policy: TreasuryPolicy;
  evaluation: DecisionEvaluation;
  agentContainment?: AgentContainmentSnapshot;
  activePresetId: PresetScenarioId | null;
  recentLedger: LedgerEntry[];
  isExecuting: boolean;
  onSelectPreset: (presetId: PresetScenarioId) => void;
  onExecuteActiveScenario: () => void;
  onRunCustomProcurement: (input: {
    agentName: string;
    counterparty: string;
    amountUsd: number;
    purpose: string;
    multisigOverride?: {
      enabled: boolean;
      signers: string[];
    };
  }) => Promise<void>;
  onInspectReceipt?: (entry: LedgerEntry) => void;
}

export const DecisionEngineSection: React.FC<DecisionEngineSectionProps> = ({
  policy,
  evaluation,
  agentContainment,
  activePresetId,
  recentLedger,
  isExecuting,
  onSelectPreset,
  onExecuteActiveScenario,
  onRunCustomProcurement,
  onInspectReceipt,
}) => {
  const [customVendor, setCustomVendor] = useState("Anthropic API");
  const [customAmount, setCustomAmount] = useState("95");
  const [customPurpose, setCustomPurpose] = useState(
    "Claude 3.7 Sonnet code-review batch via OutLayer Custody",
  );
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [isMultisigModalOpen, setIsMultisigModalOpen] = useState(false);
  const [selectedSigners, setSelectedSigners] = useState<string[]>([
    `Lead Dev (${policy.partnerWallets.leadDev})`,
    `Design Partner (${policy.partnerWallets.designPartner})`,
  ]);
  const [isSigningMultisig, setIsSigningMultisig] = useState(false);

  const partnerSignersList = [
    {
      id: `Lead Dev (${policy.partnerWallets.leadDev})`,
      role: "Lead Dev Partner",
      wallet: policy.partnerWallets.leadDev,
      weight: "1/3",
    },
    {
      id: `Design Partner (${policy.partnerWallets.designPartner})`,
      role: "Design Partner",
      wallet: policy.partnerWallets.designPartner,
      weight: "1/3",
    },
    {
      id: `Tax & Ops Vault (${policy.partnerWallets.taxReserve})`,
      role: "Ops Reserve Guardian",
      wallet: policy.partnerWallets.taxReserve,
      weight: "1/3",
    },
  ];

  const toggleSigner = (signerId: string) => {
    setSelectedSigners((prev) =>
      prev.includes(signerId)
        ? prev.filter((item) => item !== signerId)
        : [...prev, signerId],
    );
  };

  const handleConfirmMultisigOverride = async () => {
    if (selectedSigners.length < 2) return;
    setIsSigningMultisig(true);
    try {
      await onRunCustomProcurement({
        agentName: evaluation.taskActor || "Escalated Pod Agent",
        counterparty: evaluation.taskCounterparty || "Anthropic API",
        amountUsd: Math.max(1, evaluation.taskAmountUsd || 850),
        purpose: `${evaluation.taskDetail} [2/3 Multisig Escalation Override]`,
        multisigOverride: {
          enabled: true,
          signers: selectedSigners,
        },
      });
      setIsMultisigModalOpen(false);
    } finally {
      setIsSigningMultisig(false);
    }
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = Math.max(1, Number(customAmount) || 0);
    await onRunCustomProcurement({
      agentName: "Custom Pod Agent",
      counterparty: customVendor.trim() || "unknown-vendor.near",
      amountUsd: parsedAmount,
      purpose: customPurpose.trim() || "Autonomous API procurement request",
    });
    setIsCustomModalOpen(false);
  };

  const latestSettledInflow = recentLedger.find((r) => r.eventType === "INTENTS IN");
  const pastInflowLabel = latestSettledInflow
    ? `${latestSettledInflow.counterparty} (+$${latestSettledInflow.amountUsd.toLocaleString("en-US")}) settled via 1Click`
    : "Awaiting first cross-chain 1Click invoice settlement";

  return (
    <section
      id="decision-engine"
      className="w-full bg-[#F4F1EA] pt-14 pb-16 border-b border-[#EAE5DA]"
    >
      <div className="max-w-[1140px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Centered Two-Line Heading */}
        <div className="text-center max-w-[700px] mx-auto mb-9">
          <h2 className="text-[36px] sm:text-[46px] font-bold leading-[1.08] tracking-[-0.03em]">
            <span className="block text-[#181918]">Settle anywhere.</span>
            <span className="block text-[#B86B4B]">Aligned with your margins.</span>
          </h2>
          <p className="mt-4 text-[16.5px] leading-[1.6] text-[#5C5B57]">
            Configure your agency&apos;s financial guardrails in plain numbers. OutLayer TEE custody
            enforces every spend cap and revenue split before a single cent moves.
          </p>
        </div>

        {/* Interactive Scenario Selector Bar (Above the Obsidian Card) */}
        <div className="mb-5">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2.5">
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#5C5B57]">
              LIVE TEE SIMULATION SCENARIOS — CLICK TO INSPECT
            </span>
            <button
              type="button"
              onClick={() => setIsCustomModalOpen(true)}
              className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-[#B86B4B] hover:text-[#181918] font-semibold transition-colors cursor-pointer"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>+ TEST CUSTOM AGENT SPEND</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {PRESET_SCENARIOS.map((sc) => {
              const isSelected = activePresetId === sc.id;
              return (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => onSelectPreset(sc.id)}
                  className={`text-left px-3.5 py-2.5 rounded-xl text-[12.5px] font-medium leading-snug transition-all cursor-pointer border ${
                    isSelected
                      ? "bg-[#141514] text-[#F7F6F2] border-[#141514] shadow-[0_6px_18px_rgba(20,21,20,0.16)]"
                      : "bg-[#EFECE4] hover:bg-white text-[#181918] border-[#DDD6C7]"
                  }`}
                >
                  {sc.pillLabel}
                </button>
              );
            })}
          </div>
        </div>

        {/* Signature Matte Obsidian 3-Column Decision Card */}
        <div className="rounded-[16px] bg-[#141514] text-[#F7F6F2] border border-white/12 shadow-[0_22px_50px_rgba(20,21,20,0.22)] overflow-hidden transition-bitfli">
          {/* Card Header Bar */}
          <div className="px-5 sm:px-6 py-3.5 border-b border-white/10 flex flex-wrap items-center justify-between gap-3 bg-white/[0.02]">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#B86B4B]" />
              <span className="text-[13px] font-medium text-[#F7F6F2]/90">
                Your agency&apos;s treasury policy{" "}
                <span className="font-mono text-[#F7F6F2]/65">({policy.podAccountId})</span>
              </span>
            </div>

            <div className="inline-flex items-center gap-2 font-mono text-[11.5px] text-[#7CE3A6]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#7CE3A6]" />
              <span>
                {evaluation.teeAttested || evaluation.attestation?.teeAttested
                  ? "LIVE_OUTLAYER_TEE · TEE Attested"
                  : `${evaluation.executionStatus ?? "SANDBOX_PREVIEW"} · ${evaluation.attestationSource ?? "local_policy_check"}`}
              </span>
              <span className="hidden sm:inline text-[#F7F6F2]/35">|</span>
              <button
                type="button"
                onClick={() => {
                  if (onInspectReceipt) {
                    onInspectReceipt({
                      id: "ldg_live_decision",
                      podId: policy.podAccountId,
                      timestamp: evaluation.evaluatedAt,
                      eventType:
                        evaluation.verdict === "BLOCK" ? "RULE BLOCKED" : "OUTLAYER OPEX",
                      counterparty: evaluation.taskCounterparty,
                      chainOrRail: evaluation.taskChainRoute,
                      amountUsd: evaluation.taskAmountUsd,
                      verdict: evaluation.verdict,
                      teeReceipt: evaluation.teeReceipt,
                      enclaveMeasurement:
                        evaluation.attestation?.enclaveMeasurement ??
                        "local_policy_check",
                      memo: evaluation.explanation,
                      attestation: evaluation.attestation,
                    });
                  }
                }}
                className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/[0.06] hover:bg-white/[0.14] border border-white/15 text-[#FCD34D] transition-bitfli cursor-pointer"
                title="Inspect full OutLayer TEE JSON cryptographic commitment"
              >
                <span>{evaluation.teeReceipt}</span>
              </button>
            </div>
          </div>

          {/* 3 Equal Columns Separated by 1px solid rgba(255,255,255,0.1) Dividers */}
          <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-white/10">
            {/* Column 1 — Company policies */}
            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#F7F6F2]/55">
                  Column 01 · Company policies
                </span>
                <span
                  className={`font-mono text-[10px] px-2 py-0.5 rounded-full ${
                    policy.autonomousOpsActive
                      ? "bg-[#1E3A2B] text-[#7CE3A6]"
                      : "bg-[#3D1C1C] text-[#FCA5A5]"
                  }`}
                >
                  {policy.autonomousOpsActive ? "OPS ACTIVE" : "HUMAN LOCK"}
                </span>
              </div>

              <p className="font-mono text-[12.5px] leading-[1.7] text-[#F7F6F2]/90 bg-white/[0.03] border border-white/10 rounded-xl p-3.5">
                Max single tx:{" "}
                <span className="text-white font-semibold">${policy.maxSingleTxUsd}</span> · Daily
                cap: <span className="text-white font-semibold">${policy.dailySpendCapUsd}</span> ·
                Profit lock:{" "}
                <span className="text-white font-semibold">{policy.profitLockPct}%</span> ·
                Allowlist:{" "}
                <span className="text-[#7CE3A6] font-semibold">
                  {policy.vendorAllowlist.length} verified vendors
                </span>
              </p>

              <div className="space-y-1.5">
                <div className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-[#F7F6F2]/45">
                  Enclave Allowlisted Counterparties
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {policy.vendorAllowlist.map((vendor) => (
                    <span
                      key={vendor}
                      className="px-2.5 py-1 rounded-md bg-white/[0.05] border border-white/10 font-mono text-[11px] text-[#F7F6F2]/80"
                    >
                      {vendor}
                    </span>
                  ))}
                </div>
              </div>

              {/* NEAR Intents Agent API Containment & Grants State */}
              <div className="rounded-xl bg-white/[0.03] border border-white/10 p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.08em]">
                  <span className="text-[#F7F6F2]/55">Agent API Containment</span>
                  <span className="px-1.5 py-0.5 rounded bg-white/[0.06] text-[#FCD34D]">
                    {agentContainment
                      ? `${agentContainment.status} · ${agentContainment.mode}`
                      : "SANDBOX_PREVIEW · local_policy_check"}
                  </span>
                </div>
                <div className="font-mono text-[11px] text-[#F7F6F2]/80">
                  Mode:{" "}
                  <span className="text-[#7CE3A6]">
                    {agentContainment?.containmentMode ?? "UNCONFIGURED"}
                  </span>{" "}
                  · Grants:{" "}
                  <span className="text-white">
                    {agentContainment?.grants?.length ?? 0} active
                  </span>
                </div>
                <div className="text-[11px] text-[#F7F6F2]/55 leading-snug">
                  {agentContainment?.statusMessage ??
                    "api.agentsonintents.com/v1/agents/{id}/containment (local_policy_check)"}
                </div>
              </div>
            </div>

            {/* Column 2 — Current task */}
            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#F7F6F2]/55">
                  Column 02 · Current task
                </span>
                <span className="font-mono text-[11px] text-[#B86B4B]">
                  ${evaluation.taskAmountUsd.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="rounded-xl bg-white/[0.04] border border-white/10 p-3.5 space-y-2">
                <div className="text-[15px] font-semibold text-[#F7F6F2] tracking-[-0.01em]">
                  {evaluation.taskTitle}
                </div>
                <div className="font-mono text-[11.5px] text-[#F7F6F2]/70 space-y-1">
                  <div>
                    <span className="text-[#F7F6F2]/45">Actor: </span>
                    <span>{evaluation.taskActor}</span>
                  </div>
                  <div>
                    <span className="text-[#F7F6F2]/45">Target: </span>
                    <span className="text-[#F7F6F2]">{evaluation.taskCounterparty}</span>
                  </div>
                  <div>
                    <span className="text-[#F7F6F2]/45">Route: </span>
                    <span className="text-[#B86B4B]">{evaluation.taskChainRoute}</span>
                  </div>
                </div>
              </div>

              <p className="text-[12.5px] leading-relaxed text-[#F7F6F2]/65">
                {evaluation.taskDetail}
              </p>

              {/* NEAR AI Cloud (deepseek-ai/DeepSeek-V3-0324) Semantic Audit */}
              <div className="rounded-xl bg-white/[0.03] border border-white/10 p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.08em]">
                  <span className="text-[#F7F6F2]/55">NEAR AI Cloud Audit</span>
                  <span className="px-1.5 py-0.5 rounded bg-white/[0.06] text-[#7CE3A6]">
                    {evaluation.nearAiAudit
                      ? `${evaluation.nearAiAudit.status} · ${evaluation.nearAiAudit.mode}`
                      : "SANDBOX_PREVIEW · local_policy_check"}
                  </span>
                </div>
                <div className="font-mono text-[11px] text-[#F7F6F2]/80">
                  Model:{" "}
                  <span className="text-white">
                    {evaluation.nearAiAudit?.model ?? "deepseek-ai/DeepSeek-V3-0324"}
                  </span>
                  {evaluation.nearAiAudit?.inferenceId && (
                    <>
                      {" "}
                      · ID:{" "}
                      <span className="text-[#FCD34D]">
                        {evaluation.nearAiAudit.inferenceId}
                      </span>
                    </>
                  )}
                </div>
                <div className="text-[11px] text-[#F7F6F2]/65 leading-snug">
                  {evaluation.nearAiAudit?.rationale ??
                    "cloud-api.near.ai/v1/chat/completions semantic firewall check ready."}
                </div>
              </div>
            </div>

            {/* Column 3 — Past actions */}
            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#F7F6F2]/55">
                  Column 03 · Past actions
                </span>
                <span className="font-mono text-[11px] text-[#F7F6F2]/65">On-chain context</span>
              </div>

              <p className="font-mono text-[12.5px] leading-[1.7] text-[#F7F6F2]/90 bg-white/[0.03] border border-white/10 rounded-xl p-3.5">
                {pastInflowLabel} ·{" "}
                <span className="text-[#FCD34D] font-semibold">
                  ${policy.dailySpentTodayUsd.toFixed(0)}/${policy.dailySpendCapUsd}
                </span>{" "}
                daily cap used
              </p>

              <div className="space-y-1.5">
                <div className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-[#F7F6F2]/45">
                  Recent Enclave Receipts
                </div>
                <div className="space-y-1.5">
                  {recentLedger.slice(0, 2).map((row) => (
                    <div
                      key={row.id}
                      className="flex items-center justify-between gap-2 text-[11.5px] font-mono px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.07]"
                    >
                      <span className="truncate text-[#F7F6F2]/80">{row.counterparty}</span>
                      <span
                        className={
                          row.verdict === "ALLOW"
                            ? "text-[#7CE3A6] shrink-0"
                            : "text-[#FCA5A5] shrink-0"
                        }
                      >
                        {row.eventType === "INTENTS IN"
                          ? `+$${row.amountUsd.toFixed(0)}`
                          : row.verdict === "BLOCK"
                            ? `✕ $${row.amountUsd.toFixed(0)}`
                            : `-$${row.amountUsd.toFixed(0)}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Card Footer Decision Strip (1px top border) */}
          <div className="px-5 sm:px-6 py-4 border-t border-white/10 bg-black/25 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3.5">
              {/* Dynamic Semantic Status Pill */}
              {evaluation.verdict === "ALLOW" && (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#1E3A2B] text-[#7CE3A6] border border-[#7CE3A6]/25 font-mono text-[12.5px] font-semibold shrink-0 w-fit">
                  <span>✓ Allow</span>
                </span>
              )}
              {evaluation.verdict === "BLOCK" && (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#3D1C1C] text-[#FCA5A5] border border-[#FCA5A5]/25 font-mono text-[12.5px] font-semibold shrink-0 w-fit">
                  <span>✕ Block</span>
                </span>
              )}
              {evaluation.verdict === "ROUTING" && (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#3B2E17] text-[#FCD34D] border border-[#FCD34D]/25 font-mono text-[12.5px] font-semibold shrink-0 w-fit">
                  <Hourglass className="w-3.5 h-3.5 stroke-[2.2]" />
                  <span>Routing</span>
                </span>
              )}

              {/* Action Headline + Plain-English Explanation */}
              <div className="space-y-0.5">
                <div className="text-[13.5px] font-semibold text-[#F7F6F2] flex items-center gap-2">
                  {evaluation.verdict === "BLOCK" ? (
                    <ShieldAlert className="w-4 h-4 text-[#FCA5A5] shrink-0" />
                  ) : (
                    <ShieldCheck className="w-4 h-4 text-[#7CE3A6] shrink-0" />
                  )}
                  <span>{evaluation.headline}</span>
                </div>
                <p className="text-[13px] text-[#F7F6F2]/75 leading-relaxed">
                  {evaluation.explanation}
                </p>
              </div>
            </div>

            {/* Action Buttons: 2-of-3 Multisig Escalation (when BLOCK) + Commit Simulation Action Button */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {evaluation.verdict === "BLOCK" && (
                <button
                  type="button"
                  onClick={() => setIsMultisigModalOpen(true)}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full bg-[#B86B4B] hover:bg-[#c67756] text-[#F7F6F2] font-mono text-[11.5px] font-semibold transition-bitfli cursor-pointer shadow-sm"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Escalate to Partner Multisig (2/3)</span>
                </button>
              )}

              <button
                type="button"
                disabled={isExecuting}
                onClick={onExecuteActiveScenario}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-white/[0.08] hover:bg-white/[0.15] border border-white/15 text-[#F7F6F2] font-mono text-[11.5px] transition-bitfli cursor-pointer disabled:opacity-50"
              >
                <span>{isExecuting ? "Executing..." : "Commit to Live Ledger"}</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#B86B4B]" />
              </button>
            </div>
          </div>
        </div>

        {/* 2-of-3 Partner Multisig Escalation Co-Signing Modal */}
        {isMultisigModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141514]/65 backdrop-blur-xs"
            role="dialog"
            aria-modal="true"
            aria-label="Escalate to 2-of-3 Partner Multisig"
            onClick={() => setIsMultisigModalOpen(false)}
          >
            <div
              className="w-full max-w-[540px] rounded-[20px] bg-[#141514] text-[#F7F6F2] border border-white/15 shadow-2xl overflow-hidden transition-bitfli"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-4 bg-white/[0.03] border-b border-white/10 flex items-center justify-between gap-3">
                <div>
                  <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-[#FCD34D] flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-[#B86B4B]" />
                    <span>2-OF-3 PARTNER MULTISIG ESCALATION · OUTLAYER TEE</span>
                  </div>
                  <h3 className="mt-0.5 text-[18px] font-bold tracking-[-0.02em] text-white">
                    Override Single-Tx Cap for ${evaluation.taskAmountUsd.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMultisigModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/15 inline-flex items-center justify-center text-[#F7F6F2] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="rounded-xl bg-[#3D1C1C]/45 border border-[#FCA5A5]/25 p-3.5 text-[12.5px] text-[#FCA5A5] leading-relaxed">
                  <strong>Blocked Task:</strong> {evaluation.taskActor} requested{" "}
                  <span className="font-mono font-semibold">
                    ${evaluation.taskAmountUsd.toFixed(2)}
                  </span>{" "}
                  to <span className="font-mono">{evaluation.taskCounterparty}</span> (exceeds{" "}
                  <span className="font-mono">${policy.maxSingleTxUsd}</span> single-tx guardrail).
                  Select at least <strong>2 of 3 partner signers</strong> below to co-sign a one-time
                  enclave override.
                </div>

                <div className="space-y-2">
                  <div className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-[#F7F6F2]/55">
                    Select Co-Signing Partner Keys ({selectedSigners.length}/3 Selected · Minimum 2 Required)
                  </div>
                  {partnerSignersList.map((partner) => {
                    const checked = selectedSigners.includes(partner.id);
                    return (
                      <button
                        key={partner.id}
                        type="button"
                        onClick={() => toggleSigner(partner.id)}
                        className={`w-full text-left rounded-xl p-3.5 border flex items-center justify-between gap-3 transition-bitfli cursor-pointer ${
                          checked
                            ? "bg-[#1E3A2B]/65 border-[#7CE3A6]/45 text-[#F7F6F2]"
                            : "bg-white/[0.03] border-white/10 text-[#F7F6F2]/70 hover:bg-white/[0.06]"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`w-5 h-5 rounded-md inline-flex items-center justify-center border ${
                              checked
                                ? "bg-[#7CE3A6] text-[#141514] border-[#7CE3A6]"
                                : "border-white/25"
                            }`}
                          >
                            {checked && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                          </span>
                          <div>
                            <div className="text-[13.5px] font-semibold">{partner.role}</div>
                            <div className="font-mono text-[11px] text-[#F7F6F2]/60">
                              NEP-413 Key: {partner.wallet}
                            </div>
                          </div>
                        </div>
                        <span className="font-mono text-[11px] px-2.5 py-0.5 rounded-full bg-white/10 text-[#FCD34D]">
                          Weight {partner.weight}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setIsMultisigModalOpen(false)}
                    className="px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-[#F7F6F2] text-[12.5px] font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={selectedSigners.length < 2 || isSigningMultisig}
                    onClick={handleConfirmMultisigOverride}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#7CE3A6] hover:bg-[#6bd396] text-[#141514] font-semibold text-[13px] transition-bitfli cursor-pointer disabled:opacity-45"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>
                      {isSigningMultisig
                        ? "Co-Signing in TEE..."
                        : `Co-Sign & Approve ($${evaluation.taskAmountUsd.toFixed(2)}) (${selectedSigners.length}/3)`}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Always-Visible Custom Agent Spend Test Strip (/api/agent/procure) */}
        <form
          onSubmit={handleCustomSubmit}
          className="mt-5 rounded-[16px] bg-[#EFECE4] border border-[#DDD6C7] p-4 sm:p-5 space-y-3.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-[#181918] font-semibold">
              <Terminal className="w-3.5 h-3.5 text-[#B86B4B]" />
              <span>CUSTOM AGENT SPEND TEST · POST /api/agent/procure</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10.5px]">
              <span className="text-[#5C5B57] mr-1">Quick load:</span>
              <button
                type="button"
                onClick={() => {
                  setCustomVendor("Vercel Pro");
                  setCustomAmount("40");
                  setCustomPurpose("Preview deployment bandwidth top-up");
                }}
                className="px-2 py-0.5 rounded bg-white border border-[#D8D1C2] text-[#181918] hover:border-[#B86B4B] cursor-pointer"
              >
                $40 Vercel Pro (Valid)
              </button>
              <button
                type="button"
                onClick={() => {
                  setCustomVendor("Anthropic API");
                  setCustomAmount("240");
                  setCustomPurpose("Oversized Opus fine-tune job exceeding per-tx cap");
                }}
                className="px-2 py-0.5 rounded bg-white border border-[#D8D1C2] text-[#181918] hover:border-[#B86B4B] cursor-pointer"
              >
                $240 Over-Cap Test
              </button>
              <button
                type="button"
                onClick={() => {
                  setCustomVendor("drain-bot.near");
                  setCustomAmount("850");
                  setCustomPurpose("Prompt-injected treasury exfiltration attempt");
                }}
                className="px-2 py-0.5 rounded bg-white border border-[#D8D1C2] text-[#9E2A2B] hover:border-[#9E2A2B] cursor-pointer"
              >
                $850 Rogue Wallet
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-3">
              <label className="block font-mono text-[10.5px] uppercase tracking-[0.1em] text-[#5C5B57] mb-1">
                Counterparty / Wallet
              </label>
              <input
                type="text"
                value={customVendor}
                onChange={(e) => setCustomVendor(e.target.value)}
                list="bitfli-vendor-suggestions"
                placeholder="e.g. Anthropic API or rogue.near"
                className="w-full rounded-lg bg-white border border-[#D8D1C2] px-3 py-2 text-[13px] text-[#181918] focus:outline-none focus:border-[#B86B4B]"
              />
              <datalist id="bitfli-vendor-suggestions">
                {policy.vendorAllowlist.map((v) => (
                  <option key={v} value={v} />
                ))}
                <option value="unknown-wallet.near" />
                <option value="drain-bot.near" />
              </datalist>
            </div>

            <div className="md:col-span-2">
              <label className="block font-mono text-[10.5px] uppercase tracking-[0.1em] text-[#5C5B57] mb-1">
                Amount (USD)
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="w-full rounded-lg bg-white border border-[#D8D1C2] px-3 py-2 font-mono text-[13px] text-[#181918] focus:outline-none focus:border-[#B86B4B]"
              />
            </div>

            <div className="md:col-span-4">
              <label className="block font-mono text-[10.5px] uppercase tracking-[0.1em] text-[#5C5B57] mb-1">
                Agent Task Memo
              </label>
              <input
                type="text"
                value={customPurpose}
                onChange={(e) => setCustomPurpose(e.target.value)}
                className="w-full rounded-lg bg-white border border-[#D8D1C2] px-3 py-2 text-[13px] text-[#181918] focus:outline-none focus:border-[#B86B4B]"
              />
            </div>

            <div className="md:col-span-3">
              <button
                type="submit"
                disabled={isExecuting}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#141514] hover:bg-[#272927] text-[#F7F6F2] text-[12.5px] font-semibold px-4 py-2.5 transition-all cursor-pointer disabled:opacity-60"
              >
                <Play className="w-3.5 h-3.5 text-[#B86B4B]" />
                <span>Test &amp; Log in TEE</span>
              </button>
            </div>
          </div>
        </form>

        {/* + TEST CUSTOM AGENT SPEND Modal (POST /api/agent/procure) */}
        {isCustomModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141514]/60 backdrop-blur-xs"
            role="dialog"
            aria-modal="true"
            aria-label="Test Custom Agent Spend"
          >
            <div className="w-full max-w-[520px] rounded-[20px] bg-[#F4F1EA] border border-[#DFD8C8] shadow-2xl overflow-hidden">
              <div className="px-6 py-5 bg-[#141514] text-[#F7F6F2] flex items-center justify-between">
                <div>
                  <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-[#B86B4B]">
                    OUTLAYER TEE POLICY EVALUATION · POST /api/agent/procure
                  </div>
                  <h3 className="mt-0.5 text-[20px] font-bold tracking-[-0.02em]">
                    Test Custom Agent Spend
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCustomModalOpen(false)}
                  aria-label="Close custom agent spend modal"
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/15 inline-flex items-center justify-center text-[#F7F6F2] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCustomSubmit} className="p-6 space-y-4">
                <div className="rounded-xl bg-[#EFECE4] border border-[#DDD6C7] p-3 font-mono text-[11.5px] text-[#5C5B57]">
                  Active Guardrails: Max{" "}
                  <strong className="text-[#181918]">${policy.maxSingleTxUsd}/tx</strong> · Daily
                  remaining{" "}
                  <strong className="text-[#181918]">
                    ${Math.max(0, policy.dailySpendCapUsd - policy.dailySpentTodayUsd).toFixed(0)}
                  </strong>{" "}
                  · {policy.vendorAllowlist.length} allowlisted vendors
                </div>

                <div>
                  <label className="block font-mono text-[10.5px] uppercase tracking-[0.1em] text-[#5C5B57] mb-1">
                    Counterparty / Vendor or Wallet
                  </label>
                  <input
                    type="text"
                    required
                    value={customVendor}
                    onChange={(e) => setCustomVendor(e.target.value)}
                    list="bitfli-vendor-suggestions"
                    placeholder="e.g. Anthropic API or unknown-wallet.near"
                    className="w-full rounded-xl bg-white border border-[#DAD3C4] px-3.5 py-2.5 text-[13.5px] text-[#181918] focus:outline-none focus:border-[#B86B4B]"
                  />
                </div>

                <div>
                  <label className="block font-mono text-[10.5px] uppercase tracking-[0.1em] text-[#5C5B57] mb-1">
                    Spend Amount (USD)
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="1"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    className="w-full rounded-xl bg-white border border-[#DAD3C4] px-3.5 py-2.5 font-mono text-[13.5px] text-[#181918] focus:outline-none focus:border-[#B86B4B]"
                  />
                </div>

                <div>
                  <label className="block font-mono text-[10.5px] uppercase tracking-[0.1em] text-[#5C5B57] mb-1">
                    Agent Task / Procurement Memo
                  </label>
                  <input
                    type="text"
                    value={customPurpose}
                    onChange={(e) => setCustomPurpose(e.target.value)}
                    className="w-full rounded-xl bg-white border border-[#DAD3C4] px-3.5 py-2.5 text-[13px] text-[#181918] focus:outline-none focus:border-[#B86B4B]"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsCustomModalOpen(false)}
                    className="px-4 py-2.5 rounded-full text-[13px] font-medium text-[#5C5B57] hover:text-[#181918] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isExecuting}
                    className="inline-flex items-center gap-2 rounded-full bg-[#141514] hover:bg-[#272927] text-[#F7F6F2] px-5 py-2.5 text-[13.5px] font-semibold cursor-pointer disabled:opacity-60"
                  >
                    <Play className="w-3.5 h-3.5 text-[#B86B4B]" />
                    <span>Run TEE Evaluation &amp; Log Receipt</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
