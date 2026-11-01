/**
 * AIDERS GeoLookup Service
 * ========================
 * Maps Indian states, districts, rivers and mandals to geographic
 * coordinates so SACHET/IMD/CWC/GSI/USGS alerts can be plotted on
 * the Leaflet map even when the alert contains no geometry field.
 *
 * All coordinates are centroids (lat, lng) — good enough for map markers.
 */

// ── State centroids ──────────────────────────────────────────────────────────
const STATE_COORDS = {
  "andhra pradesh":     [15.9129,  79.7400],
  "arunachal pradesh":  [28.2180,  94.7278],
  "assam":              [26.2006,  92.9376],
  "bihar":              [25.0961,  85.3131],
  "chhattisgarh":       [21.2787,  81.8661],
  "goa":                [15.2993,  74.1240],
  "gujarat":            [22.2587,  71.1924],
  "haryana":            [29.0588,  76.0856],
  "himachal pradesh":   [31.1048,  77.1734],
  "jharkhand":          [23.6102,  85.2799],
  "karnataka":          [15.3173,  75.7139],
  "kerala":             [10.8505,  76.2711],
  "madhya pradesh":     [22.9734,  78.6569],
  "maharashtra":        [19.7515,  75.7139],
  "manipur":            [24.6637,  93.9063],
  "meghalaya":          [25.4670,  91.3662],
  "mizoram":            [23.1645,  92.9376],
  "nagaland":           [26.1584,  94.5624],
  "odisha":             [20.9517,  85.0985],
  "punjab":             [31.1471,  75.3412],
  "rajasthan":          [27.0238,  74.2179],
  "sikkim":             [27.5330,  88.5122],
  "tamil nadu":         [11.1271,  78.6569],
  "telangana":          [18.1124,  79.0193],
  "tripura":            [23.9408,  91.9882],
  "uttar pradesh":      [26.8467,  80.9462],
  "uttarakhand":        [30.0668,  79.0193],
  "west bengal":        [22.9868,  87.8550],
  "jammu & kashmir":    [33.7782,  76.5762],
  "jammu and kashmir":  [33.7782,  76.5762],
  "ladakh":             [34.1526,  77.5770],
  "andaman":            [11.7401,  92.6586],
  "lakshadweep":        [10.5667,  72.6417],
  "delhi":              [28.7041,  77.1025],
};

