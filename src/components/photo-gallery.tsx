"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, X, Images, ZoomIn } from "lucide-react";

export function PhotoGallery({ photos, alt }: { photos: string[]; alt: string }) {
  const [current, setCurrent] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [fade, setFade] = useState(true);
  const touchStart = useRef<number | null>(null);

  const go = useCallback((idx: number) => {
    setFade(false);
    setTimeout(() => {
      setCurrent(idx);
      setFade(true);
    }, 120);
  }, []);

  const prev = useCallback(() => go((current - 1 + photos.length) % photos.length), [current, go, photos.length]);
  const next = useCallback(() => go((current + 1) % photos.length), [current, go, photos.length]);

  /* Keyboard navigation */
  useEffect(() => {
    if (!lightbox) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft")  { e.preventDefault(); prev(); }
      if (e.key === "ArrowRight") { e.preventDefault(); next(); }
      if (e.key === "Escape")     setLightbox(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightbox, prev, next]);

  /* Touch swipe */
  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStart.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStart.current;
    if (Math.abs(dx) > 40) { dx < 0 ? next() : prev(); }
    touchStart.current = null;
  };

  if (photos.length === 0) return null;

  return (
    <>
      {/* Carousel principal */}
      <div
        className="relative group h-full"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photos[current]}
          alt={alt}
          className="w-full h-full object-cover cursor-zoom-in"
          style={{ opacity: fade ? 1 : 0, transition: "opacity 0.15s ease" }}
          onClick={() => setLightbox(true)}
        />
        {/* Zoom hint */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <div className="rounded-full bg-black/40 backdrop-blur-sm p-2">
            <ZoomIn size={18} className="text-white/80" />
          </div>
        </div>
        {photos.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 backdrop-blur-sm p-1.5 text-white opacity-0 group-hover:opacity-100 transition hover:bg-black/80 active:scale-95"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 backdrop-blur-sm p-1.5 text-white opacity-0 group-hover:opacity-100 transition hover:bg-black/80 active:scale-95"
            >
              <ChevronRight size={16} />
            </button>
            {/* Dots */}
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1">
              {photos.map((_, i) => (
                <button
                  key={i}
                  onClick={() => go(i)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${i === current ? "w-4 bg-white" : "w-1.5 bg-white/40 hover:bg-white/70"}`}
                />
              ))}
            </div>
            <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-black/60 backdrop-blur-sm px-2 py-0.5 text-[10px] text-white">
              <Images size={10} /> {current + 1}/{photos.length}
            </div>
          </>
        )}
      </div>

      {/* Thumbnails strip */}
      {photos.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 mt-1.5 px-0.5">
          {photos.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={url}
              alt={`${alt} ${i + 1}`}
              onClick={() => go(i)}
              className={`h-14 w-20 flex-shrink-0 cursor-pointer rounded object-cover transition-all duration-200 ${
                i === current
                  ? "ring-2 ring-rose-500 opacity-100 scale-[1.03]"
                  : "opacity-50 hover:opacity-90 hover:scale-[1.02]"
              }`}
            />
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm"
          onClick={() => setLightbox(false)}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {/* Close */}
          <button
            className="absolute top-4 right-4 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 active:scale-95"
            onClick={() => setLightbox(false)}
          >
            <X size={20} />
          </button>
          {/* Counter */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
            {current + 1} / {photos.length}
          </div>
          {/* Keyboard hint */}
          {photos.length > 1 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 text-[11px] text-white/30">
              <span>← → naviguer</span>
              <span>·</span>
              <span>Échap fermer</span>
            </div>
          )}
          {photos.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); prev(); }}
                className="absolute left-4 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 active:scale-95 transition"
              >
                <ChevronLeft size={24} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); next(); }}
                className="absolute right-4 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 active:scale-95 transition"
              >
                <ChevronRight size={24} />
              </button>
            </>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photos[current]}
            alt={alt}
            className="max-h-[85vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
            style={{ opacity: fade ? 1 : 0, transition: "opacity 0.15s ease" }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
