import { Moon, Sun } from "lucide-react";
import { useTheme } from "./theme-provider";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
      className={`group inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-border/60 bg-card/60 text-foreground shadow-sm backdrop-blur transition-all duration-200 hover:scale-105 hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${className}`}
    >
      {isDark ? (
        <Sun className="h-5 w-5 transition-transform duration-300 group-hover:rotate-45" />
      ) : (
        <Moon className="h-5 w-5 transition-transform duration-300 group-hover:-rotate-12" />
      )}
    </button>
  );
}
