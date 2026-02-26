import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { photos } from "../data/photos";
import { thumbUrl } from "../utils/image";
import { Lightbox } from "../components/Lightbox";
import { usePensieveAudio } from "../hooks/usePensieveAudio";
import type { Photo } from "../types";

/* ─── Specs ─── */

const PENSIEVE_SPECS: {
  location: string;
  orientation: "landscape" | "portrait";
  index?: number;
}[] = [
  { location: "Mexico City", orientation: "landscape" },
  { location: "Mexico City", orientation: "portrait" },
  { location: "Croatia", orientation: "landscape" },
  { location: "Croatia", orientation: "portrait" },
  { location: "Croatia", orientation: "landscape", index: 1 },
  { location: "Singapore", orientation: "landscape" },
  { location: "Hong Kong", orientation: "landscape" },
  { location: "Taiwan", orientation: "portrait" },
  { location: "Taiwan", orientation: "landscape" },
  { location: "Morocco", orientation: "landscape" },
  { location: "Morocco", orientation: "landscape", index: 1 },
  { location: "Romania", orientation: "landscape" },
  { location: "Romania", orientation: "portrait" },
  { location: "Costa Rica", orientation: "landscape" },
  { location: "San Francisco", orientation: "landscape" },
  { location: "San Francisco", orientation: "portrait" },
  { location: "Bulgaria", orientation: "landscape" },
  { location: "Bulgaria", orientation: "portrait" },
];

/* ─── Seasonal photo picker ─── */

function buildPensievePhotos(): Photo[] {
  const now = new Date();
  const seed = now.getMonth() * 31 + now.getDate();

  const used = new Set<string>();
  const result: Photo[] = [];

  for (let si = 0; si < PENSIEVE_SPECS.length; si++) {
    const spec = PENSIEVE_SPECS[si];
    const candidates = photos.filter(
      (p) =>
        p.location === spec.location &&
        p.orientation === spec.orientation &&
        !p.hidden &&
        !used.has(p.id),
    );
    if (candidates.length === 0) continue;
    const pickIdx = (seed + si + (spec.index ?? 0)) % candidates.length;
    const pick = candidates[pickIdx];
    used.add(pick.id);
    result.push(pick);
  }

  return result;
}

/* ─── Layout helpers ─── */

const DRIFT_NAMES = [
  "pensieve-drift-a",
  "pensieve-drift-b",
  "pensieve-drift-c",
] as const;

const DEPTH_FACTORS = [0.5, 0.75, 1.0] as const;

function computeLayout(i: number, total: number) {
  const angle =
    (i * (360 / total) + ((i * 17) % 11)) * (Math.PI / 180);
  const radius = 25 + (i % 3) * 8;
  const left = 50 + radius * Math.cos(angle);
  const top = 50 + radius * Math.sin(angle);
  const rotation = ((i * 7) % 15) - 7;
  const duration = 15 + ((i * 3) % 11);
  const delay = -(i * 2.3);
  const drift = DRIFT_NAMES[i % 3];

  return { left, top, rotation, duration, delay, drift };
}

/* ─── Component ─── */

