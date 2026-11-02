import React, { useState } from "react";
import {
  X,
  PhoneCall,
  Shield,
  LifeBuoy,
  Flame,
  Ambulance,
  AlertOctagon,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";

export default function EmergencyHelplineModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState("helplines");

  if (!isOpen) return null;

  const helplines = [
    {
      number: "112",
      title: "National Emergency Unified Helpline",
      subtitle: "Single emergency response across India (Police, Fire, Ambulance)",
      color: "bg-rose-500/10 border-rose-500/30 text-rose-400",
      btnColor: "bg-rose-600 hover:bg-rose-500",
      icon: Shield,
    },
    {
      number: "1078",
      title: "NDRF Disaster Control Room",
      subtitle: "Direct line to National Disaster Response Force HQ Operations",
      color: "bg-indigo-500/10 border-indigo-500/30 text-indigo-400",
      btnColor: "bg-indigo-600 hover:bg-indigo-500",
      icon: LifeBuoy,
    },
    {
      number: "1070",
      title: "State Relief & Emergency Ops (EOC)",
      subtitle: "State-level disaster commissioner disaster relief coordinator",
      color: "bg-amber-500/10 border-amber-500/30 text-amber-400",
      btnColor: "bg-amber-600 hover:bg-amber-500",
      icon: AlertOctagon,
    },
    {
      number: "108",
      title: "Emergency Medical & Ambulance",
      subtitle: "24/7 Paramedic and Trauma transport dispatch",
      color: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
      btnColor: "bg-emerald-600 hover:bg-emerald-500",
      icon: Ambulance,
    },
    {
      number: "101",
      title: "Fire & Rescue Brigade",
      subtitle: "Fire suppression, urban entrapment, and hazard mitigation",
      color: "bg-orange-500/10 border-orange-500/30 text-orange-400",
      btnColor: "bg-orange-600 hover:bg-orange-500",
      icon: Flame,
    },
    {
      number: "1091",
      title: "Women in Distress Helpline",
      subtitle: "Specialized crisis response and shelter coordination",
      color: "bg-pink-500/10 border-pink-500/30 text-pink-400",
      btnColor: "bg-pink-600 hover:bg-pink-500",
      icon: PhoneCall,
    },
  ];

  const sops = [
    {
      hazard: "FLOOD & FLASH INUNDATION",
      badgeColor: "text-blue-400 border-blue-500/30 bg-blue-500/10",
      steps: [
        "Immediately move to designated multi-storey shelters or elevated terrain.",
        "Turn off master circuit breakers and gas supply valves before inundation reaches ground level.",
        "Never attempt to drive or walk through flood waters deeper than ankle height — 15cm can knock down an adult.",
        "Boil all drinking water or use water purification chlorination tablets.",
      ],
    },
    {
      hazard: "LANDSLIDE & SLOPE FAILURE",
      badgeColor: "text-amber-400 border-amber-500/30 bg-amber-500/10",
      steps: [
        "Stay vigilant during prolonged rainfall; listen for faint rumblings or cracking sounds in hill trees.",
        "Notice tilted utility poles, new cracks in roads or foundations, and sudden muddying of clear streams.",
        "Evacuate downslope residences immediately away from direct ravine or chute paths.",
        "Do not stop on vulnerable cut-slopes along mountain ghat highways.",
      ],
    },
    {
      hazard: "EARTHQUAKE",
      badgeColor: "text-rose-400 border-rose-500/30 bg-rose-500/10",
      steps: [
        "DROP to your hands and knees. COVER your head and neck under sturdy furniture. HOLD ON until shaking stops.",
        "If outdoors, move into open spaces away from high-tension wires, glass curtain walls, and masonry cornices.",
        "Do not enter elevators; use designated fire stairwells once primary ground shaking ceases.",
        "Expect and prepare for significant aftershocks over subsequent 48-72 hours.",
      ],
    },
    {
      hazard: "CYCLONIC STORM & GALE WINDS",
      badgeColor: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10",
      steps: [
        "Board up or tape large glass windows. Secure loose corrugated roof sheets and rooftop water tanks.",
        "Keep emergency battery pack, radio, flashlights, non-perishable foods, and dry medication ready.",
        "Do not venture out during the 'eye of the cyclone' when calm prevails — severe counter-winds will resume suddenly.",
        "Follow official SACHET / IMD broadcasts and heed mandatory evacuation directives.",
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/80 p-3 sm:p-4 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-4 sm:px-6 py-3 sm:py-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-rose-500/20 p-2 text-rose-400 border border-rose-500/30">
              <PhoneCall className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide">
                National Emergency Directory & SOP Protocols
              </h3>
              <p className="text-xs text-slate-400">
                Official Government Hotlines & Standard Operating Procedures
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Toggle */}
        <div className="flex border-b border-slate-800 bg-slate-950/50 px-6">
          <button
            type="button"
            onClick={() => setActiveTab("helplines")}
            className={`py-3 px-4 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${
              activeTab === "helplines"
                ? "border-rose-500 text-rose-400"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            Speed Dial Emergency Directory
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("sops")}
            className={`py-3 px-4 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${
              activeTab === "sops"
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            Standard Operating Procedures (SOPs)
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {activeTab === "helplines" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {helplines.map((line) => {
                const Icon = line.icon;
                return (
                  <div
                    key={line.number}
                    className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-4 transition-all hover:border-slate-700"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-black border ${line.color}`}>
                          <Icon className="h-3.5 w-3.5" />
                          DIAL {line.number}
                        </span>
                        <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                          24/7 TOLL FREE
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-white mt-1">
                        {line.title}
                      </h4>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        {line.subtitle}
                      </p>
                    </div>

                    <a
                      href={`tel:${line.number}`}
                      className={`mt-4 inline-flex items-center justify-center gap-2 rounded-lg ${line.btnColor} px-4 py-2 text-xs font-bold text-white shadow-md transition-transform active:scale-95`}
                    >
                      <PhoneCall className="h-3.5 w-3.5" />
                      CALL {line.number} NOW
                    </a>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-4">
              {sops.map((item) => (
                <div
                  key={item.hazard}
                  className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className={`rounded-md border px-2.5 py-1 text-[11px] font-black uppercase tracking-wider ${item.badgeColor}`}>
                      {item.hazard}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      NDMA PROTOCOL
                    </span>
                  </div>
                  <ul className="space-y-2 text-xs text-slate-300">
                    {item.steps.map((step, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                        <span className="leading-relaxed">{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 bg-slate-950 px-6 py-3 text-center text-xs text-slate-500">
          AIDERS Disaster Telemetry System · Connected with National Emergency Operations Network
        </div>
      </div>
    </div>
  );
}

