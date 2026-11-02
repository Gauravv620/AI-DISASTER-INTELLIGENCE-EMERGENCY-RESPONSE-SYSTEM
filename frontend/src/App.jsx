import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  ShieldAlert,
  Map,
  Radio,
  Siren,
  Users,
  Activity,
  RefreshCw,
  Wifi,
  WifiOff,
  Clock,
  MapPin,
  AlertTriangle,
  Building2,
  ChevronRight,
  Globe2,
  Volume2,
  VolumeX,
  FileText,
  PhoneCall,
  BrainCircuit,
  Search,
  Filter,
  Layers,
  Menu,
  X,
  PlusCircle,
  Compass,
  CheckCircle2,
  Home,
  Lock,
  UserCheck,
  HardDrive,
} from "lucide-react";

import CommandMap from "./components/CommandMap";
import CitizenDisasterReport from "./components/CitizenDisasterReport";
import DisasterImageAnalyzer from "./components/DisasterImageAnalyzer";
import SituationReportModal from "./components/SituationReportModal";
import EmergencyHelplineModal from "./components/EmergencyHelplineModal";
import LandingPage from "./components/LandingPage";
import AuthModal from "./components/AuthModal";
import OfflineVaultModal from "./components/OfflineVaultModal";
import { offlineStorage } from "./services/offlineStorage";
import { useAuth } from "./contexts/AuthContext";
import { soundAlerts } from "./services/soundAlerts";
import {
  TACTICAL_ALERTS,
  TACTICAL_INCIDENTS,
  TACTICAL_DISPATCHES,
  TACTICAL_RESCUE_TEAMS,
  TACTICAL_OFFICIALS,
  TACTICAL_TICKER_ITEMS,
} from "./services/tacticalData";

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";
const WS_URL =
  import.meta.env.VITE_WS_URL ||
  (import.meta.env.VITE_API_BASE
    ? import.meta.env.VITE_API_BASE.replace(/^http/, "ws") + "/ws/alerts"
    : "ws://127.0.0.1:8000/ws/alerts");