export function Home() {
  const navigate = useNavigate();

  /* --- Plunge transition state --- */
  const [plunging, setPlunging] = useState(false);

  /* --- Pool state (cycling mutates this) --- */
  const [pool, setPool] = useState(buildPensievePhotos);
  const poolRef = useRef(pool);
  poolRef.current = pool;

  /* --- UI state --- */
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [lightboxPool, setLightboxPool] = useState<Photo[]>([]);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [fadingSlot, setFadingSlot] = useState<number | null>(null);

  /* --- Audio --- */
  const { startAmbient, stopAmbient, playHoverTone } = usePensieveAudio();

  /* --- Refs for parallax + trail (no re-renders) --- */
  const layerRefs = [
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
  ];
  const trailRef = useRef<HTMLDivElement>(null);

  /* --- Lightbox open / close --- */
  const openLightbox = useCallback(
    (i: number) => {
      setLightboxPool([...poolRef.current]);
      setLightboxIndex(i);
    },
    [],
  );
  const closeLightbox = useCallback(() => {
    setLightboxIndex(null);
    setLightboxPool([]);
  }, []);

  /* --- Depth layers memo --- */
  const layers = useMemo(() => {
    const buckets: { photo: Photo; originalIndex: number }[][] = [
      [],
      [],
      [],
    ];
    pool.forEach((photo, i) => {
      buckets[i % 3].push({ photo, originalIndex: i });
    });
    return buckets;
  }, [pool]);

  /* --- Photo cycling (every 5.5s) --- */
  useEffect(() => {
    let alive = true;

    const interval = setInterval(() => {
      if (!alive) return;
      if (lightboxIndex !== null) return; // don't cycle while lightbox open

      const currentPool = poolRef.current;
      const slot = Math.floor(Math.random() * currentPool.length);
      const spec = PENSIEVE_SPECS[slot];
      if (!spec) return;

      // Find eligible replacement: same location + orientation, not in pool, not hidden
      const poolIds = new Set(currentPool.map((p) => p.id));
      const candidates = photos.filter(
        (p) =>
          p.location === spec.location &&
          p.orientation === spec.orientation &&
          !p.hidden &&
          !poolIds.has(p.id),
      );
      if (candidates.length === 0) return; // e.g. Morocco portrait has only 1 photo

      const replacement =
        candidates[Math.floor(Math.random() * candidates.length)];

      // Fade out
      setFadingSlot(slot);

      // After fade-out completes, swap photo and fade back in
      setTimeout(() => {
        if (!alive) return;
        setPool((prev) => {
          const next = [...prev];
          next[slot] = replacement;
          return next;
        });
        setFadingSlot(null);
      }, 1250);
    }, 6000);

    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [lightboxIndex]);

  /* --- Combined mouse handler: parallax + trail --- */
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const mx = (e.clientX - rect.left) / rect.width - 0.5; // -0.5 to 0.5
      const my = (e.clientY - rect.top) / rect.height - 0.5;

      // Update depth layers
      for (let l = 0; l < 3; l++) {
        const el = layerRefs[l].current;
        if (!el) continue;
        const factor = (1 - DEPTH_FACTORS[l]) * 20;
        el.style.transform = `translate(${mx * factor}px, ${my * factor}px)`;
      }

      // Update cursor trail
      if (trailRef.current) {
        trailRef.current.style.left = `${e.clientX}px`;
        trailRef.current.style.top = `${e.clientY}px`;
      }
    },
    [],
  );

  const handlePoolEnter = useCallback(() => {
    if (trailRef.current) trailRef.current.style.opacity = "1";
    startAmbient();
  }, [startAmbient]);

  const handlePoolLeave = useCallback(() => {
    if (trailRef.current) trailRef.current.style.opacity = "0";
    stopAmbient();
    // Reset parallax layers
    for (let l = 0; l < 3; l++) {
      const el = layerRefs[l].current;
      if (el) el.style.transform = "translate(0px, 0px)";
    }
  }, [stopAmbient]);

  /* --- Touch device detection --- */
  const isTouchDevice = useRef(false);
  const [tappedIndex, setTappedIndex] = useState<number | null>(null);

  useEffect(() => {
    isTouchDevice.current = window.matchMedia("(pointer: coarse)").matches;
  }, []);

  const handleWispClick = useCallback(
    (originalIndex: number) => {
      if (isTouchDevice.current) {
        if (tappedIndex === originalIndex) {
          openLightbox(originalIndex);
          setTappedIndex(null);
        } else {
          setTappedIndex(originalIndex);
        }
      } else {
        openLightbox(originalIndex);
      }
    },
    [tappedIndex, openLightbox],
  );

  const handlePoolClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest(".pensieve__wisp")) return;
      setTappedIndex(null);
    },
    [],
  );

  return (
    <main className={`pensieve${plunging ? " pensieve--plunging" : ""}`}>
      <p className="pensieve__subtitle">
        memorializing my late twenties on film
      </p>

      <div className="pensieve__glow" />
      <div className="pensieve__caustics" />
      <div className="pensieve__ripples">
        <div className="pensieve__ripple" />
        <div className="pensieve__ripple" />
        <div className="pensieve__ripple" />
      </div>

      {/* Cursor trail — silvery glow behind photos */}
      <div ref={trailRef} className="pensieve__trail" />

      <div
        className="pensieve__pool"
        onMouseMove={handleMouseMove}
        onMouseEnter={handlePoolEnter}
        onMouseLeave={handlePoolLeave}
        onClick={handlePoolClick}
      >
        {layers.map((bucket, layerIdx) => (
          <div
            key={layerIdx}
            ref={layerRefs[layerIdx]}
            className={`pensieve__depth-layer pensieve__depth-layer--${layerIdx}`}
          >
            {bucket.map(({ photo, originalIndex }) => {
              const pos = computeLayout(originalIndex, pool.length);
              const isActive = hoveredIndex === originalIndex;
              const isTapped = tappedIndex === originalIndex;
              const isDimmed =
                (hoveredIndex !== null && hoveredIndex !== originalIndex) ||
                (tappedIndex !== null && tappedIndex !== originalIndex);
              const isFading = fadingSlot === originalIndex;
              const isFocal = originalIndex === 0;
              const entranceDelay = 0.5 + originalIndex * 0.12;

              return (
                <button
                  key={originalIndex}
                  className={[
                    "pensieve__wisp",
                    isActive && "pensieve__wisp--active",
                    isTapped && "pensieve__wisp--tapped",
                    isDimmed && "pensieve__wisp--dimmed",
                    isFading && "pensieve__wisp--fading",
                    isFocal && "pensieve__wisp--focal",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={
                    {
                      left: `${pos.left}%`,
                      top: `${pos.top}%`,
                      "--rot": `${pos.rotation}deg`,
                      animationName: pos.drift,
                      animationDuration: `${pos.duration}s`,
                      animationDelay: `${pos.delay}s`,
                    } as React.CSSProperties
                  }
                  onClick={() => handleWispClick(originalIndex)}
                  onMouseEnter={() => {
                    setHoveredIndex(originalIndex);
                    playHoverTone(originalIndex);
                  }}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  <img
                    src={thumbUrl(photo.url, 600)}
                    alt={photo.location}
                    className="pensieve__wisp-img"
                    style={
                      {
                        "--entrance-delay": `${entranceDelay}s`,
                      } as React.CSSProperties
                    }
                    loading={originalIndex < 6 ? "eager" : "lazy"}
                    draggable={false}
                  />
                  <span className="pensieve__wisp-label">
                    {photo.location}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <Link
        to="/photos"
        className="pensieve__archive"
        onClick={(e) => {
          e.preventDefault();
          setPlunging(true);
          setTimeout(() => navigate("/photos"), 1200);
        }}
      >
        dive in
      </Link>

      {lightboxIndex !== null && lightboxPool.length > 0 && (
        <Lightbox
          photos={lightboxPool}
          index={lightboxIndex}
          onClose={closeLightbox}
          onNavigate={setLightboxIndex}
        />
      )}
    </main>
  );
}
