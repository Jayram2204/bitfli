import React from "react";
import { Bot, Coins, Cpu, Globe, Link2, PenTool, Server, Sparkles } from "lucide-react";
import { CONVERGENCE_NODES, type ConvergenceNodeId } from "../lib/scenarios";

interface ConvergenceDiagramProps {
  activeNodeId: ConvergenceNodeId;
  onSelectNode: (nodeId: ConvergenceNodeId) => void;
}

function renderNodeIcon(id: ConvergenceNodeId, isActive: boolean) {
  const cls = `w-4 h-4 transition-colors ${isActive ? "text-[#B86B4B]" : "text-[#181918]"}`;
  switch (id) {
    case "eth":
      return (
        <svg className={cls} viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path
            d="M9 2L4.2 9.2L9 11.9L13.8 9.2L9 2Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M4.2 10.6L9 16L13.8 10.6L9 13.2L4.2 10.6Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "solana":
      return <Sparkles className={cls} />;
    case "base-usdc":
      return <Coins className={cls} />;
    case "near":
      return <Globe className={cls} />;
    case "claude-agent":
      return <Bot className={cls} />;
    case "aws-apis":
      return <Server className={cls} />;
    case "design-contractor":
      return <PenTool className={cls} />;
    case "x402-link":
      return <Link2 className={cls} />;
    default:
      return <Cpu className={cls} />;
  }
}

// SVG X-coordinates matching the 4-column grid centers (in a 1000-unit viewBox)
const NODE_START_X: Record<ConvergenceNodeId, number> = {
  eth: 118,
  "claude-agent": 132,
  solana: 368,
  "aws-apis": 382,
  "base-usdc": 618,
  "design-contractor": 632,
  near: 868,
  "x402-link": 882,
};

export const ConvergenceDiagram: React.FC<ConvergenceDiagramProps> = ({
  activeNodeId,
  onSelectNode,
}) => {
  const activeSpec = CONVERGENCE_NODES.find((n) => n.id === activeNodeId) ?? CONVERGENCE_NODES[0];
  const row0Nodes = CONVERGENCE_NODES.filter((n) => n.rowIndex === 0);
  const row1Nodes = CONVERGENCE_NODES.filter((n) => n.rowIndex === 1);

  const renderNodeCard = (node: (typeof CONVERGENCE_NODES)[number]) => {
    const isActive = node.id === activeNodeId;
    return (
      <button
        key={node.id}
        type="button"
        onClick={() => onSelectNode(node.id)}
        aria-pressed={isActive}
        className={`group text-left rounded-[14px] px-4 py-3.5 transition-bitfli cursor-pointer border ${
          isActive
            ? "bg-white border-[#B86B4B] shadow-[0_8px_24px_rgba(184,107,75,0.13)] -translate-y-0.5"
            : "bg-[#EFECE4]/85 hover:bg-white border-[#DFD9CC] hover:border-[#C9C1B0]"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#F4F1EA] border border-[#E2DDD0] group-hover:border-[#D0C9B8]">
            {renderNodeIcon(node.id, isActive)}
          </span>
          <span
            className={`font-mono text-[9.5px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-full ${
              isActive
                ? "bg-[#B86B4B]/12 text-[#B86B4B] font-semibold"
                : "bg-[#E5E0D4] text-[#5C5B57]"
            }`}
          >
            {node.rowIndex === 0 ? "INBOUND" : "ACTION"}
          </span>
        </div>

        <div className="mt-2.5 flex items-center justify-between">
          <span className="text-[14px] font-semibold tracking-[-0.01em] text-[#181918]">
            {node.label}
          </span>
          <span
            className={`w-2 h-2 rounded-full transition-colors ${
              isActive ? "bg-[#B86B4B]" : "bg-[#D2CCC0] group-hover:bg-[#A69F91]"
            }`}
          />
        </div>
        <div className="mt-0.5 font-mono text-[11px] text-[#5C5B57] truncate">{node.sublabel}</div>
      </button>
    );
  };

  return (
    <section className="w-full bg-[#F4F1EA] pt-16 pb-6 border-b border-[#EAE5DA]/60">
      <div className="max-w-[1060px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Centered Uppercase Micro-Kicker */}
        <div className="text-center mb-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#5C5B57]">
            ANY CHAIN. EVERY ACTION. YOUR POLICIES.
          </p>
          <p className="mt-1.5 text-[13px] text-[#5C5B57]">
            Click any chain rail or autonomous actor below to trace its live OutLayer TEE routing
            decision.
          </p>
        </div>

        {/* 2-Row x 4-Column Monochrome Source Grid */}
        <div className="relative z-10">
          {/* Row 1: Inbound Cross-Chain Settlement Sources */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {row0Nodes.map(renderNodeCard)}
          </div>

          {/* Vertical Terracotta Channel Stems Linking Row 1 Through Row 2 */}
          <svg
            viewBox="0 0 1000 22"
            className="hidden sm:block w-full h-4 overflow-visible"
            fill="none"
            aria-hidden="true"
          >
            {row0Nodes.map((node) => {
              const x = NODE_START_X[node.id];
              const isRow0Selected = activeNodeId === node.id;
              return (
                <line
                  key={node.id}
                  x1={x}
                  y1={0}
                  x2={x}
                  y2={22}
                  stroke="#B86B4B"
                  strokeOpacity={isRow0Selected ? "0.95" : "0.28"}
                  strokeWidth={isRow0Selected ? "2.4" : "1.25"}
                />
              );
            })}
          </svg>

          {/* Row 2: Autonomous Agent & Outbound Execution Nodes */}
          <div className="mt-3 sm:mt-0 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {row1Nodes.map(renderNodeCard)}
          </div>
        </div>

        {/* Fine #B86B4B Terracotta SVG Lines Converging Downward into Central >> bitfli Hub */}
        <div className="relative flex flex-col items-center">
          <svg
            viewBox="0 0 1000 116"
            className="w-full h-[78px] sm:h-[108px] overflow-visible"
            fill="none"
            aria-hidden="true"
          >
            {/* Subtle Inactive Paths First */}
            {CONVERGENCE_NODES.map((node) => {
              if (node.id === activeNodeId) return null;
              const startX = NODE_START_X[node.id];
              const d = `M ${startX} 0 C ${startX} 62, 500 50, 500 114`;
              return (
                <path
                  key={node.id}
                  d={d}
                  stroke="#B86B4B"
                  strokeOpacity="0.26"
                  strokeWidth="1.25"
                />
              );
            })}

            {/* Highlighted Active Terracotta Path + 0.4s Traveling Pulse */}
            {(() => {
              const startX = NODE_START_X[activeNodeId];
              const d = `M ${startX} 0 C ${startX} 62, 500 50, 500 114`;
              const pathId = `active-convergence-path-${activeNodeId}`;
              return (
                <g key={activeNodeId}>
                  <path id={pathId} d={d} stroke="#B86B4B" strokeOpacity="0.25" strokeWidth="6" />
                  <path d={d} stroke="#B86B4B" strokeWidth="2.4" />
                  <path d={d} stroke="#F4F1EA" strokeWidth="1.6" className="animate-route-flow" />

                  {/* 0.4s Terracotta SVG Pulse Traveling From Selected Node Into Central >> bitfli Hub */}
                  <circle r="7.5" fill="#B86B4B" fillOpacity="0.28">
                    <animateMotion
                      dur="0.4s"
                      repeatCount="indefinite"
                      calcMode="spline"
                      keyTimes="0;1"
                      keySplines="0.22 1 0.36 1"
                      path={d}
                    />
                  </circle>
                  <circle r="4.2" fill="#B86B4B">
                    <animateMotion
                      dur="0.4s"
                      repeatCount="indefinite"
                      calcMode="spline"
                      keyTimes="0;1"
                      keySplines="0.22 1 0.36 1"
                      path={d}
                    />
                  </circle>

                  <circle cx={startX} cy="3" r="4.5" fill="#B86B4B" />
                  <circle cx="500" cy="112" r="5" fill="#B86B4B" />
                </g>
              );
            })()}
          </svg>

          {/* Central Dark Obsidian Hub Pill: >> bitfli */}
          <div className="-mt-1 inline-flex flex-col items-center">
            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-[#141514] text-[#F7F6F2] border border-white/12 shadow-[0_12px_30px_rgba(20,21,20,0.2)]">
              <span className="font-mono text-[14px] font-bold text-[#B86B4B]">&gt;&gt;</span>
              <span className="text-[18px] font-extrabold tracking-[-0.03em]">bitfli</span>
              <span className="h-3.5 w-[1px] bg-white/15" />
              <span className="font-mono text-[11px] text-[#7CE3A6] tracking-[0.04em]">
                {activeSpec.label} → TEE Policy Engine
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
