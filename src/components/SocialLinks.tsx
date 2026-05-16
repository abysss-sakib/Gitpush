import React, { useRef } from "react";
import { SiGithub, SiInstagram, SiFacebook } from "react-icons/si";

const socials = [
  {
    icon: SiFacebook,
    href: "https://www.facebook.com/abysss.sakib",
    label: "Facebook",
  },
  {
    icon: SiInstagram,
    href: "https://www.instagram.com/abysss_sakib?igsh=djVyMWYyYXBlNGVj&utm_source=qr",
    label: "Instagram",
  },
  {
    icon: SiGithub,
    href: "https://github.com/abysss-sakib",
    label: "GitHub",
  },
];

function MagneticIcon({
  item,
  index,
}: {
  item: (typeof socials)[0];
  index: number;
}) {
  const btnRef = useRef<HTMLAnchorElement>(null);

  function handleMouseMove(e: React.MouseEvent<HTMLAnchorElement>) {
    const el = btnRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) * 0.28;
    const dy = (e.clientY - cy) * 0.28;
    el.style.transform = `translate(${dx}px, ${dy}px) scale(1.12)`;
  }

  function handleMouseLeave() {
    const el = btnRef.current;
    if (!el) return;
    el.style.transform = "translate(0,0) scale(1)";
  }

  return (
    <a
      ref={btnRef}
      href={item.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={item.label}
      data-testid={`link-social-${item.label.toLowerCase()}`}
      className="group flex flex-col items-center gap-4"
      style={{
        transition: "transform 0.55s cubic-bezier(0.16,1,0.3,1)",
        animationDelay: `${index * 120}ms`,
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className="relative flex items-center justify-center w-16 h-16 rounded-full"
        style={{
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.02)",
          transition: "border-color 0.4s ease, background 0.4s ease, box-shadow 0.4s ease",
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.borderColor = "rgba(255,255,255,0.35)";
          el.style.background = "rgba(255,255,255,0.06)";
          el.style.boxShadow = "0 0 32px rgba(255,255,255,0.12), inset 0 0 20px rgba(255,255,255,0.04)";
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.borderColor = "rgba(255,255,255,0.08)";
          el.style.background = "rgba(255,255,255,0.02)";
          el.style.boxShadow = "none";
        }}
      >
        <span
          className="text-white/45 group-hover:text-white"
          style={{ transition: "color 0.35s ease, filter 0.35s ease" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLSpanElement).style.filter =
              "drop-shadow(0 0 14px rgba(255,255,255,0.85))";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLSpanElement).style.filter = "none";
          }}
        >
          <item.icon size={28} />
        </span>
      </div>

      <span
        className="font-mono text-[10px] tracking-[0.25em] text-white/25 group-hover:text-white/60"
        style={{ transition: "color 0.35s ease" }}
      >
        {item.label.toUpperCase()}
      </span>
    </a>
  );
}

export function SocialLinks() {
  return (
    <div className="flex gap-12 md:gap-20 items-center justify-center">
      {socials.map((item, i) => (
        <MagneticIcon key={i} item={item} index={i} />
      ))}
    </div>
  );
}
