import React, { useEffect, useRef, useState } from "react";

interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "left" | "right" | "clip" | "line" | "scale" | "fade";
}

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

export function ScrollReveal({
  children,
  className = "",
  delay = 0,
  direction = "up",
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Fallback: if IntersectionObserver never fires (some Android WebViews),
    // reveal after a short timeout so content is never permanently hidden.
    const fallback = setTimeout(() => setVisible(true), 800);

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          clearTimeout(fallback);
          setVisible(true);
          obs.unobserve(entry.target);
        }
      },
      { threshold: 0, rootMargin: "0px 0px 0px 0px" }
    );
    obs.observe(el);
    return () => {
      clearTimeout(fallback);
      obs.unobserve(el);
    };
  }, []);

  if (direction === "clip") {
    return (
      <div
        ref={ref}
        className={className}
        style={{
          clipPath: visible ? "inset(0% 0% 0% 0%)" : "inset(0% 0% 100% 0%)",
          opacity: visible ? 1 : 0,
          transition: `clip-path 1.1s ${EASE} ${delay}ms, opacity 0.5s ease ${delay}ms`,
        }}
      >
        {children}
      </div>
    );
  }

  if (direction === "line") {
    return (
      <div
        ref={ref}
        className={className}
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateX(0)" : "translateX(-28px)",
          transition: `opacity 0.9s ${EASE} ${delay}ms, transform 0.9s ${EASE} ${delay}ms`,
        }}
      >
        {children}
      </div>
    );
  }

  if (direction === "fade") {
    return (
      <div
        ref={ref}
        className={className}
        style={{
          opacity: visible ? 1 : 0,
          transition: `opacity 1.2s ease ${delay}ms`,
        }}
      >
        {children}
      </div>
    );
  }

  const transforms: Record<string, string> = {
    up:    `translateY(${visible ? "0" : "44px"})`,
    left:  `translateX(${visible ? "0" : "-44px"})`,
    right: `translateX(${visible ? "0" : "44px"})`,
    scale: `scale(${visible ? "1" : "0.92"}) translateY(${visible ? "0" : "20px"})`,
  };

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: transforms[direction] ?? transforms.up,
        transition: `opacity 0.95s ${EASE} ${delay}ms, transform 0.95s ${EASE} ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}
