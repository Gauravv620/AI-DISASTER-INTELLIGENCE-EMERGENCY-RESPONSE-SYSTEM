import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  SlidersHorizontal,
  X,
  Siren,
  Radio,
  Layers,
  Info,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";

import { geocodeAlert, jitterCoords, alertIcon, severityColor } from "../services/geoLookup";



import {

  MapContainer,

  TileLayer,

  CircleMarker,

  Marker,

  Popup,

  LayersControl,

  LayerGroup,

  ZoomControl,

  Polygon,

  Circle,

} from "react-leaflet";

import L from "leaflet";



import "leaflet/dist/leaflet.css";
import { TACTICAL_ALERTS } from "../services/tacticalData";

const PROD_API_BASE = "https://ai-disaster-intelligence-emergency.onrender.com";
const isLocalhost =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "0.0.0.0");

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  (!isLocalhost || import.meta.env.PROD
    ? PROD_API_BASE
    : "http://127.0.0.1:8000");



/* ==========================================================

   EARTHQUAKE HELPERS

   ========================================================== */



function earthquakeColor(severity) {

  switch (String(severity || "").toUpperCase()) {

    case "CRITICAL":

      return "#dc2626";



    case "HIGH":

      return "#ef4444";



    case "MEDIUM":

      return "#f59e0b";



    default:

      return "#eab308";

  }

}



function earthquakeRadius(magnitude) {

  const value = Number(magnitude);



  if (!Number.isFinite(value)) {

    return 5;

  }



  if (value >= 6) {

    return 14;

  }



  if (value >= 5) {

    return 11;

  }



  if (value >= 4) {

    return 8;

  }



  return 5;

}



/* ==========================================================

   SACHET HELPERS

   ========================================================== */



function floodRiskColor(level) {
  switch (String(level || "").toUpperCase()) {
    case "CRITICAL":
      return "#991b1b";
    case "HIGH":
      return "#dc2626";
    case "MODERATE":
      return "#f59e0b";
    case "LOW":
      return "#22c55e";
    default:
      return "#64748b";
  }
}

function floodRiskRadius(level) {
  switch (String(level || "").toUpperCase()) {
    case "CRITICAL":
      return 12;
    case "HIGH":
      return 10;
    case "MODERATE":
      return 8;
    default:
      return 6;
  }
}

function normalizeFloodRisk(record, index) {
  if (!record || typeof record !== "object") {
    return null;
  }

  const latitude = Number(
    record.latitude ?? record.lat ?? record.mapLatitude
  );
  const longitude = Number(
    record.longitude ??
      record.lon ??
      record.lng ??
      record.mapLongitude
  );

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  const score = Number(
    record.risk_score ?? record.riskScore ?? record.score
  );

  return {
    ...record,
    mapLatitude: latitude,
    mapLongitude: longitude,
    mapRiskScore: Number.isFinite(score) ? score : null,
    mapRiskLevel:
      record.risk_level ?? record.riskLevel ?? "UNKNOWN",
    mapIndex: index,
  };
}

function sachetColor(severity) {

  switch (String(severity || "").toLowerCase()) {

    case "severe":

    case "critical":

      return "#dc2626";



    case "moderate":

    case "high":

      return "#f97316";



    case "minor":

    case "low":

      return "#eab308";



    default:

      return "#3b82f6";

  }

}



/* ==========================================================

   GENERAL HELPERS

   ========================================================== */



function formatDate(value) {

  if (!value) {

    return "Unknown";

  }



  const date = new Date(value);



  if (Number.isNaN(date.getTime())) {

    return value;

  }



  return date.toLocaleString();

}



/* ==========================================================

   SACHET POLYGON PARSER

   ========================================================== */



/*

 * CAP polygon format:

 *

 * "lat,lon lat,lon lat,lon ..."

 *

 * Only official coordinates supplied by the alert

 * are used. No geocoding is performed.

 */



function parseSachetPolygon(value) {

  if (!value || typeof value !== "string") {

    return null;

  }



  const coordinates = value

    .trim()

    .split(/\s+/)

    .map((pair) => {

      const parts = pair.split(",");



      if (parts.length !== 2) {

        return null;

      }



      const lat = Number(parts[0]);

      const lon = Number(parts[1]);



      if (

        !Number.isFinite(lat) ||

        !Number.isFinite(lon)

      ) {

        return null;

      }



      if (

        lat < -90 ||

        lat > 90 ||

        lon < -180 ||

        lon > 180

      ) {

        return null;

      }



      return [lat, lon];

    })

    .filter(Boolean);



  return coordinates.length >= 3

    ? coordinates

    : null;

}



/* ==========================================================

   SACHET CIRCLE PARSER

   ========================================================== */



/*

 * CAP circle format:

 *

 * "latitude,longitude radius"

 *

 * Radius is normally in kilometers.

 */



function parseSachetCircle(value) {

  if (!value || typeof value !== "string") {

    return null;

  }



  const parts = value.trim().split(/\s+/);



  if (parts.length < 2) {

    return null;

  }



  const coordinates = parts[0].split(",");



  if (coordinates.length !== 2) {

    return null;

  }



  const lat = Number(coordinates[0]);

  const lon = Number(coordinates[1]);

  const radiusKm = Number(parts[1]);



  if (

    !Number.isFinite(lat) ||

    !Number.isFinite(lon) ||

    !Number.isFinite(radiusKm)

  ) {

    return null;

  }



  if (

    lat < -90 ||

    lat > 90 ||

    lon < -180 ||

    lon > 180 ||

    radiusKm < 0

  ) {

    return null;

  }



  return {

    latitude: lat,

    longitude: lon,

    radiusMeters: radiusKm * 1000,

  };

}



/* ==========================================================

   SACHET GEOMETRY

   ========================================================== */



function getSachetGeometry(alert) {

  if (!alert) {

    return null;

  }



  /*

   * Future-proof support for backend GeoJSON.

   */



  if (

    alert.geometry &&

    typeof alert.geometry === "object"

  ) {

    /*

     * GeoJSON Polygon

     */



    if (

      alert.geometry.type === "Polygon" &&

      Array.isArray(alert.geometry.coordinates)

    ) {

      const polygonCoordinates =

        alert.geometry.coordinates[0];



      if (

        Array.isArray(polygonCoordinates) &&

        polygonCoordinates.length >= 3

      ) {

        return {

          type: "polygon",

          coordinates: polygonCoordinates.map(

            (coordinate) => [

              coordinate[1],

              coordinate[0],

            ]

          ),

        };

      }

    }



    /*

     * GeoJSON Point

     */



    if (

      alert.geometry.type === "Point" &&

      Array.isArray(alert.geometry.coordinates)

    ) {

      const [lon, lat] =

        alert.geometry.coordinates;



      if (

        Number.isFinite(Number(lat)) &&

        Number.isFinite(Number(lon))

      ) {

        return {

          type: "circle",

          latitude: Number(lat),

          longitude: Number(lon),

          radiusMeters: 5000,

        };

      }

    }

  }



  const raw = alert.raw_payload || {};



  /*

   * Official CAP polygon

   */



  if (raw.polygon) {

    const polygon = parseSachetPolygon(

      raw.polygon

    );



    if (polygon) {

      return {

        type: "polygon",

        coordinates: polygon,

      };

    }

  }



  /*

   * Official CAP circle

   */



  if (raw.circle) {

    const circle = parseSachetCircle(

      raw.circle

    );



    if (circle) {

      return {

        type: "circle",

        ...circle,

      };

    }

  }



  return null;

}



/* ==========================================================

   COMPONENT

   ========================================================== */



