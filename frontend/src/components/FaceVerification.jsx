import React, { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";

const MODEL_URL = "/models";
const PROD_API_BASE = "https://ai-disaster-intelligence-emergency.onrender.com";
const isLocalhost =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "0.0.0.0");

const rawApiBase =
  import.meta.env.VITE_API_BASE ||
  (!isLocalhost || import.meta.env.PROD
    ? PROD_API_BASE
    : "");
const API_BASE = (rawApiBase || "").replace(/\/+$/, "");

export default function FaceVerification({ officialId, onVerified, onFailure }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("Loading face recognition...");

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });

        if (!mounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStatus("Position your face inside the frame.");
        setLoading(false);
      } catch (error) {
        console.error(error);
        setLoading(false);
        setStatus("Camera or model initialization failed.");
        onFailure?.(error);
      }
    }

    initialize();

    return () => {
      mounted = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [onFailure]);

  async function verifyFace() {
    if (!videoRef.current) return;
    setStatus("Scanning...");

    try {
      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({
          inputSize: 320, scoreThreshold: 0.5
        }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        setStatus("No clear face detected. Try again.");
        return;
      }

      const descriptor = Array.from(detection.descriptor);

      const response = await fetch(`${API_BASE}/api/v1/auth/face/verify`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ official_id: officialId, descriptor }),
      });

      const result = await response.json();

      if (!response.ok || !result.verified) {
        setStatus("Face verification failed.");
        onFailure?.(new Error(result.detail || "Face verification failed"));
        return;
      }

      setStatus("Identity verified.");
      onVerified?.(result);
    } catch (error) {
      console.error(error);
      setStatus("Verification request failed.");
      onFailure?.(error);
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-[420px] max-w-full overflow-hidden rounded-2xl bg-black">
        <video ref={videoRef} autoPlay muted playsInline className="aspect-video w-full object-cover" />
        <div className="pointer-events-none absolute inset-10 rounded-[40%] border-2 border-white/70" />
      </div>
      <p className="text-sm text-slate-300">{status}</p>
      <button
        type="button"
        disabled={loading}
        onClick={verifyFace}
        className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        Verify Identity
      </button>
    </div>
  );
}
