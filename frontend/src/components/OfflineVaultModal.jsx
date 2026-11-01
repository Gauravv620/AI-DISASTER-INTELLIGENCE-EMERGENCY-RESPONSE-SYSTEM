import React, { useState, useEffect } from "react";
import {
  Database,
  HardDrive,
  Download,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Wifi,
  WifiOff,
  X,
  ShieldCheck,
  Zap,
  ZapOff,
  Clock,
  ArrowRight,
  FileText,
  Trash2,
} from "lucide-react";
import { offlineStorage } from "../services/offlineStorage";

export default function OfflineVaultModal({
  isOpen,
  onClose,
  onRestoreSnapshot,
  currentSnapshotInfo,
}) {
  const [isOnline, setIsOnline] = useState(offlineStorage.isOnline());
  const [outboxItems, setOutboxItems] = useState([]);
  const [snapshot, setSnapshot] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState("");
  const [exportNotice, setExportNotice] = useState("");

  const refreshVaultData = () => {
    setIsOnline(offlineStorage.isOnline());
    setOutboxItems(offlineStorage.getOfflineOutbox());
    setSnapshot(offlineStorage.loadCommandSnapshot());
  };

  useEffect(() => {
    if (isOpen) {
      refreshVaultData();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      refreshVaultData();
    };
    const handleOffline = () => {
      setIsOnline(false);
      refreshVaultData();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!isOpen) return null;

  const handleSyncOutbox = async () => {
    setSyncing(true);
    setSyncStatus("Connecting to central command servers & transmitting pending outbox...");
    try {
      const result = await offlineStorage.syncOfflineOutbox();
      setOutboxItems(offlineStorage.getOfflineOutbox());
      if (result.synced > 0) {
        setSyncStatus(`Successfully synchronized ${result.synced} offline report(s) to central EOC grid.`);
      } else if (result.failed > 0) {
        setSyncStatus(`Network unreachable. ${result.failed} report(s) safely retained in local storage.`);
      } else {
        setSyncStatus("Outbox is up to date. No pending reports.");
      }
    } catch {
      setSyncStatus("Failed to reach central server. Reports remain secure in offline vault.");
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncStatus(""), 4000);
    }
  };

  const handleExportBackup = () => {
    const success = offlineStorage.exportEmergencyBackup();
    if (success) {
      setExportNotice("Emergency vault snapshot downloaded to local machine as JSON.");
      setTimeout(() => setExportNotice(""), 3500);
    }
  };

  const snapshotDate = snapshot?.savedAt ? new Date(snapshot.savedAt).toLocaleTimeString() : "None";

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden text-slate-200">
        {/* Header */}
        <div className="border-b border-slate-800 bg-slate-950 px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <HardDrive className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-white uppercase tracking-tight">
                  AIDERS Offline Resilience & Emergency Vault
                </h3>
                <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-[9px] font-bold text-indigo-300 border border-indigo-500/30">
                  POWER-CUT SAFE
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Non-volatile storage protecting operational telemetry and citizen reports during blackouts.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-800 bg-slate-900 p-1.5 text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Live Status Bar */}
        <div className="grid grid-cols-3 divide-x divide-slate-800 border-b border-slate-800 bg-slate-950/50 p-3 text-center">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Grid Connection</span>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-white mt-0.5">
              {isOnline ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-emerald-400">Connected to Grid</span>
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
                  <span className="text-amber-400">Offline / Blackout Mode</span>
                </>
              )}
            </span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Power-Loss Vault</span>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-300 mt-0.5">
              <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" />
              <span>Auto-Caching Active</span>
            </span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Last Snapshot</span>
            <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-slate-300 mt-0.5">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              <span>{snapshotDate}</span>
            </span>
          </div>
        </div>

        {/* Notifications */}
        {syncStatus && (
          <div className="mx-6 mt-4 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3 text-xs text-indigo-200 flex items-center gap-2">
            <RefreshCw className={`h-4 w-4 shrink-0 text-indigo-400 ${syncing ? "animate-spin" : ""}`} />
            <span>{syncStatus}</span>
          </div>
        )}

        {exportNotice && (
          <div className="mx-6 mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>{exportNotice}</span>
          </div>
        )}

        <div className="p-6 space-y-5">
          {/* Vault Inventory Cards */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-2">
              <Database className="h-3.5 w-3.5 text-indigo-400" />
              <span>Local Persistent Vault Inventory</span>
            </h4>
            <div className="grid grid-cols-4 gap-2.5">
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-center">
                <span className="text-[10px] uppercase text-slate-500 block">Saved Alerts</span>
                <span className="text-base font-black text-rose-400">
                  {snapshot?.alerts?.length || 0}
                </span>
                <span className="text-[9px] text-slate-500 block">IMD / SACHET</span>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-center">
                <span className="text-[10px] uppercase text-slate-500 block">Saved Incidents</span>
                <span className="text-base font-black text-amber-400">
                  {snapshot?.incidents?.length || 0}
                </span>
                <span className="text-[9px] text-slate-500 block">EOC Registers</span>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-center">
                <span className="text-[10px] uppercase text-slate-500 block">Saved Dispatches</span>
                <span className="text-base font-black text-indigo-400">
                  {snapshot?.dispatches?.length || 0}
                </span>
                <span className="text-[9px] text-slate-500 block">NDRF / SDRF</span>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-center">
                <span className="text-[10px] uppercase text-slate-500 block">Offline Outbox</span>
                <span className="text-base font-black text-emerald-400">
                  {outboxItems.length}
                </span>
                <span className="text-[9px] text-slate-500 block">Queued For Sync</span>
              </div>
            </div>
          </div>

          {/* Pending Offline Reports Outbox */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-amber-400" />
                <span>Pending Offline Reports ({outboxItems.length})</span>
              </h4>
              {outboxItems.length > 0 && (
                <button
                  type="button"
                  onClick={handleSyncOutbox}
                  disabled={syncing}
                  className="rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-indigo-500 flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
                  <span>Sync Outbox Now</span>
                </button>
              )}
            </div>

            {outboxItems.length === 0 ? (
              <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-center text-xs text-slate-400">
                <CheckCircle2 className="h-5 w-5 text-emerald-400 mx-auto mb-1" />
                <span>No queued offline reports. All citizen submissions and SOS beacons are synchronized.</span>
              </div>
            ) : (
              <div className="space-y-2 max-h-36 overflow-y-auto custom-scrollbar pr-1">
                {outboxItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-slate-800 bg-slate-950/80 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{item.data?.title || "Emergency Report"}</span>
                        <span className="rounded bg-amber-500/20 px-1.5 py-0.2 text-[9px] font-bold text-amber-300 border border-amber-500/30">
                          PENDING SYNC
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {item.data?.category || "DISASTER"} · {item.data?.name || "Citizen"} · {new Date(item.queuedAt).toLocaleTimeString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        offlineStorage.removeOfflineReport(item.id);
                        setOutboxItems(offlineStorage.getOfflineOutbox());
                      }}
                      className="text-slate-500 hover:text-rose-400 p-1"
                      title="Discard report"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={handleExportBackup}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-750 p-3 text-xs font-bold text-slate-100 transition-colors"
            >
              <Download className="h-4 w-4 text-emerald-400" />
              <span>Download Vault Backup (.json)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (onRestoreSnapshot && snapshot) {
                  onRestoreSnapshot(snapshot);
                  setExportNotice("Command dashboard reloaded from local offline snapshot.");
                  setTimeout(() => onClose(), 800);
                }
              }}
              disabled={!snapshot}
              className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 p-3 text-xs font-bold text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Reload From Last Snapshot</span>
            </button>
          </div>

          {/* Legal / MHA Guidance */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-[11px] text-slate-400 leading-relaxed">
            <span className="font-bold text-slate-300">National Disaster Management Standard: </span>
            In the event of regional power grid blackout or cellular tower downing, AIDERS stores all field inputs in persistent browser storage with automatic sync retry. Workstation backups should be saved to external solid-state storage every operational shift.
          </div>
        </div>
      </div>
    </div>
  );
}

