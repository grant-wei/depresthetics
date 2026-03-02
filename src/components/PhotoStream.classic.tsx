import { useState, useEffect, useRef, useCallback } from "react";
import type { Photo } from "../types";
import { PhotoCard } from "./PhotoCard";
import { Lightbox } from "./Lightbox";
import { useReveal } from "../hooks/useReveal";

const CHUNK = 30;

interface PhotoStreamProps {
  photos: Photo[];
}

export function PhotoStream({ photos }: PhotoStreamProps) {
  const [visibleCount, setVisibleCount] = useState(CHUNK);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const revealRef = useReveal<HTMLDivElement>();

  // Reset visible count when photos change (e.g. filter)
  useEffect(() => {
    setVisibleCount(CHUNK);
  }, [photos]);

  // IntersectionObserver to load more
  const loadMore = useCallback(() => {
    setVisibleCount((prev) => Math.min(prev + CHUNK, photos.length));
  }, [photos.length]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "200px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  const visible = photos.slice(0, visibleCount);

  function openLightbox(photo: Photo) {
    const idx = photos.findIndex((p) => p.id === photo.id);
    setLightboxIndex(idx);
  }

  return (
    <div className="photo-stream" ref={revealRef}>
      <div className="photo-stream__masonry">
        {visible.map((photo) => (
          <PhotoCard
            key={photo.id}
            photo={photo}
            onClick={() => openLightbox(photo)}
          />
        ))}
      </div>

      {visibleCount < photos.length && (
        <div ref={sentinelRef} className="photo-stream__sentinel" />
      )}

      {lightboxIndex !== null && (
        <Lightbox
          photos={photos}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </div>
  );
}
