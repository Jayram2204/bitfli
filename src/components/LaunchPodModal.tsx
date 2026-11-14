import React, { useState } from "react";
import { ArrowRight, ShieldCheck, X } from "lucide-react";
import type { NetworkMode, TreasuryPolicy } from "../lib/api";

interface LaunchPodModalProps {
  isOpen: boolean;
  mode: NetworkMode;
  policy: TreasuryPolicy;
  onClose: () => void;
  onSavePod: (patch: {
    podAccountId: string;
    podDisplayName: string;
    maxSingleTxUsd: number;
    partnerWallets: TreasuryPolicy["partnerWallets"];
  }) => Promise<void>;
}

export const LaunchPodModal: React.FC<LaunchPodModalProps> = ({
  isOpen,
  mode,
  policy,
  onClose,
  onSavePod,
}) => {
  const currentSlug = policy.podAccountId.split(".")[0] || "pod-01";
  const suffix = mode === "testnet" ? ".bitfli.testnet" : ".bitfli.near";

  const [slug, setSlug] = useState(currentSlug);
  const [displayName, setDisplayName] = useState(policy.podDisplayName);
  const [leadWallet, setLeadWallet] = useState(policy.partnerWallets.leadDev);
  const [designWallet, setDesignWallet] = useState(policy.partnerWallets.designPartner);
  const [perTxCap, setPerTxCap] = useState(String(policy.maxSingleTxUsd));

  if (!isOpen) return null;

  const sanitizedSlug =
    slug
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "pod-01";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSavePod({
      podAccountId: `${sanitizedSlug}${suffix}`,
      podDisplayName: displayName.trim() || "Autonomous Agency Pod",
      maxSingleTxUsd: Math.min(1000, Math.max(10, Number(perTxCap) || 150)),
      partnerWallets: {
        leadDev: leadWallet.trim() || "maya-dev.near",
        designPartner: designWallet.trim() || "sora-design.sol",
        taxReserve: `ops-${sanitizedSlug}${suffix}`,
      },
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141514]/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Launch Agency Pod"
    >
      <div className="w-full max-w-[540px] rounded-[20px] bg-[#F4F1EA] border border-[#DFD8C8] shadow-2xl overflow-hidden">
        <div className="px-6 py-5 bg-[#141514] text-[#F7F6F2] flex items-center justify-between">
          <div>
            <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-[#B86B4B]">
              OUTLAYER TEE PROVISIONING · POST /api/pods
            </div>
            <h3 className="mt-0.5 text-[20px] font-bold tracking-[-0.02em]">
              Configure &amp; Launch Agency Pod
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-mono text-[10.5px] uppercase tracking-[0.1em] text-[#5C5B57] mb-1">
                Agency Pod Name
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-xl bg-white border border-[#DAD3C4] px-3.5 py-2.5 text-[13.5px] text-[#181918] focus:outline-none focus:border-[#B86B4B]"
              />
            </div>

            <div>
              <label className="block font-mono text-[10.5px] uppercase tracking-[0.1em] text-[#5C5B57] mb-1">
                NEAR Vault Handle
              </label>
              <div className="flex items-center rounded-xl bg-white border border-[#DAD3C4] px-3 py-2.5">
                <input
                  type="text"
                  required
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full font-mono text-[13px] text-[#181918] focus:outline-none"
                />
                <span className="font-mono text-[11px] text-[#5C5B57] shrink-0">{suffix}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-mono text-[10.5px] uppercase tracking-[0.1em] text-[#5C5B57] mb-1">
                Lead Dev Payout Wallet (NEAR)
              </label>
              <input
                type="text"
                value={leadWallet}
                onChange={(e) => setLeadWallet(e.target.value)}
                className="w-full rounded-xl bg-white border border-[#DAD3C4] px-3.5 py-2 font-mono text-[12.5px] text-[#181918]"
              />
            </div>

            <div>
              <label className="block font-mono text-[10.5px] uppercase tracking-[0.1em] text-[#5C5B57] mb-1">
                Design Partner Wallet (Solana/EVM)
              </label>
              <input
                type="text"
                value={designWallet}
                onChange={(e) => setDesignWallet(e.target.value)}
                className="w-full rounded-xl bg-white border border-[#DAD3C4] px-3.5 py-2 font-mono text-[12.5px] text-[#181918]"
              />
            </div>
          </div>

          <div>
            <label className="block font-mono text-[10.5px] uppercase tracking-[0.1em] text-[#5C5B57] mb-1">
              Initial Per-Transaction Agent Spend Cap (USD)
            </label>
            <input
              type="number"
              min="10"
              max="1000"
              value={perTxCap}
              onChange={(e) => setPerTxCap(e.target.value)}
              className="w-full rounded-xl bg-white border border-[#DAD3C4] px-3.5 py-2 font-mono text-[13px] text-[#181918]"
            />
          </div>

          <div className="rounded-xl bg-[#EFECE4] border border-[#DDD6C7] p-3.5 flex items-center gap-2.5 text-[12px] text-[#5C5B57]">
            <ShieldCheck className="w-4 h-4 text-[#1E3A2B] shrink-0" />
            <span>
              Provisioning binds{" "}
              <strong>
                {sanitizedSlug}
                {suffix}
              </strong>{" "}
              keys exclusively inside an OutLayer SGX enclave. Agents never hold raw private keys.
            </span>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-full text-[13px] font-medium text-[#5C5B57] hover:text-[#181918] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full bg-[#181918] hover:bg-[#292B29] text-[#F7F6F2] px-6 py-2.5 text-[13.5px] font-semibold cursor-pointer"
            >
              <span>Activate Agency Pod</span>
              <ArrowRight className="w-4 h-4 text-[#B86B4B]" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
