import { Moon, Sun } from "lucide-react";
import { Button } from "./ui/button";
import { useTheme } from "@/contexts/ThemeContext";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const label = theme === "light" ? "Switch to dark theme" : "Switch to light theme";

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className="min-h-11 min-w-11"
    >
      {theme === "light" ? (
        <Moon aria-hidden="true" className="h-5 w-5" />
      ) : (
        <Sun aria-hidden="true" className="h-5 w-5" />
      )}
    </Button>
  );
}
