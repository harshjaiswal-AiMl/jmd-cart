"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { StoreBanner } from "@/modules/banners/banner.types";

interface StoreBannerCarouselProps {
  banners: StoreBanner[];
}

export function StoreBannerCarousel({ banners }: StoreBannerCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const activeBanners = banners.filter((b) => b.active && b.imageUrl);
  const totalSlides = activeBanners.length;

  const nextSlide = useCallback(() => {
    if (totalSlides <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % totalSlides);
  }, [totalSlides]);

  const prevSlide = useCallback(() => {
    if (totalSlides <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + totalSlides) % totalSlides);
  }, [totalSlides]);

  // Autoplay timer
  useEffect(() => {
    if (isPaused || totalSlides <= 1) return;
    const interval = setInterval(() => {
      nextSlide();
    }, 5000);
    return () => clearInterval(interval);
  }, [isPaused, totalSlides, nextSlide]);

  // Touch swipe handling
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 40) {
      if (diff > 0) nextSlide();
      else prevSlide();
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  if (totalSlides === 0) return null;

  return (
    <section
      aria-label="Store Promotional Banners"
      className="max-w-[1280px] mx-auto w-full px-3 sm:px-4 lg:px-8 py-2 sm:py-3"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="relative overflow-hidden rounded-xl sm:rounded-2xl shadow-sm group">
        {/* Slides Track - PURE IMAGE ONLY, EXACT SPACE OF IMAGE */}
        <div
          className="flex transition-transform duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] will-change-transform"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {activeBanners.map((banner, idx) => (
            <div
              key={banner.id || idx}
              className="min-w-full flex-shrink-0 relative overflow-hidden"
            >
              <Link
                href={banner.ctaLink || "/store"}
                className="block w-full focus:outline-none"
              >
                {/* 
                  Senior UI/UX Proportions:
                  - Mobile: 16:8.5 (~180px height, compact & thumb-friendly)
                  - Tablet/Desktop: 2.7:1 (~240px - 280px height)
                  - Zero letterbox space, image occupies 100% of slide area seamlessly
                */}
                <div className="w-full aspect-[16/8.5] sm:aspect-[2.4/1] md:aspect-[2.7/1] max-h-[260px] sm:max-h-[280px] md:max-h-[300px] overflow-hidden bg-surface-container-low">
                  <img
                    src={banner.imageUrl || ""}
                    alt={banner.title || "Promotional Banner"}
                    className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-[1.015]"
                    loading={idx === 0 ? "eager" : "lazy"}
                  />
                </div>
              </Link>
            </div>
          ))}
        </div>

        {/* Carousel Arrow Controls - Sleek floating glass chevrons on desktop hover */}
        {totalSlides > 1 && (
          <>
            <button
              type="button"
              onClick={prevSlide}
              aria-label="Previous slide"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/85 hover:bg-white text-on-surface shadow-md backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-105 active:scale-95"
            >
              <span className="material-symbols-outlined text-[20px]">chevron_left</span>
            </button>
            <button
              type="button"
              onClick={nextSlide}
              aria-label="Next slide"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/85 hover:bg-white text-on-surface shadow-md backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-105 active:scale-95"
            >
              <span className="material-symbols-outlined text-[20px]">chevron_right</span>
            </button>

            {/* Dots Indicator - Modern subtle pill indicator */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-20 bg-black/35 backdrop-blur-sm px-2.5 py-1 rounded-full border border-white/10 shadow-xs">
              {activeBanners.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setCurrentIndex(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  className={`transition-all duration-300 rounded-full ${
                    currentIndex === i
                      ? "w-5 h-1.5 bg-white shadow-xs"
                      : "w-1.5 h-1.5 bg-white/50 hover:bg-white/80"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
