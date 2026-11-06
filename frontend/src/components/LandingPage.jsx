import React, { useState } from "react";
import {
  ShieldAlert,
  BrainCircuit,
  Map,
  Siren,
  Radio,
  Users,
  Activity,
  PhoneCall,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Award,
  Lock,
  Building2,
  Sparkles,
  ArrowRight,
  Zap,
  Globe2,
  Cpu,
  GraduationCap,
  ShieldCheck,
  Star,
  User,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export default function LandingPage({
  onEnterCommand,
  onOpenCitizenPortal,
  onOpenAIVision,
  onOpenGIS,
  onOpenOperations,
  onOpenHelplines,
  onOpenAuth,
}) {
  const { user, isAuthenticated } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#050b16] text-slate-100 font-sans relative overflow-x-hidden selection:bg-indigo-500/40">
      {/* Background Ambient Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[550px] bg-gradient-to-b from-indigo-600/15 via-blue-700/10 to-transparent rounded-full blur-[160px] pointer-events-none -z-10" />
      <div className="absolute top-[800px] left-10 w-[500px] h-[500px] bg-rose-600/5 rounded-full blur-[180px] pointer-events-none -z-10" />
      <div className="absolute top-[1400px] right-10 w-[600px] h-[600px] bg-emerald-600/5 rounded-full blur-[180px] pointer-events-none -z-10" />

      {/* =======================================================
          TOP OFFICIAL GOVERNMENT BANNER
      ======================================================= */}
      <div className="border-b border-slate-800 bg-slate-950 px-4 py-2 text-[11px] text-slate-400">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-slate-800 text-[10px] font-black text-amber-400 border border-slate-700">
              GOI
            </div>
            <span className="font-medium text-slate-300">
              Government of India · Ministry of Home Affairs · National Disaster Management Authority
            </span>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onOpenHelplines}
              className="flex items-center gap-1.5 text-rose-400 hover:text-rose-300 font-bold transition-colors"
            >
              <PhoneCall className="w-3.5 h-3.5 animate-pulse" />
              National Hotlines: 112 / 1078 (24x7)
            </button>
            <span className="hidden sm:inline text-slate-700">|</span>
            <span className="hidden md:inline rounded bg-emerald-500/20 px-2 py-0.5 text-[9px] font-bold text-emerald-400 border border-emerald-500/30">
              CERT-In CERTIFIED EOC GATEWAY
            </span>
          </div>
        </div>
      </div>

      {/* =======================================================
          MAIN NAVIGATION HEADER
      ======================================================= */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#060c18]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-3.5 sm:px-6">
          {/* Logo & Platform Name */}
          <div className="flex items-center gap-3">
            <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-blue-600 to-indigo-800 shadow-lg shadow-indigo-600/30">
              <ShieldAlert className="h-6 w-6 text-white" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight text-white">
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

          {/* Quick Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <a href="#features" className="hover:text-indigo-400 transition-colors">
              Core Capabilities
            </a>
            <a href="#ai-vision" className="hover:text-indigo-400 transition-colors">
              Vision AI Model
            </a>
            <a href="#architecture" className="hover:text-indigo-400 transition-colors">
              National Architecture
            </a>
            <a href="#team" className="hover:text-indigo-400 transition-colors">
              Core Team
            </a>
          </nav>

          {/* Action CTAs & Mobile Menu Toggle */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onOpenCitizenPortal}
              className="hidden sm:flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2 text-xs font-bold text-rose-300 hover:bg-rose-500/20 transition-all shadow-sm"
            >
              <Radio className="h-3.5 w-3.5 text-rose-400 animate-pulse" />
              Citizen SOS
            </button>

            {isAuthenticated && user ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onEnterCommand}
                  className="flex items-center gap-2 rounded-xl bg-indigo-600 px-3 sm:px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 transition-all shadow-md shadow-indigo-600/30"
                >
                  <ShieldAlert className="h-4 w-4" />
                  <span className="hidden sm:inline">Enter Command Portal</span>
                  <span className="sm:hidden">Command</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenAuth}
                  title={`Signed in as ${user.name}`}
                  className="rounded-xl border border-slate-700 bg-slate-800 p-1 hover:border-slate-600"
                >
                  <img
                    src={user.picture}
                    alt={user.name}
                    className="h-8 w-8 rounded-lg object-cover"
                  />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenAuth}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-3 sm:px-4 py-2 text-xs font-bold text-white hover:brightness-110 transition-all shadow-lg shadow-indigo-600/30"
              >
                <Lock className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign In / Official Access</span>
                <span className="sm:hidden">Sign In</span>
              </button>
            )}

            {/* Mobile Navigation Toggle Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden rounded-xl border border-slate-800 bg-slate-900/90 p-2 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-800/80 bg-[#060c18] px-4 py-4 space-y-3 shadow-2xl animate-in slide-in-from-top-3 duration-200">
            <nav className="space-y-1">
              <a
                href="#features"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-900 hover:text-indigo-400"
              >
                <ShieldAlert className="h-4 w-4 text-indigo-400" />
                Core Capabilities
              </a>
              <a
                href="#ai-vision"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-900 hover:text-indigo-400"
              >
                <BrainCircuit className="h-4 w-4 text-purple-400" />
                Vision AI Model Lab
              </a>
              <a
                href="#architecture"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-900 hover:text-indigo-400"
              >
                <Globe2 className="h-4 w-4 text-blue-400" />
                National Architecture
              </a>
              <a
                href="#team"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-900 hover:text-indigo-400"
              >
                <Users className="h-4 w-4 text-emerald-400" />
                Core Engineering Team
              </a>
            </nav>

            <div className="pt-2 border-t border-slate-800/80 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenCitizenPortal();
                }}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-rose-600/20 border border-rose-500/40 py-2.5 text-xs font-bold text-rose-300"
              >
                <Radio className="h-3.5 w-3.5 text-rose-400 animate-pulse" />
                Citizen SOS
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenHelplines();
                }}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-800 border border-slate-700 py-2.5 text-xs font-bold text-slate-200"
              >
                <PhoneCall className="h-3.5 w-3.5 text-amber-400" />
                Hotlines (112)
              </button>
            </div>
          </div>
        )}
      </header>

      {/* =======================================================
          HERO SECTION
      ======================================================= */}
      <section className="relative pt-16 pb-20 px-4 sm:px-6">
        <div className="mx-auto max-w-[1280px] text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-semibold text-indigo-300 mb-6 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            <span>National Disaster Management Infrastructure · AI-Powered Emergency Operations</span>
          </div>

          {/* Main Headline */}
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white max-w-4xl mx-auto leading-tight">
            AI Disaster Intelligence &{" "}
            <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Automated Rapid Rescue
            </span>{" "}
            System
          </h2>

          <p className="mt-6 text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Unifying multi-hazard telemetry from IMD, USGS & CWC with zero-shot computer vision damage verification and cost-optimized battalion auto-dispatch for real-time national incident management.
          </p>

          {/* Primary Action Buttons */}
          <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3 sm:gap-4 max-w-xl sm:max-w-none mx-auto">
            <button
              type="button"
              onClick={onEnterCommand}
              className="w-full sm:w-auto flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 px-6 py-3.5 text-xs sm:text-sm font-black uppercase tracking-wider text-white shadow-xl shadow-indigo-600/30 hover:scale-[1.02] active:scale-95 transition-all"
            >
              <ShieldAlert className="h-5 w-5" />
              <span>Launch Command Center</span>
              <ArrowRight className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={onOpenCitizenPortal}
              className="w-full sm:w-auto flex items-center justify-center gap-2.5 rounded-xl border border-rose-500/50 bg-rose-500/15 px-6 py-3.5 text-xs sm:text-sm font-black uppercase tracking-wider text-rose-300 shadow-xl shadow-rose-600/20 hover:bg-rose-500/25 active:scale-95 transition-all"
            >
              <Radio className="h-5 w-5 text-rose-400 animate-pulse" />
              <span>Citizen Emergency SOS Portal</span>
            </button>

            <button
              type="button"
              onClick={onOpenAIVision}
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-5 py-3.5 text-xs sm:text-sm font-bold text-slate-200 hover:bg-slate-800 hover:border-slate-600 transition-all"
            >
              <BrainCircuit className="h-5 w-5 text-purple-400" />
              <span>AI Damage Classifier Lab</span>
            </button>
          </div>

          {/* Key Verified Metrics Strip */}
          <div className="mt-10 sm:mt-14 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 max-w-4xl mx-auto">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-3.5 sm:p-5 backdrop-blur">
              <p className="text-2xl sm:text-3xl font-black text-emerald-400">85.4%</p>
              <p className="text-xs font-bold text-white mt-1">CLIP Vision Accuracy</p>
              <p className="text-[10px] text-slate-400 mt-0.5">ViT-B/32 Zero-Shot Benchmark</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-3.5 sm:p-5 backdrop-blur">
              <p className="text-2xl sm:text-3xl font-black text-indigo-400">100%</p>
              <p className="text-xs font-bold text-white mt-1">NLP Alert Classification</p>
              <p className="text-[10px] text-slate-400 mt-0.5">SACHET & IMD Severity</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-3.5 sm:p-5 backdrop-blur">
              <p className="text-2xl sm:text-3xl font-black text-rose-400">&lt; 3.2s</p>
              <p className="text-xs font-bold text-white mt-1">AI Triage to Dispatch</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Cost-Weighted Haversine ETA</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-3.5 sm:p-5 backdrop-blur">
              <p className="text-2xl sm:text-3xl font-black text-sky-400">6 NDRF</p>
              <p className="text-xs font-bold text-white mt-1">Response Battalions</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Ready for National Mobilization</p>
            </div>
          </div>
        </div>
      </section>

      {/* =======================================================
          CORE PILLARS SECTION
      ======================================================= */}
      <section id="features" className="py-20 px-4 sm:px-6 border-t border-slate-800/80 bg-slate-950/40">
        <div className="mx-auto max-w-[1300px]">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="rounded bg-indigo-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-indigo-300 border border-indigo-500/30">
              National Defense Architecture
            </span>
            <h3 className="mt-4 text-3xl sm:text-4xl font-black text-white">
              End-to-End Autonomous Emergency Operations
            </h3>
            <p className="mt-3 text-sm text-slate-400">
              Engineered to replace slow bureaucratic escalations with direct AI-verified sensory pipelines.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {/* Card 1 */}
            <div
              onClick={onEnterCommand}
              className="relative rounded-2xl border border-slate-800 bg-slate-900/40 p-6 backdrop-blur hover:border-purple-500 hover:scale-[1.02] cursor-pointer transition-all group shadow-xl"
            >
              <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-3 text-purple-400 w-fit mb-4 group-hover:bg-purple-500/20 transition-colors">
                <BrainCircuit className="h-6 w-6" />
              </div>
              <h4 className="text-base font-bold text-white mb-2 flex items-center justify-between">
                <span>1. Zero-Shot Vision AI</span>
                <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-purple-400 group-hover:translate-x-1 transition-all" />
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                OpenAI CLIP ViT-B/32 multimodal foundation model classifies incoming disaster footage across 11 hyper-specific hazard categories without manual labelling.
              </p>
              <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-purple-400">
                <span>BENCHMARK: 85.4%</span>
                <span>OPEN LAB →</span>
              </div>
            </div>

            {/* Card 2 */}
            <div
              onClick={onEnterCommand}
              className="relative rounded-2xl border border-slate-800 bg-slate-900/40 p-6 backdrop-blur hover:border-blue-500 hover:scale-[1.02] cursor-pointer transition-all group shadow-xl"
            >
              <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-blue-400 w-fit mb-4 group-hover:bg-blue-500/20 transition-colors">
                <Map className="h-6 w-6" />
              </div>
              <h4 className="text-base font-bold text-white mb-2 flex items-center justify-between">
                <span>2. Subcontinent GIS Map</span>
                <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Leaflet-driven geospatial command visualizing live USGS earthquake faults, Central Water Commission flood hydrographs, and Geological Survey of India landslide polygons.
              </p>
              <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-blue-400">
                <span>SUB-SECOND TILES</span>
                <span>VIEW GIS →</span>
              </div>
            </div>

            {/* Card 3 */}
            <div
              onClick={onEnterCommand}
              className="relative rounded-2xl border border-slate-800 bg-slate-900/40 p-6 backdrop-blur hover:border-rose-500 hover:scale-[1.02] cursor-pointer transition-all group shadow-xl"
            >
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-rose-400 w-fit mb-4 group-hover:bg-rose-500/20 transition-colors">
                <Siren className="h-6 w-6" />
              </div>
              <h4 className="text-base font-bold text-white mb-2 flex items-center justify-between">
                <span>3. Cost-Weighted Auto Dispatch</span>
                <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-rose-400 group-hover:translate-x-1 transition-all" />
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Calculates great-circle Haversine distances to all 6 NDRF/SDRF battalions and scores by operational readiness to immediately mobilize the nearest response unit.
              </p>
              <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-rose-400">
                <span>HAVERSINE MATRIX</span>
                <span>DISPATCH HUB →</span>
              </div>
            </div>

            {/* Card 4 */}
            <div
              onClick={onEnterCommand}
              className="relative rounded-2xl border border-slate-800 bg-slate-900/40 p-6 backdrop-blur hover:border-emerald-500 hover:scale-[1.02] cursor-pointer transition-all group shadow-xl"
            >
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-400 w-fit mb-4 group-hover:bg-emerald-500/20 transition-colors">
                <Radio className="h-6 w-6" />
              </div>
              <h4 className="text-base font-bold text-white mb-2 flex items-center justify-between">
                <span>4. Citizen SOS Verification</span>
                <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Public portal allowing trapped civilians to upload geo-tagged disaster photos. The pipeline checks for authentic perils, creates an official EOC incident, and alerts teams.
              </p>
              <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-emerald-400">
                <span>NO BARRIER SOS</span>
                <span>OPEN PORTAL →</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =======================================================
          AI VISION PERFORMANCE SHOWCASE
      ======================================================= */}
      <section id="ai-vision" className="py-20 px-4 sm:px-6 border-t border-slate-800/80">
        <div className="mx-auto max-w-[1280px]">
          <div className="grid gap-12 lg:grid-cols-2 items-center">
            <div>
              <span className="rounded bg-purple-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-purple-300 border border-purple-500/30">
                Multimodal Vision AI
              </span>
              <h3 className="mt-4 text-3xl font-black text-white">
                Zero-Shot Damage Classification with OpenAI CLIP ViT-B/32
              </h3>
              <p className="mt-4 text-sm text-slate-300 leading-relaxed">
                Trained on millions of paired image-text instances, our vision subsystem projects visual embeddings into shared latent space against high-granularity domain prompts.
              </p>

              <div className="mt-6 space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-xs font-bold text-white">100% F1-Score on Floods & Cyclones</h5>
                    <p className="text-[11px] text-slate-400">Detects submerged infrastructure, brown raging torrents, and satellite hurricane eyes with zero false positives.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-xs font-bold text-white">Hyper-Specific Prompts Eliminate False Alarms</h5>
                    <p className="text-[11px] text-slate-400">Differentiates between structural earthquake rubble with twisted rebar versus natural rockfall landslides.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-xs font-bold text-white">Sub-Second Classification on CPU</h5>
                    <p className="text-[11px] text-slate-400">Local PyTorch inference running completely offline in secure air-gapped government environments.</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button
                  type="button"
                  onClick={onEnterCommand}
                  className="rounded-xl bg-purple-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-purple-500 transition-colors shadow-md shadow-purple-600/30"
                >
                  Test Disaster Vision Lab
                </button>
              </div>
            </div>

            {/* Right: Accuracy Metrics Box */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur shadow-2xl">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Classification Benchmark Matrix
                </span>
                <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-400 border border-emerald-500/30">
                  OVERALL: 85.4%
                </span>
              </div>

              <div className="mt-4 space-y-3 font-mono text-xs">
                {[
                  { label: "FLOOD (Inundated Streets & Submerged Vehicles)", score: "100%", width: "w-full", color: "bg-blue-500" },
                  { label: "CYCLONE (Satellite Eye Wall & Storm Bands)", score: "100%", width: "w-full", color: "bg-teal-500" },
                  { label: "WILDFIRE (Flames & Smoke Plumes)", score: "100%", width: "w-full", color: "bg-rose-500" },
                  { label: "THUNDERSTORM (Lightning Bolt to Ground)", score: "100%", width: "w-full", color: "bg-amber-500" },
                  { label: "DROUGHT (Cracked Dry Earth & Arid Basin)", score: "100%", width: "w-full", color: "bg-yellow-500" },
                  { label: "EARTHQUAKE (Concrete Rubble & Structural Damage)", score: "66.7%", width: "w-2/3", color: "bg-purple-500" },
                  { label: "LANDSLIDE (Mudflow & Debris Slope)", score: "50.0%", width: "w-1/2", color: "bg-orange-500" },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-slate-300 truncate max-w-[280px]">{item.label}</span>
                      <span className="font-bold text-white">{item.score}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div className={`h-full rounded-full ${item.width} ${item.color}`} />
                    </div>
                  </div>
                ))}
              </div>

              <p className="mt-4 text-[10px] text-slate-500 border-t border-slate-800 pt-3">
                * Evaluated on synthetic and authentic disaster datasets across 48 ground-truth test runs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =======================================================
          PROJECT RESEARCH & DEVELOPMENT TEAM
      ======================================================= */}
      <section id="team" className="py-20 px-4 sm:px-6 relative border-t border-slate-800/80 bg-gradient-to-b from-slate-950 via-[#070d1a] to-slate-950 scroll-mt-20">
        <div className="mx-auto max-w-[1300px]">
          {/* Section Heading */}
          <div className="mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                Core Engineering &amp; Research
              </p>
              <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                AIDERS Core Development Team
              </h3>
            </div>
          </div>

          {/* 4-Column Team Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* 1. Gaurav Kumar - Full-Stack & AI Developer */}
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 flex flex-col justify-between hover:border-cyan-500/40 hover:bg-slate-900/80 transition-all duration-300 shadow-lg group relative overflow-hidden">
              <div className="absolute top-3 right-3 z-10 flex items-center gap-1 rounded-full bg-slate-950/90 border border-cyan-400/80 px-2.5 py-0.5 text-[10px] font-black text-cyan-200 shadow-xl backdrop-blur-md">
                <span>FULL-STACK & AI DEVELOPER</span>
              </div>

              <div>
                {/* Photo with clean framing */}
                <div className="relative h-72 w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-800 group-hover:border-cyan-500/30 transition-colors shadow-inner">
                  <img
                    src="/team/gaurav_kumar.jpg"
                    alt="Gaurav Kumar - Full-Stack & AI Developer"
                    className="h-full w-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      e.target.src = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500";
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60" />
                </div>

                <div className="mt-4">
                  <div className="flex items-center gap-1.5">
                    <h5 className="text-base font-black text-white group-hover:text-cyan-300 transition-colors">
                      Gaurav Kumar
                    </h5>
                    <ShieldCheck className="h-4 w-4 text-cyan-400 shrink-0" />
                  </div>
                  <p className="text-xs font-bold text-cyan-400 mt-0.5">
                    Full-Stack &amp; AI Developer
                  </p>
                  <p className="text-[11px] text-slate-300 mt-2 leading-relaxed">
                    End-to-End System Lead, AI Deep Learning Pipeline Architecture, Real-Time National Telemetry Integration, Firebase Authentication & Disaster Vault Resilience.
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap gap-1.5">
                <span className="rounded bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-300 border border-cyan-500/20">
                  Full-Stack Core
                </span>
                <span className="rounded bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-300 border border-cyan-500/20">
                  AI Deep Learning
                </span>
                <span className="rounded bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-300 border border-cyan-500/20">
                  Emergency Telemetry
                </span>
              </div>
            </div>

            {/* 2. Aaryan Raj - Frontend & Tactical UI/UX Specialist (Swapped with #3) */}
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 flex flex-col justify-between hover:border-indigo-500/40 hover:bg-slate-900/80 transition-all duration-300 shadow-lg group relative overflow-hidden">
              <div className="absolute top-3 right-3 z-10 flex items-center gap-1 rounded-full bg-slate-950/90 border border-indigo-400/80 px-2.5 py-0.5 text-[10px] font-black text-indigo-200 shadow-xl backdrop-blur-md">
                <span>TACTICAL UI/UX</span>
              </div>

              <div>
                <div className="relative h-72 w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-800 group-hover:border-indigo-500/30 transition-colors shadow-inner">
                  <img
                    src="/team/aaryan_raj.jpg"
                    alt="Aaryan Raj - Frontend & Tactical UI/UX"
                    className="h-full w-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      e.target.src = "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500";
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60" />
                </div>

                <div className="mt-4">
                  <div className="flex items-center gap-1.5">
                    <h5 className="text-base font-black text-white group-hover:text-indigo-300 transition-colors">
                      Aaryan Raj
                    </h5>
                    <ShieldCheck className="h-4 w-4 text-indigo-400 shrink-0" />
                  </div>
                  <p className="text-xs font-bold text-indigo-400 mt-0.5">
                    Frontend &amp; Tactical UI/UX Specialist
                  </p>
                  <p className="text-[11px] text-slate-300 mt-2 leading-relaxed">
                    Interactive Command Operations Hub, Leaflet Geospatial Intelligence Mapping, Incident Dispatch Controls & Responsive Operational Dashboards.
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap gap-1.5">
                <span className="rounded bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-300 border border-indigo-500/20">
                  React 18
                </span>
                <span className="rounded bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-300 border border-indigo-500/20">
                  Leaflet GIS
                </span>
                <span className="rounded bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-300 border border-indigo-500/20">
                  Command UI
                </span>
              </div>
            </div>

            {/* 3. Yash Walunjkar - Backend & Systems Engineer (Full Photo Uncropped) */}
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 flex flex-col justify-between hover:border-emerald-500/40 hover:bg-slate-900/80 transition-all duration-300 shadow-lg group relative overflow-hidden">
              <div className="absolute top-3 right-3 z-10 flex items-center gap-1 rounded-full bg-slate-950/90 border border-emerald-400/80 px-2.5 py-0.5 text-[10px] font-black text-emerald-200 shadow-xl backdrop-blur-md">
                <span>BACKEND SYSTEMS</span>
              </div>

              <div>
                <div className="relative h-72 w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-800 group-hover:border-emerald-500/30 transition-colors shadow-inner flex items-center justify-center">
                  <img
                    src="/team/yash_walunjkar.jpg"
                    alt="Yash Walunjkar - Backend & Systems Engineer"
                    className="h-full w-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      e.target.src = "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500";
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60" />
                </div>

                <div className="mt-4">
                  <div className="flex items-center gap-1.5">
                    <h5 className="text-base font-black text-white group-hover:text-emerald-300 transition-colors">
                      Yash Walunjkar
                    </h5>
                    <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                  </div>
                  <p className="text-xs font-bold text-emerald-400 mt-0.5">
                    Backend &amp; Systems Engineer
                  </p>
                  <p className="text-[11px] text-slate-300 mt-2 leading-relaxed">
                    FastAPI Telemetry Microservices, WebSocket Event Dispatching, API Ingestion & Real-Time Geospatial Coordinate Normalization.
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap gap-1.5">
                <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/20">
                  FastAPI
                </span>
                <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/20">
                  WebSockets
                </span>
                <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/20">
                  Data Pipelines
                </span>
              </div>
            </div>

            {/* 4. Shivani Singh - AI Model Evaluation & Research Lead */}
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 flex flex-col justify-between hover:border-purple-500/40 hover:bg-slate-900/80 transition-all duration-300 shadow-lg group relative overflow-hidden">
              <div className="absolute top-3 right-3 z-10 flex items-center gap-1 rounded-full bg-slate-950/90 border border-purple-400 px-2.5 py-0.5 text-[10px] font-black text-purple-200 shadow-xl backdrop-blur-md">
                <span>AI RESEARCH &amp; EVALUATION</span>
              </div>

              <div>
                <div className="relative h-72 w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-800 group-hover:border-purple-500/30 transition-colors shadow-inner flex items-center justify-center">
                  <img
                    src="/team/shivani_singh.jpg"
                    alt="Shivani Singh - AI Model Evaluation & Research Lead"
                    className="h-full w-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      e.target.src = "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=500";
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60 pointer-events-none" />
                </div>

                <div className="mt-4">
                  <div className="flex items-center gap-1.5">
                    <h5 className="text-base font-black text-white group-hover:text-purple-300 transition-colors">
                      Shivani Singh
                    </h5>
                    <ShieldCheck className="h-4 w-4 text-purple-400 shrink-0" />
                  </div>
                  <p className="text-xs font-bold text-purple-400 mt-0.5">
                    AI Model Evaluation &amp; Research Lead
                  </p>
                  <p className="text-[11px] text-slate-300 mt-2 leading-relaxed">
                    Disaster Classification Benchmark Dataset Curation, Deep Learning Ground-Truth Validation, Model Robustness Testing & Statutory Compliance Protocols.
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap gap-1.5">
                <span className="rounded bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-300 border border-purple-500/20">
                  Model Evaluation
                </span>
                <span className="rounded bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-300 border border-purple-500/20">
                  Benchmark Testing
                </span>
                <span className="rounded bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-300 border border-purple-500/20">
                  Documentation
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =======================================================
          GOVERNMENT HOTLINES & EMERGENCY DIRECTORY BANNER
      ======================================================= */}
      <section className="py-10 px-4 sm:px-6 bg-gradient-to-r from-rose-950/40 via-slate-950 to-indigo-950/40 border-t border-b border-rose-900/30">
        <div className="mx-auto max-w-[1280px] flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl border border-rose-500/40 bg-rose-500/20 p-3.5 text-rose-400 animate-pulse">
              <PhoneCall className="h-8 w-8" />
            </div>
            <div>
              <h4 className="text-lg font-black text-white">
                National Emergency Response Toll-Free Hotlines
              </h4>
              <p className="text-xs text-slate-400">
                Direct nationwide integration with NDRF HQ, State EOCs, Ambulance & Fire Brigades
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-center">
              <p className="text-[10px] uppercase font-bold text-slate-400">Pan-India Helpline</p>
              <p className="text-base font-black text-rose-400 font-mono">112</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-center">
              <p className="text-[10px] uppercase font-bold text-slate-400">NDMA Control</p>
              <p className="text-base font-black text-indigo-400 font-mono">1078</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-center">
              <p className="text-[10px] uppercase font-bold text-slate-400">NDRF Control Room</p>
              <p className="text-base font-black text-emerald-400 font-mono">011-24363260</p>
            </div>
            <button
              type="button"
              onClick={onOpenHelplines}
              className="rounded-xl bg-rose-600 hover:bg-rose-500 px-4 py-3 text-xs font-bold text-white transition-colors"
            >
              View Full SOPs
            </button>
          </div>
        </div>
      </section>

      {/* =======================================================
          OFFICIAL FOOTER
      ======================================================= */}
      <footer className="py-12 px-4 sm:px-6 bg-slate-950 text-slate-400 text-xs">
        <div className="mx-auto max-w-[1280px] grid gap-8 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white font-black text-xs">
                A
              </div>
              <span className="font-bold text-white text-sm">AIDERS Platform</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-400">
              AI Disaster Intelligence & Emergency Response System. Designed for rapid emergency dispatch and zero-shot damage appraisal.
            </p>
            <p className="mt-3 text-[10px] text-slate-500">
              © 2026 Government of India · Ministry of Home Affairs · National Disaster Management Authority (NDMA). All Rights Reserved.
            </p>
          </div>

          <div>
            <h5 className="font-bold text-white uppercase text-[11px] tracking-wider mb-3">
              Emergency Services
            </h5>
            <ul className="space-y-1.5 text-[11px]">
              <li><button type="button" onClick={onEnterCommand} className="hover:text-rose-400">Citizen SOS Report</button></li>
              <li><button type="button" onClick={onEnterCommand} className="hover:text-indigo-400">GIS Subcontinent Map</button></li>
              <li><button type="button" onClick={onEnterCommand} className="hover:text-purple-400">AI Damage Analyzer</button></li>
              <li><button type="button" onClick={onOpenHelplines} className="hover:text-emerald-400">State Disaster SOPs</button></li>
            </ul>
          </div>

          <div>
            <h5 className="font-bold text-white uppercase text-[11px] tracking-wider mb-3">
              Telemetry Sources
            </h5>
            <ul className="space-y-1.5 text-[11px]">
              <li>India Meteorological Department (IMD)</li>
              <li>Central Water Commission (CWC)</li>
              <li>United States Geological Survey (USGS)</li>
              <li>Geological Survey of India (GSI)</li>
              <li>National Disaster Management Authority (NDMA)</li>
            </ul>
          </div>

          <div>
            <h5 className="font-bold text-white uppercase text-[11px] tracking-wider mb-3">
              Official Security Notice
            </h5>
            <p className="text-[11px] leading-relaxed text-slate-500">
              Access to operational dispatch commands is restricted to authorized personnel under the Disaster Management Act, 2005. All IP connections are audited by CERT-In security protocols.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenAuth}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-slate-300 hover:text-white"
              >
                Sign In with Google / Gov ID
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

