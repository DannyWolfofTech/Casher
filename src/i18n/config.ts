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
      thisMonth: "This month",
      perYear: "Per year",
      uploadCsvToSeeData: "Upload CSV to see data",
      uploadLimitReached: "Upload limit reached",
      uploadLimitMessage: "Free tier allows 1 upload per month. Used: {count}/1",
      upgradeForUnlimited: "Upgrade to Pro for Unlimited Uploads",
      uploadsUsed: "Uploads used: {count}/1 this month",
      howToExport: "How to export from your bank:",
      
      // Spending Chart
      spendingByCategory: "Spending by Category",
      overallSpendingBreakdown: "Your overall spending breakdown",
      loading: "Loading...",
      noDataAvailable: "No data available. Upload a CSV to see your spending.",
      
      // Subscriptions
      recurringPayments: "Recurring payments we found in your transactions",
      noSubscriptionsYet: "No subscriptions detected yet. Upload a CSV to find recurring payments.",
      perFrequency: "per {frequency}",
      annualCost: "Annual cost: £{amount}",
      cancelSubscription: "Cancel",
      
      // CSV Upload
      uploadBankStatement: "Upload Bank Statement",
      uploadBankStatementDesc: "Upload a CSV file from your bank to analyze transactions",
      dropFileHere: "Drop the CSV file here",
      dragDropPrompt: "Drag & drop your CSV file here, or click to select",
      supportsFormat: "Supports CSV files from HSBC, NatWest, Barclays, and more",
      analyzeTransactions: "Analyze Transactions",
      processing: "Processing...",
      successProcessed: "Processed {transactions} transactions and detected {subscriptions} subscriptions.",
      errorProcessing: "Failed to process CSV",
      errorReading: "Failed to read file",
      
      // Pricing
      chooseYourPlan: "Choose Your Plan",
      startSavingToday: "Start saving money on unused subscriptions today",
      featureComparison: "Feature Comparison",
      mostPopular: "Most Popular",
      getStartedFree: "Get Started Free",
      upgradeNow: "Upgrade Now",
      pleaseSignIn: "Please sign in",
      needSignInToSubscribe: "You need to be signed in to subscribe",
      errorCheckout: "Failed to start checkout",
      getWeeklyProTips: "Get Weekly Pro Tips",
      subscribeForTips: "Subscribe to receive expert financial advice and money-saving strategies",
      enterYourEmail: "Enter your email",
      subscribe: "Subscribe",
      allPlansInclude: "All plans include GDPR-compliant data handling & multi-language support",
      cancelAnytime: "Cancel anytime, no questions asked • 30-day money-back guarantee",
      
      // Plans
      planFree: "Free",
      planPro: "Pro",
      planPremium: "Premium",
      planFreeDesc: "Perfect for getting started",
      planProDesc: "For regular users",
      planPremiumDesc: "For power users",
      
      // Features
      csvUploadsPerMonth: "1 CSV upload per month",
      unlimitedCsvUploads: "Unlimited CSV uploads",
      basicCategorization: "Basic transaction categorization",
      viewInsights: "View insights & spot subscriptions",
      multiLanguage: "Multi-language support",
      lightDarkMode: "Light/dark mode",
      advancedFilters: "Advanced filters & search",
      csvExports: "CSV exports",
      detailedReports: "Detailed spending reports",
      priorityEmailSupport: "Priority email support",
      monthlySummary: "Monthly savings summary",
      allProFeatures: "All Pro features",
      aiInsights: "AI-powered insights",
      customRecommendations: "Custom financial recommendations",
      priorityChatSupport: "Priority chat support",
      earlyAccess: "Early access to features",
      quarterlyReview: "Quarterly financial review",
      
      // Limitations
      limitations: "Limitations:",
      noCsvExports: "No CSV exports",
      noAdvancedFilters: "No advanced filters",
      limitedDashboard: "Limited dashboard access",
      
      // Comparison table
      feature: "Feature",
      transactionCategorization: "Transaction Categorization",
      subscriptionDetection: "Subscription Detection",
      aiPoweredInsights: "AI-Powered Insights",
      support: "Support",
      community: "Community",
      email: "Email",
      priorityChat: "Priority Chat",
      
      // Savings Goals
      savingsGoals: "Savings Goals",
      trackProgress: "Track your progress towards financial goals",
      noGoalsYet: "No savings goals yet. Add one to start tracking!",
      addGoal: "Add Goal",
      
      // Coming Soon
      bankConnect: "Bank Connect (Coming Soon)",
      bankConnectDesc: "Connect your bank directly for automatic transaction tracking",
      bankConnectPrompt: "Join the waitlist to get early access to automatic bank connections via Moneyhub API",
      joinWaitlist: "Join Waitlist",
      
      // Table
      upgradeToProExport: "Upgrade to Pro",
      exportFeatureDesc: "Export feature is available on Pro and Premium plans",
      exportSuccessful: "Export successful",
      exportedTransactions: "Your transactions have been exported",
      pageOf: "Page {current} of {total}",
      other: "Other",
      uncategorized: "Uncategorized",
      
      // Common
      back: "Back",
      cancel: "Cancel",
      save: "Save",
      delete: "Delete",
      
      // Transaction Table Extended
      searchTransactions: "Search transactions...",
      actions: "Actions",
      success: "Success",
      error: "Error",
      markedAsCanceled: "Transaction marked as canceled",
      failedToUpdate: "Failed to update transaction",
      noResults: "No transactions found",
      cancelTitle: "Cancel {{name}}",
      cancelInstructions: "To cancel this subscription:",
      openWebsite: "Open Website",
      markCanceled: "Mark as Canceled",
      date: "Date",
      description: "Description",
      amount: "Amount",
      category: "Category",
      export: "Export",
      
      // Savings Goals Extended
      trackFinancialGoals: "Track your financial goals",
      createGoal: "Create Savings Goal",
      setFinancialTarget: "Set a new financial target to work towards",
      goalTitle: "Goal Title",
      goalTitlePlaceholder: "e.g., Emergency Fund",
      targetAmount: "Target Amount (£)",
      deadlineOptional: "Deadline (Optional)",
      complete: "complete",
      due: "Due",
      goalCreated: "Savings goal created!",
      failedToCreateGoal: "Failed to create savings goal",
      goalDeleted: "Goal deleted",
      failedToDeleteGoal: "Failed to delete goal",
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
      thisMonth: "Luna aceasta",
      perYear: "Pe an",
      uploadCsvToSeeData: "Încarcă CSV pentru date",
      uploadLimitReached: "Limită încărcare atinsă",
      uploadLimitMessage: "Planul gratuit permite 1 încărcare pe lună. Folosit: {count}/1",
      upgradeForUnlimited: "Actualizează la Pro pentru încărcări nelimitate",
      uploadsUsed: "Încărcări folosite: {count}/1 luna aceasta",
      howToExport: "Cum să exporți din banca ta:",
      
      // Spending Chart
      spendingByCategory: "Cheltuieli pe categorie",
      overallSpendingBreakdown: "Defalcarea totală a cheltuielilor",
      loading: "Se încarcă...",
      noDataAvailable: "Nicio dată disponibilă. Încarcă un CSV pentru a vedea cheltuielile.",
      
      // Subscriptions
      recurringPayments: "Plăți recurente găsite în tranzacțiile tale",
      noSubscriptionsYet: "Niciun abonament detectat încă. Încarcă un CSV pentru a găsi plăți recurente.",
      perFrequency: "pe {frequency}",
      annualCost: "Cost anual: £{amount}",
      cancelSubscription: "Anulează",
      
      // CSV Upload
      uploadBankStatement: "Încarcă extras bancar",
      uploadBankStatementDesc: "Încarcă un fișier CSV de la banca ta pentru a analiza tranzacțiile",
      dropFileHere: "Eliberează fișierul CSV aici",
      dragDropPrompt: "Trage și eliberează fișierul CSV aici sau apasă pentru a selecta",
      supportsFormat: "Suportă fișiere CSV de la HSBC, NatWest, Barclays și altele",
      analyzeTransactions: "Analizează tranzacții",
      processing: "Se procesează...",
      successProcessed: "Procesate {transactions} tranzacții și detectate {subscriptions} abonamente.",
      errorProcessing: "Eșec procesare CSV",
      errorReading: "Eșec citire fișier",
      
      // Pricing
      chooseYourPlan: "Alege planul tău",
      startSavingToday: "Începe să economisești bani de la abonamente nefolosite astăzi",
      featureComparison: "Comparație funcționalități",
      mostPopular: "Cel mai popular",
      getStartedFree: "Începe gratuit",
      upgradeNow: "Actualizează acum",
      pleaseSignIn: "Te rog autentifică-te",
      needSignInToSubscribe: "Trebuie să fii autentificat pentru abonament",
      errorCheckout: "Eșec la inițializare plată",
      getWeeklyProTips: "Primește sfaturi săptămânale",
      subscribeForTips: "Abonează-te pentru sfaturi financiare și strategii de economisire",
      enterYourEmail: "Introdu adresa ta de email",
      subscribe: "Abonează-te",
      allPlansInclude: "Toate planurile includ gestionare date conformă GDPR și suport multilingv",
      cancelAnytime: "Anulează oricând, fără întrebări • Garanție rambursare 30 zile",
      
      // Plans
      planFree: "Gratuit",
      planPro: "Pro",
      planPremium: "Premium",
      planFreeDesc: "Perfect pentru început",
      planProDesc: "Pentru utilizatori regulați",
      planPremiumDesc: "Pentru utilizatori avansați",
      
      // Features
      csvUploadsPerMonth: "1 încărcare CSV pe lună",
      unlimitedCsvUploads: "Încărcări CSV nelimitate",
      basicCategorization: "Categorizare de bază a tranzacțiilor",
      viewInsights: "Vezi analize și detectează abonamente",
      multiLanguage: "Suport multilingv",
      lightDarkMode: "Mod luminos/întunecat",
      advancedFilters: "Filtre și căutare avansate",
      csvExports: "Exporturi CSV",
      detailedReports: "Rapoarte detaliate de cheltuieli",
      priorityEmailSupport: "Suport email prioritar",
      monthlySummary: "Rezumat lunar economii",
      allProFeatures: "Toate funcționalitățile Pro",
      aiInsights: "Analize cu inteligență artificială",
      customRecommendations: "Recomandări financiare personalizate",
      priorityChatSupport: "Suport chat prioritar",
      earlyAccess: "Acces timpuriu la funcționalități",
      quarterlyReview: "Revizuire financiară trimestrială",
      
      // Limitations
      limitations: "Limitări:",
      noCsvExports: "Fără exporturi CSV",
      noAdvancedFilters: "Fără filtre avansate",
      limitedDashboard: "Acces limitat la panou",
      
      // Comparison table
      feature: "Funcționalitate",
      transactionCategorization: "Categorizare tranzacții",
      subscriptionDetection: "Detectare abonamente",
      aiPoweredInsights: "Analize cu AI",
      support: "Suport",
      community: "Comunitate",
      email: "Email",
      priorityChat: "Chat prioritar",
      
      // Savings Goals
      savingsGoals: "Obiective de economisire",
      trackProgress: "Urmărește progresul către obiectivele financiare",
      noGoalsYet: "Niciun obiectiv încă. Adaugă unul pentru a începe urmărirea!",
      addGoal: "Adaugă obiectiv",
      
      // Coming Soon
      bankConnect: "Conectare bancă (În curând)",
      bankConnectDesc: "Conectează-ți banca direct pentru urmărire automată a tranzacțiilor",
      bankConnectPrompt: "Alătură-te listei de așteptare pentru acces timpuriu la conexiuni bancare automate",
      joinWaitlist: "Alătură-te listei",
      
      // Table
      upgradeToProExport: "Actualizează la Pro",
      exportFeatureDesc: "Funcția de export este disponibilă pentru planurile Pro și Premium",
      exportSuccessful: "Export reușit",
      exportedTransactions: "Tranzacțiile tale au fost exportate",
      pageOf: "Pagina {current} din {total}",
      other: "Altele",
      uncategorized: "Necategorizat",
      
      // Common
      back: "Înapoi",
      cancel: "Anulează",
      save: "Salvează",
      delete: "Șterge",
      
      // Transaction Table Extended
      searchTransactions: "Caută tranzacții...",
      actions: "Acțiuni",
      success: "Succes",
      error: "Eroare",
      markedAsCanceled: "Tranzacție marcată ca anulată",
      failedToUpdate: "Nu s-a putut actualiza tranzacția",
      noResults: "Nu s-au găsit tranzacții",
      cancelTitle: "Anulează {{name}}",
      cancelInstructions: "Pentru a anula acest abonament:",
      openWebsite: "Deschide site-ul web",
      markCanceled: "Marchează ca anulat",
      date: "Data",
      description: "Descriere",
      amount: "Sumă",
      category: "Categorie",
      export: "Exportă",
      
      // Savings Goals Extended
      trackFinancialGoals: "Urmărește-ți obiectivele financiare",
      createGoal: "Creează obiectiv de economisire",
      setFinancialTarget: "Setează un nou obiectiv financiar",
      goalTitle: "Titlul obiectivului",
      goalTitlePlaceholder: "de ex., Fond de urgență",
      targetAmount: "Suma țintă (£)",
      deadlineOptional: "Dată limită (Opțional)",
      complete: "complet",
      due: "Scadență",
      goalCreated: "Obiectiv de economisire creat!",
      failedToCreateGoal: "Nu s-a putut crea obiectivul",
      goalDeleted: "Obiectiv șters",
      failedToDeleteGoal: "Nu s-a putut șterge obiectivul",
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
      thisMonth: "Este mes",
      perYear: "Por año",
      uploadCsvToSeeData: "Sube CSV para ver datos",
      uploadLimitReached: "Límite de subidas alcanzado",
      uploadLimitMessage: "Plan gratuito permite 1 subida por mes. Usado: {count}/1",
      upgradeForUnlimited: "Actualiza a Pro para subidas ilimitadas",
      uploadsUsed: "Subidas usadas: {count}/1 este mes",
      howToExport: "Cómo exportar desde tu banco:",
      
      // Spending Chart
      spendingByCategory: "Gastos por categoría",
      overallSpendingBreakdown: "Desglose total de gastos",
      loading: "Cargando...",
      noDataAvailable: "No hay datos disponibles. Sube un CSV para ver tus gastos.",
      
      // Subscriptions
      recurringPayments: "Pagos recurrentes encontrados en tus transacciones",
      noSubscriptionsYet: "No se detectaron suscripciones todavía. Sube un CSV para encontrar pagos recurrentes.",
      perFrequency: "por {frequency}",
      annualCost: "Costo anual: £{amount}",
      cancelSubscription: "Cancelar",
      
      // CSV Upload
      uploadBankStatement: "Subir extracto bancario",
      uploadBankStatementDesc: "Sube un archivo CSV de tu banco para analizar transacciones",
      dropFileHere: "Suelta el archivo CSV aquí",
      dragDropPrompt: "Arrastra y suelta tu archivo CSV aquí o haz clic para seleccionar",
      supportsFormat: "Soporta archivos CSV de HSBC, NatWest, Barclays y más",
      analyzeTransactions: "Analizar transacciones",
      processing: "Procesando...",
      successProcessed: "Procesadas {transactions} transacciones y detectadas {subscriptions} suscripciones.",
      errorProcessing: "Error al procesar CSV",
      errorReading: "Error al leer archivo",
      
      // Pricing
      chooseYourPlan: "Elige tu plan",
      startSavingToday: "Comienza a ahorrar dinero en suscripciones no utilizadas hoy",
      featureComparison: "Comparación de características",
      mostPopular: "Más popular",
      getStartedFree: "Comenzar gratis",
      upgradeNow: "Actualizar ahora",
      pleaseSignIn: "Por favor inicia sesión",
      needSignInToSubscribe: "Necesitas iniciar sesión para suscribirte",
      errorCheckout: "Error al iniciar pago",
      getWeeklyProTips: "Recibe consejos semanales",
      subscribeForTips: "Suscríbete para recibir consejos financieros y estrategias de ahorro",
      enterYourEmail: "Ingresa tu correo electrónico",
      subscribe: "Suscribirse",
      allPlansInclude: "Todos los planes incluyen manejo de datos conforme a GDPR y soporte multiidioma",
      cancelAnytime: "Cancela en cualquier momento, sin preguntas • Garantía de devolución de 30 días",
      
      // Plans
      planFree: "Gratis",
      planPro: "Pro",
      planPremium: "Premium",
      planFreeDesc: "Perfecto para comenzar",
      planProDesc: "Para usuarios regulares",
      planPremiumDesc: "Para usuarios avanzados",
      
      // Features
      csvUploadsPerMonth: "1 subida CSV por mes",
      unlimitedCsvUploads: "Subidas CSV ilimitadas",
      basicCategorization: "Categorización básica de transacciones",
      viewInsights: "Ver análisis y detectar suscripciones",
      multiLanguage: "Soporte multiidioma",
      lightDarkMode: "Modo claro/oscuro",
      advancedFilters: "Filtros y búsqueda avanzados",
      csvExports: "Exportaciones CSV",
      detailedReports: "Informes detallados de gastos",
      priorityEmailSupport: "Soporte por email prioritario",
      monthlySummary: "Resumen mensual de ahorros",
      allProFeatures: "Todas las características Pro",
      aiInsights: "Análisis con inteligencia artificial",
      customRecommendations: "Recomendaciones financieras personalizadas",
      priorityChatSupport: "Soporte por chat prioritario",
      earlyAccess: "Acceso temprano a características",
      quarterlyReview: "Revisión financiera trimestral",
      
      // Limitations
      limitations: "Limitaciones:",
      noCsvExports: "Sin exportaciones CSV",
      noAdvancedFilters: "Sin filtros avanzados",
      limitedDashboard: "Acceso limitado al panel",
      
      // Comparison table
      feature: "Característica",
      transactionCategorization: "Categorización de transacciones",
      subscriptionDetection: "Detección de suscripciones",
      aiPoweredInsights: "Análisis con IA",
      support: "Soporte",
      community: "Comunidad",
      email: "Email",
      priorityChat: "Chat prioritario",
      
      // Savings Goals
      savingsGoals: "Objetivos de ahorro",
      trackProgress: "Rastrea tu progreso hacia objetivos financieros",
      noGoalsYet: "Aún no hay objetivos. ¡Agrega uno para comenzar a rastrear!",
      addGoal: "Agregar objetivo",
      
      // Coming Soon
      bankConnect: "Conexión bancaria (Próximamente)",
      bankConnectDesc: "Conecta tu banco directamente para seguimiento automático de transacciones",
      bankConnectPrompt: "Únete a la lista de espera para acceso temprano a conexiones bancarias automáticas",
      joinWaitlist: "Unirse a lista",
      
      // Table
      upgradeToProExport: "Actualizar a Pro",
      exportFeatureDesc: "La función de exportación está disponible en planes Pro y Premium",
      exportSuccessful: "Exportación exitosa",
      exportedTransactions: "Tus transacciones han sido exportadas",
      pageOf: "Página {current} de {total}",
      other: "Otros",
      uncategorized: "Sin categorizar",
      
      // Common
      back: "Atrás",
      cancel: "Cancelar",
      save: "Guardar",
      delete: "Eliminar",
      
      // Transaction Table Extended
      searchTransactions: "Buscar transacciones...",
      actions: "Acciones",
      success: "Éxito",
      error: "Error",
      markedAsCanceled: "Transacción marcada como cancelada",
      failedToUpdate: "Error al actualizar transacción",
      noResults: "No se encontraron transacciones",
      cancelTitle: "Cancelar {{name}}",
      cancelInstructions: "Para cancelar esta suscripción:",
      openWebsite: "Abrir sitio web",
      markCanceled: "Marcar como cancelado",
      date: "Fecha",
      description: "Descripción",
      amount: "Monto",
      category: "Categoría",
      export: "Exportar",
      
      // Savings Goals Extended
      trackFinancialGoals: "Rastrea tus objetivos financieros",
      createGoal: "Crear objetivo de ahorro",
      setFinancialTarget: "Establece un nuevo objetivo financiero",
      goalTitle: "Título del objetivo",
      goalTitlePlaceholder: "ej., Fondo de emergencia",
      targetAmount: "Cantidad objetivo (£)",
      deadlineOptional: "Fecha límite (Opcional)",
      complete: "completo",
      due: "Vence",
      goalCreated: "¡Objetivo de ahorro creado!",
      failedToCreateGoal: "Error al crear objetivo de ahorro",
      goalDeleted: "Objetivo eliminado",
      failedToDeleteGoal: "Error al eliminar objetivo",
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
