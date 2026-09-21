import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";

/**
 * Global i18n system for MANOVIK AI.
 * - Ships English + Hindi fully. Other locales fall back to English until
 *   translations are added. The registry below is the single source of truth.
 * - Shares its persisted locale key with the legacy footer hook
 *   (i18n-footer.ts) so both stay in sync.
 */

export type Locale = "en" | "hi" | "es" | "fr" | "de" | "ja" | "zh";

export const STORAGE_KEY = "manovik.footer.locale";
export const LOCALE_EVENT = "manovik-locale-change";

export const LOCALES: { code: Locale; label: string }[] = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "ja", label: "日本語" },
  { code: "zh", label: "中文" },
];

/** Only en + hi are fully translated in this pass. */
type Dict = Record<string, string>;

const en: Dict = {
  // Navigation
  "nav.signin": "Sign in",
  "nav.getStarted": "Get started",
  "nav.pricing": "Pricing",
  "nav.features": "Features",
  "nav.faq": "FAQ",
  "nav.contact": "Contact",
  "nav.blog": "Blog",
  "nav.docs": "Docs",
  "nav.backHome": "Back to home",
  "nav.language": "Language",

  // Primary CTAs
  "cta.startFree": "Start free",
  "cta.tryFree": "Try free",
  "cta.upgrade": "Upgrade to Pro",
  "cta.buySovereign": "Buy Sovereign",
  "cta.manage": "Manage",
  "cta.refresh": "Refresh",
  "cta.open": "Open",
  "cta.retry": "Try again",
  "cta.copy": "Copy",
  "cta.download": "Download",
  "cta.send": "Send",

  // Auth / login
  "login.signinTitle": "Sign in to MANOVIK AI",
  "login.signupTitle": "Create your MANOVIK AI account",
  "login.signinSub": "Sign in to continue",
  "login.signupSub": "Start commanding your AI agent",
  "login.email": "Email",
  "login.password": "Password",
  "login.google": "Continue with Google",
  "login.or": "or",
  "login.submit.signin": "Sign in",
  "login.submit.signup": "Create account",
  "login.busy": "…",
  "login.magicSending": "Sending…",
  "login.magicSend": "Email me a magic link",
  "login.magicResendAnother": "Email another login link",
  "login.magicResendIn": "Resend in {s}s",
  "login.magicHelp": "Didn't get it? Check spam, or resend above.",
  "login.toSignup": "No account? Sign up",
  "login.toSignin": "Already have an account? Sign in",
  "login.admin": "Admin sign-in →",
  "login.toast.checkEmail": "Check your email to confirm your account.",
  "login.toast.authFailed": "Authentication failed",
  "login.toast.googleFailed": "Google sign-in failed",
  "login.toast.signinFailed": "Sign-in failed",
  "login.toast.enterEmail": "Enter your email first.",
  "login.toast.tooMany": "Too many attempts. Try again in {s}s.",
  "login.toast.magicFail": "Could not send magic link. Please try again.",
  "login.toast.magicSent": "Check your inbox for the login link.",
  "login.toast.network": "Network error. Please try again.",

  // Chat dashboard
  "dashboard.title": "Workspace dashboard",
  "dashboard.subtitle": "Live account telemetry",
  "dashboard.remaining": "Remaining credits",
  "dashboard.creditsUnit": "credits",
  "dashboard.adminBypass": "Admin bypass enabled",
  "dashboard.usedMonth": "{n} used this month",
  "dashboard.metric.messages": "Messages",
  "dashboard.metric.threads": "Threads",
  "dashboard.plan.suffix": "plan",
  "dashboard.plan.upgradeCopy": "Upgrade for higher usage and priority model routing.",
  "dashboard.plan.paidCopy": "Billing, receipts, and renewal controls are active.",
  "dashboard.creditActivity": "Credit activity",
  "dashboard.noCredits": "No credit activity yet.",
  "dashboard.security": "Security",
  "dashboard.auditLog": "Audit log",
  "dashboard.noSecurity": "No recent security events.",
  "dashboard.failed": "Dashboard failed to load.",
  "dashboard.recorded": "Recorded",

  // Aria labels
  "aria.hideDashboard": "Hide dashboard",
  "aria.showDashboard": "Show dashboard",
  "aria.newChat": "New chat",
  "aria.workspaceDashboard": "Workspace dashboard",

  // Billing page
  "billing.title": "Your plan",
  "billing.header": "Billing",
  "billing.cancelAuto": "Cancel auto-renewal",
  "billing.resumeAuto": "Resume auto-renewal",
  "billing.history": "Purchase history",
  "billing.col.date": "Date",
  "billing.col.plan": "Plan",
  "billing.col.amount": "Amount",
  "billing.col.status": "Status",
  "billing.col.receipt": "Receipt",
  "billing.loading": "Loading…",
  "billing.empty": "No purchases yet.",
  "billing.paid": "Paid",
  "billing.failed": "Failed",

  // Landing chrome (headings only — prose stays)
  "landing.pricing.title": "Pricing",
  "landing.pricing.sub": "Start free. Upgrade when you outgrow it.",
  "landing.features.title": "Features",
  "landing.faq.title": "Frequently asked questions",
  "landing.footer.pricing": "Pricing",
  "landing.footer.signin": "Sign in",

  // Errors
  "error.pageTitle": "This page didn't load",
  "error.pageBody": "Something went wrong on our end. You can try refreshing or head back home.",
  "notfound.title": "Page not found",
  "notfound.body": "The page you're looking for doesn't exist or has been moved.",
  "notfound.goHome": "Go home",
};

