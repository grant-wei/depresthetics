import { useState } from "react";
import type { Photo } from "../types";
import { PhotoCard } from "./PhotoCard";
import { Lightbox } from "./Lightbox";

interface PhotoStreamProps {
  photos: Photo[];
}

export function PhotoStream({ photos }: PhotoStreamProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  function openLightbox(photo: Photo) {
    const idx = photos.findIndex((p) => p.id === photo.id);
    setLightboxIndex(idx);
  }

  return (
    <div className="photo-stream">
      <div className="photo-stream__masonry">
        {photos.map((photo) => (
          <PhotoCard
            key={photo.id}
            photo={photo}
            onClick={() => openLightbox(photo)}
          />
        ))}
      </div>

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
