import { listen } from "@tauri-apps/api/event";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  MicrophoneIcon,
  TranscriptionIcon,
  CancelIcon,
} from "../components/icons";
import "./RecordingOverlay.css";
import { commands } from "@/bindings";
import i18n, { syncLanguageFromSettings } from "@/i18n";
import { getLanguageDirection } from "@/lib/utils/rtl";

type OverlayState = "recording" | "transcribing" | "processing";

const CANVAS_WIDTH = 90;
const CANVAS_HEIGHT = 24;
const NUM_POINTS = 16;
const LERP_UP = 0.12;
const LERP_DOWN = 0.08;

const RecordingOverlay: React.FC = () => {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const [state, setState] = useState<OverlayState>("recording");
  const direction = getLanguageDirection(i18n.language);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const targetLevelsRef = useRef<number[]>(Array(NUM_POINTS).fill(0));
  const smoothedLevelsRef = useRef<number[]>(Array(NUM_POINTS).fill(0));
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  const drawWaveform = useCallback((timestamp: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (!startTimeRef.current) startTimeRef.current = timestamp;
    const elapsed = (timestamp - startTimeRef.current) / 1000;

    // Lerp smoothed levels toward targets
    const targets = targetLevelsRef.current;
    const smoothed = smoothedLevelsRef.current;
    for (let i = 0; i < NUM_POINTS; i++) {
      const target = targets[i];
      const factor = target > smoothed[i] ? LERP_UP : LERP_DOWN;
      smoothed[i] += (target - smoothed[i]) * factor;
    }

    // Detect if audio is essentially silent
    const totalEnergy = smoothed.reduce((sum, v) => sum + v, 0);
    const isIdle = totalEnergy < 0.15;

    const w = canvas.width;
    const h = canvas.height;
    const centerY = h / 2;

    ctx.clearRect(0, 0, w, h);

    // Build control points
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < NUM_POINTS; i++) {
      const x = (i / (NUM_POINTS - 1)) * w;
      let amplitude: number;
      if (isIdle) {
        // Multi-frequency organic breathing animation
        const t = elapsed;
        const base = Math.sin(t * 0.8 + i * 0.4) * 1.5;
        const detail = Math.sin(t * 1.7 + i * 0.7) * 0.8;
        const micro = Math.sin(t * 3.1 + i * 1.1) * 0.3;
        amplitude = base + detail + micro;
      } else {
        // Scale level to pixel amplitude with better dynamic range
        amplitude = Math.pow(smoothed[i], 0.55) * (h / 2 - 2);
      }

      // Edge tapering - fade to zero at left/right edges
      const edgeFade = Math.sin((i / (NUM_POINTS - 1)) * Math.PI);
      amplitude *= edgeFade;

      points.push({ x, y: amplitude });
    }

    // Helper function for Catmull-Rom to Bezier conversion
    function catmullRomToBezier(
      p0: { x: number; y: number },
      p1: { x: number; y: number },
      p2: { x: number; y: number },
      p3: { x: number; y: number }
    ): [{ x: number; y: number }, { x: number; y: number }] {
      const tension = 6;
      const cp1 = {
        x: p1.x + (p2.x - p0.x) / tension,
        y: p1.y + (p2.y - p0.y) / tension,
      };
      const cp2 = {
        x: p2.x - (p3.x - p1.x) / tension,
        y: p2.y - (p3.y - p1.y) / tension,
      };
      return [cp1, cp2];
    }

    // Build top and bottom point arrays
    const topPts: { x: number; y: number }[] = [];
    const botPts: { x: number; y: number }[] = [];
    for (let i = 0; i < NUM_POINTS; i++) {
      topPts.push({ x: points[i].x, y: centerY - points[i].y });
      botPts.push({
        x: points[NUM_POINTS - 1 - i].x,
        y: centerY + points[NUM_POINTS - 1 - i].y,
      });
    }

    // Combine into closed polygon
    const allPts = [...topPts, ...botPts];
    const len = allPts.length;

    // Draw waveform with softened gradient and glow
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, "rgba(255, 210, 230, 0.45)");
    gradient.addColorStop(0.5, "rgba(255, 235, 245, 0.7)");
    gradient.addColorStop(1, "rgba(255, 210, 230, 0.45)");

    ctx.shadowColor = "rgba(255, 190, 220, 0.4)";
    ctx.shadowBlur = 4;
    ctx.fillStyle = gradient;

    // Draw smooth Catmull-Rom spline as single closed shape
    ctx.beginPath();
    ctx.moveTo(allPts[0].x, allPts[0].y);

    for (let i = 0; i < len; i++) {
      const p0 = allPts[(i - 1 + len) % len];
      const p1 = allPts[i];
      const p2 = allPts[(i + 1) % len];
      const p3 = allPts[(i + 2) % len];

      const [cp1, cp2] = catmullRomToBezier(p0, p1, p2, p3);
      ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, p2.x, p2.y);
    }

    ctx.closePath();
    ctx.fill();

    rafRef.current = requestAnimationFrame(drawWaveform);
  }, []);

  // Start/stop animation loop based on state
  useEffect(() => {
    if (state === "recording" && isVisible) {
      startTimeRef.current = 0;
      rafRef.current = requestAnimationFrame(drawWaveform);
    } else {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      // Reset levels when leaving recording state
      targetLevelsRef.current = Array(NUM_POINTS).fill(0);
      smoothedLevelsRef.current = Array(NUM_POINTS).fill(0);
    }
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };
  }, [state, isVisible, drawWaveform]);

  useEffect(() => {
    const setupEventListeners = async () => {
      const unlistenShow = await listen("show-overlay", async (event) => {
        await syncLanguageFromSettings();
        const overlayState = event.payload as OverlayState;
        setState(overlayState);
        setIsVisible(true);
      });

      const unlistenHide = await listen("hide-overlay", () => {
        setIsVisible(false);
      });

      const unlistenLevel = await listen<number[]>("mic-level", (event) => {
        targetLevelsRef.current = event.payload as number[];
      });

      return () => {
        unlistenShow();
        unlistenHide();
        unlistenLevel();
      };
    };

    setupEventListeners();
  }, []);

  const getIcon = () => {
    if (state === "recording") {
      return <MicrophoneIcon />;
    } else {
      return <TranscriptionIcon />;
    }
  };

  return (
    <div
      dir={direction}
      className={`recording-overlay ${isVisible ? "fade-in" : ""}`}
    >
      <div className="overlay-left">{getIcon()}</div>

      <div className="overlay-middle">
        {state === "recording" && (
          <canvas
            ref={canvasRef}
            className="waveform-canvas"
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
          />
        )}
        {state === "transcribing" && (
          <div className="transcribing-text">{t("overlay.transcribing")}</div>
        )}
        {state === "processing" && (
          <div className="transcribing-text">{t("overlay.processing")}</div>
        )}
      </div>

      <div className="overlay-right">
        {state === "recording" && (
          <div
            className="cancel-button"
            onClick={() => {
              commands.cancelOperation();
            }}
          >
            <CancelIcon />
          </div>
        )}
      </div>
    </div>
  );
};

export default RecordingOverlay;
