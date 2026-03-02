import { useEffect, useRef, useCallback, useState } from "react";
import type { Photo } from "../types";
import { useKeyboard } from "../hooks/useKeyboard";
import { fullUrl, thumbUrl, getCamera } from "../utils/image";

interface LightboxProps {
  photos: Photo[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
  fromPull?: boolean;
}

export function Lightbox({ photos, index, onClose, onNavigate, fromPull }: LightboxProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const photo = photos[index];

  const goPrev = useCallback(() => {
    if (index > 0) onNavigate(index - 1);
  }, [index, onNavigate]);

  const goNext = useCallback(() => {
    if (index < photos.length - 1) onNavigate(index + 1);
  }, [index, photos.length, onNavigate]);

  useKeyboard({
    Escape: onClose,
    ArrowLeft: goPrev,
    ArrowRight: goNext,
  });

  // Preload adjacent images
  useEffect(() => {
    const preload = (i: number) => {
      if (i >= 0 && i < photos.length) {
        const img = new Image();
        img.src = fullUrl(photos[i].url);
      }
    };
    preload(index - 1);
    preload(index + 1);
  }, [index, photos]);

  // Open dialog on mount
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  function onBackdropClick(e: React.MouseEvent) {
    if (e.target === dialogRef.current) {
      onClose();
    }
  }

  const lightboxCursorRef = useRef<HTMLDivElement>(null);
  const [cursorVisible, setCursorVisible] = useState(false);

  const onLightboxMouseMove = useCallback((e: React.MouseEvent) => {
    if (lightboxCursorRef.current) {
      lightboxCursorRef.current.style.left = `${e.clientX}px`;
      lightboxCursorRef.current.style.top = `${e.clientY}px`;
    }
    if (!cursorVisible) setCursorVisible(true);
  }, [cursorVisible]);

  // Touch swipe gestures for mobile navigation
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    touchStart.current = null;

    // Horizontal swipe (min 50px, mostly horizontal)
    if (Math.abs(dx) > 50 && Math.abs(dy) < Math.abs(dx) * 0.7) {
      if (dx > 0) goPrev();
      else goNext();
    }
    // Downward swipe to close
    else if (dy > 80 && Math.abs(dx) < 50) {
      onClose();
    }
  }, [goPrev, goNext, onClose]);

  if (!photo) return null;

  return (
    <dialog
      ref={dialogRef}
      className={`lightbox custom-cursor-area${fromPull ? " lightbox--from-pull" : ""}`}
      onClick={onBackdropClick}
      onMouseMove={onLightboxMouseMove}
      onMouseLeave={() => setCursorVisible(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div
        className={`custom-cursor ${cursorVisible ? "custom-cursor--visible" : ""}`}
        ref={lightboxCursorRef}
      />
      <div className="lightbox__content">
        <button className="lightbox__close" onClick={onClose}>
          &times;
        </button>

        <div className="lightbox__nav">
          <button
            className="lightbox__arrow lightbox__arrow--prev"
            onClick={goPrev}
            disabled={index === 0}
          >
            &#8249;
          </button>

          <img
            src={fullUrl(photo.url)}
            srcSet={`${thumbUrl(photo.url, 600)} 600w, ${fullUrl(photo.url)} 1600w`}
            sizes="90vw"
            alt={`${photo.location || "Untitled"} — ${photo.filmStock || "Film"}`}
            className="lightbox__img"
          />

          <button
            className="lightbox__arrow lightbox__arrow--next"
            onClick={goNext}
            disabled={index === photos.length - 1}
          >
            &#8250;
          </button>
        </div>

        <div className="lightbox__meta">
          {photo.location && <span className="lightbox__location">{photo.location}</span>}
          {photo.filmStock && (
            <>
              <span className="lightbox__sep">&middot;</span>
              <span className="lightbox__film">{photo.filmStock}</span>
            </>
          )}
          {(() => {
            const camera = getCamera(photo.location, photo.filmStock);
            return camera ? (
              <>
                <span className="lightbox__sep">&middot;</span>
                <span className="lightbox__film">{camera}</span>
              </>
            ) : null;
          })()}
          {photo.devDate && (
            <>
              <span className="lightbox__sep">&middot;</span>
              <span className="lightbox__date">{photo.devDate}</span>
            </>
          )}
          <span className="lightbox__counter">
            {index + 1} / {photos.length}
          </span>
        </div>
      </div>
    </dialog>
  );
}