export default function CommandMap({ onIncidentSelect, alerts: propAlerts }) {
  /* ========================================================
     COLLAPSIBLE GIS & LEGEND PANEL STATE (TOP-RIGHT)
     ======================================================== */
  const [isGisPanelOpen, setIsGisPanelOpen] = useState(false);
  const [gisActiveTab, setGisActiveTab] = useState("gis"); // "gis" | "legend"
  const gisPanelRef = useRef(null);
  const gisButtonRef = useRef(null);

  /* ========================================================
     COLLAPSIBLE SACHET ALERTS PANEL STATE (LEFT-MIDDLE)
     ======================================================== */
  const [isSachetPanelOpen, setIsSachetPanelOpen] = useState(false);
  const sachetPanelRef = useRef(null);
  const sachetTabRef = useRef(null);

  // Close top-right GIS panel when clicking outside
  useEffect(() => {
    if (!isGisPanelOpen) return;
    function handleClickOutside(event) {
      if (
        gisPanelRef.current &&
        !gisPanelRef.current.contains(event.target) &&
        gisButtonRef.current &&
        !gisButtonRef.current.contains(event.target)
      ) {
        setIsGisPanelOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isGisPanelOpen]);

  // Close left-side SACHET panel when clicking outside
  useEffect(() => {
    if (!isSachetPanelOpen) return;
    function handleClickOutside(event) {
      if (
        sachetPanelRef.current &&
        !sachetPanelRef.current.contains(event.target) &&
        sachetTabRef.current &&
        !sachetTabRef.current.contains(event.target)
      ) {
        setIsSachetPanelOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isSachetPanelOpen]);


  /* ========================================================

     GSI STATE

     ======================================================== */



  const [landslides, setLandslides] = useState([]);



  const [landslideLoading, setLandslideLoading] =

    useState(true);



  const [landslideError, setLandslideError] =

    useState("");



  const [totalLandslides, setTotalLandslides] =

    useState(0);



  /* ========================================================

     USGS STATE

     ======================================================== */



  const [earthquakes, setEarthquakes] = useState([]);



  const [earthquakeLoading, setEarthquakeLoading] =

    useState(true);



  const [earthquakeError, setEarthquakeError] =

    useState("");



  const [totalEarthquakes, setTotalEarthquakes] =

    useState(0);



  /* ========================================================

     SACHET STATE

     ======================================================== */



  const [sachetAlerts, setSachetAlerts] =
    useState(propAlerts && propAlerts.length > 0 ? propAlerts : TACTICAL_ALERTS);

  const [sachetLoading, setSachetLoading] =
    useState(false);

  const [sachetError, setSachetError] =
    useState("");

  const [totalSachetAlerts, setTotalSachetAlerts] =
    useState(propAlerts && propAlerts.length > 0 ? propAlerts.length : TACTICAL_ALERTS.length);

  useEffect(() => {
    if (propAlerts && propAlerts.length > 0) {
      setSachetAlerts(propAlerts);
      setTotalSachetAlerts(propAlerts.length);
      setSachetError("");
    }
  }, [propAlerts]);



  /* ========================================================

     CWC WATER LEVEL STATE

     ======================================================== */



  const [cwcFloods, setCwcFloods] =

    useState([]);



  const [cwcFloodTotal, setCwcFloodTotal] =

    useState(0);



  const [cwcFloodLoading, setCwcFloodLoading] =

    useState(true);



  const [cwcFloodError, setCwcFloodError] =

    useState("");



  const [showCwcFloods, setShowCwcFloods] =

    useState(true);



  /* ========================================================

     CWC RAINFALL STATE

     ======================================================== */



  const [cwcRainfall, setCwcRainfall] =

    useState([]);



  const [cwcRainfallTotal, setCwcRainfallTotal] =

    useState(0);



  const [cwcRainfallLoading, setCwcRainfallLoading] =

    useState(true);



  const [cwcRainfallError, setCwcRainfallError] =

    useState("");
  const [showCwcRainfall, setShowCwcRainfall] =
    useState(true);

  /* ========================================================
     AIDERS FLOOD INTELLIGENCE STATE
     ======================================================== */

  const [floodRisk, setFloodRisk] = useState([]);
  const [floodRiskLoading, setFloodRiskLoading] =
    useState(true);
  const [floodRiskError, setFloodRiskError] =
    useState("");
  const [showFloodRisk, setShowFloodRisk] =
    useState(true);


  /* ========================================================
     LOAD AIDERS FLOOD INTELLIGENCE
     ======================================================== */

  useEffect(() => {
    let cancelled = false;

    async function loadFloodRisk() {
      try {
        setFloodRiskLoading(true);
        setFloodRiskError("");

        const response = await fetch(
          API_BASE +
            "/api/v1/ingestion/intelligence/flood-risk?limit=100"
        );

        if (!response.ok) {
          throw new Error(
            "AIDERS Flood Intelligence API returned " +
              response.status
          );
        }

        const data = await response.json();

        if (cancelled) {
          return;
        }

        setFloodRisk(
          Array.isArray(data.records)
            ? data.records
            : []
        );
      } catch (error) {
        console.error(
          "Failed to load AIDERS flood intelligence:",
          error
        );

        if (!cancelled) {
          setFloodRiskError(
            "Flood Intelligence API is unavailable."
          );
          setFloodRisk([]);
        }
      } finally {
        if (!cancelled) {
          setFloodRiskLoading(false);
        }
      }
    }

    loadFloodRisk();

    const refreshTimer = setInterval(
      loadFloodRisk,
      5 * 60 * 1000
    );

    return () => {
      cancelled = true;
      clearInterval(refreshTimer);
    };
  }, []);

  /* ========================================================
     CWC STATION HISTORY STATE
     ======================================================== */

  const [selectedCwcStation, setSelectedCwcStation] =
    useState(null);

  const [cwcStationHistory, setCwcStationHistory] =
    useState([]);

  const [cwcHistoryLoading, setCwcHistoryLoading] =
    useState(false);

  const [cwcHistoryError, setCwcHistoryError] =
    useState("");
/* ========================================================

     LOAD GSI LANDSLIDES

     ======================================================== */



  useEffect(() => {

    let cancelled = false;



    async function loadLandslides() {

      try {

        setLandslideLoading(true);

        setLandslideError("");



        const response = await fetch(

          API_BASE +

            "/api/v1/ingestion/landslides?limit=500&offset=0"

        );



        if (!response.ok) {

          throw new Error(

            "GSI Landslide API returned " +

              response.status

          );

        }



        const data = await response.json();



        if (cancelled) {

          return;

        }



        const records = Array.isArray(data.records)

          ? data.records

          : [];



        setLandslides(records);



        setTotalLandslides(

          Number(

            data.total || records.length

          )

        );

      } catch (error) {

        console.error(

          "Failed to load GSI landslides:",

          error

        );



        if (!cancelled) {

          setLandslideError(

            "Unable to load GSI landslide inventory."

          );

        }

      } finally {

        if (!cancelled) {

          setLandslideLoading(false);

        }

      }

    }



    loadLandslides();



    return () => {

      cancelled = true;

    };

  }, []);



  /* ========================================================

     LOAD USGS EARTHQUAKES

     ======================================================== */



  useEffect(() => {

    let cancelled = false;



    async function loadEarthquakes() {

      try {

        setEarthquakeLoading(true);

        setEarthquakeError("");



        const response = await fetch(

          API_BASE +

            "/api/v1/ingestion/earthquakes?limit=1000&offset=0"

        );



        if (!response.ok) {

          throw new Error(

            "USGS Earthquake API returned " +

              response.status

          );

        }



        const data = await response.json();



        if (cancelled) {

          return;

        }



        const records = Array.isArray(data.records)

          ? data.records

          : [];



        setEarthquakes(records);



        setTotalEarthquakes(

          Number(

            data.total || records.length

          )

        );

      } catch (error) {

        console.error(

          "Failed to load USGS earthquakes:",

          error

        );



        if (!cancelled) {

          setEarthquakeError(

            "Unable to load USGS earthquake data."

          );

        }

      } finally {

        if (!cancelled) {

          setEarthquakeLoading(false);

        }

      }

    }



    loadEarthquakes();



    return () => {

      cancelled = true;

    };

  }, []);



  /* ========================================================

     LOAD CWC HISTORICAL WATER LEVELS

     ======================================================== */



  useEffect(() => {

    let cancelled = false;



    async function loadCwcFloods() {

      try {

        setCwcFloodLoading(true);

        setCwcFloodError("");



        const response = await fetch(

          API_BASE +

            "/api/v1/ingestion/cwc/stations?limit=500&offset=0"

        );



        if (!response.ok) {

          throw new Error(

            "CWC Water Level API returned " +

              response.status

          );

        }



        const data = await response.json();



        if (cancelled) {

          return;

        }



        const records = Array.isArray(data.records)

          ? data.records

          : [];



        setCwcFloods(records);



setCwcFloodTotal(

  Number(

    data.total_stations ||

      records.length

  )

);

      } catch (error) {

        console.error(

          "Failed to load CWC water levels:",

          error

        );



        if (!cancelled) {

          setCwcFloodError(

            "Unable to load CWC historical water-level data."

          );

        }

      } finally {

        if (!cancelled) {

          setCwcFloodLoading(false);

        }

      }

    }



    loadCwcFloods();



    return () => {

      cancelled = true;

    };

  }, []);



  /* ========================================================

     LOAD CWC HISTORICAL RAINFALL

     ======================================================== */



  useEffect(() => {

    let cancelled = false;



    async function loadCwcRainfall() {

      try {

        setCwcRainfallLoading(true);

        setCwcRainfallError("");



        const response = await fetch(

          API_BASE +

            "/api/v1/ingestion/cwc/rainfall?limit=500&offset=0"

        );



        if (!response.ok) {

          throw new Error(

            "CWC Rainfall API returned " +

              response.status

          );

        }



        const data = await response.json();



        if (cancelled) {

          return;

        }



        const records = Array.isArray(data.records)

          ? data.records

          : [];



        setCwcRainfall(records);



        setCwcRainfallTotal(

          Number(

            data.total || records.length

          )

        );

      } catch (error) {

        console.error(

          "Failed to load CWC rainfall:",

          error

        );



        if (!cancelled) {

          setCwcRainfallError(

            "Unable to load CWC historical rainfall data."

          );

        }

      } finally {

        if (!cancelled) {

          setCwcRainfallLoading(false);

        }

      }

    }



    loadCwcRainfall();



    return () => {

      cancelled = true;

    };

  }, []);
  /* ========================================================
     LOAD CWC STATION HISTORY
     ======================================================== */

  async function loadCwcStationHistory(station) {
    if (!station?.station_name) {
      return;
    }

    try {
      setSelectedCwcStation(station);
      setCwcHistoryLoading(true);
      setCwcHistoryError("");
      setCwcStationHistory([]);

      const stationName = encodeURIComponent(
        station.station_name
      );

      const response = await fetch(
        `${API_BASE}/api/v1/ingestion/cwc/stations/${stationName}/history?limit=100&offset=0`
      );

      if (!response.ok) {
        throw new Error(
          `CWC station history API returned ${response.status}`
        );
      }

      const data = await response.json();

      const records = Array.isArray(data.records)
        ? data.records
        : [];

      // Backend returns newest first; chart oldest -> newest.
      setCwcStationHistory([...records].reverse());
    } catch (error) {
      console.error(
        "Failed to load CWC station history:",
        error
      );

      setCwcHistoryError(
        "Unable to load CWC station history."
      );
    } finally {
      setCwcHistoryLoading(false);
    }
  }

  /* ========================================================
     LOAD SACHET ALERTS
     ======================================================== */




  async function loadSachetAlerts() {

    try {

      setSachetLoading(true);

      setSachetError("");



      const response = await fetch(

        API_BASE +

          "/api/v1/alerts?limit=500"

      );



      if (!response.ok) {

        throw new Error(

          "SACHET Alert API returned " +

            response.status

        );

      }



      const data = await response.json();

      const alerts = Array.isArray(data.alerts)
        ? data.alerts
        : [];

      if (alerts.length > 0) {
        setSachetAlerts(alerts);
        setTotalSachetAlerts(
          Number(
            data.total || alerts.length
          )
        );
      } else {
        setSachetAlerts((curr) => (curr && curr.length > 0 ? curr : TACTICAL_ALERTS));
        setTotalSachetAlerts((curr) => (curr > 0 ? curr : TACTICAL_ALERTS.length));
      }
    } catch (error) {
      console.warn(
        "Live SACHET stream unavailable, running active tactical telemetry fallback:",
        error
      );

      setSachetAlerts((curr) => (curr && curr.length > 0 ? curr : TACTICAL_ALERTS));
      setTotalSachetAlerts((curr) => (curr > 0 ? curr : TACTICAL_ALERTS.length));
      setSachetError("");
    } finally {
      setSachetLoading(false);
    }

  }



  /* ========================================================

     INITIAL SACHET LOAD

     ======================================================== */



  useEffect(() => {
    loadSachetAlerts();
    const interval = setInterval(loadSachetAlerts, 60000);
    return () => clearInterval(interval);
  }, []);



  /* ========================================================

     SACHET WEBSOCKET

     ======================================================== */



  useEffect(() => {

    let socket;

    let reconnectTimer;



    function connectWebSocket() {

      try {
        const dynamicWsUrl =
          import.meta.env.VITE_WS_URL ||
          (import.meta.env.VITE_API_BASE
            ? import.meta.env.VITE_API_BASE.replace(/^http/, "ws") + "/ws/alerts"
            : (!isLocalhost || import.meta.env.PROD
                ? "wss://ai-disaster-intelligence-emergency.onrender.com/ws/alerts"
                : "ws://127.0.0.1:8000/ws/alerts"));

        socket = new WebSocket(dynamicWsUrl);



        socket.onopen = () => {

          console.log(

            "AIDERS live alert stream connected"

          );

        };



        socket.onmessage = (event) => {

          try {

            const message = JSON.parse(

              event.data

            );



            console.log(

              "AIDERS WebSocket message:",

              message

            );



            if (

              message.type ===

              "new_alerts"

            ) {

              loadSachetAlerts();

            }

          } catch (error) {

            console.error(

              "WebSocket message parsing error:",

              error

            );

          }

        };



        socket.onerror = (error) => {

          console.error(

            "AIDERS WebSocket error:",

            error

          );

        };



        socket.onclose = () => {

          console.log(

            "AIDERS live alert stream disconnected"

          );



          reconnectTimer = setTimeout(() => {

            connectWebSocket();

          }, 5000);

        };

      } catch (error) {

        console.error(

          "WebSocket connection failed:",

          error

        );

      }

    }



    connectWebSocket();



    return () => {

      if (reconnectTimer) {

        clearTimeout(reconnectTimer);

      }



      if (socket) {

        socket.close();

      }

    };

  }, []);



  /* ========================================================

     VALID GSI LANDSLIDES

     ======================================================== */



  const validLandslides = useMemo(() => {

    return landslides

      .map((slide, index) => {

        const latitude = Number(

          slide.latitude ??

            slide.latitude_postgis

        );



        const longitude = Number(

          slide.longitude ??

            slide.longitude_postgis

        );



        if (

          !Number.isFinite(latitude) ||

          !Number.isFinite(longitude)

        ) {

          return null;

        }



        if (

          latitude < -90 ||

          latitude > 90 ||

          longitude < -180 ||

          longitude > 180

        ) {

          return null;

        }



        return {

          ...slide,

          mapLatitude: latitude,

          mapLongitude: longitude,

          mapIndex: index,

        };

      })

      .filter(Boolean);

  }, [landslides]);



  /* ========================================================

     VALID USGS EARTHQUAKES

     ======================================================== */



  const validEarthquakes = useMemo(() => {

    return earthquakes

      .map((earthquake, index) => {

        const latitude = Number(

          earthquake.latitude

        );



        const longitude = Number(

          earthquake.longitude

        );



        const magnitude = Number(

          earthquake.magnitude

        );



        if (

          !Number.isFinite(latitude) ||

          !Number.isFinite(longitude)

        ) {

          return null;

        }



        if (

          latitude < -90 ||

          latitude > 90 ||

          longitude < -180 ||

          longitude > 180

        ) {

          return null;

        }



        return {

          ...earthquake,

          mapLatitude: latitude,

          mapLongitude: longitude,

          mapMagnitude:

            Number.isFinite(magnitude)

              ? magnitude

              : null,

          mapIndex: index,

        };

      })

      .filter(Boolean);

  }, [earthquakes]);



  /* ========================================================

     VALID CWC WATER LEVELS

     ======================================================== */



  const validCwcFloods = useMemo(() => {

    return cwcFloods

      .map((flood, index) => {

        const latitude = Number(

          flood.latitude

        );



        const longitude = Number(

          flood.longitude

        );



        const waterLevel = Number(

          flood.water_level

        );



        if (

          !Number.isFinite(latitude) ||

          !Number.isFinite(longitude)

        ) {

          return null;

        }



        if (

          latitude < -90 ||

          latitude > 90 ||

          longitude < -180 ||

          longitude > 180

        ) {

          return null;

        }



        return {

          ...flood,

          mapLatitude: latitude,

          mapLongitude: longitude,

          mapWaterLevel:

            Number.isFinite(waterLevel)

              ? waterLevel

              : null,

          mapIndex: index,

        };

      })

      .filter(Boolean);

  }, [cwcFloods]);



  /* ========================================================

     VALID CWC RAINFALL

     ======================================================== */



  const validCwcRainfall = useMemo(() => {

    return cwcRainfall

      .map((rainfall, index) => {

        const latitude = Number(

          rainfall.latitude

        );



        const longitude = Number(

          rainfall.longitude

        );



        const rainfallMm = Number(

          rainfall.rainfall_mm

        );



        if (

          !Number.isFinite(latitude) ||

          !Number.isFinite(longitude)

        ) {

          return null;

        }



        if (

          latitude < -90 ||

          latitude > 90 ||

          longitude < -180 ||

          longitude > 180

        ) {

          return null;

        }



        return {

          ...rainfall,

          mapLatitude: latitude,

          mapLongitude: longitude,

          mapRainfallMm:

            Number.isFinite(rainfallMm)

              ? rainfallMm

              : null,

          mapIndex: index,

        };

      })

      .filter(Boolean);

  }, [cwcRainfall]);



  /* ========================================================

     VALID SACHET ALERTS

     ONLY OFFICIAL GEOMETRY

     ======================================================== */



  /* ========================================================
     VALID AIDERS FLOOD INTELLIGENCE
     ======================================================== */

  const validFloodRisk = useMemo(() => {
    return floodRisk
      .map((record, index) =>
        normalizeFloodRisk(record, index)
      )
      .filter(Boolean);
  }, [floodRisk]);

  const validSachetAlerts = useMemo(() => {

    return sachetAlerts

      .map((alert, index) => {

        const geometry =

          getSachetGeometry(alert);



        if (!geometry) {

          return null;

        }



        return {

          ...alert,

          mapGeometry: geometry,

          mapIndex: index,

        };

      })

      .filter(Boolean);

  }, [sachetAlerts]);



  /* ========================================================

     NON-MAPPED SACHET ALERTS

     ======================================================== */



  const nonMappedSachetAlerts =

    useMemo(() => {

      return sachetAlerts.filter(

        (alert) =>

          !getSachetGeometry(alert)

      );

    }, [sachetAlerts]);

  /* ========================================================
     GEOCODED LIVE ALERTS (all alerts without official geometry)
     Uses geoLookup.js to place markers on the map even when
     the SACHET/IMD/CWC/USGS alert has no geometry field.
     ======================================================== */

  const geocodedAlerts = useMemo(() => {
    return sachetAlerts
      .filter((a) => !getSachetGeometry(a)) // only those without official geo
      .map((alert) => {
        const coords = geocodeAlert(
          alert.area_name || "",
          alert.description || alert.headline || ""
        );
        if (!coords) return null;
        const [lat, lng] = jitterCoords(coords[0], coords[1], alert.id || alert.external_id || "");
        return { ...alert, _lat: lat, _lng: lng };
      })
      .filter(Boolean);
  }, [sachetAlerts]);



  /* ========================================================

     RENDER

     ======================================================== */



  return (

    <div className="relative h-full w-full">



      <MapContainer

        center={[22.5, 79.0]}

        zoom={5}

        minZoom={4}

        maxZoom={13}

        scrollWheelZoom={true}

        zoomControl={false}

        className="h-full w-full"

      >



        {/* ==================================================

            OPENSTREETMAP

            ================================================== */}



        <TileLayer

          attribution="&copy; OpenStreetMap contributors"

          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"

        />



        <ZoomControl position="bottomleft" />



        {/* ==================================================

            MAP LAYERS

            ================================================== */}



        <LayersControl position="topright">



          {/* ==================================================

              GSI LANDSLIDES

              ================================================== */}



          <LayersControl.Overlay

            checked={true}

            name="GSI Landslides"

          >

            <LayerGroup>



              {validLandslides.map((slide) => (

                <CircleMarker

                  key={

                    slide.id ??

                    slide.slide_no ??

                    `landslide-${slide.mapIndex}`

                  }

                  center={[

                    slide.mapLatitude,

                    slide.mapLongitude,

                  ]}

                  radius={4}

                  pathOptions={{

                    color: "#f59e0b",

                    fillColor: "#f59e0b",

                    fillOpacity: 0.75,

                    weight: 1,

                  }}

                >

                  <Popup>



                    <div className="text-sm">



                      <strong>

                        GSI Landslide

                      </strong>



                      <div>

                        <strong>

                          Slide:

                        </strong>{" "}

                        {slide.slide_name ||

                          slide.slide_no ||

                          "Unknown"}

                      </div>



                      <div>

                        <strong>

                          State:

                        </strong>{" "}

                        {slide.state ||

                          "Unknown"}

                      </div>



                      <div>

                        <strong>

                          District:

                        </strong>{" "}

                        {slide.district ||

                          "Unknown"}

                      </div>



                      <div>

                        <strong>

                          Material:

                        </strong>{" "}

                        {slide.material_involved ||

                          "Unknown"}

                      </div>



                      <div>

                        <strong>

                          Movement:

                        </strong>{" "}

                        {slide.movement_type ||

                          "Unknown"}

                      </div>



                      <div>

                        <strong>

                          Coordinates:

                        </strong>{" "}

                        {slide.mapLatitude},{" "}

                        {slide.mapLongitude}

                      </div>



                      <div>

                        <strong>

                          Source:

                        </strong>{" "}

                        GSI

                      </div>



                    </div>



                  </Popup>

                </CircleMarker>

              ))}



            </LayerGroup>

          </LayersControl.Overlay>



          {/* ==================================================

              USGS EARTHQUAKES

              ================================================== */}



          <LayersControl.Overlay

            checked={true}

            name="USGS Earthquakes"

          >

            <LayerGroup>



              {validEarthquakes.map(

                (earthquake) => {



                  const color =

                    earthquakeColor(

                      earthquake.severity

                    );



                  const radius =

                    earthquakeRadius(

                      earthquake.mapMagnitude

                    );



                  return (

                    <CircleMarker

                      key={

                        earthquake.id ??

                        earthquake.external_event_id ??

                        `earthquake-${earthquake.mapIndex}`

                      }

                      center={[

                        earthquake.mapLatitude,

                        earthquake.mapLongitude,

                      ]}

                      radius={radius}

                      pathOptions={{

                        color,

                        fillColor: color,

                        fillOpacity: 0.75,

                        weight: 2,

                      }}

                      eventHandlers={{
                        click: () => onIncidentSelect?.(earthquake),
                      }}

                    >



                      <Popup>



                        <div className="text-sm">



                          <strong>

                            USGS Earthquake

                          </strong>



                          <div>

                            <strong>

                              Magnitude:

                            </strong>{" "}

                            {earthquake.mapMagnitude ??

                              "Unknown"}

                          </div>



                          <div>

                            <strong>

                              Severity:

                            </strong>{" "}

                            {earthquake.severity ||

                              "Unknown"}

                          </div>



                          <div>

                            <strong>

                              Status:

                            </strong>{" "}

                            {earthquake.status ||

                              "Unknown"}

                          </div>



                          <div>

                            <strong>

                              Location:

                            </strong>{" "}

                            {earthquake.title ||

                              "Unknown"}

                          </div>



                          <div>

                            <strong>

                              Occurred:

                            </strong>{" "}

                            {formatDate(

                              earthquake.occurred_at

                            )}

                          </div>



                          <div>

                            <strong>

                              Coordinates:

                            </strong>{" "}

                            {earthquake.mapLatitude},{" "}

                            {earthquake.mapLongitude}

                          </div>



                          <div>

                            <strong>

                              USGS Event ID:

                            </strong>{" "}

                            {earthquake.external_event_id ||

                              "Unknown"}

                          </div>



                          <div>

                            <strong>

                              Source:

                            </strong>{" "}

                            USGS

                          </div>



                        </div>



                      </Popup>



                    </CircleMarker>

                  );

                }

              )}



            </LayerGroup>

          </LayersControl.Overlay>



          {/* ==================================================
              AIDERS FLOOD RISK INTELLIGENCE
              ================================================== */}

          <LayersControl.Overlay
            checked={showFloodRisk}
            name="AIDERS Flood Risk"
          >
            <LayerGroup>
              {validFloodRisk.map((risk) => {
                const color = floodRiskColor(
                  risk.mapRiskLevel
                );

                return (
                  <CircleMarker
                    key={
                      risk.id ??
                      `${risk.station_name || "risk"}-${risk.mapIndex}`
                    }
                    center={[
                      risk.mapLatitude,
                      risk.mapLongitude,
                    ]}
                    radius={floodRiskRadius(
                      risk.mapRiskLevel
                    )}
                    pathOptions={{
                      color,
                      fillColor: color,
                      fillOpacity: 0.85,
                      weight: 2,
                    }}
                  >
                    <Popup>
                      <div className="text-sm">
                        <strong>
                          AIDERS Flood Intelligence
                        </strong>

                        <div className="mt-2">
                          <strong>Station:</strong>{" "}
                          {risk.station_name || "Unknown"}
                        </div>

                        <div>
                          <strong>River:</strong>{" "}
                          {risk.river_name || "Unknown"}
                        </div>

                        <div>
                          <strong>District:</strong>{" "}
                          {risk.district || "Unknown"}
                        </div>

                        <div>
                          <strong>State:</strong>{" "}
                          {risk.state || "Unknown"}
                        </div>

                        <div className="mt-2">
                          <strong>Risk:</strong>{" "}
                          <span
                            style={{
                              color,
                              fontWeight: 700,
                            }}
                          >
                            {risk.mapRiskLevel}
                          </span>
                        </div>

                        <div>
                          <strong>Risk Score:</strong>{" "}
                          {risk.mapRiskScore !== null
                            ? `${risk.mapRiskScore}/100`
                            : "Not available"}
                        </div>

                        <div>
                          <strong>Water Level:</strong>{" "}
                          {risk.current_water_level ??
                            risk.water_level ??
                            "—"}
                          {(risk.current_water_level ??
                            risk.water_level) != null
                            ? " m"
                            : ""}
                        </div>

                        <div>
                          <strong>
                            Historical Percentile:
                          </strong>{" "}
                          {risk.historical_percentile !=
                          null
                            ? `${risk.historical_percentile}%`
                            : "—"}
                        </div>

                        <div>
                          <strong>Recent Change:</strong>{" "}
                          {risk.recent_change_m != null
                            ? `${risk.recent_change_m} m`
                            : "—"}
                        </div>

                        <div>
                          <strong>SACHET Matches:</strong>{" "}
                          {risk.matching_sachet_alerts ??
                            0}
                        </div>

                        {Array.isArray(risk.factors) &&
                          risk.factors.length > 0 && (
                            <div className="mt-2 border-t pt-2">
                              <strong>
                                Assessment Factors:
                              </strong>

                              <ul className="mt-1 list-disc pl-4">
                                {risk.factors.map(
                                  (factor, factorIndex) => (
                                    <li key={factorIndex}>
                                      {String(factor)}
                                    </li>
                                  )
                                )}
                              </ul>
                            </div>
                          )}

                        <div className="mt-2 text-xs text-slate-500">
                          AIDERS-derived analytical
                          assessment. It is not an
                          official CWC or NDMA warning.
                        </div>
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
            </LayerGroup>
          </LayersControl.Overlay>

          {/* ==================================================

              CWC HISTORICAL WATER LEVELS

              ================================================== */}



          <LayersControl.Overlay

            checked={showCwcFloods}

            name="CWC Historical Station Levels"

          >

            <LayerGroup>



              {validCwcFloods.map((flood) => (



                <CircleMarker

                  key={

                    flood.id ??

                    `cwc-flood-${flood.mapIndex}`

                  }

                  center={[

                    flood.mapLatitude,

                    flood.mapLongitude,

                  ]}
                  radius={5}
                  eventHandlers={{
                    click: () =>
                      loadCwcStationHistory(flood),
                  }}
                  pathOptions={{

                    color: "#2563eb",

                    fillColor: "#2563eb",

                    fillOpacity: 0.75,

                    weight: 1,

                  }}

                >



                  <Popup>



                    <div className="text-sm">



                      <strong>

                        CWC Historical Station Water Level

                      </strong>



                      <div>

                        <strong>

                          Station:

                        </strong>{" "}

                        {flood.station_name ||

                          "Unknown"}

                      </div>



                      <div>

                        <strong>

                          River:

                        </strong>{" "}

                        {flood.river_name ||

                          "Unknown"}

                      </div>



                      <div>

                        <strong>

                          State:

                        </strong>{" "}

                        {flood.state ||

                          "Unknown"}

                      </div>



                      <div>

                        <strong>

                          District:

                        </strong>{" "}

                        {flood.district ||

                          "Unknown"}

                      </div>



                      <div>

                        <strong>

                          Water Level:

                        </strong>{" "}

                        {flood.mapWaterLevel !==

                        null

                          ? `${flood.mapWaterLevel} m`

                          : "Unknown"}

                      </div>



                      <div>

                        <strong>

                          Observed:

                        </strong>{" "}

                        {formatDate(

                          flood.observed_at

                        )}

                      </div>



                      <div>

                        <strong>

                          Coordinates:

                        </strong>{" "}

                        {flood.mapLatitude},{" "}

                        {flood.mapLongitude}

                      </div>



                      <div>

                        <strong>

                          Status:

                        </strong>{" "}

                        HISTORICAL

                      </div>



                      <div>

                        <strong>

                          Source:

                        </strong>{" "}

                        Central Water Commission

                        (CWC)

                      </div>



                    </div>



                  </Popup>



                </CircleMarker>



              ))}



            </LayerGroup>

          </LayersControl.Overlay>



          {/* ==================================================

              CWC HISTORICAL RAINFALL

              ================================================== */}



          <LayersControl.Overlay

            checked={showCwcRainfall}

            name="CWC Historical Rainfall"

          >

            <LayerGroup>



              {validCwcRainfall.map(

                (rainfall) => {



                  const rainfallValue =

                    rainfall.mapRainfallMm;



                  let radius = 5;



                  if (

                    rainfallValue !== null

                  ) {

                    radius = Math.min(

                      12,

                      Math.max(

                        5,

                        5 +

                          rainfallValue / 10

                      )

                    );

                  }



                  return (

                    <CircleMarker

                      key={

                        rainfall.id ??

                        `cwc-rainfall-${rainfall.mapIndex}`

                      }

                      center={[

                        rainfall.mapLatitude,

                        rainfall.mapLongitude,

                      ]}

                      radius={radius}

                      pathOptions={{

                        color: "#06b6d4",

                        fillColor: "#06b6d4",

                        fillOpacity: 0.75,

                        weight: 1,

                      }}

                    >



                      <Popup>



                        <div className="text-sm">



                          <strong>

                            CWC Historical Rainfall

                          </strong>



                          <div>

                            <strong>

                              Station:

                            </strong>{" "}

                            {rainfall.station_name ||

                              "Unknown"}

                          </div>



                          <div>

                            <strong>

                              State:

                            </strong>{" "}

                            {rainfall.state ||

                              "Unknown"}

                          </div>



                          <div>

                            <strong>

                              District:

                            </strong>{" "}

                            {rainfall.district ||

                              "Unknown"}

                          </div>



                          <div>

                            <strong>

                              Tehsil:

                            </strong>{" "}

                            {rainfall.tehsil ||

                              "Unknown"}

                          </div>



                          <div>

                            <strong>

                              River:

                            </strong>{" "}

                            {rainfall.river_name ||

                              "Unknown"}

                          </div>



                          <div>

                            <strong>

                              Basin:

                            </strong>{" "}

                            {rainfall.basin ||

                              "Unknown"}

                          </div>



                          <div>

                            <strong>

                              Rainfall:

                            </strong>{" "}

                            {rainfallValue !== null

                              ? `${rainfallValue} mm`

                              : "Unknown"}

                          </div>



                          <div>

                            <strong>

                              Observed:

                            </strong>{" "}

                            {formatDate(

                              rainfall.observed_at

                            )}

                          </div>



                          <div>

                            <strong>

                              Coordinates:

                            </strong>{" "}

                            {rainfall.mapLatitude},{" "}

                            {rainfall.mapLongitude}

                          </div>



                          <div>

                            <strong>

                              Status:

                            </strong>{" "}

                            HISTORICAL

                          </div>



                          <div>

                            <strong>

                              Source:

                            </strong>{" "}

                            Central Water Commission

                            (CWC)

                          </div>



                        </div>



                      </Popup>



                    </CircleMarker>

                  );

                }

              )}



            </LayerGroup>

          </LayersControl.Overlay>



          {/* ==================================================

              SACHET LIVE ALERTS — GEOCODED MARKERS
              All SACHET/IMD/CWC/GSI/USGS alerts geocoded from
              area_name using geoLookup.js — same style as SACHET
              official website (emoji icon + colour ring by severity)

              ================================================== */}

          <LayersControl.Overlay checked={true} name="🔴 Live SACHET / IMD / CWC Alerts">
            <LayerGroup>
              {geocodedAlerts.map((alert) => {
                const color = severityColor(alert.severity);
                const emoji = alertIcon(alert.alert_type || "", alert.severity || "");
                const radius =
                  (alert.severity || "").toLowerCase() === "extreme" ? 14 :
                  (alert.severity || "").toLowerCase() === "severe"  ? 11 : 8;

                const divIcon = L.divIcon({
                  className: "",
                  html: `
                    <div style="
                      background:${color};
                      border:2.5px solid white;
                      border-radius:50%;
                      width:${radius * 2}px;
                      height:${radius * 2}px;
                      display:flex;
                      align-items:center;
                      justify-content:center;
                      font-size:${radius - 1}px;
                      box-shadow:0 0 6px ${color}99;
                      cursor:pointer;
                    ">${emoji}</div>
                  `,
                  iconSize: [radius * 2, radius * 2],
                  iconAnchor: [radius, radius],
                  popupAnchor: [0, -radius - 4],
                });

                return (
                  <Marker
                    key={`geocoded-${alert.id || alert.external_id}`}
                    position={[alert._lat, alert._lng]}
                    icon={divIcon}
                  >
                    <Popup maxWidth={320}>
                      <div className="text-sm" style={{ fontFamily: "sans-serif", minWidth: 240 }}>
                        {/* Header */}
                        <div style={{
                          background: color,
                          color: "#fff",
                          padding: "6px 10px",
                          borderRadius: "6px 6px 0 0",
                          fontWeight: "bold",
                          fontSize: 13,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center"
                        }}>
                          <span>{emoji} {alert.alert_type || "Alert"}</span>
                          <span style={{
                            background: "rgba(255,255,255,0.25)",
                            borderRadius: 4,
                            padding: "1px 6px",
                            fontSize: 11,
                          }}>
                            {(alert.severity || "").toUpperCase()}
                          </span>
                        </div>

                        {/* Body */}
                        <div style={{ padding: "8px 10px", background: "#1e293b", borderRadius: "0 0 6px 6px" }}>
                          <div style={{ color: "#f1f5f9", fontWeight: 600, marginBottom: 4, lineHeight: 1.3 }}>
                            {alert.headline || alert.alert_type}
                          </div>
                          {alert.description && (
                            <div style={{ color: "#94a3b8", fontSize: 11.5, lineHeight: 1.5, marginBottom: 6 }}>
                              {alert.description.length > 220
                                ? alert.description.slice(0, 220) + "..."
                                : alert.description}
                            </div>
                          )}
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "#64748b", borderTop: "1px solid #334155", paddingTop: 4 }}>
                            <span>📍 {alert.area_name || "India"}</span>
                            <span style={{ color: "#475569" }}>
                              {alert.source || "SACHET"} •{" "}
                              {alert.issued_at
                                ? new Date(alert.issued_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: true, hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })
                                : ""}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </LayerGroup>
          </LayersControl.Overlay>


          {/* ==================================================

              SACHET OFFICIAL GEOMETRY

              ================================================== */}



          <LayersControl.Overlay

            checked={true}

            name="SACHET Alert Geometry"

          >

            <LayerGroup>



              {validSachetAlerts.map(

                (alert) => {



                  const geometry =

                    alert.mapGeometry;



                  const color =

                    sachetColor(

                      alert.severity

                    );



                  /* ------------------------------------------

                     POLYGON

                     ------------------------------------------ */



                  if (

                    geometry.type ===

                    "polygon"

                  ) {

                    return (

                      <Polygon

                        key={

                          `sachet-${alert.id}`

                        }

                        positions={

                          geometry.coordinates

                        }

                        pathOptions={{

                          color,

                          fillColor: color,

                          fillOpacity: 0.2,

                          weight: 2,

                        }}

                      >



                        <Popup>



                          <div className="text-sm">



                            <strong>

                              SACHET Emergency Alert

                            </strong>



                            <div>

                              <strong>

                                Type:

                              </strong>{" "}

                              {alert.alert_type ||

                                "Unknown"}

                            </div>



                            <div>

                              <strong>

                                Severity:

                              </strong>{" "}

                              {alert.severity ||

                                "Unknown"}

                            </div>



                            <div>

                              <strong>

                                Area:

                              </strong>{" "}

                              {alert.area_name ||

                                "Unknown"}

                            </div>



                            <div>

                              <strong>

                                Urgency:

                              </strong>{" "}

                              {alert.urgency ||

                                "Unknown"}

                            </div>



                            <div>

                              <strong>

                                Certainty:

                              </strong>{" "}

                              {alert.certainty ||

                                "Unknown"}

                            </div>



                            <div>

                              <strong>

                                Effective:

                              </strong>{" "}

                              {formatDate(

                                alert.effective_at

                              )}

                            </div>



                            <div>

                              <strong>

                                Expires:

                              </strong>{" "}

                              {formatDate(

                                alert.expires_at

                              )}

                            </div>



                            <div className="mt-2">

                              {alert.headline ||

                                "No headline available."}

                            </div>



                            <div className="mt-2">

                              <strong>

                                Source:

                              </strong>{" "}

                              SACHET / NDMA

                            </div>



                          </div>



                        </Popup>



                      </Polygon>

                    );

                  }



                  /* ------------------------------------------

                     CIRCLE

                     ------------------------------------------ */



                  if (

                    geometry.type ===

                    "circle"

                  ) {

                    return (

                      <Circle

                        key={

                          `sachet-${alert.id}`

                        }

                        center={[

                          geometry.latitude,

                          geometry.longitude,

                        ]}

                        radius={

                          geometry.radiusMeters

                        }

                        pathOptions={{

                          color,

                          fillColor: color,

                          fillOpacity: 0.2,

                          weight: 2,

                        }}

                      >



                        <Popup>



                          <div className="text-sm">



                            <strong>

                              SACHET Emergency Alert

                            </strong>



                            <div>

                              <strong>

                                Type:

                              </strong>{" "}

                              {alert.alert_type ||

                                "Unknown"}

                            </div>



                            <div>

                              <strong>

                                Severity:

                              </strong>{" "}

                              {alert.severity ||

                                "Unknown"}

                            </div>



                            <div>

                              <strong>

                                Area:

                              </strong>{" "}

                              {alert.area_name ||

                                "Unknown"}

                            </div>



                            <div>

                              <strong>

                                Urgency:

                              </strong>{" "}

                              {alert.urgency ||

                                "Unknown"}

                            </div>



                            <div>

                              <strong>

                                Certainty:

                              </strong>{" "}

                              {alert.certainty ||

                                "Unknown"}

                            </div>



                            <div>

                              <strong>

                                Effective:

                              </strong>{" "}

                              {formatDate(

                                alert.effective_at

                              )}

                            </div>



                            <div>

                              <strong>

                                Expires:

                              </strong>{" "}

                              {formatDate(

                                alert.expires_at

                              )}

                            </div>



                            <div className="mt-2">

                              {alert.headline ||

                                "No headline available."}

                            </div>



                            <div className="mt-2">

                              <strong>

                                Source:

                              </strong>{" "}

                              SACHET / NDMA

                            </div>



                          </div>



                        </Popup>



                      </Circle>

                    );

                  }



                  return null;

                }

              )}



            </LayerGroup>

          </LayersControl.Overlay>



        </LayersControl>

      </MapContainer>

      {/* ====================================================
          CWC STATION INTELLIGENCE PANEL
          ==================================================== */}

      {selectedCwcStation && (
        <div className="absolute right-4 top-4 z-[1100] w-[420px] max-w-[calc(100%-2rem)]">
          <div className="rounded-xl border border-blue-200 bg-white/95 p-4 shadow-2xl backdrop-blur">

            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                  CWC Station Intelligence
                </div>

                <h3 className="mt-1 text-lg font-bold text-slate-900">
                  {selectedCwcStation.station_name}
                </h3>

                <p className="text-xs text-slate-500">
                  {selectedCwcStation.river_name || "River unavailable"}
                  {" · "}
                  {selectedCwcStation.district || "District unavailable"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedCwcStation(null);
                  setCwcStationHistory([]);
                  setCwcHistoryError("");
                }}
                className="rounded-lg px-2 py-1 text-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ×
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="text-[10px] uppercase text-slate-500">
                  Latest Water Level
                </div>
                <div className="mt-1 text-xl font-bold text-blue-700">
                  {selectedCwcStation.water_level !== null &&
                  selectedCwcStation.water_level !== undefined
                    ? `${selectedCwcStation.water_level} m`
                    : "N/A"}
                </div>
              </div>

              <div className="rounded-lg bg-slate-50 p-3">
                <div className="text-[10px] uppercase text-slate-500">
                  Status
                </div>
                <div className="mt-1 text-sm font-bold text-slate-700">
                  {selectedCwcStation.flood_status || "HISTORICAL"}
                </div>
              </div>
            </div>

            <div className="mt-3 text-[10px] text-slate-500">
              Latest observation
            </div>

            <div className="text-xs text-slate-700">
              {formatDate(selectedCwcStation.observed_at)}
            </div>

            {cwcHistoryLoading && (
              <div className="mt-5 rounded-lg bg-slate-50 p-4 text-center text-xs text-slate-500">
                Loading CWC historical observations...
              </div>
            )}

            {cwcHistoryError && (
              <div className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-600">
                {cwcHistoryError}
              </div>
            )}

            {!cwcHistoryLoading &&
              !cwcHistoryError &&
              cwcStationHistory.length > 0 && (
                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">
                      Water-Level History
                    </span>

                    <span className="text-[10px] text-slate-400">
                      {cwcStationHistory.length} observations
                    </span>
                  </div>

                  <div className="h-[180px] w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-2">
                    <svg
                      viewBox="0 0 400 160"
                      className="h-full w-full"
                      preserveAspectRatio="none"
                    >
                      {(() => {
                        const values =
                          cwcStationHistory
                            .map((item) => Number(item.water_level))
                            .filter(Number.isFinite);

                        if (values.length === 0) {
                          return null;
                        }

                        const minValue = Math.min(...values);
                        const maxValue = Math.max(...values);
                        const range = maxValue - minValue || 1;

                        const points = values
                          .map((value, index) => {
                            const x =
                              values.length === 1
                                ? 200
                                : (index / (values.length - 1)) * 380 + 10;

                            const y =
                              145 -
                              ((value - minValue) / range) * 125;

                            return `${x},${y}`;
                          })
                          .join(" ");

                        return (
                          <>
                            <polyline
                              points={points}
                              fill="none"
                              stroke="#2563eb"
                              strokeWidth="2.5"
                            />

                            {values.map((value, index) => {
                              const x =
                                values.length === 1
                                  ? 200
                                  : (index / (values.length - 1)) * 380 + 10;

                              const y =
                                145 -
                                ((value - minValue) / range) * 125;

                              return (
                                <circle
                                  key={index}
                                  cx={x}
                                  cy={y}
                                  r="2.5"
                                  fill="#2563eb"
                                />
                              );
                            })}
                          </>
                        );
                      })()}
                    </svg>
                  </div>

                  {(() => {
                    const values =
                      cwcStationHistory
                        .map((item) => Number(item.water_level))
                        .filter(Number.isFinite);

                    if (!values.length) {
                      return null;
                    }

                    const latest = values[values.length - 1];
                    const earliest = values[0];
                    const difference = latest - earliest;

                    return (
                      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-lg bg-slate-50 p-2">
                          <div className="text-[9px] uppercase text-slate-400">
                            Minimum
                          </div>
                          <div className="mt-1 text-xs font-bold text-slate-700">
                            {Math.min(...values).toFixed(2)} m
                          </div>
                        </div>

                        <div className="rounded-lg bg-slate-50 p-2">
                          <div className="text-[9px] uppercase text-slate-400">
                            Maximum
                          </div>
                          <div className="mt-1 text-xs font-bold text-slate-700">
                            {Math.max(...values).toFixed(2)} m
                          </div>
                        </div>

                        <div className="rounded-lg bg-slate-50 p-2">
                          <div className="text-[9px] uppercase text-slate-400">
                            Change
                          </div>
                          <div className="mt-1 text-xs font-bold text-blue-700">
                            {difference >= 0 ? "+" : ""}
                            {difference.toFixed(2)} m
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

            {!cwcHistoryLoading &&
              !cwcHistoryError &&
              cwcStationHistory.length === 0 && (
                <div className="mt-5 rounded-lg bg-slate-50 p-4 text-center text-xs text-slate-500">
                  No historical observations available.
                </div>
              )}

            <div className="mt-4 border-t border-slate-200 pt-3 text-[10px] text-slate-400">
              Source: Central Water Commission (CWC)
              <br />
              Dataset: CWC River Water Level Telemetry 2021-2025
            </div>
          </div>
        </div>
      )}

      
      {/* ====================================================
          PART 1: TOP-RIGHT COLLAPSIBLE GIS COMMAND MAP & HAZARD LEGEND
          ==================================================== */}
      {/* Toggle Control Button in Top-Right near Leaflet Layers Control */}
      <button
        ref={gisButtonRef}
        type="button"
        onClick={() => setIsGisPanelOpen((prev) => !prev)}
        aria-label="Toggle GIS Intelligence and Hazard Legend"
        className={`pointer-events-auto absolute top-2.5 right-14 z-[1000] flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-md backdrop-blur transition-all ${
          isGisPanelOpen
            ? "border-blue-500 bg-white text-blue-700 ring-2 ring-blue-400/30"
            : "border-slate-200 bg-white/95 text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
        }`}
      >
        <SlidersHorizontal className="h-3.5 w-3.5 text-blue-600" />
        <span className="font-medium">GIS & Legend</span>
      </button>

      {/* Floating Collapsible Panel */}
      {isGisPanelOpen && (
        <div
          ref={gisPanelRef}
          onDoubleClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
          className="pointer-events-auto absolute top-14 right-2 sm:right-3 z-[1100] flex w-[320px] sm:w-[390px] max-w-[calc(100vw-1.5rem)] max-h-[calc(100%-4.5rem)] flex-col rounded-2xl border border-slate-200 bg-white/95 text-slate-800 shadow-2xl backdrop-blur-md"
        >
          {/* Header with Two Tabs and Close Button */}
          <div className="flex shrink-0 items-center justify-between border-b border-slate-200/80 px-4 py-3 bg-slate-50/80 rounded-t-2xl">
            <div className="flex items-center gap-1 rounded-lg bg-slate-200/70 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setGisActiveTab("gis")}
                className={`rounded-md px-3 py-1.5 transition-all ${
                  gisActiveTab === "gis"
                    ? "bg-white text-blue-700 shadow-sm font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                GIS Command Map
              </button>
              <button
                type="button"
                onClick={() => setGisActiveTab("legend")}
                className={`rounded-md px-3 py-1.5 transition-all ${
                  gisActiveTab === "legend"
                    ? "bg-white text-blue-700 shadow-sm font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Hazard Legend
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsGisPanelOpen(false)}
              className="ml-2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 transition-colors"
              aria-label="Close panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Panel Body with Internal Scrolling */}
          <div className="min-h-0 flex-1 overflow-y-auto p-4 text-xs">
            {gisActiveTab === "gis" ? (
              <div className="space-y-4">
                {/* Telemetry Feeds */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Telemetry Feeds
                  </div>
                  <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-2.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">GSI Landslides</span>
                      <strong className="text-slate-900 font-mono">
                        {landslideLoading ? "Loading..." : validLandslides.length}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">USGS Earthquakes</span>
                      <strong className="text-slate-900 font-mono">
                        {earthquakeLoading ? "Loading..." : validEarthquakes.length}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">CWC Stations</span>
                      <strong className="text-slate-900 font-mono">
                        {cwcFloodLoading ? "Loading..." : validCwcFloods.length}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">CWC Rainfall</span>
                      <strong className="text-slate-900 font-mono">
                        {cwcRainfallLoading ? "Loading..." : validCwcRainfall.length}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">AIDERS Flood Risk</span>
                      <strong className="text-slate-900 font-mono">
                        {floodRiskLoading ? "Loading..." : validFloodRisk.length}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Flood Risk Severity Breakdown */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    AIDERS Flood Risk Severity
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50/60 px-2.5 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-[#991b1b]" />
                        <span className="font-medium text-red-950">Critical</span>
                      </div>
                      <strong className="font-mono text-red-950">
                        {
                          validFloodRisk.filter(
                            (item) =>
                              String(item.mapRiskLevel).toUpperCase() === "CRITICAL"
                          ).length
                        }
                      </strong>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50/40 px-2.5 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-[#dc2626]" />
                        <span className="font-medium text-red-700">High</span>
                      </div>
                      <strong className="font-mono text-red-700">
                        {
                          validFloodRisk.filter(
                            (item) =>
                              String(item.mapRiskLevel).toUpperCase() === "HIGH"
                          ).length
                        }
                      </strong>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50/60 px-2.5 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-[#f59e0b]" />
                        <span className="font-medium text-amber-800">Moderate</span>
                      </div>
                      <strong className="font-mono text-amber-800">
                        {
                          validFloodRisk.filter(
                            (item) =>
                              String(item.mapRiskLevel).toUpperCase() === "MODERATE"
                          ).length
                        }
                      </strong>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/60 px-2.5 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-[#22c55e]" />
                        <span className="font-medium text-emerald-800">Low</span>
                      </div>
                      <strong className="font-mono text-emerald-800">
                        {
                          validFloodRisk.filter(
                            (item) =>
                              String(item.mapRiskLevel).toUpperCase() === "LOW"
                          ).length
                        }
                      </strong>
                    </div>
                  </div>
                </div>

                {/* SACHET Emergency Alert Stream */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Emergency Alert Stream
                  </div>
                  <div className="rounded-lg border border-red-200/80 bg-red-50/30 p-2.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
                        <span className="text-xs font-bold uppercase tracking-wider text-red-600">
                          SACHET LIVE
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-medium">
                        Official NDMA emergency alert stream
                      </span>
                    </div>
                    <div className="border-t border-red-100 pt-2 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">SACHET Alerts</span>
                        <strong className="text-slate-900 font-mono">
                          {sachetLoading ? "Loading..." : sachetAlerts.length}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">SACHET Mapped</span>
                        <strong className="text-slate-900 font-mono">
                          {validSachetAlerts.length}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">SACHET Feed Only</span>
                        <strong className="text-slate-900 font-mono">
                          {nonMappedSachetAlerts.length}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Database Record Inventory */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Dataset Inventory
                  </div>
                  <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Total GSI Records</span>
                      <strong className="text-slate-900 font-mono">{totalLandslides || "—"}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Total USGS Records</span>
                      <strong className="text-slate-900 font-mono">{totalEarthquakes || "—"}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Total CWC Stations</span>
                      <strong className="text-slate-900 font-mono">
                        {cwcFloodTotal ? cwcFloodTotal.toLocaleString() : "—"}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Total CWC Rainfall Records</span>
                      <strong className="text-slate-900 font-mono">
                        {cwcRainfallTotal ? cwcRainfallTotal.toLocaleString() : "—"}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Total SACHET Records</span>
                      <strong className="text-slate-900 font-mono">{totalSachetAlerts || "—"}</strong>
                    </div>
                  </div>
                </div>

                {/* Errors if any */}
                {(landslideError ||
                  earthquakeError ||
                  cwcFloodError ||
                  cwcRainfallError ||
                  floodRiskError ||
                  sachetError) && (
                  <div className="space-y-1 rounded-lg border border-red-200 bg-red-50 p-2.5 text-[11px] text-red-600">
                    {landslideError && <div>{landslideError}</div>}
                    {earthquakeError && <div>{earthquakeError}</div>}
                    {cwcFloodError && <div>{cwcFloodError}</div>}
                    {cwcRainfallError && <div>{cwcRainfallError}</div>}
                    {floodRiskError && <div>{floodRiskError}</div>}
                    {sachetError && <div>{sachetError}</div>}
                  </div>
                )}
              </div>
            ) : (
              /* HAZARD LEGEND TAB */
              <div className="space-y-3.5">
                {/* GSI & Earthquakes */}
                <div className="space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Geological & Seismic Hazards
                  </div>
                  <div className="space-y-1.5 pl-0.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: "#f59e0b" }}
                      />
                      <span className="text-slate-700">GSI Landslide</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: "#eab308" }}
                      />
                      <span className="text-slate-700">Earthquake &lt; 4.0</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: "#f59e0b" }}
                      />
                      <span className="text-slate-700">Earthquake 4.0+</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: "#ef4444" }}
                      />
                      <span className="text-slate-700">Earthquake 5.0+</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: "#dc2626" }}
                      />
                      <span className="text-slate-700">Earthquake 6.0+</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-200/80" />

                {/* CWC Telemetry */}
                <div className="space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    CWC Hydrological Telemetry
                  </div>
                  <div className="space-y-1.5 pl-0.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: "#2563eb" }}
                      />
                      <span className="text-slate-700 truncate">
                        CWC Historical Station Water Level
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: "#06b6d4" }}
                      />
                      <span className="text-slate-700">CWC Historical Rainfall</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-200/80" />

                {/* AIDERS Flood Risk */}
                <div className="space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    AIDERS Flood Risk
                  </div>
                  <div className="space-y-1.5 pl-0.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: "#991b1b" }}
                      />
                      <span className="text-slate-700">AIDERS Flood Risk — Critical</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: "#dc2626" }}
                      />
                      <span className="text-slate-700">AIDERS Flood Risk — High</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: "#f59e0b" }}
                      />
                      <span className="text-slate-700">AIDERS Flood Risk — Moderate</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: "#22c55e" }}
                      />
                      <span className="text-slate-700">AIDERS Flood Risk — Low</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-200/80" />

                {/* SACHET Severe */}
                <div className="space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Emergency Alerts
                  </div>
                  <div className="space-y-1.5 pl-0.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: "#dc2626" }}
                      />
                      <span className="text-slate-700">SACHET Severe</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ====================================================
          PART 2: LEFT-SIDE MIDDLE TAB & SACHET EMERGENCY ALERTS PANEL
          ==================================================== */}
      {/* Docked Left-Side Tab Button (vertically centered relative to map) */}
      {!isSachetPanelOpen && (
        <button
          ref={sachetTabRef}
          type="button"
          onClick={() => setIsSachetPanelOpen(true)}
          aria-label="Open SACHET Emergency Alerts"
          className="pointer-events-auto absolute left-0 top-1/2 -translate-y-1/2 z-[1000] flex items-center gap-2 rounded-r-xl border border-l-0 border-rose-500/50 bg-slate-900/95 px-3 py-2.5 text-white shadow-xl backdrop-blur-md transition-all hover:bg-slate-800 hover:border-rose-400 group cursor-pointer"
        >
          <div className="relative flex items-center justify-center">
            <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
            </span>
            <Siren className="h-4 w-4 text-rose-400 group-hover:scale-110 transition-transform" />
          </div>
          <span className="text-xs font-semibold tracking-wide text-white">
            SACHET Alerts
          </span>
          <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-300 border border-rose-500/30 font-mono">
            {sachetLoading ? "..." : sachetAlerts.length}
          </span>
        </button>
      )}

      {/* Dedicated Floating SACHET Emergency Alerts Panel */}
      {isSachetPanelOpen && (
        <div
          ref={sachetPanelRef}
          onDoubleClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
          className="pointer-events-auto absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 z-[1100] flex w-[320px] sm:w-[400px] max-w-[calc(100vw-1.5rem)] max-h-[min(560px,calc(100%-2rem))] flex-col rounded-2xl border border-slate-700 bg-slate-950/95 text-white shadow-2xl backdrop-blur-md"
        >
          {/* Fixed Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-slate-800 px-4 py-3 bg-slate-900/80 rounded-t-2xl">
            <div>
              <h3 className="text-sm font-bold tracking-wide text-white flex items-center gap-2">
                <Siren className="h-4 w-4 text-rose-400" />
                SACHET Emergency Alerts
              </h3>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Official NDMA / CAP alert feed
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 rounded-full bg-slate-800/80 px-2 py-0.5 border border-slate-700">
                <span
                  className={`h-2 w-2 rounded-full ${
                    sachetError ? "bg-rose-500" : "animate-pulse bg-emerald-500"
                  }`}
                />
                <span
                  className={`text-[10px] font-bold ${
                    sachetError ? "text-rose-400" : "text-emerald-400"
                  }`}
                >
                  {sachetError ? "OFFLINE" : "LIVE"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsSachetPanelOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                aria-label="Close SACHET alerts panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Fixed Summary Section */}
          <div className="shrink-0 px-4 pt-3 pb-2">
            <div className="flex items-center justify-between rounded-lg bg-slate-900/90 border border-slate-800 px-3 py-2">
              <span className="text-xs text-slate-400">Active feed records</span>
              <span className="text-sm font-bold text-white font-mono">
                {sachetLoading ? "..." : sachetAlerts.length}
              </span>
            </div>
          </div>

          {/* Scrollable Alert List (displays two complete alert cards at a time where space permits, scrollable for more) */}
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 space-y-2.5 max-h-[300px]">
            {sachetLoading && (
              <div className="rounded-lg bg-slate-900 p-3 text-xs text-slate-400">
                Loading official SACHET alerts...
              </div>
            )}

            {sachetError && (
              <div className="rounded-lg border border-red-800/60 bg-red-950/60 p-3 text-xs text-red-300">
                {sachetError}
              </div>
            )}

            {!sachetLoading && !sachetError && sachetAlerts.length === 0 && (
              <div className="rounded-lg bg-slate-900 p-3 text-xs text-slate-400">
                No SACHET alerts available.
              </div>
            )}

            {!sachetLoading &&
              sachetAlerts.map((alert) => {
                const severityColor = sachetColor(alert.severity);

                return (
                  <div
                    key={alert.id}
                    className="rounded-xl border border-slate-800 bg-slate-900/90 p-3 transition-colors hover:border-slate-700"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 flex-shrink-0 rounded-full"
                            style={{ backgroundColor: severityColor }}
                          />
                          <span className="truncate text-xs font-semibold text-white">
                            {alert.alert_type || "Emergency Alert"}
                          </span>
                        </div>
                        <div className="mt-1 text-[11px] text-slate-400">
                          {alert.area_name || "Area not specified"}
                        </div>
                      </div>

                      <span
                        className="flex-shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase"
                        style={{
                          color: severityColor,
                          backgroundColor: `${severityColor}20`,
                        }}
                      >
                        {alert.severity || "Unknown"}
                      </span>
                    </div>

                    <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-300">
                      {alert.headline || "No alert message available."}
                    </p>

                    <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
                      <div className="text-slate-500">
                        Certainty:{" "}
                        <span className="text-slate-300">
                          {alert.certainty || "N/A"}
                        </span>
                      </div>
                      <div className="text-slate-500">
                        Urgency:{" "}
                        <span className="text-slate-300">
                          {alert.urgency || "N/A"}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 text-[10px] text-slate-500">
                      Effective:{" "}
                      <span className="text-slate-300">
                        {formatDate(alert.effective_at)}
                      </span>
                    </div>

                    <div className="mt-1 text-[10px] text-slate-500">
                      Expires:{" "}
                      <span className="text-slate-300">
                        {formatDate(alert.expires_at)}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between border-t border-slate-800/80 pt-2">
                      <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                        Source: SACHET / NDMA
                      </span>
                      {getSachetGeometry(alert) ? (
                        <span className="text-[9px] font-semibold text-emerald-400">
                          MAPPED
                        </span>
                      ) : (
                        <span className="text-[9px] text-slate-500">
                          AREA FEED
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}





    </div>

  );

}