// ── District / city / river / region centroids ───────────────────────────────
const DISTRICT_COORDS = {
  // Andhra Pradesh
  "srikakulam":         [18.2949,  83.8975],
  "vizianagaram":       [18.1066,  83.3956],
  "visakhapatnam":      [17.6868,  83.2185],
  "east godavari":      [17.0900,  81.9800],
  "west godavari":      [16.9168,  81.2028],
  "krishna":            [16.6100,  80.7200],
  "guntur":             [16.3067,  80.4365],
  "prakasam":           [15.3400,  79.5900],
  "nellore":            [14.4426,  79.9865],
  "chittoor":           [13.2172,  79.1003],
  "kadapa":             [14.4674,  78.8241],
  "anantapur":          [14.6819,  77.6006],
  "kurnool":            [15.8281,  78.0373],
  "bhadradri kothagudem":[17.5500, 80.6200],
  "polavaram":          [17.2484,  81.6434],
  "bhadrachalam":       [17.6688,  80.8916],
  "dowleswaram":        [16.9400,  81.7800],

  // Telangana
  "hyderabad":          [17.3850,  78.4867],
  "rangareddy":         [17.2400,  78.4000],
  "warangal":           [17.9689,  79.5941],
  "hanamkonda":         [18.0005,  79.5616],
  "khammam":            [17.2473,  80.1514],
  "nalgonda":           [17.0575,  79.2674],
  "suryapet":           [17.1415,  79.6211],
  "mahabubabad":        [17.6000,  80.0000],
  "jangaon":            [17.7224,  79.1525],
  "siddipet":           [18.1018,  78.8520],
  "yadadri bhuvanagiri":[17.5714,  79.0380],
  "jayashankar bhupalapally":[18.4500,79.9000],
  "mulugu":             [18.1966,  80.0700],

  // Assam / NE
  "guwahati":           [26.1445,  91.7362],
  "kamrup":             [26.1445,  91.7362],
  "kamrup metro":       [26.1445,  91.7362],
  "morigaon":           [26.2500,  92.3400],
  "dibrugarh":          [27.4728,  94.9120],
  "nalbari":            [26.4438,  91.4370],
  "barpeta":            [26.3200,  91.0000],
  "baksa":              [26.6900,  91.1800],
  "goalpara":           [26.1700,  90.6200],
  "sonitpur":           [26.6274,  92.8001],
  "brahmaputra":        [26.1445,  91.7362],
  "lower subansiri":    [27.5100,  93.9800],
  "papum pare":         [27.1020,  93.7110],
  "dhalai":             [23.7800,  91.9900],
  "khowai":             [24.0650,  91.6007],
  "west tripura":       [23.6800,  91.5000],

  // Odisha
  "balasore":           [21.4934,  86.9355],
  "bhadrak":            [21.0582,  86.5155],
  "ganjam":             [19.3880,  84.7905],
  "berhampur":          [19.3150,  84.7941],
  "puri":               [19.8106,  85.8314],
  "cuttack":            [20.4625,  85.8828],
  "bhubaneswar":        [20.2961,  85.8245],
  "kendrapara":         [20.5024,  86.4204],
  "jagatsinghpur":      [20.2617,  86.1702],

  // Bihar / Jharkhand
  "supaul":             [26.1225,  86.6026],
  "saharsa":            [25.8780,  86.5952],
  "araria":             [26.1447,  87.4716],
  "patna":              [25.5941,  85.1376],
  "bhagalpur":          [25.2425,  86.9842],
  "muzaffarpur":        [26.1197,  85.3910],
  "darbhanga":          [26.1542,  85.9010],

  // Maharashtra / Konkan
  "raigad":             [18.5158,  73.1199],
  "ratnagiri":          [16.9902,  73.3120],
  "sindhudurg":         [16.3490,  73.6300],
  "mumbai":             [19.0760,  72.8777],
  "pune":               [18.5204,  73.8567],
  "nashik":             [19.9975,  73.7898],
  "konkan":             [17.0000,  73.2000],
  "nagpur":             [21.1458,  79.0882],
  "satara":             [17.6858,  74.0044],
  "kolhapur":           [16.7050,  74.2433],

  // Kerala
  "wayanad":            [11.6854,  76.1320],
  "meppadi":            [11.5100,  76.0600],
  "chooralmala":        [11.4900,  76.0300],
  "vythiri":            [11.5850,  76.0450],
  "thrissur":           [10.5276,  76.2144],
  "ernakulam":          [10.0261,  76.3125],
  "thiruvananthapuram": [ 8.5241,  76.9366],
  "kozhikode":          [11.2588,  75.7804],
  "malappuram":         [11.0510,  76.0711],
  "palakkad":           [10.7867,  76.6548],

  // Karnataka
  "bangalore":          [12.9716,  77.5946],
  "mysore":             [12.2958,  76.6394],
  "mangalore":          [12.9141,  74.8560],
  "udupi":              [13.3400,  74.7460],
  "dakshina kannada":   [12.8438,  75.2479],

  // Tamil Nadu
  "chennai":            [13.0827,  80.2707],
  "chengalpattu":       [12.6819,  79.9757],
  "cuddalore":          [11.7480,  79.7714],
  "nagapattinam":       [10.7632,  79.8428],
  "tiruvallur":         [13.1434,  79.9071],
  "kancheepuram":       [12.8185,  79.7037],
  "villupuram":         [11.9392,  79.4927],

  // Himachal Pradesh
  "shimla":             [31.1048,  77.1734],
  "kullu":              [31.9579,  77.1095],
  "manali":             [32.2432,  77.1892],
  "mandi":              [31.7085,  76.9322],
  "kinnaur":            [31.5830,  78.2760],

  // Uttarakhand
  "dehradun":           [30.3165,  78.0322],
  "joshimath":          [30.5561,  79.5644],
  "chamoli":            [30.4100,  79.3200],
  "rudraprayag":        [30.2846,  78.9812],
  "tehri":              [30.3782,  78.4803],
  "haridwar":           [29.9457,  78.1642],

  // Jammu & Kashmir
  "srinagar":           [34.0837,  74.7973],
  "baramulla":          [34.2003,  74.3432],
  "kupwara":            [34.5220,  74.2630],
  "anantnag":           [33.7311,  75.1487],
  "jammu":              [32.7266,  74.8570],

  // Gujarat
  "ahmedabad":          [23.0225,  72.5714],
  "surat":              [21.1702,  72.8311],
  "vadodara":           [22.3072,  73.1812],
  "rajkot":             [22.3039,  70.8022],
  "kutch":              [23.7337,  69.8597],

  // Rajasthan
  "jaipur":             [26.9124,  75.7873],
  "jodhpur":            [26.2389,  73.0243],
  "udaipur":            [24.5854,  73.7125],
  "bikaner":            [28.0229,  73.3119],

  // West Bengal
  "kolkata":            [22.5726,  88.3639],
  "darjeeling":         [27.0360,  88.2627],
  "jalpaiguri":         [26.5429,  88.7179],
  "murshidabad":        [24.1852,  88.2537],
  "midnapore":          [22.4186,  87.3191],

  // Rivers (flood gauge references)
  "godavari":           [17.0079,  81.7767],
  "krishna river":      [16.5000,  80.2000],
  "brahmaputra valley": [26.1445,  92.3000],
  "kosi":               [25.8800,  86.6000],
  "ganga":              [25.3176,  83.0100],
  "yamuna":             [28.6139,  77.2090],
  "narmada":            [22.1000,  77.0000],
  "tapti":              [21.1500,  75.7800],
  "mahanadi":           [20.4625,  85.0000],
  "kaveri":             [11.0000,  77.5000],
  "beas":               [31.8000,  76.5000],
  "sutlej":             [31.2000,  75.8000],
  "nagavali":           [18.2900,  83.8900],
  "rishikulya":         [19.3400,  84.8000],
  "jalaka":             [21.4900,  86.9000],
};

