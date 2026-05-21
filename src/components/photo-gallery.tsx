"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight, X, Images } from "lucide-react";

export function PhotoGallery({ photos, alt }: { photos: string[]; alt: string }) {
  const [current, setCurrent] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  if (photos.length === 0) return null;

  const prev = () => setCurrent((c) => (c - 1 + photos.length) % photos.length);
  const next = () => setCurrent((c) => (c + 1) % photos.length);

  return (
    <>
      {/* Carousel principal */}
      <div className="relative group">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photos[current]}
          alt={alt}
          className="w-full h-full object-cover cursor-zoom-in"
          onClick={() => setLightbox(true)}
        />
        {photos.length > 1 && (
          <>
            <button onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-1.5 text-white opacity-0 group-hover:opacity-100 transition">
              <ChevronLeft size={16} />
            </button>
            <button onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-1.5 text-white opacity-0 group-hover:opacity-100 transition">
              <ChevronRight size={16} />
            </button>
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1">
              {photos.map((_, i) => (
                <button key={i} onClick={() => setCurrent(i)} className={`h-1.5 rounded-full transition-all ${i === current ? "w-4 bg-white" : "w-1.5 bg-white/50"}`} />
              ))}
            </div>
            <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
              <Images size={10} /> {current + 1}/{photos.length}
            </div>
          </>
        )}
      </div>

      {/* Thumbnails strip si > 1 photo */}
      {photos.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 mt-1.5">
          {photos.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={url}
              alt={`${alt} ${i + 1}`}
              onClick={() => setCurrent(i)}
              className={`h-14 w-20 flex-shrink-0 cursor-pointer rounded object-cover transition ${i === current ? "ring-2 ring-rose-500" : "opacity-60 hover:opacity-100"}`}
            />
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" onClick={() => setLightbox(false)}>
          <button className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" onClick={() => setLightbox(false)}>
            <X size={20} />
          </button>
          {photos.length > 1 && (
            <>
              <button onClick={(e) => { e.stopPropagation(); prev(); }} className="absolute left-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
                <ChevronLeft size={24} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); next(); }} className="absolute right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
                <ChevronRight size={24} />
              </button>
            </>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photos[current]}
            alt={alt}
            className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="absolute bottom-4 text-sm text-white/60">{current + 1} / {photos.length}</div>
        </div>
      )}
    </>
  );
}
