"use client";

import { useEffect, useRef } from "react";

const STAR_COUNT = 72;
const TARGET_FPS = 30;

function random(min, max) {
  return Math.random() * (max - min) + min;
}

function signedRandom(minAbs, maxAbs) {
  const value = random(minAbs, maxAbs);
  return Math.random() < 0.5 ? -value : value;
}

function isDarkTheme() {
  return document.documentElement.getAttribute("data-theme") === "dark";
}

export default function StarsField() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return undefined;

    let width = 0;
    let height = 0;
    let rafId = 0;
    let t = 0;
    let lastFrameTime = 0;
    let running = false;

    const stars = Array.from({ length: STAR_COUNT }, () => ({
      x: random(0, 1),
      y: random(0, 1),
      vx: signedRandom(0.000004, 0.000014),
      vy: signedRandom(0.000004, 0.000014),
      size: random(0.6, 1.8),
      twinkle: random(0, Math.PI * 2),
      chaos: random(0.04, 0.2),
    }));

    function setBackgroundShift(clientX, clientY) {
      const cx = (clientX - width / 2) / width;
      const cy = (clientY - height / 2) / height;
      document.documentElement.style.setProperty("--bg-shift-x", `${cx * 18}px`);
      document.documentElement.style.setProperty("--bg-shift-y", `${cy * 14}px`);
    }

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = window.devicePixelRatio || 1;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      setBackgroundShift(width * 0.5, height * 0.5);
    }

    function drawFrame(ts) {
      if (!running) return;

      const frameInterval = 1000 / TARGET_FPS;
      if (ts - lastFrameTime < frameInterval) {
        rafId = window.requestAnimationFrame(drawFrame);
        return;
      }

      lastFrameTime = ts;
      t += 0.0018;

      ctx.clearRect(0, 0, width, height);

      for (const star of stars) {
        const chaosX = Math.sin(t * star.chaos + star.twinkle) * 0.0000025;
        const chaosY = Math.cos(t * (star.chaos + 0.2) + star.twinkle) * 0.0000025;

        star.vx += chaosX;
        star.vy += chaosY;

        star.vx *= 0.998;
        star.vy *= 0.998;

        star.x += star.vx;
        star.y += star.vy;

        if (star.x < -0.03) star.x = 1.03;
        if (star.x > 1.03) star.x = -0.03;
        if (star.y < -0.03) star.y = 1.03;
        if (star.y > 1.03) star.y = -0.03;

        const alpha = 0.35 + 0.65 * ((Math.sin(t * 1.7 + star.twinkle) + 1) / 2);

        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(star.x * width, star.y * height, star.size, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      rafId = window.requestAnimationFrame(drawFrame);
    }

    function startAnimation() {
      if (running) return;
      running = true;
      lastFrameTime = 0;
      rafId = window.requestAnimationFrame(drawFrame);
    }

    function stopAnimation() {
      running = false;
      window.cancelAnimationFrame(rafId);
      ctx.clearRect(0, 0, width, height);
    }

    function syncWithTheme() {
      if (isDarkTheme()) {
        startAnimation();
      } else {
        stopAnimation();
      }
    }

    function onMouseMove(event) {
      setBackgroundShift(event.clientX, event.clientY);
    }

    resize();
    syncWithTheme();

    const observer = new MutationObserver(syncWithTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMouseMove, { passive: true });

    return () => {
      observer.disconnect();
      stopAnimation();
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      document.documentElement.style.setProperty("--bg-shift-x", "0px");
      document.documentElement.style.setProperty("--bg-shift-y", "0px");
    };
  }, []);

  return <canvas ref={canvasRef} className="stars-canvas" aria-hidden="true" />;
}