// ── Keyword-to-coordinates mapping (for SACHET-style mandal codes) ───────────
// wgd = West Godavari, nlr = Nellore, prk = Prakasam, pln = unknown district
const MANDAL_CODE_MAP = {
  "wgd": [16.9168,  81.2028],   // West Godavari
  "egd": [17.0900,  81.9800],   // East Godavari
  "nlr": [14.4426,  79.9865],   // Nellore
  "prk": [15.3400,  79.5900],   // Prakasam
  "pln": [15.3400,  79.5900],   // Prakasam/Nellore area
  "mkp": [16.3067,  80.4365],   // Guntur / Macherla
  "krs": [16.6100,  80.7200],   // Krishna
  "spk": [14.4426,  79.9865],   // South prakasam
  "vis": [17.6868,  83.2185],   // Visakhapatnam
  "vzm": [18.1066,  83.3956],   // Vizianagaram
  "skl": [18.2949,  83.8975],   // Srikakulam
  "hyd": [17.3850,  78.4867],   // Hyderabad
  "rng": [17.2400,  78.4000],   // Rangareddy
  "wgl": [17.9689,  79.5941],   // Warangal
  "khm": [17.2473,  80.1514],   // Khammam
  "bhd": [17.6688,  80.8916],   // Bhadrachalam / Bhadradri
};

// ── Main geocoder function ───────────────────────────────────────────────────

/**
 * Given an alert's area_name (and optionally description), return [lat, lng]
 * or null if no match found.
 *
 * @param {string} areaName - alert.area_name
 * @param {string} [description] - alert.description (fallback search)
 * @returns {[number, number] | null}
 */
export function geocodeAlert(areaName = "", description = "") {
  const sources = [areaName, description];

  for (const text of sources) {
    if (!text) continue;
    const lower = text.toLowerCase();

    // 1. Try district/city lookup (more specific first)
    for (const [key, coords] of Object.entries(DISTRICT_COORDS)) {
      if (lower.includes(key)) return coords;
    }

    // 2. Try mandal code prefixes (e.g. "wgd-kalla", "nlr-sangam")
    const mandalMatch = lower.match(/\b([a-z]{2,4})-[a-z]/);
    if (mandalMatch) {
      const code = mandalMatch[1];
      if (MANDAL_CODE_MAP[code]) return MANDAL_CODE_MAP[code];
    }

    // 3. Try state lookup
    for (const [key, coords] of Object.entries(STATE_COORDS)) {
      if (lower.includes(key)) return coords;
    }
  }

  return null;
}

/**
 * Returns a small jitter offset so overlapping markers don't hide each other.
 * Deterministic based on the alert ID string.
 */
export function jitterCoords(lat, lng, idStr = "") {
  const seed = Array.from(idStr).reduce((a, c) => a + c.charCodeAt(0), 0);
  const jLat = ((seed % 23) - 11) * 0.012;
  const jLng = ((seed % 17) - 8)  * 0.012;
  return [lat + jLat, lng + jLng];
}

/**
 * Alert type → icon emoji mapping for Leaflet DivIcon labels.
 */
export function alertIcon(alertType = "", severity = "") {
  const t = alertType.toLowerCase();
  const s = severity.toLowerCase();

  if (t.includes("cyclone") || t.includes("gale"))           return "🌀";
  if (t.includes("landslide") || t.includes("slope"))         return "⛰️";
  if (t.includes("earthquake") || t.includes("seismic"))      return "🔴";
  if (t.includes("flood") || t.includes("river") || t.includes("inundation")) return "🌊";
  if (t.includes("lightning"))                                 return "⚡";
  if (t.includes("thunderstorm"))                              return "⛈️";
  if (t.includes("rain") || t.includes("cloudburst"))         return "🌧️";
  if (t.includes("wind") || t.includes("squally"))            return "💨";
  if (t.includes("fire") || t.includes("wildfire"))           return "🔥";
  return s === "extreme" ? "🚨" : "⚠️";
}

/**
 * Severity → marker fill colour.
 */
export function severityColor(severity = "") {
  switch (severity.toLowerCase()) {
    case "extreme":  return "#dc2626";   // red
    case "severe":   return "#f97316";   // orange
    case "moderate": return "#eab308";   // yellow
    default:         return "#3b82f6";   // blue
  }
}

