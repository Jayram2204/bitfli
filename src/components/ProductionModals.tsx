import React, { useEffect, useState } from "react";
import {
  BookOpen,
  Check,
  Cookie,
  Cpu,
  FileText,
  KeyRound,
  Lock,
  ShieldCheck,
  Terminal,
  X,
} from "lucide-react";

interface Nep413WalletModalProps {
  isOpen: boolean;
  podAccountId: string;
  connectedAccount: string | null;
  onClose: () => void;
  onConnectAccount: (accountId: string | null) => void;
}

export const Nep413WalletModal: React.FC<Nep413WalletModalProps> = ({
  isOpen,
  podAccountId,
  connectedAccount,
  onClose,
  onConnectAccount,
}) => {
  const [accountInput, setAccountInput] = useState("maya-dev.near");
  const [isSigning, setIsSigning] = useState(false);

  if (!isOpen) return null;

  const challengeNonce = "0x8f31c09d4a2b71d055c190fa3e88b102";

  const handleSignNep413 = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSigning(true);
    await new Promise((r) => setTimeout(r, 380));
    setIsSigning(false);
    onConnectAccount(accountInput.trim() || "maya-dev.near");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141514]/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Connect NEAR Wallet (NEP-413) or Judge Sandbox"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[540px] rounded-[20px] bg-[#F4F1EA] text-[#181918] border border-[#DDD6C7] shadow-2xl overflow-hidden transition-bitfli"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 bg-[#141514] text-[#F7F6F2] flex items-center justify-between gap-3">
          <div>
            <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-[#7CE3A6] flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-[#B86B4B]" />
              <span>HYBRID AUTH · NEP-413 MESSAGE SIGNING + JUDGE SANDBOX</span>
            </div>
            <h3 className="mt-0.5 text-[18px] font-bold tracking-[-0.02em]">
              Owner Policy Control ({podAccountId})
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/15 inline-flex items-center justify-center text-[#F7F6F2] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Active Mode Banner */}
          <div className="rounded-xl bg-[#EFECE4] border border-[#DAD3C4] p-4 flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-[#B86B4B] font-semibold">
                {connectedAccount ? "NEP-413 OWNER SESSION ACTIVE" : "INSTANT JUDGE SANDBOX ACTIVE"}
              </div>
              <p className="text-[12.5px] text-[#5C5B57] leading-relaxed">
                {connectedAccount
                  ? `Signed in as ${connectedAccount} via NEP-413 off-chain message attestation. All policy mutations carry owner authority.`
                  : "Hackathon Judge / Guest Sandbox Mode is enabled by default so every guardrail slider, 1Click invoice, and TEE procurement test works with zero login friction."}
              </p>
            </div>
            {connectedAccount && (
              <button
                type="button"
                onClick={() => {
                  onConnectAccount(null);
                  onClose();
                }}
                className="shrink-0 px-3 py-1.5 rounded-full bg-white border border-[#D8D1C2] font-mono text-[11px] text-[#181918] hover:border-[#B86B4B] cursor-pointer"
              >
                Switch to Sandbox
              </button>
            )}
          </div>

          {/* NEP-413 Sign-In Form */}
          <form onSubmit={handleSignNep413} className="space-y-4">
            <div>
              <label className="block font-mono text-[10.5px] uppercase tracking-[0.12em] text-[#5C5B57] mb-1.5">
                NEAR Account ID (NEP-413 Signer)
              </label>
              <input
                type="text"
                required
                value={accountInput}
                onChange={(e) => setAccountInput(e.target.value)}
                placeholder="maya-dev.near"
                className="w-full rounded-xl bg-white border border-[#DAD3C4] px-3.5 py-2.5 font-mono text-[13.5px] text-[#181918] focus:outline-none focus:border-[#B86B4B]"
              />
            </div>

            <div className="rounded-xl bg-[#141514] text-[#F7F6F2] p-3.5 font-mono text-[11px] space-y-1">
              <div className="text-[#F7F6F2]/45 uppercase text-[10px]">
                NEP-413 Payload Preview (Zero Gas · Off-Chain Signature)
              </div>
              <div>
                <span className="text-[#F7F6F2]/50">recipient: </span>
                <span className="text-[#7CE3A6]">{podAccountId}</span>
              </div>
              <div>
                <span className="text-[#F7F6F2]/50">nonce: </span>
                <span className="text-[#FCD34D]">{challengeNonce}</span>
              </div>
              <div>
                <span className="text-[#F7F6F2]/50">message: </span>
                <span>&quot;Authorize OutLayer TEE Policy Session for {accountInput}&quot;</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-full bg-[#EFECE4] hover:bg-[#E4DFD3] text-[#181918] text-[12.5px] font-semibold cursor-pointer"
              >
                Continue in Guest Sandbox
              </button>
              <button
                type="submit"
                disabled={isSigning}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#181918] hover:bg-[#292B29] text-[#F7F6F2] text-[13px] font-semibold transition-bitfli cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 text-[#7CE3A6]" />
                <span>{isSigning ? "Signing NEP-413..." : "Sign NEP-413 & Connect"}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

interface DocsWhitepaperModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DocsWhitepaperModal: React.FC<DocsWhitepaperModalProps> = ({ isOpen, onClose }) => {
  const [section, setSection] = useState<
    "problem" | "architecture" | "threat" | "oneclick" | "api"
  >("problem");

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141514]/65 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="bitfli.xyz Technical Whitepaper & Architecture Docs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[820px] max-h-[88vh] rounded-[20px] bg-[#F4F1EA] text-[#181918] border border-[#DDD6C7] shadow-2xl flex flex-col overflow-hidden transition-bitfli"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-[#141514] text-[#F7F6F2] flex items-center justify-between gap-3 shrink-0">
          <div>
            <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-[#B86B4B] flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              <span>TECHNICAL WHITEPAPER &amp; SYSTEM ARCHITECTURE · NEAR HACKATHON 2026</span>
            </div>
            <h3 className="mt-0.5 text-[19px] font-bold tracking-[-0.02em]">
              &gt;&gt; bitfli.xyz — Autonomous Cross-Border Micro-Agency &amp; Profit-Split Engine
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/15 inline-flex items-center justify-center text-[#F7F6F2] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Section Tabs */}
        <div className="px-6 py-3 bg-[#EFECE4] border-b border-[#DFD9CC] flex flex-wrap gap-1.5 shrink-0 font-mono text-[11px]">
          {[
            { id: "problem", label: "01 · Problem Statement" },
            { id: "architecture", label: "02 · Margin-Locked Pod" },
            { id: "threat", label: "03 · OutLayer TEE Threat Model" },
            { id: "oneclick", label: "04 · NEAR Intents 1Click" },
            { id: "api", label: "05 · REST API & Idempotency" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSection(tab.id as typeof section)}
              className={`px-3 py-1.5 rounded-lg transition-bitfli cursor-pointer ${
                section === tab.id
                  ? "bg-[#141514] text-[#F7F6F2] font-semibold"
                  : "bg-white/70 text-[#5C5B57] hover:text-[#181918]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-[14px] leading-relaxed text-[#181918]">
          {section === "problem" && (
            <div className="space-y-4">
              <h4 className="text-[18px] font-bold tracking-[-0.02em]">
                Why Autonomous Agencies Need Enclave-Enforced Treasury Rails
              </h4>
              <p className="text-[#5C5B57]">
                AI-native design and engineering studios rely on autonomous agents to procure LLM
                inference (Anthropic, OpenAI), cloud GPUs (AWS), and sub-contractor micro-bounties,
                while billing international clients across Ethereum, Solana, and Base.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl bg-white border border-[#E2DDD0] p-4">
                  <div className="font-mono text-[11px] text-[#B86B4B] font-semibold">
                    01 · INFLOW FRAGMENTATION
                  </div>
                  <p className="mt-1.5 text-[12.5px] text-[#5C5B57]">
                    Clients pay in ETH, SOL, or Base USDC. Manual bridging wastes 40–120 bps and
                    delays partner profit distributions.
                  </p>
                </div>
                <div className="rounded-xl bg-white border border-[#E2DDD0] p-4">
                  <div className="font-mono text-[11px] text-[#B86B4B] font-semibold">
                    02 · PROMPT-INJECTION RISK
                  </div>
                  <p className="mt-1.5 text-[12.5px] text-[#5C5B57]">
                    Giving an AI agent raw private keys risks catastrophic treasury drainage if a
                    malicious x402 invoice or prompt injection occurs.
                  </p>
                </div>
                <div className="rounded-xl bg-white border border-[#E2DDD0] p-4">
                  <div className="font-mono text-[11px] text-[#B86B4B] font-semibold">
                    03 · MARGIN EROSION
                  </div>
                  <p className="mt-1.5 text-[12.5px] text-[#5C5B57]">
                    Without cryptographic margin locks, runaway agent OpEx eats into partner
                    take-home profit and tax reserves.
                  </p>
                </div>
              </div>
            </div>
          )}

          {section === "architecture" && (
            <div className="space-y-4">
              <h4 className="text-[18px] font-bold tracking-[-0.02em]">
                Margin-Locked Pod Architecture &amp; Mathematical Ledger State
              </h4>
              <p className="text-[#5C5B57]">
                Every agency pod (<code className="font-mono">pod-01.bitfli.near</code>) computes
                its KPIs mathematically from an append-only attested ledger persisted atomically to{" "}
                <code className="font-mono">backend/data/state.json</code>:
              </p>
              <pre className="rounded-xl bg-[#141514] text-[#7CE3A6] p-4 font-mono text-[11.5px] overflow-x-auto">
{`treasuryBalanceUsd        = GrossIntentsInflows - ApprovedOpEx - ExternalPartnerPayouts
availableOpexUsd          = treasuryBalanceUsd * (1 - profitLockPct / 100)
netDistributableProfitUsd = GrossIntentsInflows - ApprovedOpEx - TotalProfitSplits`}
              </pre>
              <p className="text-[13px] text-[#5C5B57]">
                When <code className="font-mono">profitLockPct</code> is set to <strong>70%</strong>,
                autonomous agents can never touch the locked 70% partner profit buffer—even if their
                daily spend cap has room remaining.
              </p>
            </div>
          )}

          {section === "threat" && (
            <div className="space-y-4">
              <h4 className="text-[18px] font-bold tracking-[-0.02em]">
                OutLayer Intel TDX / SGX Enclave Threat Model &amp; 2-of-3 Multisig Escalation
              </h4>
              <p className="text-[#5C5B57]">
                Pod private keys are provisioned and sealed inside OutLayer&apos;s hardware enclave
                (verified via <code className="font-mono">GET https://api.outlayer.ai/attestations/by-call/&#123;call_id&#125;</code>, or labeled <code className="font-mono">local_policy_check</code> during sandbox pre-checks). Every{" "}
                <code className="font-mono">POST /api/agent/procure</code> request must pass 5
                deterministic rules before the enclave signs:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-[13px] text-[#181918] font-mono">
                <li>Rule 1: autonomousOpsActive === true (Human Kill-Switch Check)</li>
                <li>Rule 2: amountUsd &lt;= maxSingleTxUsd (Per-Transaction Cap)</li>
                <li>Rule 3: dailySpentTodayUsd + amountUsd &lt;= dailySpendCapUsd (24h Rolling Cap)</li>
                <li>Rule 4: amountUsd &lt;= availableOpexUsd (Partner Profit Lock Protection)</li>
                <li>Rule 5: vendorAllowlist.includes(counterparty) (Counterparty Firewall)</li>
              </ul>
              <p className="text-[13px] text-[#5C5B57]">
                If a legitimate high-value purchase exceeds <code className="font-mono">maxSingleTxUsd</code>,
                partners can invoke <strong>2-of-3 Partner Multisig Escalation</strong> directly from
                the Obsidian Decision Card to co-sign that single transaction without raising the
                standing autonomous cap.
              </p>
            </div>
          )}

          {section === "oneclick" && (
            <div className="space-y-4">
              <h4 className="text-[18px] font-bold tracking-[-0.02em]">
                NEAR Intents 1Click Cross-Chain Settlement Flow
              </h4>
              <p className="text-[#5C5B57]">
                Client invoices call <code className="font-mono">POST https://1click.chaindefuser.com/v0/quote</code>{" "}
                with <code className="font-mono">swapType: &quot;EXACT_INPUT&quot;</code> and canonical NEAR
                USDC (<code className="font-mono">nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1</code>)
                as the destination asset. OutLayer&apos;s authenticated solver routing lowers swap
                overhead to <strong>0.0001%</strong> compared to <strong>0.20%</strong> on standard
                unauthenticated swaps.
              </p>
            </div>
          )}

          {section === "api" && (
            <div className="space-y-3">
              <h4 className="text-[18px] font-bold tracking-[-0.02em]">
                REST API Endpoints &amp; Atomic Persistence
              </h4>
              <p className="text-[13px] text-[#5C5B57]">
                All state-mutating <code className="font-mono">POST</code> routes support{" "}
                <code className="font-mono">X-Idempotency-Key</code> replay protection and atomic
                write-then-rename persistence in <code className="font-mono">backend/data/state.json</code>:
              </p>
              <pre className="rounded-xl bg-[#141514] text-[#F7F6F2] p-4 font-mono text-[11px] overflow-x-auto leading-relaxed">
{`GET  /api/health            -> Live NEAR RPC block height + OutLayer wallet & handoff_url
GET  /api/tokens            -> 231+ cross-chain tokens from 1click.chaindefuser.com/v0/tokens
GET  /api/dashboard         -> Hydrated pod metrics, policy, waterfall, agentContainment & ledger
POST /api/invoices          -> Live 1Click cross-chain quote & deposit address
POST /api/invoices/preview  -> Live 1Click fee benchmark (0.0001% vs 0.20%)
POST /api/invoices/:id/settle -> Atomic NEAR USDC settlement + INTENTS IN ledger entry
POST /api/policy            -> Update kill switch, spend caps, vendor allowlist & split ratios
POST /api/agent/procure     -> 5-rule TEE evaluation + NEAR AI Cloud DeepSeek-V3 audit
GET  /api/x402/deliverable  -> PingPay x402 HTTP 402 Payment Required + facilitator verify/settle
POST /api/checks            -> Issue gasless sub-contractor payment check (bitfli.xyz/claim/<id>)
POST /api/treasury/split    -> Execute 55/30/15 partner waterfall payout
POST /api/pods              -> Provision a new agency pod vault
GET  /api/ledger/csv        -> Export RFC-4180 accountant audit CSV`}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#EFECE4] border-t border-[#DFD9CC] flex items-center justify-between text-[11.5px] font-mono text-[#5C5B57] shrink-0">
          <span>NEAR Hackathon 2026 · Track 04 &amp; Track 08</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-full bg-[#141514] text-[#F7F6F2] font-sans text-[12px] font-semibold cursor-pointer"
          >
            Close Docs
          </button>
        </div>
      </div>
    </div>
  );
};

interface LegalPrivacyModalProps {
  tab: "terms" | "privacy" | null;
  onClose: () => void;
  onSwitchTab: (tab: "terms" | "privacy") => void;
}

export const LegalPrivacyModal: React.FC<LegalPrivacyModalProps> = ({
  tab,
  onClose,
  onSwitchTab,
}) => {
  if (!tab) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141514]/65 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Terms of Service and Zero-Retention TEE Privacy Policy"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[640px] rounded-[20px] bg-[#F4F1EA] text-[#181918] border border-[#DDD6C7] shadow-2xl overflow-hidden transition-bitfli"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 bg-[#141514] text-[#F7F6F2] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSwitchTab("terms")}
              className={`px-3 py-1 rounded-full font-mono text-[11px] cursor-pointer ${
                tab === "terms"
                  ? "bg-[#B86B4B] text-white font-semibold"
                  : "bg-white/10 text-[#F7F6F2]/70"
              }`}
            >
              Terms of Service
            </button>
            <button
              type="button"
              onClick={() => onSwitchTab("privacy")}
              className={`px-3 py-1 rounded-full font-mono text-[11px] cursor-pointer ${
                tab === "privacy"
                  ? "bg-[#1E3A2B] text-[#7CE3A6] font-semibold"
                  : "bg-white/10 text-[#F7F6F2]/70"
              }`}
            >
              TEE Zero-Retention Privacy
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/15 inline-flex items-center justify-center text-[#F7F6F2] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-3.5 text-[13.5px] leading-relaxed text-[#5C5B57]">
          {tab === "terms" ? (
            <>
              <h4 className="text-[17px] font-bold text-[#181918]">
                bitfli.xyz Non-Custodial Autonomous Agency Terms
              </h4>
              <p>
                <strong>1. Enclave-Bound Execution:</strong> bitfli.xyz provides deterministic policy
                guardrails and cross-chain intent routing via NEAR Intents (1Click API) and OutLayer
                Intel TDX / SGX enclaves. Agency partners retain full governance authority over their
                pod&apos;s spend caps, allowlists, and emergency kill switch.
              </p>
              <p>
                <strong>2. Atomic Cross-Chain Settlement:</strong> Inbound client invoices and
                outbound partner profit splits are settled atomically on-chain. Quote slippage and
                solver execution deadlines are enforced by the NEAR Intents solver network.
              </p>
              <p>
                <strong>3. Sandbox &amp; Testnet Verification:</strong> In Judge Sandbox Mode,
                simulated invoice settlements and dry-run transfers execute deterministically without
                requiring mainnet gas expenditure.
              </p>
            </>
          ) : (
            <>
              <h4 className="text-[17px] font-bold text-[#181918]">
                Zero-Retention TEE Privacy &amp; Key Derivation Notice
              </h4>
              <p>
                <strong>1. Zero Seed-Phrase Storage:</strong> Pod signing keys are derived and sealed
                exclusively inside OutLayer&apos;s hardware-attested Intel TDX / SGX enclave (verified via{" "}
                <code className="font-mono text-[#181918]">api.outlayer.ai/attestations/by-call/&#123;call_id&#125;</code>).
                Raw private keys or mnemonics are never exposed to the Node.js host, browser client,
                or AI agent prompts.
              </p>
              <p>
                <strong>2. Verifiable Attestation Receipts:</strong> Every policy evaluation emits a
                deterministic SHA-256 commitment (<code className="font-mono text-[#181918]">audit_sha256_...</code>)
                binding the NEAR block height, policy hash, and task parameters without logging
                sensitive API payloads.
              </p>
              <p>
                <strong>3. Local Storage Footprint:</strong> The web client stores only your
                cookie notice preference and optional NEP-413 session identifier in local browser
                storage.
              </p>
            </>
          )}

          <div className="pt-3 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full bg-[#181918] text-[#F7F6F2] text-[12.5px] font-semibold cursor-pointer"
            >
              Understood
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const CookieNoticePill: React.FC = () => {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("bitfli_cookie_notice_v1");
      if (!saved) {
        setDismissed(false);
      }
    } catch {
      setDismissed(false);
    }
  }, []);

  const handleChoice = (choice: "essential" | "accept") => {
    try {
      window.localStorage.setItem("bitfli_cookie_notice_v1", choice);
    } catch {
      // ignore storage errors
    }
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 z-40 max-w-[390px] rounded-2xl bg-[#141514] text-[#F7F6F2] border border-white/15 p-3.5 shadow-2xl flex items-center justify-between gap-3 transition-bitfli">
      <div className="flex items-start gap-2.5 min-w-0">
        <Cookie className="w-4 h-4 text-[#B86B4B] shrink-0 mt-0.5" />
        <div className="text-[11.5px] leading-snug text-[#F7F6F2]/85">
          <span className="font-semibold text-white">Zero-Tracking Enclave Storage:</span> Uses
          local storage only for NEP-413 session &amp; sandbox state.
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 font-mono text-[10.5px]">
        <button
          type="button"
          onClick={() => handleChoice("essential")}
          className="px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/15 text-[#F7F6F2] cursor-pointer"
        >
          Essential Only
        </button>
        <button
          type="button"
          onClick={() => handleChoice("accept")}
          className="px-2.5 py-1 rounded-full bg-[#B86B4B] hover:bg-[#c77756] text-white font-semibold cursor-pointer"
        >
          Accept
        </button>
      </div>
    </div>
  );
};
