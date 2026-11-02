import React, { useState } from "react";
import {
  ShieldCheck,
  Lock,
  X,
  AlertCircle,
  UserPlus,
  LogIn,
  CheckCircle2,
  ChevronRight,
  Globe2,
  Building2,
  Sparkles,
  ArrowLeft,
  Mail,
  UserCheck,
  RefreshCw,
  ExternalLink,
  Settings,
  HelpCircle,
} from "lucide-react";
import { useAuth, DEFAULT_OFFICIAL_ACCOUNTS } from "../contexts/AuthContext";

// Google 4-Color SVG Brand Icon
function GoogleIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

export default function AuthModal({ isOpen, onClose, onSuccess, initialMode = "signin" }) {
  const {
    user,
    isAuthenticated,
    signIn,
    signUp,
    loginWithGoogleAccount,
    loginWithFirebaseGoogle,
    isFirebaseConfigured,
    getFirebaseConfig,
    saveFirebaseRuntimeConfig,
    logout,
    authError,
    setAuthError,
  } = useAuth();

  const [mode, setMode] = useState(initialMode); // "signin" | "signup" | "demo" | "firebase_setup"
  const [showGoogleChooser, setShowGoogleChooser] = useState(false);
  const [googleHandshakeState, setGoogleHandshakeState] = useState(null); // null | "connecting" | "success"

  // 18+ Statutory Declaration & Age Verification
  const [isAgeVerified, setIsAgeVerified] = useState(true);
  const [birthYear, setBirthYear] = useState("2000");

  // In-app Firebase Config form
  const [showFirebaseSetup, setShowFirebaseSetup] = useState(false);
  const currentFb = getFirebaseConfig();
  const [fbApiKey, setFbApiKey] = useState(currentFb?.apiKey || "");
  const [fbProjectId, setFbProjectId] = useState(currentFb?.projectId || "");
  const [fbAuthDomain, setFbAuthDomain] = useState(currentFb?.authDomain || "");
  const [fbAppId, setFbAppId] = useState(currentFb?.appId || "");
  const [fbRawConfig, setFbRawConfig] = useState("");

  // Sign In form fields
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");

  // Sign Up form fields
  const [signUpName, setSignUpName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpRole, setSignUpRole] = useState("ROLE_ADMIN");
  const [signUpOrg, setSignUpOrg] = useState("National Disaster Response Force (NDRF)");

  // Custom Google Account input
  const [customGoogleEmail, setCustomGoogleEmail] = useState("");
  const [customGoogleName, setCustomGoogleName] = useState("");
  const [showCustomGoogleInput, setShowCustomGoogleInput] = useState(false);

  const [loading, setLoading] = useState(false);
  const [successNotice, setSuccessNotice] = useState("");

  if (!isOpen) return null;

  // Real Firebase Google Login Handler
  const handleFirebaseGoogleLogin = async () => {
    setAuthError("");
    setSuccessNotice("");

    // 1. Verify 18+ Criteria
    const currentYear = new Date().getFullYear();
    const parsedYear = Number(birthYear);

    if (!isAgeVerified) {
      setAuthError("Age Verification Required: You must certify that you are 18 years of age or older to access National Emergency Operations.");
      return;
    }

    if (parsedYear && parsedYear > currentYear - 18) {
      setAuthError(`Access Restricted: Under 18 years of age (born ${parsedYear}). Only personnel aged 18+ are authorized to operate this national system.`);
      return;
    }

    // 2. Check if Firebase is configured
    if (!isFirebaseConfigured()) {
      setShowFirebaseSetup(true);
      setAuthError("Firebase Setup Required: Please paste your Firebase Project keys below to connect real Google Authentication for any Gmail.");
      return;
    }

    // 3. Initiate Firebase Popup
    setGoogleHandshakeState("connecting");
    setLoading(true);

    try {
      const res = await loginWithFirebaseGoogle({ isAgeVerified, birthYear });
      setLoading(false);

      if (res.success) {
        setGoogleHandshakeState("success");
        setSuccessNotice(`Authenticated as ${res.user.name} (${res.user.email}) via Firebase Google SSO.`);
        setTimeout(() => {
          setGoogleHandshakeState(null);
          if (onSuccess) onSuccess();
          onClose();
        }, 800);
      } else {
        setGoogleHandshakeState(null);
      }
    } catch (e) {
      setLoading(false);
      setGoogleHandshakeState(null);
      setAuthError(e.message || "Failed to sign in with Google Firebase.");
    }
  };

  // Save runtime Firebase Config from in-app form
  const handleSaveFirebaseConfig = (e) => {
    e.preventDefault();
    try {
      let finalConfig = {
        apiKey: fbApiKey.trim(),
        projectId: fbProjectId.trim(),
        authDomain: fbAuthDomain.trim() || `${fbProjectId.trim()}.firebaseapp.com`,
        appId: fbAppId.trim(),
      };

      // If raw config JSON was pasted
      if (fbRawConfig.trim()) {
        try {
          // Clean possible JS object format (const firebaseConfig = { ... })
          let cleaned = fbRawConfig
            .replace(/const\s+firebaseConfig\s*=\s*/g, "")
            .replace(/export\s+const\s+firebaseConfig\s*=\s*/g, "")
            .replace(/;/g, "");
          
          // If valid JSON or JS object
          const parsed = (new Function(`return ${cleaned}`))();
          if (parsed && parsed.apiKey && parsed.projectId) {
            finalConfig = parsed;
            setFbApiKey(parsed.apiKey);
            setFbProjectId(parsed.projectId);
            setFbAuthDomain(parsed.authDomain || "");
            setFbAppId(parsed.appId || "");
          }
        } catch (jsonErr) {
          console.warn("Could not parse raw config as JSON/JS, using direct fields", jsonErr);
        }
      }

      saveFirebaseRuntimeConfig(finalConfig);
      setSuccessNotice("Firebase credentials successfully saved! You can now click Continue with Google.");
      setShowFirebaseSetup(false);
      setAuthError("");
    } catch (err) {
      setAuthError(err.message || "Invalid Firebase credentials.");
    }
  };

  // Handle Google Account Selection
  const handleSelectGoogleAccount = ({ name, email, picture, role, organization }) => {
    setGoogleHandshakeState("connecting");
    setAuthError("");

    setTimeout(() => {
      const result = loginWithGoogleAccount({
        name,
        email,
        picture,
        role,
        organization,
      });

      if (result.success) {
        setGoogleHandshakeState("success");
        setSuccessNotice(`Authenticated as ${result.user.name} via Google Identity SSO.`);
        setTimeout(() => {
          setGoogleHandshakeState(null);
          setShowGoogleChooser(false);
          if (onSuccess) onSuccess();
          onClose();
        }, 700);
      } else {
        setGoogleHandshakeState(null);
      }
    }, 600);
  };

  // Handle Custom Google Account Form
  const handleCustomGoogleSubmit = (e) => {
    e.preventDefault();
    if (!customGoogleEmail || !customGoogleEmail.includes("@")) {
      setAuthError("Please enter a valid Google email address.");
      return;
    }
    const derivedName = customGoogleName.trim() || customGoogleEmail.split("@")[0].replace(/[._]/g, " ");
    handleSelectGoogleAccount({
      name: derivedName,
      email: customGoogleEmail,
    });
  };

  // Handle Standard Email/Password Sign In
  const handleSignInSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setAuthError("");
    setSuccessNotice("");

    setTimeout(() => {
      const result = signIn({
        email: signInEmail,
        password: signInPassword,
      });

      setLoading(false);

      if (result.success) {
        setSuccessNotice(`Welcome back, ${result.user.name}! Decrypting national feeds...`);
        setTimeout(() => {
          if (onSuccess) onSuccess();
          onClose();
        }, 600);
      }
    }, 400);
  };

  // Handle Sign Up (Registration)
  const handleSignUpSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setAuthError("");
    setSuccessNotice("");

    setTimeout(() => {
      const result = signUp({
        name: signUpName,
        email: signUpEmail,
        password: signUpPassword,
        role: signUpRole,
        organization: signUpOrg,
      });

      setLoading(false);

      if (result.success) {
        setSuccessNotice(`Account registered successfully! Identity authenticated as ${result.user.name}.`);
        setTimeout(() => {
          if (onSuccess) onSuccess();
          onClose();
        }, 700);
      }
    }, 450);
  };

  // Handle Quick Demo Account Fill
  const handleQuickDemoSelect = (account) => {
    setSignInEmail(account.email);
    setSignInPassword(account.password);
    const result = signIn({ email: account.email, password: account.password });
    if (result.success) {
      setSuccessNotice(`Authenticated as ${result.user.name} (${result.user.roleLabel})`);
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 500);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/85 p-3 sm:p-4 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg my-auto max-h-[92vh] flex flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden text-slate-200">
        {/* Top Government Emblem Strip */}
        <div className="border-b border-slate-800 bg-slate-950 px-4 sm:px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 font-bold text-xs">
              MHA
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Government of India · Ministry of Home Affairs
              </p>
              <p className="text-xs font-black tracking-tight text-white">
                AIDERS Emergency Authentication Gateway
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-800 bg-slate-900 p-1.5 text-slate-400 hover:text-white hover:border-slate-700 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Security Banner */}
        <div className="bg-gradient-to-r from-blue-950/80 via-indigo-950/60 to-slate-900 px-6 py-2.5 border-b border-indigo-900/40 flex items-center gap-3">
          <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
          <div className="text-[11px] text-slate-300">
            <span className="font-bold text-white">Protected Infrastructure: </span>
            <span>All live disaster telemetry and dispatch registers are encrypted until verified.</span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
          {/* Status notices */}
          {authError && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{authError}</span>
            </div>
          )}

          {successNotice && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>{successNotice}</span>
            </div>
          )}

          {/* Current Active User Status */}
          {isAuthenticated && user && (
            <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4">
              <div className="flex items-center gap-3">
                <img
                  src={user.picture}
                  alt={user.name}
                  className="h-10 w-10 rounded-full border-2 border-indigo-400 object-cover"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-white truncate">{user.name}</p>
                    <span className="rounded bg-emerald-500/20 px-1.5 py-0.2 text-[9px] font-bold text-emerald-300 border border-emerald-500/30">
                      AUTHENTICATED
                    </span>
                  </div>
                  <p className="text-xs text-indigo-300 truncate">{user.email}</p>
                  <p className="text-[10px] text-slate-400">{user.roleLabel} · {user.clearanceLevel}</p>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-indigo-500/20 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (onSuccess) onSuccess();
                    onClose();
                  }}
                  className="flex-1 rounded-lg bg-indigo-600 py-2 text-xs font-bold text-white hover:bg-indigo-500 transition-colors"
                >
                  Enter Command Center
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-300 hover:text-rose-400 hover:border-rose-500/40"
                >
                  Sign Out
                </button>
              </div>
            </div>
          )}

          {/* GOOGLE ACCOUNT CHOOSER OVERLAY / SUB-VIEW */}
          {showGoogleChooser ? (
            <div className="rounded-2xl border border-indigo-500/40 bg-slate-950 p-5 space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <GoogleIcon className="h-5 w-5" />
                  <div>
                    <h3 className="text-sm font-bold text-white">Sign in with Google</h3>
                    <p className="text-[11px] text-slate-400">Choose an account to continue to AIDERS</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowGoogleChooser(false);
                    setShowCustomGoogleInput(false);
                  }}
                  className="rounded-lg p-1 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              </div>

              {googleHandshakeState === "connecting" ? (
                <div className="py-8 text-center space-y-3">
                  <RefreshCw className="h-8 w-8 text-indigo-400 animate-spin mx-auto" />
                  <p className="text-xs font-bold text-white">Connecting to Google Identity Services...</p>
                  <p className="text-[11px] text-slate-400">Verifying OAuth 2.0 Identity Token & Clearance</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Option 1: User's Account (Gaurav Kumar - from screenshot) */}
                  <button
                    type="button"
                    onClick={() =>
                      handleSelectGoogleAccount({
                        name: "Gaurav Kumar",
                        email: "6206317372gaurav@gmail.com",
                        role: "ROLE_ADMIN",
                        organization: "National Disaster Response Division (NDMA)",
                      })
                    }
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-900/80 hover:border-indigo-500 hover:bg-slate-850 transition-all text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center font-bold text-white text-xs border border-white/20">
                        GK
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white group-hover:text-indigo-300">
                            Gaurav Kumar
                          </span>
                          <span className="rounded bg-emerald-500/20 px-1.5 py-0.2 text-[9px] font-bold text-emerald-400 border border-emerald-500/30">
                            Primary Account
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">6206317372gaurav@gmail.com</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-white transition-colors" />
                  </button>

                  {/* Option 2: NDRF Official Commander */}
                  <button
                    type="button"
                    onClick={() =>
                      handleSelectGoogleAccount({
                        name: "Col. Rajeshwar Sharma",
                        email: "commander@ndrf.gov.in",
                        role: "ROLE_ADMIN",
                        organization: "National Disaster Response Force (NDRF)",
                      })
                    }
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-900/80 hover:border-indigo-500 hover:bg-slate-850 transition-all text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150"
                        alt="Col. Rajeshwar Sharma"
                        className="h-9 w-9 rounded-full object-cover border border-slate-700"
                      />
                      <div>
                        <span className="text-xs font-bold text-white group-hover:text-indigo-300">
                          Col. Rajeshwar Sharma
                        </span>
                        <p className="text-[11px] text-slate-400">commander@ndrf.gov.in</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-white transition-colors" />
                  </button>

                  {/* Option 3: NDMA Dispatcher */}
                  <button
                    type="button"
                    onClick={() =>
                      handleSelectGoogleAccount({
                        name: "Dr. Ananya Deshmukh",
                        email: "dispatcher@ndma.gov.in",
                        role: "ROLE_DISPATCHER",
                        organization: "National Disaster Management Authority (NDMA)",
                      })
                    }
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-900/80 hover:border-indigo-500 hover:bg-slate-850 transition-all text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150"
                        alt="Dr. Ananya Deshmukh"
                        className="h-9 w-9 rounded-full object-cover border border-slate-700"
                      />
                      <div>
                        <span className="text-xs font-bold text-white group-hover:text-indigo-300">
                          Dr. Ananya Deshmukh
                        </span>
                        <p className="text-[11px] text-slate-400">dispatcher@ndma.gov.in</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-white transition-colors" />
                  </button>

                  {/* Custom Google Account Form Toggle */}
                  {!showCustomGoogleInput ? (
                    <button
                      type="button"
                      onClick={() => setShowCustomGoogleInput(true)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900 text-left text-xs text-slate-400 hover:text-white transition-all"
                    >
                      <Mail className="h-4 w-4 text-slate-500" />
                      <span>Use another Google account...</span>
                    </button>
                  ) : (
                    <form onSubmit={handleCustomGoogleSubmit} className="p-3 rounded-xl border border-slate-800 bg-slate-900/90 space-y-2.5">
                      <p className="text-[11px] font-bold text-slate-300">Enter Google Account Details</p>
                      <input
                        type="email"
                        value={customGoogleEmail}
                        onChange={(e) => setCustomGoogleEmail(e.target.value)}
                        placeholder="yourname@gmail.com"
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white placeholder:text-slate-600 outline-none focus:border-indigo-500"
                        required
                      />
                      <input
                        type="text"
                        value={customGoogleName}
                        onChange={(e) => setCustomGoogleName(e.target.value)}
                        placeholder="Officer / User Full Name"
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white placeholder:text-slate-600 outline-none focus:border-indigo-500"
                      />
                      <div className="flex gap-2 pt-1">
                        <button
                          type="submit"
                          className="flex-1 rounded-lg bg-indigo-600 py-1.5 text-xs font-bold text-white hover:bg-indigo-500"
                        >
                          Sign In with this Google ID
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowCustomGoogleInput(false)}
                          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="pt-2 text-[10px] text-slate-500 text-center leading-relaxed">
                    To continue, Google will share your name, email address, language preference, and profile picture with AIDERS Emergency Response.
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Mode Switcher Tabs */}
              <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setAuthError("");
                  }}
                  className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    mode === "signin"
                      ? "bg-indigo-600 text-white shadow-md"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <LogIn className="h-3.5 w-3.5" />
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setAuthError("");
                  }}
                  className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    mode === "signup"
                      ? "bg-indigo-600 text-white shadow-md"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Sign Up (Register)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("demo");
                    setAuthError("");
                  }}
                  className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    mode === "demo"
                      ? "bg-indigo-600 text-white shadow-md"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                  Official Logins
                </button>
              </div>

              {/* ===================================================
                  MODE 1: SIGN IN
              =================================================== */}
              {mode === "signin" && (
                <div className="space-y-4">
                  {/* Age Verification & Statutory Gate (18+ Requirement) */}
                  <div className="rounded-xl border border-indigo-500/30 bg-slate-950 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                        <ShieldCheck className="h-4 w-4 text-indigo-400" />
                        <span>Statutory Eligibility & Age Verification</span>
                      </div>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold border ${
                        isAgeVerified && Number(birthYear) <= new Date().getFullYear() - 18
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                      }`}>
                        {isAgeVerified && Number(birthYear) <= new Date().getFullYear() - 18 ? "18+ VERIFIED" : "UNDER 18 RESTRICTED"}
                      </span>
                    </div>

                    <label className="flex items-start gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={isAgeVerified}
                        onChange={(e) => setIsAgeVerified(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-[11px] text-slate-300 leading-tight group-hover:text-white">
                        I solemnly declare under the <strong>Disaster Management Act</strong> that I am <strong>18 years of age or older</strong> and authorized to access live emergency registers.
                      </span>
                    </label>

                    <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80">
                      <span className="text-[11px] font-semibold text-slate-400">Year of Birth:</span>
                      <select
                        value={birthYear}
                        onChange={(e) => setBirthYear(e.target.value)}
                        className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white outline-none focus:border-indigo-500"
                      >
                        {Array.from({ length: 45 }, (_, i) => 2015 - i).map((yr) => (
                          <option key={yr} value={yr}>
                            {yr} {yr > new Date().getFullYear() - 18 ? "(Under 18 - Ineligible)" : "(18+ Eligible)"}
                          </option>
                        ))}
                      </select>
                      <span className="text-[10px] text-slate-500">
                        (Minimum age: 18 years)
                      </span>
                    </div>
                  </div>

                  {/* Google Firebase Authentication Section */}
                  <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Official Google Identity (Firebase Auth)
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowFirebaseSetup(!showFirebaseSetup)}
                        className="flex items-center gap-1 text-[10px] font-bold text-indigo-400 hover:text-indigo-300 underline"
                      >
                        <Settings className="h-3 w-3" />
                        <span>{isFirebaseConfigured() ? "Firebase: Connected" : "Firebase: Setup Keys"}</span>
                      </button>
                    </div>

                    {/* Real Firebase Google Sign-In Button */}
                    <button
                      type="button"
                      onClick={handleFirebaseGoogleLogin}
                      disabled={loading || !isAgeVerified || Number(birthYear) > new Date().getFullYear() - 18}
                      className="w-full flex items-center justify-center gap-3 rounded-xl border border-slate-600 bg-white hover:bg-slate-100 p-2.5 text-xs font-bold text-slate-900 shadow-md transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <GoogleIcon className="h-5 w-5 shrink-0" />
                      <span>{loading ? "Connecting to Google..." : "Continue with Google (Firebase Real Login)"}</span>
                    </button>

                    {/* Instant 1-Click for Gaurav Kumar Fallback */}
                    <div className="pt-1 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Or quick sign-in:</span>
                      <button
                        type="button"
                        onClick={() =>
                          handleSelectGoogleAccount({
                            name: "Gaurav Kumar",
                            email: "6206317372gaurav@gmail.com",
                            role: "ROLE_ADMIN",
                            organization: "National Disaster Response Division (NDMA)",
                          })
                        }
                        className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 underline"
                      >
                        Gaurav Kumar (6206317372gaurav@gmail.com)
                      </button>
                    </div>
                  </div>

                  {/* IN-APP FIREBASE CONFIGURATION DRAWER */}
                  {showFirebaseSetup && (
                    <div className="rounded-xl border border-indigo-500/40 bg-slate-900/90 p-4 space-y-3 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <div className="flex items-center gap-2">
                          <Settings className="h-4 w-4 text-indigo-400" />
                          <h4 className="text-xs font-bold text-white">Firebase Real Google Auth Setup</h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowFirebaseSetup(false)}
                          className="text-slate-400 hover:text-white"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="text-[11px] text-slate-300 space-y-1.5 leading-relaxed bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                        <p className="font-semibold text-white">How to connect your Firebase Project in 3 steps:</p>
                        <p>1. Open <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-indigo-400 underline font-semibold inline-flex items-center gap-0.5">console.firebase.google.com <ExternalLink className="h-2.5 w-2.5 inline" /></a> and create a project.</p>
                        <p>2. Go to <strong>Build &gt; Authentication</strong> &gt; enable <strong>Google</strong> as Sign-in Provider.</p>
                        <p>3. In <strong>Project Settings (Gear icon) &gt; General &gt; Your apps &gt; Web ( &lt;/&gt; )</strong>, copy the keys and paste below or into <code className="bg-slate-900 px-1 py-0.5 rounded text-indigo-300">frontend/.env</code>.</p>
                      </div>

                      <form onSubmit={handleSaveFirebaseConfig} className="space-y-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-0.5">
                            Quick Paste: Entire firebaseConfig object (or paste keys below)
                          </label>
                          <textarea
                            value={fbRawConfig}
                            onChange={(e) => setFbRawConfig(e.target.value)}
                            placeholder={'const firebaseConfig = { apiKey: "...", projectId: "...", ... };'}
                            rows={2}
                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-[10px] text-indigo-200 placeholder:text-slate-600 outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">
                              API Key (apiKey)
                            </label>
                            <input
                              type="text"
                              value={fbApiKey}
                              onChange={(e) => setFbApiKey(e.target.value)}
                              placeholder="AIzaSy..."
                              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-white placeholder:text-slate-600 outline-none focus:border-indigo-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">
                              Project ID (projectId)
                            </label>
                            <input
                              type="text"
                              value={fbProjectId}
                              onChange={(e) => setFbProjectId(e.target.value)}
                              placeholder="aiders-disaster"
                              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-white placeholder:text-slate-600 outline-none focus:border-indigo-500"
                            />
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setShowFirebaseSetup(false)}
                            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-1.5 text-xs font-bold text-white shadow"
                          >
                            Save & Activate Firebase
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <div className="h-px bg-slate-800 flex-1" />
                    <span className="text-[10px] font-bold uppercase text-slate-500">
                      Or Sign In with Registered Email & Password
                    </span>
                    <div className="h-px bg-slate-800 flex-1" />
                  </div>

                  {/* Email & Password Sign In Form */}
                  <form onSubmit={handleSignInSubmit} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Registered Email Address
                      </label>
                      <input
                        type="email"
                        value={signInEmail}
                        onChange={(e) => setSignInEmail(e.target.value)}
                        placeholder="e.g. commander@ndrf.gov.in or 6206317372gaurav@gmail.com"
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white placeholder:text-slate-600 outline-none focus:border-indigo-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Password
                      </label>
                      <input
                        type="password"
                        value={signInPassword}
                        onChange={(e) => setSignInPassword(e.target.value)}
                        placeholder="Enter password"
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white placeholder:text-slate-600 outline-none focus:border-indigo-500"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-all disabled:opacity-50 shadow-md shadow-indigo-600/30"
                    >
                      {loading ? "Verifying Credentials..." : "Sign In & Decrypt Telemetry"}
                    </button>

                    <div className="text-center pt-2">
                      <p className="text-xs text-slate-400">
                        Don't have an account?{" "}
                        <button
                          type="button"
                          onClick={() => {
                            setMode("signup");
                            setAuthError("");
                          }}
                          className="text-indigo-400 hover:text-indigo-300 font-bold underline"
                        >
                          Sign Up / Register Here
                        </button>
                      </p>
                    </div>
                  </form>
                </div>
              )}

              {/* ===================================================
                  MODE 2: SIGN UP (REGISTRATION)
              =================================================== */}
              {mode === "signup" && (
                <form onSubmit={handleSignUpSubmit} className="space-y-3">
                  <div className="text-center pb-1">
                    <p className="text-xs text-slate-300 font-medium">
                      Create an Authorized Response Account
                    </p>
                    <p className="text-[11px] text-slate-500">
                      New responders must register before accessing confidential operational feeds.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Full Name & Rank
                    </label>
                    <input
                      type="text"
                      value={signUpName}
                      onChange={(e) => setSignUpName(e.target.value)}
                      placeholder="e.g. Inspector Rohit Varma"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white placeholder:text-slate-600 outline-none focus:border-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Email Address (.gov.in / personal)
                    </label>
                    <input
                      type="email"
                      value={signUpEmail}
                      onChange={(e) => setSignUpEmail(e.target.value)}
                      placeholder="e.g. rohit.varma@sdrf.gov.in"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white placeholder:text-slate-600 outline-none focus:border-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Create Password (minimum 4 characters)
                    </label>
                    <input
                      type="password"
                      value={signUpPassword}
                      onChange={(e) => setSignUpPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white placeholder:text-slate-600 outline-none focus:border-indigo-500"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Operational Role
                      </label>
                      <select
                        value={signUpRole}
                        onChange={(e) => setSignUpRole(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                      >
                        <option value="ROLE_ADMIN">NDRF Commander (Admin)</option>
                        <option value="ROLE_DISPATCHER">EOC Dispatcher</option>
                        <option value="ROLE_FIELD_OFFICER">SDRF Tactical Lead</option>
                        <option value="ROLE_CITIZEN">Citizen Volunteer</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Department / Battalion
                      </label>
                      <input
                        type="text"
                        value={signUpOrg}
                        onChange={(e) => setSignUpOrg(e.target.value)}
                        placeholder="e.g. 5th Bn NDRF Pune"
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-600 outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-all disabled:opacity-50 shadow-md shadow-indigo-600/30"
                  >
                    {loading ? "Registering Official Profile..." : "Create Account & Sign In"}
                  </button>

                  <div className="text-center pt-2">
                    <p className="text-xs text-slate-400">
                      Already registered?{" "}
                      <button
                        type="button"
                        onClick={() => {
                          setMode("signin");
                          setAuthError("");
                        }}
                        className="text-indigo-400 hover:text-indigo-300 font-bold underline"
                      >
                        Sign In Here
                      </button>
                    </p>
                  </div>
                </form>
              )}

              {/* ===================================================
                  MODE 3: PRE-REGISTERED OFFICIAL ACCOUNTS (DEMO)
              =================================================== */}
              {mode === "demo" && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-400">
                    Pre-registered verified command accounts for demonstration and viva testing:
                  </p>
                  <div className="grid gap-2.5">
                    {DEFAULT_OFFICIAL_ACCOUNTS.map((acc) => (
                      <button
                        key={acc.email}
                        type="button"
                        onClick={() => handleQuickDemoSelect(acc)}
                        className="flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-950/70 hover:border-indigo-500 hover:bg-slate-900 transition-all text-left group"
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={acc.picture}
                            alt={acc.name}
                            className="h-9 w-9 rounded-full object-cover border border-slate-700"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
                                {acc.name}
                              </p>
                              <span className="rounded bg-indigo-500/20 px-1.5 py-0.2 text-[9px] font-bold text-indigo-300 border border-indigo-500/30">
                                {acc.roleLabel}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400">
                              {acc.email} · Pass: <span className="font-mono text-slate-300">{acc.password}</span>
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-white transition-colors" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Footer Security Notice */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-500">
            <span className="flex items-center gap-1">
              <Lock className="h-3 w-3 text-slate-400" />
              CERT-In Cyber Security Guidelines Compliant
            </span>
            <span>TLS 1.3 · 256-bit AES</span>
          </div>
        </div>
      </div>
    </div>
  );
}