const hi: Dict = {
  "nav.signin": "साइन इन",
  "nav.getStarted": "शुरू करें",
  "nav.pricing": "मूल्य निर्धारण",
  "nav.features": "विशेषताएँ",
  "nav.faq": "सामान्य प्रश्न",
  "nav.contact": "संपर्क",
  "nav.blog": "ब्लॉग",
  "nav.docs": "दस्तावेज़",
  "nav.backHome": "मुख्य पृष्ठ पर वापस",
  "nav.language": "भाषा",

  "cta.startFree": "मुफ़्त शुरू करें",
  "cta.tryFree": "मुफ़्त आज़माएँ",
  "cta.upgrade": "Pro में अपग्रेड",
  "cta.buySovereign": "Sovereign खरीदें",
  "cta.manage": "प्रबंधित करें",
  "cta.refresh": "रीफ्रेश",
  "cta.open": "खोलें",
  "cta.retry": "पुनः प्रयास",
  "cta.copy": "कॉपी",
  "cta.download": "डाउनलोड",
  "cta.send": "भेजें",

  "login.signinTitle": "MANOVIK AI में साइन इन करें",
  "login.signupTitle": "अपना MANOVIK AI खाता बनाएँ",
  "login.signinSub": "जारी रखने के लिए साइन इन करें",
  "login.signupSub": "अपने AI एजेंट को नियंत्रित करना शुरू करें",
  "login.email": "ईमेल",
  "login.password": "पासवर्ड",
  "login.google": "Google के साथ जारी रखें",
  "login.or": "या",
  "login.submit.signin": "साइन इन",
  "login.submit.signup": "खाता बनाएँ",
  "login.busy": "…",
  "login.magicSending": "भेजा जा रहा है…",
  "login.magicSend": "मुझे मैजिक लिंक ईमेल करें",
  "login.magicResendAnother": "एक और लॉगिन लिंक भेजें",
  "login.magicResendIn": "{s} सेकंड में पुनः भेजें",
  "login.magicHelp": "नहीं मिला? स्पैम देखें, या ऊपर से पुनः भेजें।",
  "login.toSignup": "खाता नहीं? साइन अप करें",
  "login.toSignin": "पहले से खाता है? साइन इन करें",
  "login.admin": "एडमिन साइन-इन →",
  "login.toast.checkEmail": "अपना खाता पुष्टि करने के लिए ईमेल देखें।",
  "login.toast.authFailed": "प्रमाणीकरण विफल",
  "login.toast.googleFailed": "Google साइन-इन विफल",
  "login.toast.signinFailed": "साइन-इन विफल",
  "login.toast.enterEmail": "पहले अपना ईमेल दर्ज करें।",
  "login.toast.tooMany": "बहुत अधिक प्रयास। {s} सेकंड बाद पुनः प्रयास करें।",
  "login.toast.magicFail": "मैजिक लिंक नहीं भेजा जा सका। कृपया पुनः प्रयास करें।",
  "login.toast.magicSent": "अपने इनबॉक्स में लॉगिन लिंक देखें।",
  "login.toast.network": "नेटवर्क त्रुटि। कृपया पुनः प्रयास करें।",

  "dashboard.title": "वर्कस्पेस डैशबोर्ड",
  "dashboard.subtitle": "लाइव खाता जानकारी",
  "dashboard.remaining": "शेष क्रेडिट",
  "dashboard.creditsUnit": "क्रेडिट",
  "dashboard.adminBypass": "एडमिन बायपास सक्षम",
  "dashboard.usedMonth": "इस माह {n} उपयोग किए",
  "dashboard.metric.messages": "संदेश",
  "dashboard.metric.threads": "थ्रेड्स",
  "dashboard.plan.suffix": "प्लान",
  "dashboard.plan.upgradeCopy": "अधिक उपयोग और प्राथमिकता वाले मॉडल के लिए अपग्रेड करें।",
  "dashboard.plan.paidCopy": "बिलिंग, रसीदें और नवीनीकरण नियंत्रण सक्रिय हैं।",
  "dashboard.creditActivity": "क्रेडिट गतिविधि",
  "dashboard.noCredits": "अभी कोई क्रेडिट गतिविधि नहीं।",
  "dashboard.security": "सुरक्षा",
  "dashboard.auditLog": "ऑडिट लॉग",
  "dashboard.noSecurity": "कोई हालिया सुरक्षा घटना नहीं।",
  "dashboard.failed": "डैशबोर्ड लोड नहीं हो सका।",
  "dashboard.recorded": "दर्ज किया गया",

  "aria.hideDashboard": "डैशबोर्ड छिपाएँ",
  "aria.showDashboard": "डैशबोर्ड दिखाएँ",
  "aria.newChat": "नई चैट",
  "aria.workspaceDashboard": "वर्कस्पेस डैशबोर्ड",

  "billing.title": "आपकी योजना",
  "billing.header": "बिलिंग",
  "billing.cancelAuto": "स्वतः-नवीनीकरण रद्द करें",
  "billing.resumeAuto": "स्वतः-नवीनीकरण फिर से शुरू करें",
  "billing.history": "खरीद इतिहास",
  "billing.col.date": "दिनांक",
  "billing.col.plan": "योजना",
  "billing.col.amount": "राशि",
  "billing.col.status": "स्थिति",
  "billing.col.receipt": "रसीद",
  "billing.loading": "लोड हो रहा है…",
  "billing.empty": "अभी कोई खरीद नहीं।",
  "billing.paid": "भुगतान किया गया",
  "billing.failed": "विफल",

  "landing.pricing.title": "मूल्य निर्धारण",
  "landing.pricing.sub": "मुफ़्त शुरू करें। ज़रूरत बढ़ने पर अपग्रेड करें।",
  "landing.features.title": "विशेषताएँ",
  "landing.faq.title": "अक्सर पूछे जाने वाले प्रश्न",
  "landing.footer.pricing": "मूल्य निर्धारण",
  "landing.footer.signin": "साइन इन",

  "error.pageTitle": "यह पृष्ठ लोड नहीं हुआ",
  "error.pageBody": "हमारी ओर से कुछ गड़बड़ हो गई। रीफ्रेश करें या मुख्य पृष्ठ पर लौटें।",
  "notfound.title": "पृष्ठ नहीं मिला",
  "notfound.body": "आप जो पृष्ठ ढूँढ़ रहे हैं वह मौजूद नहीं है या स्थानांतरित कर दिया गया है।",
  "notfound.goHome": "मुख्य पृष्ठ पर जाएँ",
};

