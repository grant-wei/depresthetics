import { useCallback, useRef } from "react";
import type { Photo } from "../types";
import { thumbUrl, srcSet, getCamera } from "../utils/image";

interface PhotoCardProps {
  photo: Photo;
  onClick: () => void;
}

export function PhotoCard({ photo, onClick }: PhotoCardProps) {
  const frameRef = useRef<HTMLDivElement>(null);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const frame = frameRef.current;
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    frame.style.setProperty("--mouse-x", `${x}%`);
    frame.style.setProperty("--mouse-y", `${y}%`);
  }, []);

  return (
    <figure className="photo-card" onClick={onClick}>
      <div
        className="photo-card__frame"
        ref={frameRef}
        onMouseMove={onMouseMove}
        style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
      >
        <img
          src={thumbUrl(photo.url)}
          srcSet={srcSet(photo.url)}
          sizes="(max-width: 600px) 100vw, (max-width: 1024px) 50vw, 33vw"
          alt={`${photo.location || "Untitled"} — ${photo.filmStock || "Film"}`}
          loading="lazy"
          decoding="async"
          width={photo.width}
          height={photo.height}
          className="photo-card__img"
        />
        <div className="photo-card__spotlight" />
      </div>
      <figcaption className="photo-card__meta">
        {photo.location && <span className="photo-card__location">{photo.location}</span>}
        {photo.filmStock && <span className="photo-card__film">{photo.filmStock}</span>}
        {(() => {
          const camera = getCamera(photo.location, photo.filmStock);
          return camera ? <span className="photo-card__film">{camera}</span> : null;
        })()}
      </figcaption>
    </figure>
  );
}
