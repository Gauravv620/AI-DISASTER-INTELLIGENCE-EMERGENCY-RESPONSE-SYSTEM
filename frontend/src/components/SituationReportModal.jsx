import React from "react";
import {
  X,
  Printer,
  ShieldAlert,
  FileText,
  Clock,
  AlertTriangle,
  Users,
  Radio,
  CheckCircle2,
} from "lucide-react";

export default function SituationReportModal({
  isOpen,
  onClose,
  alerts = [],
  incidents = [],
  dispatches = [],
  rescueTeamCount = {},
}) {
  if (!isOpen) return null;

  const now = new Date();
  const reportRef = `SITREP-IND-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;

  function handlePrint() {
    window.print();
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden my-8 print:border-none print:shadow-none print:bg-white print:text-black">
        {/* Modal Controls (Hidden in Print) */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-6 py-4 print:hidden">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-indigo-500/20 p-2 text-indigo-400 border border-indigo-500/30">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide">
                National Operational Situation Report (SITREP)
              </h3>
              <p className="text-xs text-slate-400">
                Official Incident Commander Executive Briefing
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 transition-all"
            >
              <Printer className="h-4 w-4" />
              PRINT / EXPORT PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-300 hover:bg-slate-700 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Printable Report Body */}
        <div className="p-8 space-y-6 text-slate-200 print:text-black print:p-0">
          {/* Official Letterhead */}
          <div className="border-b-2 border-indigo-500/40 pb-6 print:border-black">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold tracking-widest text-indigo-400 uppercase print:text-black">
                  Government of India · Ministry of Home Affairs
                </p>
                <h1 className="mt-1 text-2xl font-black tracking-tight text-white print:text-black sm:text-3xl">
                  AIDERS SITUATION REPORT (SITREP)
                </h1>
                <p className="text-xs text-slate-400 print:text-gray-600 mt-1">
                  National Disaster Management Authority & Central Emergency Operations Center
                </p>
              </div>
              <div className="text-right">
                <span className="inline-block rounded-md border border-rose-500/40 bg-rose-500/20 px-3 py-1 text-xs font-bold text-rose-300 print:border-black print:text-black">
                  ALERT LEVEL: ELEVATED (DEFCON 2)
                </span>
                <p className="mt-2 text-[11px] font-mono text-slate-400 print:text-black">
                  REF: {reportRef}
                </p>
                <p className="text-[10px] text-slate-500 print:text-black">
                  ISSUED: {now.toUTCString()}
                </p>
              </div>
            </div>
          </div>

          {/* Key Metric Highlights */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 print:grid-cols-4">
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 print:border-black print:bg-gray-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 print:text-black">
                Active SACHET Alerts
              </p>
              <p className="mt-1 text-2xl font-black text-rose-400 print:text-black">
                {alerts.length}
              </p>
              <p className="text-[10px] text-slate-500 print:text-black">
                Verified warnings active
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 print:border-black print:bg-gray-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 print:text-black">
                Open Incident Registers
              </p>
              <p className="mt-1 text-2xl font-black text-amber-400 print:text-black">
                {incidents.length}
              </p>
              <p className="text-[10px] text-slate-500 print:text-black">
                Under active EOC command
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 print:border-black print:bg-gray-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 print:text-black">
                Rescue Units Deployed
              </p>
              <p className="mt-1 text-2xl font-black text-sky-400 print:text-black">
                {rescueTeamCount.deployed || dispatches.filter((d) => d.status === "EN_ROUTE" || d.status === "ON_SCENE").length}
              </p>
              <p className="text-[10px] text-slate-500 print:text-black">
                NDRF / SDRF in field
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 print:border-black print:bg-gray-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 print:text-black">
                Available Reserve Force
              </p>
              <p className="mt-1 text-2xl font-black text-emerald-400 print:text-black">
                {rescueTeamCount.available || 3}
              </p>
              <p className="text-[10px] text-slate-500 print:text-black">
                Ready for rapid airlift
              </p>
            </div>
          </div>

          {/* Section 1: Executive Operational Summary */}
          <div>
            <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-400 print:text-black border-b border-slate-800 print:border-black pb-2 mb-3">
              <ShieldAlert className="h-4 w-4" />
              1. Executive Operational Appraisal
            </h4>
            <p className="text-xs leading-relaxed text-slate-300 print:text-black">
              AIDERS integrated sensors and government ingestion streams (NDMA SACHET, IMD,
              Central Water Commission, USGS) indicate heightened vulnerability across the Bay of Bengal
              littoral corridor, the Brahmaputra River drainage basin, and the Western Ghats mountain
              corridor. Standard Operating Protocols have been initiated across regional disaster headquarters.
            </p>
          </div>

          {/* Section 2: Active Incident Breakdown */}
          <div>
            <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400 print:text-black border-b border-slate-800 print:border-black pb-2 mb-3">
              <AlertTriangle className="h-4 w-4" />
              2. Active National Incidents Under Operational Command
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-slate-800 print:border-black">
                <thead className="bg-slate-950 text-slate-400 print:bg-gray-200 print:text-black font-semibold">
                  <tr>
                    <th className="p-2 border border-slate-800 print:border-black">Type</th>
                    <th className="p-2 border border-slate-800 print:border-black">Incident Title</th>
                    <th className="p-2 border border-slate-800 print:border-black">Severity</th>
                    <th className="p-2 border border-slate-800 print:border-black">Coordinates</th>
                    <th className="p-2 border border-slate-800 print:border-black">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 print:divide-black">
                  {incidents.slice(0, 5).map((inc) => (
                    <tr key={inc.id} className="hover:bg-slate-800/40 print:hover:bg-transparent">
                      <td className="p-2 font-mono font-semibold border border-slate-800 print:border-black">
                        {inc.incident_type || "INCIDENT"}
                      </td>
                      <td className="p-2 border border-slate-800 print:border-black">
                        {inc.title}
                      </td>
                      <td className="p-2 border border-slate-800 print:border-black">
                        <span className="font-bold text-rose-400 print:text-black">
                          {inc.severity || "HIGH"}
                        </span>
                      </td>
                      <td className="p-2 font-mono border border-slate-800 print:border-black">
                        {inc.latitude != null ? `${Number(inc.latitude).toFixed(2)}, ${Number(inc.longitude).toFixed(2)}` : "—"}
                      </td>
                      <td className="p-2 font-semibold border border-slate-800 print:border-black">
                        {inc.status || "OPEN"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Deployed Response Operations */}
          <div>
            <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-400 print:text-black border-b border-slate-800 print:border-black pb-2 mb-3">
              <Users className="h-4 w-4" />
              3. Search & Rescue Resource Mobilization Status
            </h4>
            <div className="space-y-2">
              {dispatches.slice(0, 4).map((disp) => (
                <div
                  key={disp.id}
                  className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 print:border-black print:bg-transparent"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white print:text-black text-xs">
                      {disp.team_name || "Rescue Battalion"}
                    </span>
                    <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold text-indigo-300 print:border print:border-black print:text-black">
                      {disp.status || "ASSIGNED"}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400 print:text-black">
                    Mission: {disp.instructions || "Operational search and rescue deployment under EOC."}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Section 4: Sign-Off Block */}
          <div className="border-t border-slate-800 pt-6 mt-6 print:border-black flex justify-between items-end text-xs text-slate-400 print:text-black">
            <div>
              <p className="font-bold uppercase tracking-wider text-slate-300 print:text-black">
                Authorized By:
              </p>
              <p className="mt-1 font-semibold text-white print:text-black">
                Duty Operations Chief · Central Incident Response Room
              </p>
              <p className="text-[10px] text-slate-500 print:text-black">
                National Disaster Intelligence & Emergency Response System (AIDERS)
              </p>
            </div>
            <div className="text-right">
              <div className="inline-block border-b border-dashed border-slate-600 print:border-black w-40 pb-1 mb-1"></div>
              <p className="text-[10px] text-slate-500 print:text-black">Official Seal / Digital Verification</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

