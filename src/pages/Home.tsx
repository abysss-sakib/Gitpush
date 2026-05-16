import React, { useEffect, useState, useRef } from "react";
import { TypingAnimation } from "@/components/TypingAnimation";
import { ScrollReveal } from "@/components/ScrollReveal";
import { SocialLinks } from "@/components/SocialLinks";
import { Navbar } from "@/components/Navbar";

const NAME_LETTERS = ["S", "A", " ", "K", "I", "B"];

export default function Home() {
  const [phase, setPhase] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 80);
    const t2 = setTimeout(() => setPhase(2), 520);
    const t3 = setTimeout(() => setPhase(3), 980);
    const t4 = setTimeout(() => setPhase(4), 1400);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, []);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#070707] text-white overflow-x-hidden">
      <Navbar />

      {/* ── HERO ── */}
      <section ref={heroRef} id="hero" className="relative h-screen w-full flex items-center justify-center overflow-hidden">

        {/* Parallax cover — cinematic fade in */}
        <div
          className="absolute inset-0 z-0"
          style={{
            transform: `translateY(${scrollY * 0.28}px) scale(1.08)`,
            opacity: phase >= 1 ? 1 : 0,
            transition: "opacity 2.4s cubic-bezier(0.16,1,0.3,1)",
            willChange: "transform",
          }}
        >
          <img
            src="/cover.jpeg"
            alt=""
            className="w-full h-full object-cover"
            style={{ filter: "contrast(1.08) brightness(0.88)" }}
          />
          {/* Multi-layer gradient for depth */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/35 to-[#070707]" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-black/30" />
          {/* Vignette */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_50%,transparent_30%,rgba(0,0,0,0.65)_100%)]" />
        </div>

        {/* Film grain */}
        <div
          className="absolute inset-0 z-[2] pointer-events-none overflow-hidden"
          style={{ opacity: 0.045 }}
        >
          <div
            style={{
              position: "absolute",
              inset: "-50%",
              width: "200%",
              height: "200%",
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
              backgroundSize: "160px 160px",
              animation: "grain 0.5s steps(1) infinite",
            }}
          />
        </div>

        {/* Subtle scan lines */}
        <div
          className="absolute inset-0 z-[1] pointer-events-none"
          style={{
            backgroundImage: "repeating-linear-gradient(0deg,rgba(255,255,255,0.018) 0px,rgba(255,255,255,0.018) 1px,transparent 1px,transparent 4px)",
          }}
        />

        {/* Hero content */}
        <div className="relative z-10 text-center flex flex-col items-center gap-7 px-6">

          {/* Profile pic — clip reveal from bottom */}
          <div
            style={{
              clipPath: phase >= 1 ? "inset(0% 0% 0% 0% round 9999px)" : "inset(100% 0% 0% 0% round 9999px)",
              transition: "clip-path 1s cubic-bezier(0.16,1,0.3,1)",
            }}
          >
            <div className="relative">
              {/* Outer rotating dashed ring */}
              <svg
                className="absolute -inset-5 w-[calc(100%+40px)] h-[calc(100%+40px)]"
                style={{ animation: "spin-slow 14s linear infinite" }}
              >
                <circle cx="50%" cy="50%" r="47%" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.8" strokeDasharray="4 12" />
              </svg>
              {/* Inner counter-rotating ring */}
              <svg
                className="absolute -inset-2 w-[calc(100%+16px)] h-[calc(100%+16px)]"
                style={{ animation: "spin-reverse 8s linear infinite" }}
              >
                <circle cx="50%" cy="50%" r="46%" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="0.6" strokeDasharray="2 8" />
              </svg>
              {/* Pulse ring */}
              <div
                className="absolute -inset-3 rounded-full border border-white/20"
                style={{ animation: "pulse-ring 3s cubic-bezier(0.16,1,0.3,1) infinite" }}
              />
              {/* Glow */}
              <div className="absolute -inset-3 rounded-full bg-white/8 blur-2xl" />
              <div
                className="w-28 h-28 md:w-36 md:h-36 rounded-full overflow-hidden border border-white/25 relative"
                style={{ boxShadow: "0 0 60px rgba(255,255,255,0.14), 0 0 120px rgba(255,255,255,0.06)" }}
              >
                <img src="/dp.jpg" alt="Sa Kib" className="w-full h-full object-cover object-top" />
              </div>
            </div>
          </div>

          {/* Name — letter-by-letter */}
          <h1
            className="font-serif font-black tracking-tight text-white leading-none flex"
            style={{ fontSize: "clamp(3.5rem, 9vw, 7.5rem)", perspective: "600px" }}
            aria-label="SA KIB"
          >
            {NAME_LETTERS.map((letter, i) => (
              <span
                key={i}
                className="inline-block"
                style={{
                  opacity: phase >= 2 ? 1 : 0,
                  transform: phase >= 2 ? "translateY(0) rotateX(0deg)" : "translateY(50px) rotateX(-50deg)",
                  transition: `opacity 0.8s cubic-bezier(0.16,1,0.3,1), transform 0.8s cubic-bezier(0.16,1,0.3,1)`,
                  transitionDelay: `${i * 70}ms`,
                  textShadow: "0 0 80px rgba(255,255,255,0.22), 0 2px 8px rgba(0,0,0,0.8)",
                  whiteSpace: letter === " " ? "pre" : "normal",
                }}
              >
                {letter === " " ? "\u00A0" : letter}
              </span>
            ))}
          </h1>

          {/* Typing line */}
          <div
            style={{
              opacity: phase >= 3 ? 1 : 0,
              transform: phase >= 3 ? "translateY(0)" : "translateY(16px)",
              transition: "opacity 0.9s cubic-bezier(0.16,1,0.3,1), transform 0.9s cubic-bezier(0.16,1,0.3,1)",
            }}
            className="font-mono text-base md:text-lg text-white/85"
          >
            I am a{" "}
            <TypingAnimation words={["Developer", "Gamer", "Creator", "Builder"]} />
          </div>

          {/* Location + tagline */}
          <div
            style={{
              opacity: phase >= 4 ? 1 : 0,
              transform: phase >= 4 ? "translateY(0)" : "translateY(10px)",
              transition: "opacity 1s cubic-bezier(0.16,1,0.3,1) 0.1s, transform 1s cubic-bezier(0.16,1,0.3,1) 0.1s",
            }}
            className="flex flex-col items-center gap-2"
          >
            <p className="font-mono text-[12px] tracking-[0.4em] text-white/80">
              DHAKA, BANGLADESH
            </p>
            <p className="font-mono text-[10px] tracking-[0.28em] text-white/55">
              STUDENT · CODE EXPLORER
            </p>
          </div>
        </div>

        {/* Scroll indicator — animated line */}
        <div
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          style={{
            opacity: phase >= 4 ? 1 : 0,
            transition: "opacity 1.2s ease 0.6s",
          }}
        >
          <span className="font-mono text-[8px] tracking-[0.6em] text-white/40">SCROLL</span>
          <div className="relative w-px h-14 overflow-hidden">
            <div
              className="absolute inset-0 bg-gradient-to-b from-white/80 to-transparent"
              style={{ animation: "scroll-line 1.8s cubic-bezier(0.16,1,0.3,1) infinite" }}
            />
          </div>
        </div>
      </section>

      {/* ── ABOUT ── */}
      <section id="about" className="py-32 md:py-44 px-6 border-t border-white/[0.04]">
        <div className="max-w-[860px] mx-auto">

          <ScrollReveal>
            <p className="font-mono text-[10px] tracking-[0.55em] text-white/55 mb-8">01 — ABOUT</p>
          </ScrollReveal>

          <ScrollReveal delay={100}>
            <h2 className="font-serif text-5xl md:text-7xl font-black mb-20 text-white"
              style={{ textShadow: "0 0 60px rgba(255,255,255,0.07)" }}>
              The Story
            </h2>
          </ScrollReveal>

          <ScrollReveal delay={200} direction="clip">
            <div className="font-sans font-light text-xl md:text-2xl leading-[2.05] text-white/88">
              Hey, I'm{" "}
              <span
                className="text-white font-semibold"
                style={{ textShadow: "0 0 35px rgba(255,255,255,0.6)" }}
              >
                Sakib
              </span>
              . I like{" "}
              <span
                className="text-white font-medium"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.22)", paddingBottom: "2px" }}
              >
                web development
              </span>{" "}
              and building things on the internet. I enjoy{" "}
              <span
                className="text-white font-medium"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.22)", paddingBottom: "2px" }}
              >
                learning
              </span>{" "}
              and creating more than anything else. I play{" "}
              <span className="text-white font-medium" style={{ textShadow: "0 0 20px rgba(255,255,255,0.4)" }}>
                games
              </span>{" "}
              sometimes — just for fun.{" "}
              <span
                className="text-white font-medium"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.22)", paddingBottom: "2px" }}
              >
                Anime
              </span>{" "}
              is my way to relax. Simple life.{" "}
              <span className="text-white font-semibold" style={{ textShadow: "0 0 35px rgba(255,255,255,0.5)" }}>
                Always learning. Always building.
              </span>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={360}>
            <div className="mt-20 pt-10 border-t border-white/[0.07] flex items-center gap-4">
              <span
                className="w-1.5 h-1.5 rounded-full bg-white"
                style={{ animation: "breathe 2.8s ease-in-out infinite", boxShadow: "0 0 8px rgba(255,255,255,0.6)" }}
              />
              <p className="font-mono text-sm text-white/65 tracking-wider">
                Building things from scratch &nbsp;—&nbsp; Dhaka, Bangladesh
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── INTERESTS ── */}
      <section id="skills" className="py-32 md:py-44 px-6 border-t border-white/[0.04]">
        <div className="max-w-[860px] mx-auto">

          <ScrollReveal>
            <p className="font-mono text-[10px] tracking-[0.55em] text-white/55 mb-8">02 — INTERESTS</p>
          </ScrollReveal>

          <ScrollReveal delay={100}>
            <h2 className="font-serif text-5xl md:text-7xl font-black mb-20 text-white"
              style={{ textShadow: "0 0 60px rgba(255,255,255,0.07)" }}>
              What I Do
            </h2>
          </ScrollReveal>

          <div className="flex flex-col">
            {[
              { label: "Web Development", num: "01" },
              { label: "Learning New Things", num: "02" },
              { label: "Gaming",            num: "03" },
              { label: "Watching Anime",    num: "04" },
            ].map((item, idx) => (
              <ScrollReveal key={idx} delay={idx * 100} direction="line">
                <div
                  className="group py-8 border-b border-white/[0.05] flex items-center justify-between cursor-default"
                  style={{ transition: "padding-left 0.6s cubic-bezier(0.16,1,0.3,1)" }}
                  onMouseEnter={e => (e.currentTarget.style.paddingLeft = "24px")}
                  onMouseLeave={e => (e.currentTarget.style.paddingLeft = "0px")}
                >
                  <span
                    className="font-serif text-2xl md:text-4xl text-white/80 group-hover:text-white"
                    style={{
                      transition: "color 0.4s ease, text-shadow 0.4s ease",
                    }}
                    onMouseEnter={e => ((e.currentTarget as HTMLElement).style.textShadow = "0 0 30px rgba(255,255,255,0.45)")}
                    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.textShadow = "none")}
                  >
                    {item.label}
                  </span>
                  <span className="font-mono text-xs text-white/40 group-hover:text-white/70 transition-colors duration-400">
                    {item.num}
                  </span>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FIND ME ON ── */}
      <section id="social" className="py-32 md:py-44 px-6 border-t border-white/[0.04]">
        <div className="max-w-[860px] mx-auto flex flex-col items-center text-center">

          <ScrollReveal>
            <p className="font-mono text-[10px] tracking-[0.55em] text-white/55 mb-8">03 — CONNECT</p>
          </ScrollReveal>

          <ScrollReveal delay={100} direction="scale">
            <h2
              className="font-serif font-black text-white mb-6"
              style={{
                fontSize: "clamp(2.8rem, 7vw, 6rem)",
                textShadow: "0 0 100px rgba(255,255,255,0.18)",
              }}
            >
              Find Me On
            </h2>
          </ScrollReveal>

          {/* Animated divider */}
          <ScrollReveal delay={180}>
            <div className="overflow-hidden h-px w-24 mb-18">
              <div
                className="h-full bg-gradient-to-r from-transparent via-white/60 to-transparent"
                style={{ animation: "line-draw 1.4s cubic-bezier(0.16,1,0.3,1) forwards" }}
              />
            </div>
          </ScrollReveal>

          <ScrollReveal delay={280} direction="scale">
            <SocialLinks />
          </ScrollReveal>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="py-12 border-t border-white/[0.04] text-center">
        <ScrollReveal direction="fade">
          <p className="font-mono text-[10px] tracking-[0.38em] text-white/45">
            © {new Date().getFullYear()} SA KIB — ALWAYS LEARNING. ALWAYS BUILDING.
          </p>
        </ScrollReveal>
      </footer>
    </div>
  );
}
