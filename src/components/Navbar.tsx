import React, { useEffect, useState } from "react";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 200);
    const handleScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      clearTimeout(t);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50`}
      style={{
        transition: "background 0.6s cubic-bezier(0.16,1,0.3,1), border-color 0.6s ease, padding 0.5s cubic-bezier(0.16,1,0.3,1)",
        background: scrolled ? "rgba(7,7,7,0.82)" : "transparent",
        backdropFilter: scrolled ? "blur(24px) saturate(180%)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(24px) saturate(180%)" : "none",
        borderBottom: scrolled ? "1px solid rgba(255,255,255,0.05)" : "1px solid transparent",
        padding: scrolled ? "10px 0" : "22px 0",
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateY(0)" : "translateY(-8px)",
        transitionProperty: "background, border-color, padding, opacity, transform",
      }}
    >
      <div className="max-w-[860px] mx-auto px-6 flex justify-between items-center">
        <button
          onClick={() => scrollTo("hero")}
          className="font-mono text-sm tracking-[0.22em] font-bold text-white/75 hover:text-white"
          style={{ transition: "color 0.3s ease" }}
          data-testid="link-nav-home"
        >
          SAKIB
        </button>

        <div className="flex gap-0.5">
          {[
            { label: "HOME",   id: "hero" },
            { label: "ABOUT",  id: "about" },
            { label: "SKILLS", id: "skills" },
            { label: "SOCIAL", id: "social" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => scrollTo(item.id)}
              data-testid={`link-nav-${item.id}`}
              className="font-mono text-[10px] tracking-[0.2em] text-white/30 hover:text-white/90 px-3 py-2 rounded-sm"
              style={{
                transition: "color 0.3s ease, background 0.3s ease",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)";
                (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.9)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.3)";
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
