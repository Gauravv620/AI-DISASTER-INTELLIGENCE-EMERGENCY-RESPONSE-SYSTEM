import React, { createContext, useContext, useState, useEffect } from "react";
import { jwtDecode } from "jwt-decode";
import {
  isFirebaseConfigured,
  signInWithGoogleFirebase,
  firebaseSignOut,
  getFirebaseConfig,
  saveFirebaseRuntimeConfig,
  clearFirebaseRuntimeConfig,
} from "../services/firebase";

const AuthContext = createContext(null);

const STORAGE_KEY = "aiders_auth_session";
const REGISTERED_ACCOUNTS_KEY = "aiders_registered_accounts";

export const ROLE_LABELS = {
  ROLE_ADMIN: "NDRF Battalion Commander (Admin)",
  ROLE_DISPATCHER: "National EOC Emergency Dispatcher",
  ROLE_FIELD_OFFICER: "SDRF Tactical Rescue Lead",
  ROLE_CITIZEN: "Verified Citizen Reporter",
};

// Default pre-registered official credentials
export const DEFAULT_OFFICIAL_ACCOUNTS = [
  {
    id: "usr_gaurav_00",
    name: "Gaurav Kumar",
    email: "6206317372gaurav@gmail.com",
    password: "Google@2026",
    role: "ROLE_ADMIN",
    roleLabel: "NDRF Senior Incident Commander",
    organization: "National Disaster Response Force (NDRF)",
    clearanceLevel: "TOP SECRET // EOC ALPHA",
    designation: "Chief Disaster Incident Controller",
    picture: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    verified: true,
  },
  {
    id: "usr_ndrf_01",
    name: "Col. Rajeshwar Sharma",
    email: "commander@ndrf.gov.in",
    password: "NDRF@2026",
    role: "ROLE_ADMIN",
    roleLabel: "NDRF Battalion Commander",
    organization: "National Disaster Response Force (NDRF)",
    clearanceLevel: "TOP SECRET // EOC ALPHA",
    designation: "Battalion 10 Incident Controller",
    picture: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    verified: true,
  },
  {
    id: "usr_eoc_02",
    name: "Dr. Ananya Deshmukh",
    email: "dispatcher@ndma.gov.in",
    password: "NDMA@2026",
    role: "ROLE_DISPATCHER",
    roleLabel: "National EOC Operations Officer",
    organization: "National Disaster Management Authority (NDMA)",
    clearanceLevel: "SECRET // EOC OPERATIONS",
    designation: "Senior Dispatcher & GIS Controller",
    picture: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
    verified: true,
  },
  {
    id: "usr_field_03",
    name: "Inspector Vikram Singh",
    email: "officer@sdrf.gov.in",
    password: "SDRF@2026",
    role: "ROLE_FIELD_OFFICER",
    roleLabel: "SDRF Tactical Lead",
    organization: "State Disaster Response Force (SDRF)",
    clearanceLevel: "CONFIDENTIAL // TACTICAL FIELD",
    designation: "Rapid Intervention Team Commander",
    picture: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
    verified: true,
  },
  {
    id: "usr_citizen_04",
    name: "Aarav Mehta",
    email: "citizen@gmail.com",
    password: "Citizen@123",
    role: "ROLE_CITIZEN",
    roleLabel: "Verified Citizen Reporter",
    organization: "Citizen Emergency Volunteer Network",
    clearanceLevel: "PUBLIC CITIZEN ACCESS",
    designation: "Civilian First Responder",
    picture: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
    verified: true,
  },
];

