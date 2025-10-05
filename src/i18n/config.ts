import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      // Header & Navigation
      appName: "Casher",
      signOut: "Sign Out",
      upgradeToPro: "Upgrade to Pro",
      share: "Share",
      adminPanel: "Admin Panel",
      
      // Dashboard
      monthlySpending: "Monthly Spending",
      subscriptionLeaks: "Subscription Leaks",
      potentialSavings: "Potential Savings",
      detectedSubscriptions: "Detected Subscriptions",
      allTransactions: "All Transactions",
      transactionsDescription: "Complete list of your parsed transactions",
      
      // Table headers
      date: "Date",
      description: "Description",
      amount: "Amount",
      category: "Category",
      export: "Export",
      
      // Upload
      getStarted: "Get Started",
      uploadCSV: "Upload Bank Statement CSV",
      uploadDescription: "Upload your bank statement CSV to analyze your spending and detect subscriptions",
      
      // Common
      back: "Back",
      cancel: "Cancel",
      save: "Save",
      delete: "Delete",
    }
  },
  ro: {
    translation: {
      // Header & Navigation
      appName: "Casher",
      signOut: "Deconectare",
      upgradeToPro: "Actualizează la Pro",
      share: "Distribuie",
      adminPanel: "Panou admin",
      
      // Dashboard
      monthlySpending: "Cheltuieli lunare",
      subscriptionLeaks: "Scurgeri de abonamente",
      potentialSavings: "Economii potențiale",
      detectedSubscriptions: "Abonamente detectate",
      allTransactions: "Toate tranzacțiile",
      transactionsDescription: "Lista completă a tranzacțiilor tale analizate",
      
      // Table headers
      date: "Data",
      description: "Descriere",
      amount: "Sumă",
      category: "Categorie",
      export: "Exportă",
      
      // Upload
      getStarted: "Începe acum",
      uploadCSV: "Încarcă extras de cont CSV",
      uploadDescription: "Încarcă extrasul tău bancar CSV pentru a analiza cheltuielile și detecta abonamentele",
      
      // Common
      back: "Înapoi",
      cancel: "Anulează",
      save: "Salvează",
      delete: "Șterge",
    }
  },
  es: {
    translation: {
      // Header & Navigation
      appName: "Casher",
      signOut: "Cerrar sesión",
      upgradeToPro: "Actualizar a Pro",
      share: "Compartir",
      adminPanel: "Panel de administración",
      
      // Dashboard
      monthlySpending: "Gasto mensual",
      subscriptionLeaks: "Fugas de suscripción",
      potentialSavings: "Ahorros potenciales",
      detectedSubscriptions: "Suscripciones detectadas",
      allTransactions: "Todas las transacciones",
      transactionsDescription: "Lista completa de tus transacciones analizadas",
      
      // Table headers
      date: "Fecha",
      description: "Descripción",
      amount: "Monto",
      category: "Categoría",
      export: "Exportar",
      
      // Upload
      getStarted: "Empezar",
      uploadCSV: "Subir extracto bancario CSV",
      uploadDescription: "Sube tu extracto bancario CSV para analizar tus gastos y detectar suscripciones",
      
      // Common
      back: "Atrás",
      cancel: "Cancelar",
      save: "Guardar",
      delete: "Eliminar",
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: localStorage.getItem('language') || 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
