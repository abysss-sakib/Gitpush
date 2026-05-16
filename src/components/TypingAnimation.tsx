import React, { useState, useEffect } from "react";

interface TypingAnimationProps {
  words: string[];
}

export function TypingAnimation({ words }: TypingAnimationProps) {
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [currentText, setCurrentText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;

    const word = words[currentWordIndex];
    const typeSpeed = isDeleting ? 45 : 90;

    const timer = setTimeout(() => {
      if (!isDeleting && currentText === word) {
        setIsPaused(true);
        setTimeout(() => {
          setIsPaused(false);
          setIsDeleting(true);
        }, 2200);
        return;
      }

      if (isDeleting && currentText === "") {
        setIsDeleting(false);
        setCurrentWordIndex((prev) => (prev + 1) % words.length);
        return;
      }

      setCurrentText((prev) =>
        isDeleting ? prev.slice(0, -1) : word.slice(0, prev.length + 1)
      );
    }, typeSpeed);

    return () => clearTimeout(timer);
  }, [currentText, isDeleting, currentWordIndex, words, isPaused]);

  return (
    <span className="inline-flex items-center gap-0.5">
      <span
        className="text-white font-semibold"
        style={{ textShadow: "0 0 30px rgba(255,255,255,0.6), 0 0 60px rgba(255,255,255,0.2)" }}
      >
        {currentText}
      </span>
      <span
        className="inline-block w-[2px] h-[1.1em] bg-white align-middle ml-0.5"
        style={{ animation: "blink 1s step-end infinite" }}
      />
    </span>
  );
}