const DICTS: Record<Locale, Dict> = {
  en,
  hi,
  // Untranslated locales fall back to English at lookup time.
  es: {},
  fr: {},
  de: {},
  ja: {},
  zh: {},
};

function detectLocale(): Locale {
  if (typeof window === "undefined") return "en";
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (saved && DICTS[saved]) return saved;
  } catch {
    // localStorage may be unavailable (SSR, private mode); fall through to browser language.
  }
  const nav = (typeof navigator !== "undefined" ? navigator.language : "en").toLowerCase();
  const short = nav.split("-")[0] as Locale;
  return DICTS[short] ? short : "en";
}

type I18nContextValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function format(str: string, vars?: Record<string, string | number>) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    setLocaleState(detectLocale());
    const onEvt = (e: Event) => {
      const l = (e as CustomEvent<Locale>).detail;
      if (l && DICTS[l]) setLocaleState(l);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue && DICTS[e.newValue as Locale]) {
        setLocaleState(e.newValue as Locale);
      }
    };
    window.addEventListener(LOCALE_EVENT, onEvt as EventListener);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(LOCALE_EVENT, onEvt as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage write can throw in private mode; locale still applies in-memory.
    }
    try {
      window.dispatchEvent(new CustomEvent(LOCALE_EVENT, { detail: next }));
    } catch {
      // dispatchEvent should not fail here; keep the empty handler for safety.
    }
  }, []);

  const value = useMemo<I18nContextValue>(() => {
    const dict = DICTS[locale] ?? {};
    const t = (key: string, vars?: Record<string, string | number>) => {
      const raw = dict[key] ?? en[key] ?? key;
      return format(raw, vars);
    };
    return { locale, setLocale, t };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  // Fallback for components rendered outside the provider (e.g. SSR shell,
  // error boundaries). Returns English and a no-op setter.
  return {
    locale: "en",
    setLocale: () => {},
    t: (key, vars) => format(en[key] ?? key, vars),
  };
}

export function LanguageSwitcher({
  className = "",
  ariaLabel,
}: {
  className?: string;
  ariaLabel?: string;
}) {
  const { locale, setLocale, t } = useI18n();
  return (
    <label
      className={`inline-flex items-center gap-1.5 text-xs text-muted-foreground ${className}`}
    >
      <span className="sr-only">{ariaLabel ?? t("nav.language")}</span>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        className="rounded-md border border-border/60 bg-background/60 px-2 py-1 text-xs text-foreground backdrop-blur"
        aria-label={ariaLabel ?? t("nav.language")}
      >
        {LOCALES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}
