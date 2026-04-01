"use client";
import { useCallback, useEffect, useRef } from "react";
import { cn } from "../../lib/utils";

const morphTime = 6;
const cooldownTime = 0.7;

const useMorphingText = (texts: string[]) => {
  const textIndexRef = useRef(0);
  const morphRef = useRef(0);
  const cooldownRef = useRef(0);
  const timeRef = useRef(new Date());

  const text1Ref = useRef<HTMLSpanElement>(null);
  const text2Ref = useRef<HTMLSpanElement>(null);

  const setStyles = useCallback(
    (fraction: number) => {
      const [current1, current2] = [text1Ref.current, text2Ref.current];
      if (!current1 || !current2) return;
      current2.style.filter = `blur(${Math.min(8 / fraction - 8, 100)}px)`;
      current2.style.opacity = `${Math.pow(fraction, 0.4) * 100}%`;
      const invertedFraction = 1 - fraction;
      current1.style.filter = `blur(${Math.min(8 / invertedFraction - 8, 100)}px)`;
      current1.style.opacity = `${Math.pow(invertedFraction, 0.4) * 100}%`;
      current1.textContent = texts[textIndexRef.current % texts.length];
      current2.textContent = texts[(textIndexRef.current + 1) % texts.length];
    },
    [texts],
  );

  const doMorph = useCallback(() => {
    morphRef.current -= cooldownRef.current;
    cooldownRef.current = 0;
    let fraction = morphRef.current / morphTime;
    if (fraction > 1) {
      cooldownRef.current = cooldownTime;
      fraction = 1;
    }
    setStyles(fraction);
    if (fraction === 1) {
      textIndexRef.current++;
    }
  }, [setStyles]);

  const doCooldown = useCallback(() => {
    morphRef.current = 0;
    const [current1, current2] = [text1Ref.current, text2Ref.current];
    if (current1 && current2) {
      current2.style.filter = "none";
      current2.style.opacity = "100%";
      current1.style.filter = "none";
      current1.style.opacity = "0%";
    }
  }, []);

  useEffect(() => {
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const newTime = new Date();
      const dt = (newTime.getTime() - timeRef.current.getTime()) / 1000;
      timeRef.current = newTime;
      cooldownRef.current -= dt;
      if (cooldownRef.current <= 0) doMorph();
      else doCooldown();
    };
    animate();
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [doMorph, doCooldown]);

  return { text1Ref, text2Ref };
};

interface MorphingTextProps {
  className?: string;
  texts: string[];
  style?: React.CSSProperties;
}

/**
 * SVG threshold filter — creates the liquid blob morph effect.
 * Rendered once, referenced by the container via CSS filter.
 */
const SvgFilters: React.FC = () => (
  <svg
    id="filters"
    style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
    aria-hidden="true"
  >
    <defs>
      <filter id="threshold" colorInterpolationFilters="sRGB">
        <feColorMatrix
          in="SourceGraphic"
          type="matrix"
          values="1 0 0 0 0
                  0 1 0 0 0
                  0 0 1 0 0
                  0 0 0 255 -140"
        />
      </filter>
    </defs>
  </svg>
);

/**
 * MorphingText — liquid blob morph between phrases.
 * Uses the SVG threshold filter for the gooey effect.
 * Centered via text-align + inline-block, no 200% scaling hack.
 */
const MorphingText: React.FC<MorphingTextProps> = ({ texts, className }) => {
  const { text1Ref, text2Ref } = useMorphingText(texts);

  return (
    <div
      className={cn("relative", className)}
      style={{
        width: "100%",
        textAlign: "center",
        filter: "url(#threshold) blur(0.6px)",
      }}
    >
      <span
        ref={text1Ref}
        style={{
          display: "block",
          position: "absolute",
          width: "100%",
          textAlign: "center",
          top: 0,
          left: 0,
        }}
      />
      <span
        ref={text2Ref}
        style={{
          display: "block",
          width: "100%",
          textAlign: "center",
        }}
      />
      <SvgFilters />
    </div>
  );
};

export { MorphingText };
