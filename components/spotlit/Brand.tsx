import Link from "next/link";

export const O_PATH =
  "M218.63,85.74 A100,100 0 1 1 170.26,37.37 L155.89,68.18 A66,66 0 1 0 187.82,100.11 Z";

/** The O mark: a spotlight seen from above. The only orange letter of the wordmark. */
export function OMark({ size = 24, color = "#F26A3F", className }: { size?: number; color?: string; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" aria-hidden="true" className={className}>
      <path d={O_PATH} fill={color} />
      <circle cx="128" cy="128" r="21" fill={color} />
    </svg>
  );
}

export function Wordmark({ tone = "dark", width = 132, href = "/" }: { tone?: "dark" | "light"; width?: number; href?: string | null }) {
  // eslint-disable-next-line @next/next/no-img-element
  const img = (
    <img
      src={tone === "dark" ? "/brand/spotlit-wordmark-on-dark-transparent.svg" : "/brand/spotlit-wordmark-on-light.svg"}
      alt="Spotlit"
      width={width}
      height={Math.round((width * 148) / 669)}
      style={{ width, height: "auto", display: "block" }}
    />
  );
  if (!href) return img;
  return (
    <Link href={href} aria-label="Spotlit home" className="block" style={{ width }}>
      {img}
    </Link>
  );
}

/** Agent glyphs: persona = circle, concierge = O mark, venue = filled square, proxy = dashed square. */
export function AgentGlyph({ kind, size = 10, dark = false }: { kind: "persona" | "concierge" | "venue" | "proxy"; size?: number; dark?: boolean }) {
  if (kind === "concierge") return <OMark size={size + 4} />;
  if (kind === "persona") return <span aria-hidden="true" className="inline-block rounded-full" style={{ width: size, height: size, background: dark ? "#fff" : "#0B0B0C" }} />;
  if (kind === "venue") return <span aria-hidden="true" className="inline-block rounded-[2px] bg-signal" style={{ width: size, height: size }} />;
  return <span aria-hidden="true" className="inline-block rounded-[2px]" style={{ width: size, height: size, border: `1.5px dashed ${dark ? "#B9B8B3" : "#6B6A66"}` }} />;
}

export function GoogleIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export function ArrowRight({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function Check({ size = 18, color = "#0B0B0C" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" aria-hidden="true">
      <path d="M5 12l5 5 9-10" />
    </svg>
  );
}

export function Ring({ size = 18, color = "#C9502A" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
    </svg>
  );
}

export function Plus({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
