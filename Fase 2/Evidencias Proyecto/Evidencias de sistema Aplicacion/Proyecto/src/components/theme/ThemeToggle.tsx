"use client";

import { useEffect, useState } from "react";

interface ThemeToggleProps {
  className?: string;
}

export default function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const isDark =
      document.documentElement.classList.contains("dark") ||
      document.documentElement.getAttribute("data-theme") === "dark";
    setTheme(isDark ? "dark" : "light");
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);

    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
      document.documentElement.setAttribute("data-theme", "dark");
      try {
        localStorage.setItem("theme", "dark");
      } catch (e) {
        console.error(e);
      }
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.setAttribute("data-theme", "light");
      try {
        localStorage.setItem("theme", "light");
      } catch (e) {
        console.error(e);
      }
    }
  };

  if (!mounted) {
    return (
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant select-none ${className}`}
        aria-hidden="true"
      >
        <span className="material-symbols-outlined text-[22px]">dark_mode</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === "light" ? "Cambiar a Modo Oscuro" : "Cambiar a Modo Claro"}
      title={theme === "light" ? "Activar Modo Oscuro" : "Activar Modo Claro"}
      className={`w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-container-high active:scale-95 transition-all ${className}`}
    >
      <span className="material-symbols-outlined text-[22px]">
        {theme === "light" ? "dark_mode" : "light_mode"}
      </span>
    </button>
  );
}
