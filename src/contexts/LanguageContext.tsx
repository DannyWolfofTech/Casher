import { createContext, useContext, useState, useEffect } from "react";

type Language = "en" | "fr" | "es";

interface Translations {
  [key: string]: {
    [key: string]: string;
  };
}

const translations: Translations = {
  en: {
    appName: "Casher",
    tagline: "Cash saver, the app that plugs your financial leaks by spotting and helping cancel unused subscriptions, so you can keep more money in your pocket!",
    getStarted: "Get Started",
    uploadCSV: "Upload CSV & Start Saving",
    viewPricing: "View Pricing",
    dashboard: "Dashboard",
    signOut: "Sign Out",
    upgradeToPro: "Upgrade to Pro",
    monthlySpending: "Monthly Spending",
    subscriptionLeaks: "Subscription Leaks",
    potentialSavings: "Potential Savings",
    savingsGoals: "Savings Goals",
  },
  fr: {
    appName: "Casher",
    tagline: "Économiseur d'argent, l'application qui colmate vos fuites financières en repérant et en aidant à annuler les abonnements inutilisés, afin que vous puissiez garder plus d'argent dans votre poche!",
    getStarted: "Commencer",
    uploadCSV: "Télécharger CSV et commencer à économiser",
    viewPricing: "Voir les tarifs",
    dashboard: "Tableau de bord",
    signOut: "Se déconnecter",
    upgradeToPro: "Passer à Pro",
    monthlySpending: "Dépenses mensuelles",
    subscriptionLeaks: "Fuites d'abonnement",
    potentialSavings: "Économies potentielles",
    savingsGoals: "Objectifs d'épargne",
  },
  es: {
    appName: "Casher",
    tagline: "Ahorrador de efectivo, la aplicación que tapa tus fugas financieras al detectar y ayudar a cancelar suscripciones no utilizadas, para que puedas mantener más dinero en tu bolsillo!",
    getStarted: "Empezar",
    uploadCSV: "Subir CSV y empezar a ahorrar",
    viewPricing: "Ver precios",
    dashboard: "Panel de control",
    signOut: "Cerrar sesión",
    upgradeToPro: "Actualizar a Pro",
    monthlySpending: "Gasto mensual",
    subscriptionLeaks: "Fugas de suscripción",
    potentialSavings: "Ahorros potenciales",
    savingsGoals: "Objetivos de ahorro",
  },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem("language");
    if (saved) return saved as Language;
    
    const browserLang = navigator.language.split("-")[0];
    if (browserLang === "fr" || browserLang === "es") return browserLang as Language;
    return "en";
  });

  useEffect(() => {
    localStorage.setItem("language", language);
  }, [language]);

  const t = (key: string): string => {
    return translations[language][key] || translations.en[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}
