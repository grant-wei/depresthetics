import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useFilterStore } from "../store";
import { useFilteredPhotos } from "../hooks/useFilteredPhotos";
import { usePensieveStore } from "../hooks/usePensieveState";
import { useTemporalSelection } from "../hooks/useTemporalSelection";
import { usePensieveAudio } from "../hooks/usePensieveAudio";
import { useKeyboard } from "../hooks/useKeyboard";
import { usePull } from "../hooks/usePull";
import { FilterBar } from "../components/FilterBar";
import { PhotoStream } from "../components/PhotoStream";
import { GridToggle } from "../components/GridToggle";
import { Lightbox } from "../components/Lightbox";
import { thumbUrl, fullUrl } from "../utils/image";
import { photos as allPhotos } from "../data/photos";
import { getNeighbors } from "../data/colorData";
import type { Photo } from "../types";

/** Full-corpus map so neighbors outside current filters resolve */
const allPhotosMap = new Map<string, Photo>();
for (const p of allPhotos) allPhotosMap.set(p.id, p);

export function Gallery() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { years, locations, filmStocks, setYears, setLocations, setFilmStocks } = useFilterStore();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const {
    mode,
    currentId,
    threadHistory,
    holdProgress,
    showClassicGrid,
    setQueue,
    advanceQueue,
    focus,
    thread,
    surface,
    surfaceAll,
    startImmerse,
    setHoldProgress,
    completeImmerse,
    releaseImmerse,
    idleTimeout,
    toggleGrid,
    reset,
  } = usePensieveStore();

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [fromPull, setFromPull] = useState(false);

  const {
    startGalleryAmbient,
    stopGalleryAmbient,
    setThreadDepth,
    setPullProgress,
  } = usePensieveAudio();

  const galleryRef = useRef<HTMLElement>(null);

  // Reset state on mount so stale threading/focused modes don't persist
  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── URL sync ───
  useEffect(() => {
    const urlYears = searchParams.get("year")?.split(",").filter(Boolean) ?? [];
    const urlLocations = searchParams.get("location")?.split(",").filter(Boolean) ?? [];
    const urlFilmStocks = searchParams.get("film")?.split(",").filter(Boolean) ?? [];
    if (urlYears.length > 0) setYears(urlYears);
    if (urlLocations.length > 0) setLocations(urlLocations);
    if (urlFilmStocks.length > 0) setFilmStocks(urlFilmStocks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (years.length > 0) params.set("year", years.join(","));
    if (locations.length > 0) params.set("location", locations.join(","));
    if (filmStocks.length > 0) params.set("film", filmStocks.join(","));
    setSearchParams(params, { replace: true });
  }, [years, locations, filmStocks, setSearchParams]);

  const filtered = useFilteredPhotos();
  const hasFilters = years.length > 0 || locations.length > 0 || filmStocks.length > 0;

  const photoMap = useMemo(() => {
    const m = new Map<string, Photo>();
    for (const p of filtered) m.set(p.id, p);
    return m;
  }, [filtered]);

  /** Set of filtered IDs for quick membership checks */
  const filteredIds = useMemo(() => new Set(filtered.map((p) => p.id)), [filtered]);

  const queue = useTemporalSelection(filtered);

  useEffect(() => {
    if (queue.length > 0) setQueue(queue);
  }, [queue, setQueue]);

  // Classic shuffle (for grid mode)
  const [shuffleKey] = useState(() => Math.random());
  const classicShuffled = useMemo(() => {
    const arr = [...filtered];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [filtered, shuffleKey]);

  // ═══════════════════════════════════════════
  //  Crossfade — two alternating slots
  // ═══════════════════════════════════════════

  const [slotA, setSlotA] = useState<string>("");
  const [slotB, setSlotB] = useState<string>("");
  const [frontSlot, setFrontSlot] = useState<"A" | "B">("A");
  const [fading, setFading] = useState(false);
  const backReady = useRef(false);
  const autoplayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize slots
  useEffect(() => {
    if (queue.length > 0 && !slotA) {
      setSlotA(queue[0]);
      if (queue.length > 1) setSlotB(queue[1]);
    }
  }, [queue, slotA]);

  const onBackLoaded = useCallback(() => {
    backReady.current = true;
  }, []);

  // Advance: fade front out, back becomes visible, then swap roles
  const advance = useCallback(() => {
    if (!backReady.current) return;

    setFading(true);

    setTimeout(() => {
      setFrontSlot((prev) => (prev === "A" ? "B" : "A"));
      setFading(false);

      const nextId = advanceQueue();
      if (nextId) {
        setFrontSlot((current) => {
          if (current === "A") {
            setSlotB(nextId);
          } else {
            setSlotA(nextId);
          }
          return current;
        });
      }
      backReady.current = false;
    }, 2500);
  }, [advanceQueue]);

  // Autoplay (DRIFTING only)
  useEffect(() => {
    if (mode !== "drifting" || showClassicGrid || queue.length < 2) {
      if (autoplayTimer.current) clearTimeout(autoplayTimer.current);
      return;
    }

    const tick = () => {
      advance();
      autoplayTimer.current = setTimeout(tick, 8000);
    };
    autoplayTimer.current = setTimeout(tick, 8000);

    return () => {
      if (autoplayTimer.current) clearTimeout(autoplayTimer.current);
    };
  }, [mode, showClassicGrid, queue.length, advance]);

  // Idle timeout (FOCUSED → DRIFTING after 8s — enough time to examine neighbors)
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (mode === "focused") {
      idleTimerRef.current = setTimeout(idleTimeout, 8000);
    }
  }, [mode, idleTimeout]);

  useEffect(() => {
    resetIdleTimer();
    return () => { if (idleTimerRef.current) clearTimeout(idleTimerRef.current); };
  }, [mode, currentId, resetIdleTimer]);

  // Audio
  useEffect(() => {
    if (showClassicGrid) { stopGalleryAmbient(); return; }
    startGalleryAmbient();
    return () => stopGalleryAmbient();
  }, [showClassicGrid, startGalleryAmbient, stopGalleryAmbient]);

  useEffect(() => { setPullProgress(holdProgress); }, [holdProgress, setPullProgress]);

  // Audio — thread depth
  useEffect(() => {
    setThreadDepth(threadHistory.length);
  }, [threadHistory.length, setThreadDepth]);

  // ═══════════════════════════════════════════
  //  Pull interaction
  // ═══════════════════════════════════════════

  const pullEnabled = mode === "focused" || mode === "threading";

  const { isPulling } = usePull({
    enabled: pullEnabled,
    containerRef: galleryRef,
    onStart: () => {
      startImmerse();
    },
    onComplete: () => {
      completeImmerse();
      setFromPull(true);
      // Open lightbox for current photo
      const idx = filtered.findIndex((p) => p.id === currentId);
      if (idx >= 0) {
        setLightboxIndex(idx);
      } else {
        // Photo not in filtered set — show as single-photo lightbox
        const photo = allPhotosMap.get(currentId);
        if (photo) {
          setLightboxIndex(0);
          // We'll handle this in the lightbox photos prop
        }
      }
    },
    onRelease: () => {
      releaseImmerse();
    },
    onProgress: (progress) => {
      setHoldProgress(progress);
    },
  });

  // ═══════════════════════════════════════════
  //  Safety: filter change while threading
  // ═══════════════════════════════════════════

  useEffect(() => {
    if ((mode === "focused" || mode === "threading") && currentId && !filteredIds.has(currentId)) {
      surfaceAll();
    }
  }, [filteredIds, currentId, mode, surfaceAll]);

  // Keyboard
  useKeyboard({
    Escape: () => {
      if (lightboxIndex !== null) {
        setLightboxIndex(null);
        setFromPull(false);
      } else {
        surface();
      }
    },
  });

  // ═══════════════════════════════════════════
  //  Click handler — mode-aware routing
  // ═══════════════════════════════════════════

  const handlePhotoClick = useCallback((e: React.MouseEvent) => {
    if (lightboxIndex !== null) return;
    if (isPulling) return;

    const target = e.target as HTMLElement;
    if (target.closest(".lightbox, .filter-drawer, .grid-toggle, .gallery__filter-btn, .pensieve-gallery__thread-depth")) return;

    if (mode === "drifting") {
      // Enter FOCUSED — do NOT open lightbox
      const id = frontSlot === "A" ? slotA : slotB;
      if (id) focus(id);
      return;
    }

    if (mode === "focused" || mode === "threading") {
      // Check if a neighbor was clicked
      const neighborBtn = target.closest("[data-neighbor-id]");
      if (neighborBtn) {
        const neighborId = (neighborBtn as HTMLElement).dataset.neighborId;
        if (neighborId) {
          thread(neighborId);
          resetIdleTimer();
        }
        return;
      }

      // Center photo clicked → open lightbox
      const idx = filtered.findIndex((p) => p.id === currentId);
      if (idx >= 0) {
        setFromPull(false);
        setLightboxIndex(idx);
      } else {
        // Threaded photo not in filtered set — single-photo lightbox
        setFromPull(false);
        setLightboxIndex(0);
      }
    }
  }, [mode, frontSlot, slotA, slotB, currentId, filtered, focus, thread, lightboxIndex, isPulling, resetIdleTimer]);

  // Resolve display
  const frontId = frontSlot === "A" ? slotA : slotB;
  const displayId = mode === "drifting" ? frontId : currentId;
  const displayPhoto = photoMap.get(displayId) ?? allPhotosMap.get(displayId);
  const slotAPhoto = photoMap.get(slotA);
  const slotBPhoto = photoMap.get(slotB);

  // Neighbors for cluster
  const neighbors = useMemo(() => {
    if (mode !== "focused" && mode !== "threading") return [];
    if (!currentId) return [];
    return getNeighbors(currentId)
      .map((nId) => ({ id: nId, photo: allPhotosMap.get(nId) }))
      .filter((n): n is { id: string; photo: Photo } => n.photo != null);
  }, [mode, currentId]);

  // Lightbox photos: if current photo is in filtered, use filtered; otherwise single-photo array
  const lightboxPhotos = useMemo(() => {
    if (currentId && !filteredIds.has(currentId)) {
      const photo = allPhotosMap.get(currentId);
      return photo ? [photo] : filtered;
    }
    return filtered;
  }, [filtered, filteredIds, currentId]);

  // ═══════════════════════════════════════════
  //  Render
  // ═══════════════════════════════════════════

  if (showClassicGrid) {
    return (
      <main className="gallery">
        <div className="gallery__header">
          <button
            className={`gallery__filter-btn ${hasFilters ? "gallery__filter-btn--active" : ""}`}
            onClick={() => setDrawerOpen(true)}
            aria-label="Filter photos"
          >
            ◯
          </button>
        </div>
        <FilterBar open={drawerOpen} onClose={() => setDrawerOpen(false)} />
        <PhotoStream photos={classicShuffled} />
        <GridToggle active={true} onToggle={toggleGrid} />
      </main>
    );
  }

  const isFocusedOrThreading = mode === "focused" || mode === "threading";
  const imgFocusedClass = isFocusedOrThreading ? " pensieve-gallery__img--focused" : "";

  return (
    <main
      className={`pensieve-gallery${isPulling ? " pensieve-gallery--pulling" : ""}`}
      onClick={handlePhotoClick}
      ref={galleryRef}
    >
      {/* Atmospheric overlays */}
      <div className="pensieve-gallery__vignette" />
      <div className="pensieve-gallery__pull-darken" />
      <div className="pensieve-gallery__grain" />

      {/* Single photo, centered, crossfading — stable keys prevent unmount flicker */}
      <div className="pensieve-gallery__crossfade">
        {slotAPhoto && (
          <img
            key="slot-A"
            src={fullUrl(slotAPhoto.url)}
            srcSet={`${thumbUrl(slotAPhoto.url, 600)} 600w, ${fullUrl(slotAPhoto.url)} 1600w`}
            sizes="100vw"
            alt={slotAPhoto.location || "Memory"}
            className={`pensieve-gallery__img ${
              frontSlot === "A"
                ? `pensieve-gallery__img--front${fading ? " pensieve-gallery__img--fading" : ""}${imgFocusedClass}`
                : `pensieve-gallery__img--back${fading ? " pensieve-gallery__img--revealing" : ""}`
            }`}
            onLoad={frontSlot !== "A" ? onBackLoaded : undefined}
            draggable={false}
          />
        )}
        {slotBPhoto && (frontSlot === "B" || mode === "drifting") && (
          <img
            key="slot-B"
            src={fullUrl(slotBPhoto.url)}
            srcSet={`${thumbUrl(slotBPhoto.url, 600)} 600w, ${fullUrl(slotBPhoto.url)} 1600w`}
            sizes="100vw"
            alt={slotBPhoto.location || "Memory"}
            className={`pensieve-gallery__img ${
              frontSlot === "B"
                ? `pensieve-gallery__img--front${fading ? " pensieve-gallery__img--fading" : ""}${imgFocusedClass}`
                : `pensieve-gallery__img--back${fading ? " pensieve-gallery__img--revealing" : ""}`
            }`}
            onLoad={frontSlot !== "B" ? onBackLoaded : undefined}
            draggable={false}
          />
        )}

        {/* Focused/threading: render current photo on top if it differs from crossfade slots */}
        {isFocusedOrThreading && currentId && currentId !== slotA && currentId !== slotB && displayPhoto && (
          <img
            key={`focused-${currentId}`}
            src={fullUrl(displayPhoto.url)}
            srcSet={`${thumbUrl(displayPhoto.url, 600)} 600w, ${fullUrl(displayPhoto.url)} 1600w`}
            sizes="100vw"
            alt={displayPhoto.location || "Memory"}
            className={`pensieve-gallery__img pensieve-gallery__img--front${imgFocusedClass}`}
            draggable={false}
          />
        )}
      </div>

      {/* ─── Neighbor strip ─── */}
      {isFocusedOrThreading && neighbors.length > 0 && (
        <div className="pensieve-gallery__neighbors" key={currentId}>
          {neighbors.map((n, i) => (
            <button
              key={n.id}
              className="pensieve-gallery__neighbor"
              data-neighbor-id={n.id}
              style={{ animationDelay: `${i * 0.04}s` }}
            >
              <img
                className="pensieve-gallery__neighbor-img"
                src={thumbUrl(n.photo.url, 600)}
                alt={n.photo.location || "Related memory"}
                draggable={false}
              />
            </button>
          ))}
        </div>
      )}

      {/* ─── Thread depth indicator ─── */}
      {threadHistory.length > 0 && (
        <div className="pensieve-gallery__thread-depth">
          <div className="pensieve-gallery__thread-dots">
            {threadHistory.map((_, i) => (
              <span key={i} className="pensieve-gallery__thread-dot" />
            ))}
            <span className="pensieve-gallery__thread-dot pensieve-gallery__thread-dot--current" />
          </div>
          <button className="pensieve-gallery__surface-hint" onClick={(e) => { e.stopPropagation(); surfaceAll(); }}>
            surface
          </button>
        </div>
      )}

      {/* Location + film at bottom */}
      {displayPhoto && (
        <div className={`pensieve-gallery__whisper${fading ? "" : " pensieve-gallery__whisper--visible"}`}>
          {displayPhoto.location && (
            <span className="pensieve-gallery__whisper-location">{displayPhoto.location}</span>
          )}
          {displayPhoto.filmStock && (
            <>
              <span className="pensieve-gallery__whisper-sep">&middot;</span>
              <span className="pensieve-gallery__whisper-film">{displayPhoto.filmStock}</span>
            </>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="pensieve-gallery__controls">
        <button
          className={`gallery__filter-btn ${hasFilters ? "gallery__filter-btn--active" : ""}`}
          onClick={(e) => { e.stopPropagation(); setDrawerOpen(true); }}
          aria-label="Filter photos"
        >
          ◯
        </button>
      </div>

      <FilterBar open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <GridToggle active={false} onToggle={toggleGrid} />

      {lightboxIndex !== null && (
        <Lightbox
          photos={lightboxPhotos}
          index={lightboxIndex}
          onClose={() => { setLightboxIndex(null); setFromPull(false); surface(); }}
          onNavigate={setLightboxIndex}
          fromPull={fromPull}
        />
      )}
    </main>
  );
}
