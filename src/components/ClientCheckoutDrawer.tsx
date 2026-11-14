import React, { useEffect, useState } from "react";
import { ArrowRight, Check, Copy, Plus, RefreshCw, ShieldCheck, Zap, X } from "lucide-react";
import {
  bitfliApi,
  type CrossChainInvoice,
  type InvoiceQuoteBenchmark,
  type NetworkMode,
  type SourceChainOption,
} from "../lib/api";
import { GeometricQrCode } from "./GeometricQrCode";

interface ClientCheckoutDrawerProps {
  isOpen: boolean;
  mode: NetworkMode;
  podAccountId: string;
  invoices: CrossChainInvoice[];
  onClose: () => void;
  onCreateInvoice: (input: {
    clientName: string;
    amountUsd: number;
    sourceChain: SourceChainOption;
    milestoneMemo?: string;
  }) => Promise<CrossChainInvoice>;
  onSimulatePayment: (invoiceId: string) => Promise<void>;
}

const CHAINS: SourceChainOption[] = ["Ethereum ETH", "Solana SOL", "Base USDC", "Arbitrum USDC"];

export const ClientCheckoutDrawer: React.FC<ClientCheckoutDrawerProps> = ({
  isOpen,
  mode,
  podAccountId,
  invoices,
  onClose,
  onCreateInvoice,
  onSimulatePayment,
}) => {
  const [selectedId, setSelectedId] = useState<string>(invoices[0]?.id ?? "");
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [clientName, setClientName] = useState("Vercel Design Partner");
  const [amountUsd, setAmountUsd] = useState("2850");
  const [sourceChain, setSourceChain] = useState<SourceChainOption>("Solana SOL");
  const [memo, setMemo] = useState("Design Systems & Agent Workflow Sprint");
  const [isRouting, setIsRouting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [benchmark, setBenchmark] = useState<InvoiceQuoteBenchmark | null>(null);

  const activeInvoice = invoices.find((inv) => inv.id === selectedId) ?? invoices[0] ?? null;

  useEffect(() => {
    if (!isOpen) return;
    const targetAmt = isCreatingNew
      ? Math.max(10, Number(amountUsd) || 1500)
      : (activeInvoice?.amountUsd ?? 2400);
    const targetChain = isCreatingNew
      ? sourceChain
      : (activeInvoice?.sourceChain ?? "Ethereum ETH");
    let cancelled = false;
    bitfliApi
      .previewInvoiceQuote({ amountUsd: targetAmt, sourceChain: targetChain })
      .then((res) => {
        if (!cancelled) setBenchmark(res);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, isCreatingNew, amountUsd, sourceChain, activeInvoice?.id, activeInvoice?.amountUsd, activeInvoice?.sourceChain]);

  if (!isOpen) return null;

  const handleQuickCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const created = await onCreateInvoice({
      clientName: clientName.trim() || "Global Client",
      amountUsd: Math.max(10, Number(amountUsd) || 1500),
      sourceChain,
      milestoneMemo: memo,
    });
    setSelectedId(created.id);
    setIsCreatingNew(false);
  };

  const handlePayNow = async () => {
    if (!activeInvoice) return;
    setIsRouting(true);
    await new Promise((r) => setTimeout(r, 700));
    try {
      await onSimulatePayment(activeInvoice.id);
    } finally {
      setIsRouting(false);
    }
  };

  const handleCopy = (addr: string) => {
    navigator.clipboard?.writeText(addr);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[#141514]/55 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Simulate 1Click Client Checkout"
    >
      <div className="w-full max-w-[520px] bg-[#F4F1EA] h-full overflow-y-auto border-l border-[#DED8CA] shadow-2xl flex flex-col justify-between">
        <div className="p-6 space-y-6">
          {/* Drawer Top Header */}
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#EAE5DA]">
            <div>
              <div className="inline-flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.12em] text-[#B86B4B] font-semibold">
                <span>HOSTED CLIENT CHECKOUT</span>
                <span>•</span>
                <span>{mode === "sandbox" ? "1CLICK LIVE SANDBOX" : "TESTNET"}</span>
              </div>
              <h3 className="mt-1 text-[22px] font-bold tracking-[-0.03em] text-[#181918]">
                Pay {podAccountId} from any chain
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close checkout drawer"
              className="w-8 h-8 rounded-full bg-[#EFECE4] hover:bg-[#E3DDD0] inline-flex items-center justify-center text-[#181918] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Invoice Switcher + Quick New Button */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {invoices.slice(0, 4).map((inv) => (
                <button
                  key={inv.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(inv.id);
                    setIsCreatingNew(false);
                  }}
                  className={`px-3 py-1.5 rounded-lg font-mono text-[11px] border transition-colors cursor-pointer ${
                    !isCreatingNew && activeInvoice?.id === inv.id
                      ? "bg-[#141514] text-[#F7F6F2] border-[#141514]"
                      : "bg-white text-[#5C5B57] border-[#DDD6C7] hover:text-[#181918]"
                  }`}
                >
                  {inv.id} · ${inv.amountUsd.toLocaleString("en-US")}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setIsCreatingNew((v) => !v)}
              className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-[#B86B4B] hover:text-[#181918] cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isCreatingNew ? "Cancel" : "New Quote"}</span>
            </button>
          </div>

          {/* New Quote Inline Form */}
          {isCreatingNew ? (
            <form
              onSubmit={handleQuickCreate}
              className="rounded-2xl bg-white border border-[#E0D9CA] p-5 space-y-4"
            >
              <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#5C5B57]">
                Create New Cross-Chain 1Click Invoice
              </div>
              <div>
                <label className="block font-mono text-[10.5px] uppercase text-[#5C5B57] mb-1">
                  Client Organization
                </label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full rounded-xl bg-[#F4F1EA] border border-[#DAD3C4] px-3.5 py-2 text-[13.5px] text-[#181918]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono text-[10.5px] uppercase text-[#5C5B57] mb-1">
                    Amount (USD)
                  </label>
                  <input
                    type="number"
                    min="10"
                    required
                    value={amountUsd}
                    onChange={(e) => setAmountUsd(e.target.value)}
                    className="w-full rounded-xl bg-[#F4F1EA] border border-[#DAD3C4] px-3.5 py-2 font-mono text-[13.5px] text-[#181918]"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[10.5px] uppercase text-[#5C5B57] mb-1">
                    Client Pays In
                  </label>
                  <select
                    value={sourceChain}
                    onChange={(e) => setSourceChain(e.target.value as SourceChainOption)}
                    className="w-full rounded-xl bg-[#F4F1EA] border border-[#DAD3C4] px-3 py-2 text-[13px] text-[#181918]"
                  >
                    {CHAINS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-mono text-[10.5px] uppercase text-[#5C5B57] mb-1">
                  Milestone Description
                </label>
                <input
                  type="text"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  className="w-full rounded-xl bg-[#F4F1EA] border border-[#DAD3C4] px-3.5 py-2 text-[13px] text-[#181918]"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-full bg-[#181918] text-[#F7F6F2] py-3 text-[13.5px] font-semibold cursor-pointer"
              >
                Generate 1Click Invoice Card
              </button>
            </form>
          ) : (
            activeInvoice && (
              <div className="rounded-[18px] bg-[#141514] text-[#F7F6F2] border border-white/12 p-5 space-y-5 shadow-xl">
                {/* Invoice Header */}
                <div className="flex items-start justify-between gap-2 pb-4 border-b border-white/10">
                  <div>
                    <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-[#F7F6F2]/50">
                      INVOICE {activeInvoice.id} · {activeInvoice.clientName}
                    </span>
                    <div className="mt-1 font-mono text-[30px] font-bold tracking-[-0.02em]">
                      $
                      {activeInvoice.amountUsd.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </div>
                    <p className="text-[12.5px] text-[#F7F6F2]/70 mt-0.5">
                      {activeInvoice.milestoneMemo}
                    </p>
                  </div>

                  {isRouting ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#3B2E17] text-[#FCD34D] border border-[#FCD34D]/25 font-mono text-[11px]">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      Routing
                    </span>
                  ) : activeInvoice.status === "SETTLED" ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1E3A2B] text-[#7CE3A6] border border-[#7CE3A6]/25 font-mono text-[11px]">
                      ✓ Allow · Settled
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-[#F7F6F2] font-mono text-[11px]">
                      1Click Open
                    </span>
                  )}
                </div>

                {/* QR & Route Summary */}
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <GeometricQrCode value={activeInvoice.depositAddress} size={118} />
                  <div className="flex-1 space-y-2.5 w-full">
                    <div className="rounded-xl bg-white/[0.04] border border-white/10 p-3 font-mono text-[11.5px] space-y-1">
                      <div className="flex justify-between">
                        <span className="text-[#F7F6F2]/50">Client Pays:</span>
                        <span className="text-[#FCD34D] font-semibold">
                          {activeInvoice.quotedSourceAmount}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#F7F6F2]/50">Source Network:</span>
                        <span>{activeInvoice.sourceChain}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#F7F6F2]/50">Destination:</span>
                        <span className="text-[#7CE3A6]">{activeInvoice.destinationVault}</span>
                      </div>
                    </div>

                    <div className="rounded-lg bg-black/45 border border-white/10 px-3 py-2 flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] text-[#F7F6F2]/85 truncate">
                        {activeInvoice.depositAddress}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(activeInvoice.depositAddress)}
                        className="font-mono text-[10.5px] px-2 py-1 rounded bg-white/10 hover:bg-white/15 text-[#F7F6F2] inline-flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        {copied ? (
                          <Check className="w-3 h-3 text-[#7CE3A6]" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>{copied ? "Copied" : "Copy"}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Live 1Click Fee & Solver Benchmark Strip */}
                {benchmark && (
                  <div className="rounded-xl bg-white/[0.04] border border-white/10 p-3.5 space-y-2 transition-bitfli">
                    <div className="flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.1em]">
                      <span className="inline-flex items-center gap-1.5 text-[#7CE3A6] font-semibold">
                        <Zap className="w-3 h-3 text-[#FCD34D]" />
                        <span>LIVE 1CLICK SOLVER &amp; FEE BENCHMARK (/v0/quote)</span>
                      </span>
                      <span className="text-[#F7F6F2]/50">
                        {benchmark.solverCount} Solvers · ~{benchmark.estimatedSettlementSec}s
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 font-mono text-[11px] pt-1">
                      <div className="rounded-lg bg-black/40 border border-white/10 p-2">
                        <div className="text-[9.5px] text-[#F7F6F2]/45 uppercase">
                          OutLayer Auth Fee
                        </div>
                        <div className="mt-0.5 text-[#7CE3A6] font-semibold">
                          0.0001% (${benchmark.outlayerFeeUsd.toFixed(3)})
                        </div>
                      </div>
                      <div className="rounded-lg bg-black/40 border border-white/10 p-2">
                        <div className="text-[9.5px] text-[#F7F6F2]/45 uppercase">
                          Standard Unauth
                        </div>
                        <div className="mt-0.5 text-[#FCA5A5] line-through">
                          0.20% (${benchmark.standardSwapFeeUsd.toFixed(2)})
                        </div>
                      </div>
                      <div className="rounded-lg bg-[#1E3A2B]/55 border border-[#7CE3A6]/30 p-2">
                        <div className="text-[9.5px] text-[#7CE3A6]/80 uppercase">
                          Margin Saved
                        </div>
                        <div className="mt-0.5 text-[#7CE3A6] font-bold">
                          +${benchmark.feeSavedUsd.toFixed(2)} USDC
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Button */}
                {activeInvoice.status === "SETTLED" ? (
                  <div className="rounded-xl bg-[#1E3A2B]/60 border border-[#7CE3A6]/30 p-3.5 flex items-center justify-between gap-2">
                    <div className="text-[12.5px] text-[#7CE3A6]">
                      Payment settled into <strong>{podAccountId}</strong>! Treasury KPIs &amp;
                      audit ledger updated.
                    </div>
                    <button
                      type="button"
                      onClick={onClose}
                      className="shrink-0 px-3.5 py-1.5 rounded-full bg-[#7CE3A6] text-[#141514] font-semibold text-[12px] cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={isRouting}
                    onClick={handlePayNow}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#B86B4B] hover:bg-[#c57655] text-[#F7F6F2] py-3.5 px-5 text-[14px] font-semibold transition-all cursor-pointer disabled:opacity-60"
                  >
                    <span>
                      {isRouting
                        ? "NEAR Intents 1Click Solver Settling..."
                        : `Simulate Client Deposit (${activeInvoice.quotedSourceAmount})`}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            )
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-5 border-t border-[#EAE5DA] bg-[#EFECE4] flex items-center justify-between text-[11.5px] font-mono text-[#5C5B57]">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#1E3A2B]" />
            Zero-bridge atomic settlement
          </span>
          <span>Powered by NEAR Intents 1Click</span>
        </div>
      </div>
    </div>
  );
};
