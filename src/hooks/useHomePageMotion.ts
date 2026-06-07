"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useGoalShellMotion(enabled: boolean) {
  const shellRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!enabled || prefersReducedMotion()) return;

      gsap.from("[data-home-header-block]", {
        opacity: 0,
        y: -14,
        duration: 0.65,
        ease: "power3.out",
      });
      gsap.from("[data-home-nav-link]", {
        opacity: 0,
        y: 8,
        duration: 0.4,
        stagger: 0.05,
        delay: 0.12,
        ease: "power2.out",
      });
    },
    { scope: shellRef, dependencies: [enabled] },
  );

  return shellRef;
}

export function useHomeDashboardMotion(progressPct: number) {
  const contentRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;

      gsap.from("[data-home-panel]", {
        opacity: 0,
        y: 24,
        duration: 0.6,
        stagger: 0.07,
        delay: 0.08,
        ease: "power3.out",
      });
      gsap.from("[data-home-metric]", {
        opacity: 0,
        scale: 0.97,
        duration: 0.45,
        stagger: 0.035,
        delay: 0.35,
        ease: "back.out(1.2)",
      });
    },
    { scope: contentRef },
  );

  useGSAP(
    () => {
      if (!progressRef.current) return;
      const target = Math.min(100, Math.max(0, progressPct));
      if (prefersReducedMotion()) {
        gsap.set(progressRef.current, { width: `${target}%` });
        return;
      }
      gsap.to(progressRef.current, {
        width: `${target}%`,
        duration: 1.1,
        ease: "power2.out",
      });
    },
    { scope: contentRef, dependencies: [progressPct] },
  );

  return { contentRef, progressRef };
}