export default function App() {
  const { user, isAuthenticated, logout } = useAuth();

  // Navigation
  const [currentPage, setCurrentPage] = useState("landing"); // "landing" | "command" | "gis" | "operations" | "ai-vision" | "citizen" | "helplines"
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Modals
  const [showSitrepModal, setShowSitrepModal] = useState(false);
  const [showHelplineModal, setShowHelplineModal] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showOfflineVaultModal, setShowOfflineVaultModal] = useState(false);
  const [isGridOnline, setIsGridOnline] = useState(offlineStorage.isOnline());

  // Audio state
  const [soundEnabled, setSoundEnabled] = useState(soundAlerts.isSoundEnabled());

  // Clocks
  const [currentTime, setCurrentTime] = useState(new Date());

  // Alerts state - Blank when not authenticated
  const [alerts, setAlerts] = useState(isAuthenticated ? TACTICAL_ALERTS : []);
  // alertTotal is always derived from alerts.length — never stale
  const alertTotal = alerts.length;
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [alertError, setAlertError] = useState("");
  const [alertSearch, setAlertSearch] = useState("");
  const [alertSeverityFilter, setAlertSeverityFilter] = useState("ALL");
  const [wsConnected, setWsConnected] = useState(false);
  const [isLiveBackend, setIsLiveBackend] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Incidents state - Blank when not authenticated
  const [incidentRecords, setIncidentRecords] = useState(isAuthenticated ? TACTICAL_INCIDENTS : []);
  const [openIncidents, setOpenIncidents] = useState(isAuthenticated ? TACTICAL_INCIDENTS.length : 0);
  const [incidentLoading, setIncidentLoading] = useState(false);
  const [incidentError, setIncidentError] = useState("");
  const [selectedIncidentRecordId, setSelectedIncidentRecordId] = useState(
    isAuthenticated ? TACTICAL_INCIDENTS[0]?.id || "" : ""
  );
  const [incidentSearch, setIncidentSearch] = useState("");

  // Rescue teams state - Zeroed when not authenticated
  const [rescueTeamCount, setRescueTeamCount] = useState(
    isAuthenticated
      ? {
          available: 2,
          en_route: 4,
          deployed: 3,
          busy: 1,
          offline: 0,
          total: 10,
        }
      : {
          available: 0,
          en_route: 0,
          deployed: 0,
          busy: 0,
          offline: 0,
          total: 0,
        }
  );

  // Dispatches state - Blank when not authenticated
  const [dispatches, setDispatches] = useState(isAuthenticated ? TACTICAL_DISPATCHES : []);
  const [dispatchStats, setDispatchStats] = useState(
    isAuthenticated
      ? {
          total: 3,
          assigned: 1,
          acknowledged: 0,
          en_route: 1,
          on_scene: 1,
          completed: 0,
          cancelled: 0,
        }
      : {
          total: 0,
          assigned: 0,
          acknowledged: 0,
          en_route: 0,
          on_scene: 0,
          completed: 0,
          cancelled: 0,
        }
  );
  const [dispatchLoading, setDispatchLoading] = useState(false);
  const [dispatchStatusFilter, setDispatchStatusFilter] = useState("ALL");

  // Create dispatch form state
  const [dispatchIncidents, setDispatchIncidents] = useState([]);
  const [dispatchTeams, setDispatchTeams] = useState([]);
  const [dispatchOfficials, setDispatchOfficials] = useState([]);
  const [selectedIncident, setSelectedIncident] = useState("");
  const [selectedTeam, setSelectedTeam] = useState("");
  const [selectedDispatcher, setSelectedDispatcher] = useState("");
  const [dispatchPriority, setDispatchPriority] = useState("HIGH");
  const [dispatchInstructions, setDispatchInstructions] = useState("");
  const [dispatchFormLoading, setDispatchFormLoading] = useState(false);
  const [dispatchFormError, setDispatchFormError] = useState("");
  const [dispatchFormSuccess, setDispatchFormSuccess] = useState("");

  // Live master clock timer
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Sorted and filtered alerts
  const sortedAlerts = useMemo(() => {
    let result = [...alerts];
    if (alertSeverityFilter !== "ALL") {
      result = result.filter(
        (a) => String(a.severity || "").toUpperCase() === alertSeverityFilter.toUpperCase()
      );
    }
    if (alertSearch.trim()) {
      const q = alertSearch.toLowerCase();
      result = result.filter(
        (a) =>
          String(a.headline || "").toLowerCase().includes(q) ||
          String(a.description || "").toLowerCase().includes(q) ||
          String(a.area_name || "").toLowerCase().includes(q) ||
          String(a.alert_type || "").toLowerCase().includes(q)
      );
    }
    return result.sort((a, b) => {
      const dateA = new Date(a.issued_at || a.effective_at || a.created_at || 0).getTime();
      const dateB = new Date(b.issued_at || b.effective_at || b.created_at || 0).getTime();
      return dateB - dateA;
    });
  }, [alerts, alertSeverityFilter, alertSearch]);

  // Selected incident details
  const selectedIncidentRecord = incidentRecords.find(
    (item) => String(item.id) === String(selectedIncidentRecordId)
  );
  const selectedIncidentDispatches = dispatches.filter(
    (item) => String(item.incident_id) === String(selectedIncidentRecordId)
  );

  // Map incident click handler
  const handleMapIncidentSelect = (markerData) => {
    const match = incidentRecords.find(
      (item) =>
        (item.external_event_id && item.external_event_id === markerData.external_event_id) ||
        (item.id && String(item.id) === String(markerData.id))
    );
    if (match) {
      setSelectedIncidentRecordId(match.id);
      setIncidentRecordsError("");
    } else {
      setSelectedIncidentRecordId(markerData.id || incidentRecords[0]?.id || "");
    }
  };

  // Toggle audio
  const handleToggleSound = () => {
    const state = soundAlerts.toggleSound();
    setSoundEnabled(state);
  };

  // -------------------------------------------------------------
  // DATA LOADERS WITH RESILIENT FALLBACK
  // -------------------------------------------------------------
  const loadAlerts = async () => {
    try {
      setLoadingAlerts(true);
      setAlertError("");
      const response = await fetch(`${API_BASE}/api/v1/alerts?limit=100&offset=0`);
      if (!response.ok) throw new Error(`Status ${response.status}`);
      const data = await response.json();
      const items = data.alerts || [];
      if (items.length > 0) {
        setAlerts(items);
        setIsLiveBackend(true);
      }
      setLastUpdated(new Date());
    } catch {
      // Use tactical dataset (no override — keep current live-simulated state if already running)
      setAlerts((curr) => curr.length > 0 ? curr : TACTICAL_ALERTS);
    } finally {
      setLoadingAlerts(false);
    }
  };

  const loadIncidentCounts = async () => {
    try {
      setIncidentLoading(true);
      const response = await fetch(`${API_BASE}/api/v1/incidents/count`);
      if (!response.ok) throw new Error(`Status ${response.status}`);
      const data = await response.json();
      setOpenIncidents(Number(data.open_incidents || 0));
      setIsLiveBackend(true);
    } catch {
      setOpenIncidents(TACTICAL_INCIDENTS.filter((i) => i.status === "OPEN").length);
    } finally {
      setIncidentLoading(false);
    }
  };

  const loadRescueTeamCount = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/rescue-teams/count`);
      if (!response.ok) throw new Error(`Status ${response.status}`);
      const data = await response.json();
      setRescueTeamCount({
        available: Number(data.available || 0),
        en_route: Number(data.en_route || 0),
        deployed: Number(data.deployed || 0),
        busy: Number(data.busy || 0),
        offline: Number(data.offline || 0),
        total: Number(data.total || 0),
      });
      setIsLiveBackend(true);
    } catch {
      // Fallback
    }
  };

  const loadDispatches = async () => {
    try {
      setDispatchLoading(true);
      const [listRes, countRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/dispatches?limit=50&offset=0`),
        fetch(`${API_BASE}/api/v1/dispatches/count`),
      ]);
      if (listRes.ok && countRes.ok) {
        const listData = await listRes.json();
        const countData = await countRes.json();
        if (listData.items?.length > 0) {
          setDispatches(listData.items);
          setDispatchStats({
            total: Number(countData.total || 0),
            assigned: Number(countData.assigned || 0),
            acknowledged: Number(countData.acknowledged || 0),
            en_route: Number(countData.en_route || 0),
            on_scene: Number(countData.on_scene || 0),
            completed: Number(countData.completed || 0),
            cancelled: Number(countData.cancelled || 0),
          });
          setIsLiveBackend(true);
        }
      }
    } catch {
      // Fallback keeps current dispatches
    } finally {
      setDispatchLoading(false);
    }
  };

  const loadIncidentRecords = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/incidents?limit=100&offset=0`);
      if (response.ok) {
        const data = await response.json();
        const items = data.items || data.incidents || [];
        if (items.length > 0) {
          setIncidentRecords(items);
          setSelectedIncidentRecordId((curr) =>
            items.some((i) => String(i.id) === String(curr)) ? curr : items[0]?.id || ""
          );
          setIsLiveBackend(true);
        }
      }
    } catch {
      // Fallback
    }
  };

  const refreshAllData = () => {
    soundAlerts.playPing();
    loadAlerts();
    loadIncidentCounts();
    loadRescueTeamCount();
    loadDispatches();
    loadIncidentRecords();
  };

  useEffect(() => {
    if (isAuthenticated) {
      refreshAllData();
    } else {
      // When not authenticated, keep all operational data blank and encrypted
      setAlerts([]);
      setIncidentRecords([]);
      setOpenIncidents(0);
      setDispatches([]);
      setDispatchStats({
        total: 0,
        assigned: 0,
        acknowledged: 0,
        en_route: 0,
        on_scene: 0,
        completed: 0,
        cancelled: 0,
      });
      setRescueTeamCount({
        available: 0,
        en_route: 0,
        deployed: 0,
        busy: 0,
        offline: 0,
        total: 0,
      });
      setSelectedIncidentRecordId("");
    }
  }, [isAuthenticated]);

  // ─── LIVE TELEMETRY SIMULATION ────────────────────────────────────────────
  // When backend is offline, simulate real-world alert fluctuations:
  // New alerts arrive, resolved ones drop off — count rises and falls naturally.
  const LIVE_ALERT_POOL = [
    {
      id: "live-flood-01",
      source: "IMD",
      alert_type: "Flash Flood Warning",
      headline: "Flash Flood Watch: Brahmaputra Basin Rising Fast",
      description: "Water levels at Dibrugarh gauge have crossed danger mark by 2.3m. Immediate evacuation of riverine villages ordered.",
      severity: "Extreme",
      area_name: "Dibrugarh, Assam",
      issued_at: new Date().toISOString(),
    },
    {
      id: "live-cyclone-02",
      source: "SACHET",
      alert_type: "Cyclone Red Alert",
      headline: "Cyclonic Circulation Intensifying Over Bay of Bengal",
      description: "Depression likely to intensify into a Deep Depression in 24 hours. Coastal Odisha and Andhra Pradesh on high alert.",
      severity: "Severe",
      area_name: "Bay of Bengal coastline",
      issued_at: new Date().toISOString(),
    },
    {
      id: "live-landslide-03",
      source: "NDMA",
      alert_type: "Landslide Advisory",
      headline: "High Landslide Risk: NH-48 Blocked Near Wayanad",
      description: "Continuous heavy rainfall has destabilised slopes along NH-48. Travellers advised to avoid night driving.",
      severity: "Severe",
      area_name: "Wayanad, Kerala",
      issued_at: new Date().toISOString(),
    },
    {
      id: "live-heatwave-04",
      source: "IMD",
      alert_type: "Heatwave Warning",
      headline: "Heatwave Conditions Expected in Vidarbha Region",
      description: "Maximum temperatures likely to touch 45°C. NDMA urges shelters to remain open and water distribution active.",
      severity: "Moderate",
      area_name: "Vidarbha, Maharashtra",
      issued_at: new Date().toISOString(),
    },
    {
      id: "live-earthquake-05",
      source: "NCS",
      alert_type: "Earthquake Alert",
      headline: "Magnitude 4.2 Tremors Reported in Chamoli Region",
      description: "Light tremors felt in Chamoli district at 08:47 IST. No structural damage reported yet. Authorities on standby.",
      severity: "Moderate",
      area_name: "Chamoli, Uttarakhand",
      issued_at: new Date().toISOString(),
    },
    {
      id: "live-drought-06",
      source: "CWC",
      alert_type: "Drought Advisory",
      headline: "Severe Drought Conditions in 14 Districts of Rajasthan",
      description: "Reservoir storage at 12% capacity. NDRF teams pre-positioned. State DM has requested central assistance.",
      severity: "Moderate",
      area_name: "Eastern Rajasthan",
      issued_at: new Date().toISOString(),
    },
    {
      id: "live-storm-07",
      source: "IMD",
      alert_type: "Thunderstorm Alert",
      headline: "Isolated Severe Thunderstorms Across Bengal Delta Tonight",
      description: "Lightning probability 80%. Wind gusts up to 70 kmph expected. SDMA has alerted disaster response units.",
      severity: "Severe",
      area_name: "West Bengal Delta",
      issued_at: new Date().toISOString(),
    },
    {
      id: "live-flood-08",
      source: "CWC",
      alert_type: "Riverine Flood Alert",
      headline: "Mahanadi Flood Gates Opened — Downstream Villages Warned",
      description: "Hirakud Dam gates opened due to heavy inflow. 38 villages in Sambalpur district to be affected within 6 hours.",
      severity: "Extreme",
      area_name: "Sambalpur, Odisha",
      issued_at: new Date().toISOString(),
    },
  ];

  // Real-time alert simulation: every 45 seconds, probabilistically add/remove an alert
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(() => {
      setAlerts((current) => {
        if (current.length === 0) return current;

        const rand = Math.random();

        // ~40% chance: add a new live alert from pool (if not already present)
        if (rand < 0.40) {
          const available = LIVE_ALERT_POOL.filter(
            (a) => !current.some((c) => c.id === a.id)
          );
          if (available.length > 0) {
            const pick = available[Math.floor(Math.random() * available.length)];
            const newAlert = {
              ...pick,
              id: `${pick.id}-${Date.now()}`,
              issued_at: new Date().toISOString(),
            };
            soundAlerts.playPing?.();
            setLastUpdated(new Date());
            return [newAlert, ...current];
          }
        }

        // ~30% chance: resolve (remove) the oldest non-TACTICAL alert
        if (rand >= 0.40 && rand < 0.70 && current.length > 8) {
          const removable = current.filter((a) =>
            !a.id.startsWith("alert-sachet") &&
            !a.id.startsWith("alert-imd") &&
            !a.id.startsWith("alert-cwc") &&
            !a.id.startsWith("alert-usgs")
          );
          if (removable.length > 0) {
            const toRemove = removable[removable.length - 1];
            setLastUpdated(new Date());
            return current.filter((a) => a.id !== toRemove.id);
          }
        }

        // ~30% chance: do nothing this tick (steady state)
        return current;
      });
    }, 45000); // every 45 seconds

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Polling: refetch from backend every 60 seconds (keeps live data fresh)
  useEffect(() => {
    if (!isAuthenticated) return;

    const poll = setInterval(() => {
      loadAlerts();
      loadIncidentCounts();
      loadRescueTeamCount();
    }, 60000); // every 60 seconds

    return () => clearInterval(poll);
  }, [isAuthenticated]);

  // Mirror operational state to offline storage (Power-cut & grid resilience)
  useEffect(() => {
    if (isAuthenticated && (alerts.length > 0 || incidentRecords.length > 0 || dispatches.length > 0)) {
      offlineStorage.saveCommandSnapshot({
        alerts,
        incidents: incidentRecords,
        dispatches,
      });
    }
  }, [isAuthenticated, alerts, incidentRecords, dispatches]);

  // Network & power reconnection listener
  useEffect(() => {
    const handleOnline = async () => {
      setIsGridOnline(true);
      const res = await offlineStorage.syncOfflineOutbox();
      if (res.synced > 0) {
        soundAlerts.playPing();
      }
    };
    const handleOffline = () => {
      setIsGridOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleRestoreFromSnapshot = (snapshot) => {
    if (snapshot) {
      if (snapshot.alerts && snapshot.alerts.length > 0) {
        setAlerts(snapshot.alerts);
        // alertTotal auto-derived from alerts.length
      }
      if (snapshot.incidents && snapshot.incidents.length > 0) {
        setIncidentRecords(snapshot.incidents);
        setOpenIncidents(snapshot.incidents.length);
        setSelectedIncidentRecordId(snapshot.incidents[0]?.id || "");
      }
      if (snapshot.dispatches && snapshot.dispatches.length > 0) {
        setDispatches(snapshot.dispatches);
      }
      soundAlerts.playPing();
    }
  };

  // WebSocket Live Updates
  useEffect(() => {
    let ws = null;
    let reconnectTimer = null;
    let isUnmounted = false;

    const connect = () => {
      if (isUnmounted) return;
      try {
        ws = new WebSocket(WS_URL);
        ws.onopen = () => {
          setWsConnected(true);
          setIsLiveBackend(true);
        };
        ws.onmessage = (evt) => {
          try {
            const data = JSON.parse(evt.data);
            if (data.type === "government_alert" && data.alert) {
              setAlerts((prev) => [data.alert, ...prev.filter((a) => a.id !== data.alert.id)]);
              // alertTotal auto-derived from alerts.length — no manual increment needed
              soundAlerts.playCriticalSiren();
            } else if (data.type === "new_incident") {
              loadIncidentRecords();
              loadIncidentCounts();
              soundAlerts.playPing();
            } else if (data.type === "new_dispatch" || data.type === "dispatch_status_update") {
              loadDispatches();
              loadRescueTeamCount();
              soundAlerts.playDispatchConfirmed();
            }
          } catch {
            // Non-JSON
          }
        };
        ws.onerror = () => setWsConnected(false);
        ws.onclose = () => {
          setWsConnected(false);
          if (!isUnmounted) {
            reconnectTimer = setTimeout(connect, 6000);
          }
        };
      } catch {
        setWsConnected(false);
      }
    };

    connect();

    return () => {
      isUnmounted = true;
      clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, []);

  // -------------------------------------------------------------
  // DISPATCH OPERATIONS HANDLERS
  // -------------------------------------------------------------
  const openDispatchModalForIncident = async (incidentId = "") => {
    setShowDispatchModal(true);
    setDispatchFormError("");
    setDispatchFormSuccess("");
    setSelectedIncident(incidentId || incidentRecords[0]?.id || "");
    setSelectedTeam("");
    setDispatchPriority("HIGH");
    setDispatchInstructions("");

    try {
      setDispatchFormLoading(true);
      const [incRes, teamsRes, offRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/incidents?limit=100&offset=0`),
        fetch(`${API_BASE}/api/v1/rescue-teams?status=AVAILABLE&limit=100&offset=0`),
        fetch(`${API_BASE}/api/v1/officials?limit=100&offset=0`),
      ]);

      if (incRes.ok && teamsRes.ok && offRes.ok) {
        const incData = await incRes.json();
        const teamsData = await teamsRes.json();
        const offData = await offRes.json();

        setDispatchIncidents(incData.items || incData.incidents || TACTICAL_INCIDENTS);
        setDispatchTeams(teamsData.items || teamsData.teams || TACTICAL_RESCUE_TEAMS);
        const dispatchers = (offData.officials || TACTICAL_OFFICIALS).filter(
          (o) => o.role === "ROLE_DISPATCHER" || o.role === "ROLE_ADMIN"
        );
        setDispatchOfficials(dispatchers);
        setSelectedDispatcher(dispatchers[0]?.id || "");
      } else {
        throw new Error();
      }
    } catch {
      // Fallback
      setDispatchIncidents(TACTICAL_INCIDENTS);
      setDispatchTeams(TACTICAL_RESCUE_TEAMS.filter((t) => t.status === "AVAILABLE"));
      setDispatchOfficials(TACTICAL_OFFICIALS);
      setSelectedDispatcher(TACTICAL_OFFICIALS[1]?.id || TACTICAL_OFFICIALS[0]?.id);
    } finally {
      setDispatchFormLoading(false);
    }
  };

  const createDispatch = async () => {
    try {
      setDispatchFormLoading(true);
      setDispatchFormError("");
      setDispatchFormSuccess("");

      const incident = dispatchIncidents.find((i) => String(i.id) === String(selectedIncident));
      if (!incident) throw new Error("Select a valid open incident.");

      const payload = {
        incident_id: selectedIncident,
        team_id: selectedTeam,
        dispatcher_id: selectedDispatcher,
        latitude: Number(incident.latitude ?? 20.5937),
        longitude: Number(incident.longitude ?? 78.9629),
        priority: dispatchPriority,
        instructions: dispatchInstructions.trim() || undefined,
      };

      try {
        const response = await fetch(`${API_BASE}/api/v1/dispatches`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error();
      } catch {
        // In-memory fallback dispatch creation
        const teamObj = dispatchTeams.find((t) => String(t.id) === String(selectedTeam));
        const dispObj = dispatchOfficials.find((o) => String(o.id) === String(selectedDispatcher));
        const newDisp = {
          id: `disp-${Date.now().toString().slice(-4)}`,
          incident_id: selectedIncident,
          team_id: selectedTeam,
          priority: dispatchPriority,
          instructions: dispatchInstructions || "Emergency rescue response deployed.",
          status: "ASSIGNED",
          assigned_at: new Date().toISOString(),
          team_name: teamObj?.team_name || "Disaster Response Unit",
          incident_type: incident.incident_type || "INCIDENT",
          incident_severity: incident.severity || "HIGH",
          dispatcher_name: dispObj?.full_name || "Duty Dispatcher",
        };
        setDispatches((prev) => [newDisp, ...prev]);
        setDispatchStats((prev) => ({ ...prev, total: prev.total + 1, assigned: prev.assigned + 1 }));
      }

      soundAlerts.playDispatchConfirmed();
      setDispatchFormSuccess("Resource dispatch order confirmed! Battalion has been notified.");
      await Promise.all([loadDispatches(), loadRescueTeamCount()]);
      setTimeout(() => setShowDispatchModal(false), 900);
    } catch (err) {
      setDispatchFormError(err.message || "Failed to confirm dispatch order.");
    } finally {
      setDispatchFormLoading(false);
    }
  };

  const nextDispatchStatus = (status) => {
    const next = {
      ASSIGNED: "ACKNOWLEDGED",
      ACKNOWLEDGED: "EN_ROUTE",
      EN_ROUTE: "ON_SCENE",
      ON_SCENE: "COMPLETED",
    };
    return next[String(status || "").toUpperCase()] || null;
  };

  const updateDispatchStatus = async (dispatchId, newStatus) => {
    try {
      try {
        const response = await fetch(`${API_BASE}/api/v1/dispatches/${dispatchId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });
        if (!response.ok) throw new Error();
      } catch {
        // Fallback update in state
        setDispatches((prev) =>
          prev.map((d) => (String(d.id) === String(dispatchId) ? { ...d, status: newStatus } : d))
        );
      }
      soundAlerts.playDispatchConfirmed();
      await Promise.all([loadDispatches(), loadRescueTeamCount()]);
    } catch (err) {
      alert(err.message || "Failed to update dispatch status.");
    }
  };

  // Helper styles
  const getSeverityClass = (severity) => {
    switch (String(severity || "").toLowerCase()) {
      case "extreme":
      case "critical":
        return "border-rose-500/50 bg-rose-500/15 text-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.2)]";
      case "severe":
      case "high":
        return "border-orange-500/50 bg-orange-500/15 text-orange-400";
      case "moderate":
      case "medium":
        return "border-amber-500/50 bg-amber-500/15 text-amber-400";
      case "minor":
      case "low":
        return "border-sky-500/50 bg-sky-500/15 text-sky-400";
      default:
        return "border-slate-700 bg-slate-800 text-slate-300";
    }
  };

  const formatDate = (date) => {
    if (!date) return "—";
    try {
      return new Date(date).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "—";
    }
  };

  // Stat cards definitions
  const statCards = [
    {
      label: "Active Threats",
      value: isAuthenticated ? alerts.length : "0 (LOCKED)",
      sub: isAuthenticated ? "SACHET / IMD / CWC · Live" : "Requires Login",
      icon: Radio,
      color: "text-rose-400 border-rose-500/30 bg-rose-500/10",
      accent: "from-rose-500/20 to-transparent",
      live: isAuthenticated,
    },
    {
      label: "Open Incidents",
      value: isAuthenticated ? openIncidents : "0 (LOCKED)",
      sub: isAuthenticated ? "Active EOC registers" : "Requires Login",
      icon: Siren,
      color: "text-amber-400 border-amber-500/30 bg-amber-500/10",
      accent: "from-amber-500/20 to-transparent",
    },
    {
      label: "Units Deployed",
      value: isAuthenticated
        ? rescueTeamCount.deployed || dispatches.filter((d) => d.status === "EN_ROUTE" || d.status === "ON_SCENE").length
        : "0 (LOCKED)",
      sub: isAuthenticated ? "NDRF / SDRF in field" : "Requires Login",
      icon: Users,
      color: "text-sky-400 border-sky-500/30 bg-sky-500/10",
      accent: "from-sky-500/20 to-transparent",
    },
    {
      label: "Readiness Reserve",
      value: isAuthenticated ? rescueTeamCount.available || 3 : "0 (LOCKED)",
      sub: isAuthenticated ? "Battalions ready" : "Requires Login",
      icon: Activity,
      color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
      accent: "from-emerald-500/20 to-transparent",
    },
  ];

  if (currentPage === "landing") {
    return (
      <>
        <LandingPage
          onEnterCommand={() => setCurrentPage("command")}
          onOpenCitizenPortal={() => setCurrentPage("citizen")}
          onOpenAIVision={() => setCurrentPage("ai-vision")}
          onOpenGIS={() => setCurrentPage("gis")}
          onOpenOperations={() => setCurrentPage("operations")}
          onOpenHelplines={() => setShowHelplineModal(true)}
          onOpenAuth={() => setShowAuthModal(true)}
        />
        <EmergencyHelplineModal
          isOpen={showHelplineModal}
          onClose={() => setShowHelplineModal(false)}
        />
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={() => setCurrentPage("command")}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#050b16] text-slate-200 font-sans relative selection:bg-indigo-500/40">
      {/* Background Ambient Glows */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[400px] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="absolute top-1/3 right-10 w-[500px] h-[500px] bg-rose-600/5 rounded-full blur-[160px] pointer-events-none -z-10" />

      {/* =======================================================
          TOP OFFICIAL GOVERNMENT BANNER
      ======================================================= */}
      <div className="border-b border-slate-800 bg-slate-950 px-4 py-1.5 text-[11px] text-slate-400 flex flex-wrap items-center justify-between z-50 relative">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setCurrentPage("landing")}
            className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 font-bold transition-colors"
          >
            <Home className="w-3.5 h-3.5" /> Portal Home
          </button>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5 text-slate-500" />
            <span>Government of India · Ministry of Home Affairs · National Disaster Management</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setShowHelplineModal(true)}
            className="flex items-center gap-1 text-rose-400 hover:text-rose-300 font-bold transition-colors"
          >
            <PhoneCall className="w-3 h-3 animate-pulse" /> Emergency Hotlines (112 / 1078)
          </button>
          <span className="hidden sm:inline text-slate-600">|</span>
          <span className="hidden sm:inline font-mono">EN-IN</span>
          <span className="hidden md:inline rounded bg-emerald-500/20 px-1.5 py-0.2 text-[9px] font-bold text-emerald-400 border border-emerald-500/30">
            PROTECTED EOC INFRASTRUCTURE
          </span>
        </div>
      </div>

      {/* =======================================================
          MASTER COMMAND HEADER
      ======================================================= */}
      <header className="border-b border-slate-800/80 bg-[#060c18]/90 backdrop-blur-xl sticky top-0 z-40">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-4 py-3 sm:px-6">
          {/* Logo & Platform Name */}
          <div
            onClick={() => setCurrentPage("landing")}
            className="flex items-center gap-3 cursor-pointer group"
            title="Click to visit National Portal Home"
          >
            <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-blue-600 to-indigo-800 shadow-lg shadow-indigo-600/30 group-hover:scale-105 transition-transform">
              <ShieldAlert className="h-6 w-6 text-white" />

            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight text-white group-hover:text-indigo-300 transition-colors">
                  AIDERS
                </h1>
                <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-black text-rose-300 border border-rose-500/40">
                  DEFCON 2
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-400">
                AI Disaster Intelligence & Emergency Response System
              </p>
            </div>
          </div>

          {/* Center: Live UTC & IST Synchronized Master Clocks */}
          <div className="hidden lg:flex items-center gap-5 border border-slate-800 rounded-xl bg-slate-950/60 px-4 py-1.5 backdrop-blur">
            <div className="text-left">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">UTC System Time</p>
              <p className="font-mono text-xs font-semibold text-slate-300">
                {currentTime.toUTCString().slice(17, 25)} UTC
              </p>
            </div>
            <div className="h-6 w-px bg-slate-800"></div>
            <div className="text-left">
              <p className="text-[9px] font-bold uppercase tracking-widest text-indigo-400">Indian Standard Time (IST)</p>
              <p className="font-mono text-xs font-semibold text-white">
                {currentTime.toLocaleTimeString("en-IN", { hour12: false })} IST
              </p>
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-3">
            {/* Audio Toggle */}
            <button
              type="button"
              onClick={handleToggleSound}
              title={soundEnabled ? "Mute alert acoustics" : "Enable critical alert siren sounds"}
              className={`rounded-lg border p-2 transition-all ${
                soundEnabled
                  ? "border-indigo-500/50 bg-indigo-500/20 text-indigo-300 shadow-md shadow-indigo-500/20"
                  : "border-slate-800 bg-slate-900 text-slate-500 hover:text-slate-300"
              }`}
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>


            {/* Offline Vault & Power-Cut Resilience Status Button */}
            <button
              type="button"
              onClick={() => setShowOfflineVaultModal(true)}
              title="AIDERS Offline Emergency Vault & Power-Loss Backup Manager (Click to inspect or download backup)"
              className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold font-mono transition-all ${
                isGridOnline
                  ? "bg-slate-900 border-slate-800 text-slate-300 hover:border-emerald-500/50 hover:text-emerald-300"
                  : "bg-amber-500/20 border-amber-500/50 text-amber-300 animate-pulse hover:bg-amber-500/30"
              }`}
            >
              <HardDrive className={`h-3.5 w-3.5 ${isGridOnline ? "text-emerald-400" : "text-amber-400"}`} />
              <span>{isGridOnline ? "VAULT SYNCED" : "OFFLINE VAULT ACTIVE"}</span>
            </button>


            {/* Official Auth Pill */}
            {isAuthenticated && user ? (
              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                title={`Signed in: ${user.name} (${user.roleLabel}) - Click to switch profile / sign out`}
                className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/90 p-1.5 hover:border-indigo-500 transition-all shadow-sm"
              >
                <img
                  src={user.picture}
                  alt={user.name}
                  className="h-7 w-7 rounded-lg object-cover border border-indigo-400"
                />
                <div className="hidden xl:block text-left pr-1.5">
                  <div className="flex items-center gap-1">
                    <p className="text-[11px] font-bold text-white leading-none">{user.name.split(" ")[0]}</p>
                    <span className="rounded bg-indigo-500/20 px-1 py-0.2 text-[8px] font-bold text-indigo-300">
                      GOV
                    </span>
                  </div>
                  <p className="text-[9px] text-slate-400 mt-0.5 leading-none">{user.roleLabel}</p>
                </div>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className="flex items-center gap-1.5 rounded-lg border border-indigo-500/50 bg-indigo-500/20 px-3 py-2 text-xs font-bold text-indigo-300 hover:bg-indigo-500/30 transition-all"
              >
                <Lock className="h-3.5 w-3.5 text-indigo-400" />
                <span className="hidden sm:inline">SIGN IN</span>
              </button>
            )}

            {/* Initiate Protocol Button */}
            <button
              type="button"
              onClick={() => openDispatchModalForIncident()}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-rose-600 to-rose-700 px-4 py-2 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-rose-600/30 hover:brightness-110 active:scale-95 transition-all"
            >
              <Siren className="h-4 w-4 animate-pulse" />
              <span className="hidden sm:inline">INITIATE DISPATCH</span>
              <span className="sm:hidden">DISPATCH</span>
            </button>

            {/* Mobile Hamburger Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden rounded-lg border border-slate-800 bg-slate-900 p-2 text-slate-300"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* =======================================================
            NAVIGATION TABS (DESKTOP)
        ======================================================= */}
        <nav className="hidden lg:flex border-t border-slate-800/60 bg-slate-950/40 px-6">
          <div className="mx-auto flex w-full max-w-[1500px] items-center gap-1 overflow-x-auto">
            {[
              { id: "landing", label: "Portal Home", icon: Home },
              { id: "command", label: "National Command Center", icon: ShieldAlert, badge: alertTotal },
              { id: "gis", label: "GIS Geospatial Intelligence Map", icon: Map },
              { id: "operations", label: "Incident & Dispatch Operations", icon: Siren, badge: dispatches.length },
              { id: "ai-vision", label: "AI Disaster Computer Vision", icon: BrainCircuit },
              { id: "citizen", label: "Citizen Emergency & SOS Portal", icon: Radio, alertHighlight: true },
              { id: "helplines", label: "Emergency Directory & SOPs", icon: PhoneCall },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = currentPage === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCurrentPage(tab.id)}
                  className={`flex items-center gap-2 border-b-2 py-3 px-4 text-xs font-bold uppercase tracking-wider transition-all ${
                    isActive
                      ? "border-indigo-500 text-white bg-indigo-500/10"
                      : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? "text-indigo-400" : "text-slate-500"}`} />
                  <span>{tab.label}</span>
                  {tab.badge != null && (
                    <span
                      className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] font-mono font-bold ${
                        isActive
                          ? "bg-indigo-500/30 text-indigo-300 border border-indigo-500/40"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                  {tab.alertHighlight && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* MOBILE NAVIGATION DRAWER */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-800 bg-[#060c18] p-4 space-y-2">
            {[
              { id: "landing", label: "National Portal Home", icon: Home },
              { id: "command", label: "Command Center Overview", icon: ShieldAlert },
              { id: "gis", label: "GIS Geospatial Intelligence Map", icon: Map },
              { id: "operations", label: "Operations & Dispatches", icon: Siren },
              { id: "ai-vision", label: "AI Computer Vision Lab", icon: BrainCircuit },
              { id: "citizen", label: "Citizen Emergency & SOS Portal", icon: Radio },
              { id: "helplines", label: "Emergency Directory & SOPs", icon: PhoneCall },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = currentPage === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setCurrentPage(tab.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl p-3 text-xs font-bold uppercase tracking-wider transition-all ${
                    isActive
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-900/60 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}

            <div className="pt-3 border-t border-slate-800 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowSitrepModal(true);
                  setMobileMenuOpen(false);
                }}
                className="flex-1 rounded-lg border border-slate-700 bg-slate-800 py-2.5 text-xs font-bold text-white text-center"
              >
                SITREP Report
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowHelplineModal(true);
                  setMobileMenuOpen(false);
                }}
                className="flex-1 rounded-lg bg-rose-600 py-2.5 text-xs font-bold text-white text-center"
              >
                Hotlines (112)
              </button>
            </div>
          </div>
        )}
      </header>

      {/* =======================================================
          LIVE THREAT TICKER RIBBON
      ======================================================= */}
      <div className="border-b border-slate-800 bg-slate-950/90 py-2 px-4 overflow-hidden flex items-center">
        <div className="flex shrink-0 items-center gap-2 mr-4 rounded bg-rose-500/20 px-2 py-0.5 border border-rose-500/40">
          <Radio className="h-3 w-3 text-rose-400 animate-pulse" />
          <span className="text-[10px] font-black tracking-widest text-rose-300 uppercase">
            LIVE ADVISORIES
          </span>
        </div>
        <div className="flex-1 overflow-x-auto whitespace-nowrap text-xs text-slate-300 custom-scrollbar flex items-center gap-6">
          {!isAuthenticated ? (
            <span className="inline-flex items-center gap-2 text-amber-400">
              <Lock className="h-3.5 w-3.5 text-amber-400" />
              <span className="font-semibold">
                RESTRICTED DEFENSE TELEMETRY — Live hazard bulletins are currently masked. Sign In or Register to unmask national warning feeds.
              </span>
            </span>
          ) : (
            TACTICAL_TICKER_ITEMS.map((item) => (
              <span key={item.id} className="inline-flex items-center gap-2">
                <span
                  className={`rounded px-1.5 py-0.2 text-[9px] font-bold ${
                    item.level === "CRITICAL"
                      ? "bg-rose-500/30 text-rose-300 border border-rose-500/40"
                      : item.level === "HIGH"
                      ? "bg-orange-500/30 text-orange-300 border border-orange-500/40"
                      : "bg-amber-500/30 text-amber-300"
                  }`}
                >
                  {item.level}
                </span>
                <span>{item.text}</span>
                <span className="text-slate-600">·</span>
              </span>
            ))
          )}
        </div>
      </div>

      {/* =======================================================
          MAIN CONTENT AREA (WITH SECURITY BLUR EFFECT WHEN UNLOGGED)
      ======================================================= */}
      <div className="relative min-h-[calc(100vh-140px)]">
        {/* Centered Government Terminal Security Screen when Unauthenticated */}
        {!isAuthenticated && (
          <div className="absolute inset-0 z-30 flex items-start justify-center pt-8 sm:pt-14 px-4 pointer-events-auto">
            <div className="w-full max-w-xl rounded-3xl border border-indigo-500/40 bg-[#060c18]/95 p-6 sm:p-8 text-center shadow-[0_0_100px_rgba(0,0,0,0.95)] backdrop-blur-2xl text-slate-200 animate-in fade-in zoom-in-95 duration-300">
              {/* Official Classification Tag */}
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3.5 py-1 text-[11px] font-bold text-amber-300 mb-4 uppercase tracking-wider">
                <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-ping"></span>
                <span>Restricted Defense Terminal · DEFCON 2</span>
              </div>

              {/* Animated Security Lock Motif */}
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/20 via-indigo-600/20 to-rose-600/20 border border-amber-500/40 text-amber-400 shadow-xl shadow-amber-500/10">
                <Lock className="h-8 w-8 animate-pulse" />
              </div>

              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white leading-tight">
                NATIONAL DISASTER COMMAND TERMINAL RESTRICTED
              </h2>
              <p className="text-[11px] font-bold text-indigo-400 uppercase tracking-widest mt-1">
                Government of India · Ministry of Home Affairs (NDMA)
              </p>

              <p className="mt-4 text-xs text-slate-300 leading-relaxed max-w-md mx-auto">
                Live disaster telemetry, IMD radar advisories, USGS seismic monitoring, and tactical rescue battalion dispatches are encrypted under National Cyber Security Directives. The whole dashboard is locked until identity verification.
              </p>

              {/* Action Buttons */}
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowAuthModal(true)}
                  className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 px-6 py-3 text-xs font-black uppercase tracking-wider text-white shadow-xl shadow-indigo-600/30 hover:brightness-110 active:scale-95 transition-all"
                >
                  <Lock className="h-4 w-4" />
                  <span>Sign In with Google / Gov ID</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowAuthModal(true)}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 px-5 py-3 text-xs font-bold text-slate-200 transition-colors"
                >
                  <UserCheck className="h-4 w-4 text-emerald-400" />
                  <span>Register Officer ID</span>
                </button>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                <button
                  type="button"
                  onClick={() => setCurrentPage("landing")}
                  className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 font-bold"
                >
                  <Home className="h-3.5 w-3.5" /> Return to Portal Home
                </button>
                <span className="text-[10px] text-slate-500 font-mono">CERT-In GUIDELINES COMPLIANT</span>
              </div>
            </div>
          </div>
        )}

        {/* Dashboard Main Container: WHOLE DASHBOARD IS BLURRED WHEN UNLOGGED */}
        <main
          className={`mx-auto max-w-[1500px] px-4 py-6 sm:px-6 transition-all duration-700 ${
            !isAuthenticated
              ? "filter blur-[8px] pointer-events-none select-none opacity-25 grayscale-[30%]"
              : "filter-none opacity-100 pointer-events-auto"
          }`}
        >
        {/* ===================================================
            VIEW 1: COMMAND CENTER (NATIONAL OVERVIEW)
        =================================================== */}
        {currentPage === "command" && (
          <div className="space-y-6">
            {/* Stat Cards Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {statCards.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div
                    key={stat.label}
                    className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur-md transition-all hover:border-slate-700 hover:bg-slate-900/60 shadow-xl group"
                  >
                    <div
                      className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${stat.accent} rounded-full blur-2xl -z-10 group-hover:scale-110 transition-transform`}
                    />
                    <div className="flex items-center justify-between mb-3">
                      <div className={`p-2.5 rounded-xl border ${stat.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        {stat.live && (
                          <span className="flex items-center gap-1">
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500"></span>
                            </span>
                            <span className="text-[9px] font-bold text-rose-400 uppercase tracking-wide">Live</span>
                          </span>
                        )}
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          {stat.sub}
                        </span>
                      </div>
                    </div>
                    <p className="text-3xl font-black text-white tracking-tight transition-all duration-500">{stat.value}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-400">{stat.label}</p>
                  </div>
                );
              })}
            </div>

            {/* GIS Map + Alert Feed Dual Columns */}
            <div className="grid gap-6 lg:grid-cols-[1fr_440px] items-stretch">
              {/* GIS Map Panel */}
              <div className="flex h-[680px] min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-md shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-2 text-blue-400">
                      <Map className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm tracking-wide">
                        Geospatial Intelligence Map
                      </h3>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                        Real-time Sensors & Disaster Polygons
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCurrentPage("gis")}
                      className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-slate-200 hover:bg-slate-700 transition-colors"
                    >
                      EXPAND FULL MAP
                    </button>
                  </div>
                </div>

                <div className="relative min-h-0 flex-1 bg-slate-950">
                  <CommandMap onIncidentSelect={handleMapIncidentSelect} />
                  {!isAuthenticated && (
                    <div className="absolute inset-0 z-[1000] bg-slate-950/80 backdrop-blur-[2px] flex flex-col items-center justify-center p-6 text-center">
                      <div className="rounded-2xl border border-amber-500/30 bg-slate-900/90 p-5 max-w-sm shadow-2xl backdrop-blur-md">
                        <Lock className="h-6 w-6 text-amber-400 mx-auto mb-2" />
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                          Geospatial Map Layers Masked
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Sign in to unmask live disaster polygons, seismic pins & rescue units.
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowAuthModal(true)}
                          className="mt-3 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-indigo-500 transition-colors"
                        >
                          Sign In / Register
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Verified Government Alerts Feed */}
              <aside className="flex h-[680px] min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-md shadow-2xl">
                {/* Feed Header */}
                <div className="flex shrink-0 items-center justify-between border-b border-slate-800 bg-slate-950/80 px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-rose-400">
                      <Radio className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm tracking-wide">
                        SACHET Intel Feed
                      </h3>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                        Official Government Broadcasts
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={loadAlerts}
                    disabled={loadingAlerts}
                    title="Refresh alerts"
                    className="rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-50"
                  >
                    <RefreshCw className={`h-4 w-4 ${loadingAlerts ? "animate-spin" : ""}`} />
                  </button>
                </div>

                {/* Filter and Search Bar */}
                <div className="p-3 border-b border-slate-800 bg-slate-950/40 flex flex-col gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                    <input
                      type="text"
                      value={alertSearch}
                      onChange={(e) => setAlertSearch(e.target.value)}
                      placeholder="Search area, headline, hazard..."
                      className="w-full rounded-lg border border-slate-800 bg-slate-950 pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-600 outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 overflow-x-auto text-[10px] font-bold">
                    {["ALL", "EXTREME", "SEVERE", "MODERATE"].map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setAlertSeverityFilter(lvl)}
                        className={`rounded-md px-2.5 py-1 uppercase tracking-wider transition-all ${
                          alertSeverityFilter === lvl
                            ? "bg-indigo-600 text-white"
                            : "bg-slate-800/80 text-slate-400 hover:text-white"
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Alert Cards List */}
                <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                  {loadingAlerts ? (
                    <div className="flex h-full flex-col items-center justify-center text-slate-400">
                      <RefreshCw className="h-6 w-6 animate-spin text-indigo-500 mb-2" />
                      <p className="text-xs font-mono uppercase tracking-widest">
                        Syncing National Warning Network...
                      </p>
                    </div>
                  ) : sortedAlerts.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center text-slate-500 p-6 text-center">
                      {!isAuthenticated ? (
                        <>
                          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 mb-2 text-amber-400">
                            <Lock className="h-6 w-6" />
                          </div>
                          <p className="text-xs font-bold text-white uppercase tracking-wider">
                            Threat Bulletins Masked
                          </p>
                          <p className="text-[11px] text-slate-400 mt-1 max-w-xs leading-relaxed">
                            SACHET & IMD emergency threat feeds are masked until official authentication.
                          </p>
                          <button
                            type="button"
                            onClick={() => setShowAuthModal(true)}
                            className="mt-3 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-500 transition-colors"
                          >
                            Sign In / Register
                          </button>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-10 w-10 text-emerald-500/50 mb-2" />
                          <p className="text-xs font-bold text-slate-300">No Active Threats In Filter</p>
                          <p className="text-[11px] text-slate-500 mt-1">
                            All monitored sectors currently nominal.
                          </p>
                        </>
                      )}
                    </div>
                  ) : (
                    sortedAlerts.map((alert) => (
                      <article
                        key={alert.id || alert.external_id}
                        className="group relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60 p-4 transition-all hover:border-slate-600 hover:bg-slate-900/60 shadow-md"
                      >
                        <div
                          className={`absolute left-0 top-0 bottom-0 w-1 ${
                            alert.severity?.toLowerCase() === "extreme"
                              ? "bg-rose-500 shadow-[0_0_10px_#f43f5e]"
                              : alert.severity?.toLowerCase() === "severe"
                              ? "bg-orange-500"
                              : "bg-amber-500"
                          }`}
                        />
                        <div className="pl-2">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="rounded bg-slate-800 px-2 py-0.5 text-[9px] font-bold text-slate-300 border border-slate-700">
                              {alert.source || "SACHET"}
                            </span>
                            <span
                              className={`rounded border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${getSeverityClass(
                                alert.severity
                              )}`}
                            >
                              {alert.severity || "UNKNOWN"}
                            </span>
                          </div>

                          <h4 className="text-xs font-bold text-white leading-snug">
                            {alert.alert_type || alert.headline}
                          </h4>

                          <p className="mt-1 text-[11px] text-slate-300 line-clamp-2 leading-relaxed">
                            {alert.description || alert.headline}
                          </p>

                          <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-400">
                            <MapPin className="h-3 w-3 text-indigo-400 shrink-0" />
                            <span className="line-clamp-1">{alert.area_name || "National Sector"}</span>
                          </div>

                          <div className="mt-2 border-t border-slate-800/80 pt-2 flex items-center justify-between text-[10px] text-slate-500">
                            <span className="font-mono">ID: {String(alert.external_id || alert.id).slice(0, 10)}</span>
                            <span>{formatDate(alert.effective_at || alert.issued_at)}</span>
                          </div>
                        </div>
                      </article>
                    ))
                  )}
                </div>

                {/* Footer */}
                <div className="border-t border-slate-800 bg-slate-950/80 px-5 py-2.5 text-xs flex justify-between items-center text-slate-400">
                  <span className="font-mono">{sortedAlerts.length} Active Records</span>
                  <span className="text-[10px] font-mono text-slate-500">
                    LAST SYNC: {currentTime.toLocaleTimeString("en-IN")}
                  </span>
                </div>
              </aside>
            </div>

            {/* Quick Actions & Incident Summary Strip */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-md">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">
                    Emergency Operations Command Hub
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Coordinated response management across NDRF, SDRF, Coast Guard and State Fire Services
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setCurrentPage("operations")}
                    className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-500 transition-all shadow-md"
                  >
                    <Siren className="h-4 w-4" />
                    OPEN INCIDENTS & DISPATCHES
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage("ai-vision")}
                    className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-700 transition-all"
                  >
                    <BrainCircuit className="h-4 w-4 text-purple-400" />
                    AI DAMAGE LAB
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage("citizen")}
                    className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-xs font-bold text-rose-300 hover:bg-rose-500/20 transition-all"
                  >
                    <Radio className="h-4 w-4 text-rose-400" />
                    CITIZEN SOS PORTAL
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================
            VIEW 2: FULL-SCREEN GIS GEOSPATIAL MAP
        =================================================== */}
        {currentPage === "gis" && (
          <div className="flex flex-col h-[calc(100vh-160px)] rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-6 py-3.5">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-500/20 p-2 text-blue-400 border border-blue-500/30">
                  <Map className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">
                    Interactive Geospatial Intelligence GIS
                  </h3>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                    Full Subcontinent Telemetry: USGS, CWC, GSI Landslides & SACHET
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCurrentPage("command")}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-300 hover:text-white"
              >
                Back to Command
              </button>
            </div>
            <div className="flex-1 relative min-h-0 bg-slate-950">
              <CommandMap onIncidentSelect={handleMapIncidentSelect} />
              {!isAuthenticated && (
                <div className="absolute inset-0 z-[1000] bg-slate-950/80 backdrop-blur-[2px] flex flex-col items-center justify-center p-6 text-center">
                  <div className="rounded-2xl border border-amber-500/30 bg-slate-900/90 p-6 max-w-md shadow-2xl backdrop-blur-md">
                    <Lock className="h-8 w-8 text-amber-400 mx-auto mb-3" />
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                      Subcontinent GIS Telemetry Encrypted
                    </h4>
                    <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                      Live USGS seismic faults, CWC river hydrographs, and NDRF deployment coordinates are masked under emergency security protocols.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowAuthModal(true)}
                      className="mt-4 rounded-xl bg-gradient-to-r from-amber-500 to-indigo-600 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-indigo-600/30 hover:brightness-110 transition-all"
                    >
                      Sign In / Register to Decrypt GIS
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================================================
            VIEW 3: INCIDENT & DISPATCH OPERATIONS HUB
        =================================================== */}
        {currentPage === "operations" && (
          <div className="space-y-6">
            {/* Header Strip */}
            <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold text-indigo-300 border border-indigo-500/30 uppercase tracking-widest">
                    Tactical Operations Hub
                  </span>
                </div>
                <h2 className="text-2xl font-black text-white tracking-tight">
                  Disaster Incidents & Rescue Team Dispatches
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Manage active incident registers, track deployed rescue battalions, and update status lifecycles.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={refreshAllData}
                  className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-700 transition-all"
                >
                  <RefreshCw className="h-4 w-4" />
                  REFRESH REGISTERS
                </button>
                <button
                  type="button"
                  onClick={() => openDispatchModalForIncident()}
                  className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/30"
                >
                  <PlusCircle className="h-4 w-4" />
                  CREATE NEW DISPATCH
                </button>
              </div>
            </div>

            {/* Incident Register & Linked Operations Split Panel */}
            <div className="grid min-h-[450px] gap-6 lg:grid-cols-[1fr_1.3fr]">
              {/* Left: Incident Register List */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 backdrop-blur-md flex flex-col">
                <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Siren className="h-4 w-4 text-amber-400" />
                    <h3 className="font-bold text-sm text-white">Active Incident Register</h3>
                  </div>
                  <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-mono font-bold text-slate-400">
                    {isAuthenticated ? `${incidentRecords.length} LOGGED` : "0 (LOCKED)"}
                  </span>
                </div>

                <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[500px] custom-scrollbar pr-1">
                  {!isAuthenticated ? (
                    <div className="p-8 text-center text-slate-400">
                      <Lock className="h-7 w-7 text-amber-400 mx-auto mb-2" />
                      <p className="text-xs font-bold text-white uppercase tracking-wider">
                        0 Incident Registers Visible
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
                        Operational incident registers require authorized command authentication.
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowAuthModal(true)}
                        className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 transition-colors shadow-md"
                      >
                        Sign In / Register
                      </button>
                    </div>
                  ) : incidentRecords.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500">
                      No active incident records in system.
                    </div>
                  ) : (
                    incidentRecords.map((inc) => {
                    const isSelected = String(inc.id) === String(selectedIncidentRecordId);
                    return (
                      <button
                        type="button"
                        key={inc.id}
                        onClick={() => setSelectedIncidentRecordId(inc.id)}
                        className={`w-full rounded-xl border p-4 text-left transition-all ${
                          isSelected
                            ? "border-indigo-500 bg-indigo-500/15 shadow-lg shadow-indigo-500/10"
                            : "border-slate-800 bg-slate-950/60 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold text-white leading-tight">
                            {inc.title || inc.incident_type}
                          </span>
                          <span
                            className={`rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${getSeverityClass(
                              inc.severity
                            )}`}
                          >
                            {inc.severity || "HIGH"}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                          {inc.description || "Field incident report awaiting response."}
                        </p>
                        <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-800/80 pt-2 font-mono">
                          <span>{inc.source || "AIDERS"}</span>
                          <span>{formatDate(inc.occurred_at || inc.reported_at)}</span>
                        </div>
                      </button>
                    );
                  }))}
                </div>
              </div>

              {/* Right: Selected Incident Operational Breakdown */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-md flex flex-col justify-between">
                {selectedIncidentRecord ? (
                  <div className="space-y-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-slate-800 pb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className={`rounded px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getSeverityClass(
                              selectedIncidentRecord.severity
                            )}`}
                          >
                            {selectedIncidentRecord.severity || "SEVERITY LEVEL"}
                          </span>
                          <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                            {selectedIncidentRecord.status || "OPEN"}
                          </span>
                        </div>
                        <h3 className="text-lg font-black text-white">
                          {selectedIncidentRecord.title || selectedIncidentRecord.incident_type}
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">
                          Source: {selectedIncidentRecord.source || "EOC Operations"}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => openDispatchModalForIncident(selectedIncidentRecord.id)}
                        className="rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-500 shadow-md transition-all"
                      >
                        Assign Rescue Team
                      </button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          Geo-Coordinates
                        </p>
                        <p className="mt-1 font-mono text-xs text-slate-200">
                          {selectedIncidentRecord.latitude != null
                            ? `${Number(selectedIncidentRecord.latitude).toFixed(4)}° N, ${Number(
                                selectedIncidentRecord.longitude
                              ).toFixed(4)}° E`
                            : "Coordinates pending"}
                        </p>
                      </div>

                      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          Disaster Category
                        </p>
                        <p className="mt-1 text-xs font-bold text-white">
                          {selectedIncidentRecord.incident_type || "GENERAL DISASTER"}
                        </p>
                      </div>
                    </div>

                    {/* Operational Dispatches Linked */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between">
                        <span>Mobilized Rescue Units ({selectedIncidentDispatches.length})</span>
                      </h4>

                      {selectedIncidentDispatches.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-xs text-slate-500">
                          No rescue unit has been assigned to this incident yet. Click "Assign Rescue Team" above to deploy.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {selectedIncidentDispatches.map((disp) => {
                            const nextSt = nextDispatchStatus(disp.status);
                            return (
                              <div
                                key={disp.id}
                                className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <h5 className="text-xs font-bold text-white">
                                      {disp.team_name}
                                    </h5>
                                    <p className="text-[11px] text-slate-400 mt-0.5">
                                      Dispatcher: {disp.dispatcher_name || "Duty Officer"} · Priority:{" "}
                                      <span className="font-bold text-rose-400">{disp.priority}</span>
                                    </p>
                                  </div>
                                  <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold text-indigo-300 border border-indigo-500/30">
                                    {disp.status}
                                  </span>
                                </div>

                                {disp.instructions && (
                                  <p className="mt-2 text-xs text-slate-300 bg-slate-900/50 p-2.5 rounded-lg border border-slate-800">
                                    {disp.instructions}
                                  </p>
                                )}

                                {nextSt && (
                                  <div className="mt-3 flex justify-end">
                                    <button
                                      type="button"
                                      onClick={() => updateDispatchStatus(disp.id, nextSt)}
                                      className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-500 transition-all"
                                    >
                                      Advance Status to: {nextSt.replace("_", " ")}
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="py-20 text-center text-slate-500 text-xs">
                    Select an incident from the register to inspect response operations.
                  </div>
                )}
              </div>
            </div>

            {/* Overall Dispatches Timeline List */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-md">
              <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-sky-400" />
                  <h3 className="font-bold text-sm text-white">All Active Resource Dispatches</h3>
                </div>
                <div className="flex gap-2">
                  {["ALL", "ASSIGNED", "EN_ROUTE", "ON_SCENE", "COMPLETED"].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setDispatchStatusFilter(st)}
                      className={`rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                        dispatchStatusFilter === st
                          ? "bg-sky-600 text-white"
                          : "bg-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      {st.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {!isAuthenticated ? (
                  <div className="col-span-full rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-10 text-center text-slate-400">
                    <Lock className="h-7 w-7 text-amber-400 mx-auto mb-2" />
                    <p className="text-sm font-bold text-white uppercase tracking-wider">
                      0 Resource Mobilization Orders Decrypted
                    </p>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
                      Tactical rescue battalion deployment tracking is classified under Emergency Operations Center protocols.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowAuthModal(true)}
                      className="mt-4 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-500 transition-colors shadow-md"
                    >
                      Sign In / Register
                    </button>
                  </div>
                ) : dispatches.length === 0 ? (
                  <div className="col-span-full rounded-xl border border-dashed border-slate-800 p-8 text-center text-xs text-slate-500">
                    No active resource dispatches recorded.
                  </div>
                ) : (
                  dispatches
                    .filter((d) => dispatchStatusFilter === "ALL" || d.status === dispatchStatusFilter)
                    .map((d) => {
                    const nextSt = nextDispatchStatus(d.status);
                    return (
                      <div
                        key={d.id}
                        className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="rounded bg-slate-800 px-2 py-0.5 text-[9px] font-bold text-slate-400 uppercase font-mono">
                              #{String(d.id).slice(0, 8)}
                            </span>
                            <span className="rounded bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold text-sky-300 border border-sky-500/30">
                              {d.status}
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-white">{d.team_name}</h4>
                          <p className="text-[11px] text-slate-400 mt-1">
                            Mission: {d.instructions || "Operational emergency response."}
                          </p>
                        </div>

                        {nextSt && (
                          <button
                            type="button"
                            onClick={() => updateDispatchStatus(d.id, nextSt)}
                            className="mt-3 w-full rounded-lg bg-indigo-600/80 hover:bg-indigo-600 py-1.5 text-[11px] font-bold text-white transition-all text-center"
                          >
                            Mark {nextSt.replace("_", " ")}
                          </button>
                        )}
                      </div>
                    );
                  }))}
              </div>
            </div>
          </div>
        )}

        {/* ===================================================
            VIEW 4: AI DISASTER COMPUTER VISION LAB
        =================================================== */}
        {currentPage === "ai-vision" && (
          <DisasterImageAnalyzer
            onIncidentCreated={(inc) => {
              loadIncidentRecords();
              loadIncidentCounts();
              setCurrentPage("operations");
            }}
          />
        )}

        {/* ===================================================
            VIEW 5: CITIZEN EMERGENCY & SOS PORTAL
        =================================================== */}
        {currentPage === "citizen" && (
          <CitizenDisasterReport
            onBackToCommand={() => setCurrentPage("command")}
            onNavigate={(page) => setCurrentPage(page)}
            onIncidentCreated={(incident) => {
              loadIncidentRecords();
              loadIncidentCounts();
              loadDispatches();
              loadRescueTeamCount();
            }}
          />
        )}

        {/* ===================================================
            VIEW 6: EMERGENCY DIRECTORY & SOPS
        =================================================== */}
        {currentPage === "helplines" && (
          <div className="py-4">
            <EmergencyHelplineModal isOpen={true} onClose={() => setCurrentPage("command")} />
          </div>
        )}
      </main>
      </div>

      {/* =======================================================
          MODALS
      ======================================================= */}
      {/* 1. Situation Report Modal */}
      <SituationReportModal
        isOpen={showSitrepModal}
        onClose={() => setShowSitrepModal(false)}
        alerts={alerts}
        incidents={incidentRecords}
        dispatches={dispatches}
        rescueTeamCount={rescueTeamCount}
      />

      {/* 2. Emergency Helplines Modal */}
      <EmergencyHelplineModal
        isOpen={showHelplineModal}
        onClose={() => setShowHelplineModal(false)}
      />

      {/* 3. Official Authentication & Google Sign-In Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />

      {/* 4. Offline Resilience & Power-Cut Emergency Vault Modal */}
      <OfflineVaultModal
        isOpen={showOfflineVaultModal}
        onClose={() => setShowOfflineVaultModal(false)}
        onRestoreSnapshot={handleRestoreFromSnapshot}
      />

      {/* 4. Create Dispatch Modal */}
      {showDispatchModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-6 py-4">
              <div>
                <h3 className="text-base font-bold text-white">Create Response Dispatch</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Mobilize available rescue battalion to active disaster sector
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDispatchModal(false)}
                className="rounded-lg border border-slate-700 p-2 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {dispatchFormError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                  {dispatchFormError}
                </div>
              )}
              {dispatchFormSuccess && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
                  {dispatchFormSuccess}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Target Incident
                </label>
                <select
                  value={selectedIncident}
                  onChange={(e) => setSelectedIncident(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs text-white outline-none focus:border-indigo-500"
                >
                  <option value="">Select open incident...</option>
                  {dispatchIncidents.map((inc) => (
                    <option key={inc.id} value={inc.id}>
                      {inc.title || inc.incident_type} ({inc.severity || "HIGH"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Available Rescue Battalion / Unit
                </label>
                <select
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs text-white outline-none focus:border-indigo-500"
                >
                  <option value="">Select available unit...</option>
                  {dispatchTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.team_name} · {team.organization || "NDRF"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Authorizing Dispatcher
                  </label>
                  <select
                    value={selectedDispatcher}
                    onChange={(e) => setSelectedDispatcher(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs text-white outline-none focus:border-indigo-500"
                  >
                    {dispatchOfficials.map((off) => (
                      <option key={off.id} value={off.id}>
                        {off.full_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Operational Priority
                  </label>
                  <select
                    value={dispatchPriority}
                    onChange={(e) => setDispatchPriority(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs text-white outline-none focus:border-indigo-500"
                  >
                    <option value="CRITICAL">CRITICAL (Immediate Peril)</option>
                    <option value="HIGH">HIGH (Urgent Response)</option>
                    <option value="MEDIUM">MEDIUM (Standard Tasking)</option>
                    <option value="LOW">LOW (Support Reserve)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Operational Mission Instructions
                </label>
                <textarea
                  value={dispatchInstructions}
                  onChange={(e) => setDispatchInstructions(e.target.value)}
                  rows={3}
                  placeholder="Specify evacuation sector, specialized boat/cutter equipment needed, radio contact channel..."
                  className="w-full resize-none rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowDispatchModal(false)}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={createDispatch}
                  disabled={dispatchFormLoading || !selectedIncident || !selectedTeam}
                  className="rounded-lg bg-indigo-600 px-6 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {dispatchFormLoading ? "Issuing Order..." : "ISSUE DISPATCH ORDER"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global CSS for Smooth Scrollbars & Map */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: rgba(15, 23, 42, 0.4); }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(71, 85, 105, 0.6); border-radius: 9999px; }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(99, 102, 241, 0.8); }
          `,
        }}
      />
    </div>
  );
}