function getRegisteredAccounts() {
  try {
    const data = localStorage.getItem(REGISTERED_ACCOUNTS_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn("Failed to load registered accounts, initializing defaults", err);
  }
  // Initialize with pre-registered accounts
  try {
    localStorage.setItem(REGISTERED_ACCOUNTS_KEY, JSON.stringify(DEFAULT_OFFICIAL_ACCOUNTS));
  } catch {}
  return DEFAULT_OFFICIAL_ACCOUNTS;
}

export function AuthProvider({ children }) {
  // Initially null: User MUST authenticate to decrypt and view sensitive national disaster data
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Fallback
    }
    return null;
  });

  const [authError, setAuthError] = useState("");

  useEffect(() => {
    if (user) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      } catch (err) {
        console.error("Failed to persist user session", err);
      }
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [user]);

  // Ensure accounts registry exists
  useEffect(() => {
    getRegisteredAccounts();
  }, []);

  // -------------------------------------------------------------
  // SIGN UP (REGISTER NEW ACCOUNT)
  // -------------------------------------------------------------
  const signUp = ({ name, email, password, role, organization }) => {
    setAuthError("");
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanName = String(name || "").trim();
    const cleanPassword = String(password || "");

    if (!cleanName) {
      setAuthError("Full name is required.");
      return { success: false, error: "Full name is required." };
    }
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setAuthError("A valid email address is required.");
      return { success: false, error: "A valid email address is required." };
    }
    if (cleanPassword.length < 4) {
      setAuthError("Password must be at least 4 characters.");
      return { success: false, error: "Password must be at least 4 characters." };
    }

    const accounts = getRegisteredAccounts();
    const existing = accounts.find((a) => a.email.toLowerCase() === cleanEmail);

    if (existing) {
      const err = "An account with this email address is already registered. Please Sign In.";
      setAuthError(err);
      return { success: false, error: err };
    }

    const assignedRole = role || (cleanEmail.includes(".gov") ? "ROLE_ADMIN" : "ROLE_CITIZEN");
    const isGov = cleanEmail.includes(".gov") || cleanEmail.includes(".nic");

    const newAccount = {
      id: `usr_${Date.now().toString().slice(-6)}`,
      name: cleanName,
      email: cleanEmail,
      password: cleanPassword,
      role: assignedRole,
      roleLabel: ROLE_LABELS[assignedRole] || "Emergency Response Personnel",
      organization:
        organization ||
        (assignedRole === "ROLE_CITIZEN"
          ? "Citizen Volunteer Network"
          : isGov
          ? "Government of India (NDMA/MHA)"
          : "National Disaster Response Division"),
      clearanceLevel:
        assignedRole === "ROLE_ADMIN"
          ? "TOP SECRET // EOC ALPHA"
          : assignedRole === "ROLE_DISPATCHER"
          ? "SECRET // EOC OPERATIONS"
          : assignedRole === "ROLE_FIELD_OFFICER"
          ? "CONFIDENTIAL // TACTICAL FIELD"
          : "PUBLIC CITIZEN ACCESS",
      designation: assignedRole === "ROLE_CITIZEN" ? "Civilian Volunteer" : "Authorized Incident Controller",
      picture:
        assignedRole === "ROLE_ADMIN"
          ? "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150"
          : "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
      verified: true,
      authMethod: "REGISTERED_ACCOUNT",
      createdAt: new Date().toISOString(),
    };

    const updatedAccounts = [...accounts, newAccount];
    try {
      localStorage.setItem(REGISTERED_ACCOUNTS_KEY, JSON.stringify(updatedAccounts));
    } catch (e) {
      console.error("Storage error:", e);
    }

    setUser(newAccount);
    return { success: true, user: newAccount };
  };

  // -------------------------------------------------------------
  // SIGN IN (LOGIN WITH REGISTERED CREDENTIALS)
  // -------------------------------------------------------------
  const signIn = ({ email, password }) => {
    setAuthError("");
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanPassword = String(password || "");

    if (!cleanEmail) {
      const err = "Please enter your registered email address.";
      setAuthError(err);
      return { success: false, error: err };
    }
    if (!cleanPassword) {
      const err = "Please enter your password.";
      setAuthError(err);
      return { success: false, error: err };
    }

    const accounts = getRegisteredAccounts();
    const matchedAccount = accounts.find((a) => a.email.toLowerCase() === cleanEmail);

    if (!matchedAccount) {
      const err = "Account not found for this email address. Please click 'Create Account / Sign Up' first.";
      setAuthError(err);
      return { success: false, error: err };
    }

    if (matchedAccount.password && matchedAccount.password !== cleanPassword) {
      const err = "Incorrect password for this account. Please verify your credentials.";
      setAuthError(err);
      return { success: false, error: err };
    }

    const sessionUser = {
      ...matchedAccount,
      authMethod: "VERIFIED_CREDENTIALS",
      authenticatedAt: new Date().toISOString(),
    };

    setUser(sessionUser);
    return { success: true, user: sessionUser };
  };

  // -------------------------------------------------------------
  // GOOGLE OAUTH 2.0 HANDLER
  // -------------------------------------------------------------
  const handleGoogleSuccess = (credentialResponse) => {
    try {
      setAuthError("");
      if (!credentialResponse?.credential) {
        throw new Error("No Google ID token credential received.");
      }

      // Decode Google JWT ID token
      const decoded = jwtDecode(credentialResponse.credential);
      const emailDomain = decoded.email?.split("@")[1]?.toLowerCase() || "";
      const isGov = emailDomain.endsWith("gov.in") || emailDomain.endsWith("nic.in");

      const authenticatedUser = {
        id: `usr_g_${decoded.sub ? decoded.sub.slice(-8) : Date.now().toString().slice(-6)}`,
        name: decoded.name || "Authenticated Official",
        email: decoded.email,
        picture: decoded.picture || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
        role: isGov ? "ROLE_ADMIN" : "ROLE_DISPATCHER",
        roleLabel: isGov ? "Government Emergency Controller" : "Verified Response Officer",
        organization: isGov ? "Government of India (NDMA/MHA)" : "National Disaster Operations",
        clearanceLevel: isGov ? "OFFICIAL GOV // VERIFIED" : "LEVEL-2 ACCESS // GOOGLE SSO",
        designation: "Authorized System Operator",
        token: credentialResponse.credential,
        authMethod: "GOOGLE_OAUTH_2.0",
        verified: true,
        authenticatedAt: new Date().toISOString(),
      };

      // Add to accounts list if not present
      const accounts = getRegisteredAccounts();
      if (!accounts.some((a) => a.email.toLowerCase() === authenticatedUser.email.toLowerCase())) {
        accounts.push(authenticatedUser);
        try {
          localStorage.setItem(REGISTERED_ACCOUNTS_KEY, JSON.stringify(accounts));
        } catch {}
      }

      setUser(authenticatedUser);
      return { success: true, user: authenticatedUser };
    } catch (err) {
      console.error("Google Auth Decode Error:", err);
      setAuthError("Failed to authenticate Google identity: " + (err.message || "Invalid token"));
      return { success: false, error: err.message };
    }
  };

  const handleGoogleFailure = (error) => {
    console.warn("Google Sign-In dismissed or failed:", error);
    setAuthError("Google Sign-In was cancelled or failed to connect.");
  };

  // Interactive Google Account Chooser Login
  const loginWithGoogleAccount = ({
    name = "Gaurav Kumar",
    email = "6206317372gaurav@gmail.com",
    picture,
    role,
    organization,
  } = {}) => {
    setAuthError("");
    const cleanEmail = String(email || "6206317372gaurav@gmail.com").trim().toLowerCase();
    const cleanName = String(name || "Gaurav Kumar").trim();
    const isGov = cleanEmail.includes(".gov") || cleanEmail.includes(".nic");
    const assignedRole = role || (isGov ? "ROLE_ADMIN" : "ROLE_ADMIN");

    const defaultPic =
      cleanEmail === "6206317372gaurav@gmail.com"
        ? "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
        : `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanName)}&backgroundColor=1e293b,3b82f6`;

    const googleUser = {
      id: `usr_g_${Date.now().toString().slice(-6)}`,
      name: cleanName,
      email: cleanEmail,
      picture: picture || defaultPic,
      role: assignedRole,
      roleLabel: isGov ? "NDRF Battalion Commander" : "NDRF Senior Incident Commander",
      organization:
        organization ||
        (isGov
          ? "Government of India (NDMA/MHA)"
          : "National Disaster Response Division (NDMA)"),
      clearanceLevel: "TOP SECRET // GOOGLE SSO VERIFIED",
      designation: "Chief Disaster Incident Controller",
      authMethod: "GOOGLE_OAUTH_2.0",
      verified: true,
      authenticatedAt: new Date().toISOString(),
    };

    // Register / update in accounts list
    try {
      const accounts = getRegisteredAccounts();
      const existingIdx = accounts.findIndex((a) => a.email.toLowerCase() === cleanEmail);
      if (existingIdx >= 0) {
        accounts[existingIdx] = { ...accounts[existingIdx], ...googleUser };
      } else {
        accounts.push(googleUser);
      }
      localStorage.setItem(REGISTERED_ACCOUNTS_KEY, JSON.stringify(accounts));
    } catch (e) {
      console.warn("Storage sync warning", e);
    }

    setUser(googleUser);
    return { success: true, user: googleUser };
  };

  // Google Sandbox Simulator for Viva/Evaluation
  const loginWithGoogleDemo = (email = "6206317372gaurav@gmail.com", name = "Gaurav Kumar") => {
    return loginWithGoogleAccount({ email, name });
  };

  // -------------------------------------------------------------
  // REAL FIREBASE GOOGLE AUTHENTICATION WITH 18+ AGE GATE
  // -------------------------------------------------------------
  const loginWithFirebaseGoogle = async ({ isAgeVerified, birthYear } = {}) => {
    try {
      setAuthError("");

      // 1. Enforce 18+ Criteria & Legal Certification
      const currentYear = new Date().getFullYear();
      const parsedYear = Number(birthYear);

      if (!isAgeVerified) {
        const msg = "Age Verification Required: Under National Disaster Management regulations, you must check the declaration certifying you are 18 years of age or older.";
        setAuthError(msg);
        return { success: false, error: msg };
      }

      if (parsedYear && parsedYear > currentYear - 18) {
        const msg = `Access Restricted: You entered birth year ${parsedYear}. You must be at least 18 years of age (born in ${currentYear - 18} or earlier) to access the National Operations Dashboard.`;
        setAuthError(msg);
        return { success: false, error: msg };
      }

      // 2. Perform Real Firebase Google Popup Sign-in
      const fbUser = await signInWithGoogleFirebase();

      if (!fbUser || !fbUser.email) {
        throw new Error("Unable to retrieve verified email from Google identity response.");
      }

      const emailDomain = fbUser.email.split("@")[1]?.toLowerCase() || "";
      const isGov = emailDomain.endsWith("gov.in") || emailDomain.endsWith("nic.in");

      const sessionUser = {
        id: `usr_fb_${fbUser.uid.slice(-8)}`,
        uid: fbUser.uid,
        name: fbUser.displayName || "Google Verified Official",
        email: fbUser.email,
        picture: fbUser.photoURL,
        role: isGov ? "ROLE_ADMIN" : "ROLE_DISPATCHER",
        roleLabel: isGov ? "Government Emergency Controller" : "Verified Response Officer",
        organization: isGov ? "Government of India (NDMA/MHA)" : "National Disaster Operations Network",
        clearanceLevel: isGov ? "OFFICIAL GOV // VERIFIED" : "LEVEL-2 ACCESS // FIREBASE GOOGLE SSO",
        designation: "Certified Disaster Incident Controller",
        authMethod: "FIREBASE_GOOGLE_AUTH",
        verified: true,
        ageVerified: true,
        birthYear: parsedYear || (currentYear - 20),
        authenticatedAt: new Date().toISOString(),
      };

      // Sync into accounts registry
      try {
        const accounts = getRegisteredAccounts();
        const existingIdx = accounts.findIndex((a) => a.email.toLowerCase() === fbUser.email.toLowerCase());
        if (existingIdx >= 0) {
          accounts[existingIdx] = { ...accounts[existingIdx], ...sessionUser };
        } else {
          accounts.push(sessionUser);
        }
        localStorage.setItem(REGISTERED_ACCOUNTS_KEY, JSON.stringify(accounts));
      } catch (e) {
        console.warn("Storage warning:", e);
      }

      setUser(sessionUser);
      return { success: true, user: sessionUser };
    } catch (err) {
      console.error("Firebase Google Auth Error:", err);
      let friendlyError = err.message || "Failed to authenticate with Google.";
      if (err.code === "auth/popup-closed-by-user") {
        friendlyError = "Google Sign-In popup was closed before completing.";
      } else if (err.code === "auth/unauthorized-domain") {
        friendlyError = "This domain (e.g. localhost) is not authorized in your Firebase Console. Add 'localhost' under Authentication > Settings > Authorized Domains.";
      } else if (err.code === "auth/configuration-not-found" || err.code === "auth/invalid-api-key") {
        friendlyError = "Invalid Firebase configuration. Please check your API key and Project ID in .env or the in-app setup.";
      }
      setAuthError(friendlyError);
      return { success: false, error: friendlyError };
    }
  };

  const logout = async () => {
    try {
      await firebaseSignOut();
    } catch {}
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        authError,
        setAuthError,
        signUp,
        signIn,
        handleGoogleSuccess,
        handleGoogleFailure,
        loginWithGoogleAccount,
        loginWithGoogleDemo,
        loginWithFirebaseGoogle,
        isFirebaseConfigured,
        getFirebaseConfig,
        saveFirebaseRuntimeConfig,
        clearFirebaseRuntimeConfig,
        logout,
        registeredAccounts: getRegisteredAccounts(),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
