import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslation } from "react-i18next";

const languageOptions = [
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "ro", name: "Română", flag: "🇷🇴" },
  { code: "de", name: "Deutsch", flag: "🇩🇪" },
  { code: "it", name: "Italiano", flag: "🇮🇹" },
  { code: "pl", name: "Polski", flag: "🇵🇱" },
];

export function LanguageSelector() {
  const { language, setLanguage } = useLanguage();
  const { i18n } = useTranslation();

  const handleLanguageChange = (value: "en" | "fr" | "es" | "ro" | "de" | "it" | "pl") => {
    setLanguage(value);
    i18n.changeLanguage(value);
  };

  return (
    <Select value={language} onValueChange={handleLanguageChange}>
      <SelectTrigger className="w-[140px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {languageOptions.map((lang) => (
          <SelectItem key={lang.code} value={lang.code}>
            <span className="flex items-center gap-2">
              <span>{lang.flag}</span>
              <span>{lang.name}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
