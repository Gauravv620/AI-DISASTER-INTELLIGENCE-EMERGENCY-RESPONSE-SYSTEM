/**
 * AIDERS Offline Resilience & Emergency Backup Engine
 * ----------------------------------------------------
 * High-reliability data persistence designed for severe disaster scenarios:
 * 1. Power-cut protection: Auto-saves form drafts and operational registers to non-volatile local storage.
 * 2. Grid-failure outbox: Queues citizen SOS beacons and incident dispatches when offline.
 * 3. Auto-sync on reconnection: Automatically flushes queued reports to backend upon network/power restoration.
 * 4. Emergency Vault export: Generates encrypted/structured JSON backups for offline field-swapping via USB.
 */

const STORAGE_KEYS = {
  COMMAND_SNAPSHOT: "aiders_offline_command_snapshot",
  OFFLINE_OUTBOX: "aiders_offline_outbox",
  CITIZEN_DRAFT: "aiders_citizen_report_draft",
  SITREP_DRAFT: "aiders_sitrep_draft",
  AUDIT_LOG: "aiders_offline_audit_log",
};

export const offlineStorage = {
  /**
   * Check if the device currently has network connectivity
   */
  isOnline() {
    return typeof navigator !== "undefined" && navigator.onLine !== undefined
      ? navigator.onLine
      : true;
  },

  /**
   * Save a form draft (Power-cut prevention)
   */
  saveDraft(key, data) {
    try {
      const payload = {
        data,
        savedAt: new Date().toISOString(),
        version: "2026.1",
      };
      localStorage.setItem(key, JSON.stringify(payload));
      return true;
    } catch (err) {
      console.warn("OfflineStorage: Failed to save draft", err);
      return false;
    }
  },

  /**
   * Retrieve a form draft after power restoration or page reload
   */
  loadDraft(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed;
    } catch (err) {
      console.warn("OfflineStorage: Failed to parse draft", err);
      return null;
    }
  },

  /**
   * Clear draft upon successful submission
   */
  clearDraft(key) {
    try {
      localStorage.removeItem(key);
    } catch {}
  },

  /**
   * Queue a report into the offline outbox when network or power is severed
   */
  queueOfflineReport(report) {
    try {
      const outbox = this.getOfflineOutbox();
      const queuedItem = {
        id: report.id || `OFFLINE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        data: report,
        queuedAt: new Date().toISOString(),
        status: "PENDING_SYNC",
        retryCount: 0,
      };
      outbox.unshift(queuedItem);
      localStorage.setItem(STORAGE_KEYS.OFFLINE_OUTBOX, JSON.stringify(outbox));
      this.logAudit("REPORT_QUEUED_OFFLINE", { id: queuedItem.id, title: report.title });
      return queuedItem;
    } catch (err) {
      console.error("OfflineStorage: Failed to queue report", err);
      return null;
    }
  },

  /**
   * Get all pending offline reports
   */
  getOfflineOutbox() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.OFFLINE_OUTBOX);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  /**
   * Remove a successfully synced item from outbox
   */
  removeOfflineReport(id) {
    try {
      const outbox = this.getOfflineOutbox().filter((item) => item.id !== id);
      localStorage.setItem(STORAGE_KEYS.OFFLINE_OUTBOX, JSON.stringify(outbox));
    } catch {}
  },

  /**
   * Synchronize pending offline outbox reports with the server
   */
  async syncOfflineOutbox(apiBase = (import.meta.env?.VITE_API_BASE || (import.meta.env?.PROD ? "https://ai-disaster-intelligence-emergency.onrender.com" : "http://127.0.0.1:8000"))) {
    const outbox = this.getOfflineOutbox();
    if (outbox.length === 0) return { total: 0, synced: 0, failed: 0 };

    let synced = 0;
    let failed = 0;

    for (const item of [...outbox]) {
      try {
        const response = await fetch(`${apiBase}/api/v1/citizen-reports`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item.data),
        });

        if (response.ok) {
          this.removeOfflineReport(item.id);
          this.logAudit("REPORT_SYNCED_TO_GRID", { id: item.id });
          synced++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    return { total: outbox.length, synced, failed };
  },

  /**
   * Save complete command dashboard state snapshot for power-cut resilience
   */
  saveCommandSnapshot({ alerts, incidents, dispatches }) {
    try {
      const snapshot = {
        savedAt: new Date().toISOString(),
        alerts: alerts || [],
        incidents: incidents || [],
        dispatches: dispatches || [],
        meta: {
          app: "AIDERS EOC Command Center",
          classification: "MHA-CERT-IN-RESTRICTED",
        },
      };
      localStorage.setItem(STORAGE_KEYS.COMMAND_SNAPSHOT, JSON.stringify(snapshot));
      return true;
    } catch (err) {
      console.warn("OfflineStorage: Failed to save command snapshot", err);
      return false;
    }
  },

  /**
   * Load last known command snapshot after power outage or reboot
   */
  loadCommandSnapshot() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.COMMAND_SNAPSHOT);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  /**
   * Append to local audit log for disaster forensics
   */
  logAudit(event, details = {}) {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.AUDIT_LOG);
      const logs = raw ? JSON.parse(raw) : [];
      logs.unshift({
        id: `LOG-${Date.now()}`,
        event,
        details,
        timestamp: new Date().toISOString(),
      });
      // Keep last 100 entries to prevent overflow
      const trimmed = logs.slice(0, 100);
      localStorage.setItem(STORAGE_KEYS.AUDIT_LOG, JSON.stringify(trimmed));
    } catch {}
  },

  /**
   * Export complete offline emergency vault as a downloadable JSON file
   * (Essential for taking disaster backups to satellite stations or offline laptops)
   */
  exportEmergencyBackup() {
    try {
      const snapshot = this.loadCommandSnapshot() || {};
      const outbox = this.getOfflineOutbox();
      const rawLogs = localStorage.getItem(STORAGE_KEYS.AUDIT_LOG);
      const logs = rawLogs ? JSON.parse(rawLogs) : [];

      const backupData = {
        exportedAt: new Date().toISOString(),
        system: "AIDERS National Disaster Decision Support Platform",
        securityClassification: "OFFICIAL EOC OFFLINE ARCHIVE",
        powerLossProtectionActive: true,
        commandSnapshot: snapshot,
        pendingOfflineOutbox: outbox,
        auditLogs: logs,
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const dateStr = new Date().toISOString().replace(/[:.]/g, "-");
      link.href = url;
      link.download = `AIDERS_Emergency_Vault_Backup_${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return true;
    } catch (err) {
      console.error("Failed to export backup", err);
      return false;
    }
  },

  STORAGE_KEYS,
};

