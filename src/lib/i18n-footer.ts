import { useEffect, useState, useCallback } from "react";

export type FooterLocale = "en" | "hi" | "es" | "fr" | "de" | "ja" | "zh";

export const FOOTER_LOCALES: { code: FooterLocale; label: string }[] = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "ja", label: "日本語" },
  { code: "zh", label: "中文" },
];

export type FooterStrings = {
  builtBy: string; // e.g. "Built by KC" — the word "by" position varies per locale
  builtWord: string;
  byWord: string;
  copyright: (year: number) => string;
  paymentsSecuredBy: string;
  languageLabel: string;
};

const dict: Record<FooterLocale, FooterStrings> = {
  en: {
    builtWord: "Built",
    byWord: "by",
    builtBy: "Built by KC",
    copyright: (y) =>
      `© ${y} MANOVIK AI. All Rights Reserved. "MANOVIK", "MANOVIK AI", the MANOVIK logo, and all related marks, content, designs, and code are the exclusive intellectual property of MANOVIK AI and are protected under Indian and international copyright, trademark, and unfair-competition laws. Unauthorized reproduction, redistribution, scraping, cloning, reverse-engineering, or commercial use — in whole or in part — is strictly prohibited.`,
    paymentsSecuredBy: "Payments secured by",
    languageLabel: "Language",
  },
  hi: {
    builtWord: "निर्मित",
    byWord: "द्वारा",
    builtBy: "KC द्वारा निर्मित",
    copyright: (y) =>
      `© ${y} MANOVIK AI. सर्वाधिकार सुरक्षित। "MANOVIK", "MANOVIK AI", MANOVIK लोगो और सभी संबंधित चिह्न, सामग्री, डिज़ाइन और कोड MANOVIK AI की विशेष बौद्धिक संपदा हैं और भारतीय एवं अंतर्राष्ट्रीय कॉपीराइट, ट्रेडमार्क और अनुचित-प्रतिस्पर्धा कानूनों के तहत संरक्षित हैं। अनधिकृत पुनरुत्पादन, पुनर्वितरण, स्क्रैपिंग, क्लोनिंग, रिवर्स-इंजीनियरिंग या व्यावसायिक उपयोग — पूर्ण या आंशिक रूप से — सख्त वर्जित है।`,
    paymentsSecuredBy: "भुगतान सुरक्षित द्वारा",
    languageLabel: "भाषा",
  },
  es: {
    builtWord: "Hecho",
    byWord: "por",
    builtBy: "Hecho por KC",
    copyright: (y) =>
      `© ${y} MANOVIK AI. Todos los derechos reservados. "MANOVIK", "MANOVIK AI", el logotipo de MANOVIK y todas las marcas, contenidos, diseños y código relacionados son propiedad intelectual exclusiva de MANOVIK AI y están protegidos por las leyes indias e internacionales de derechos de autor, marcas registradas y competencia desleal. La reproducción, redistribución, extracción, clonación, ingeniería inversa o uso comercial no autorizados — total o parcial — están estrictamente prohibidos.`,
    paymentsSecuredBy: "Pagos protegidos por",
    languageLabel: "Idioma",
  },
  fr: {
    builtWord: "Conçu",
    byWord: "par",
    builtBy: "Conçu par KC",
    copyright: (y) =>
      `© ${y} MANOVIK AI. Tous droits réservés. « MANOVIK », « MANOVIK AI », le logo MANOVIK et toutes les marques, contenus, designs et codes associés sont la propriété intellectuelle exclusive de MANOVIK AI et sont protégés par les lois indiennes et internationales sur le droit d'auteur, les marques et la concurrence déloyale. Toute reproduction, redistribution, extraction, clonage, rétro-ingénierie ou utilisation commerciale non autorisée — totale ou partielle — est strictement interdite.`,
    paymentsSecuredBy: "Paiements sécurisés par",
    languageLabel: "Langue",
  },
  de: {
    builtWord: "Gebaut",
    byWord: "von",
    builtBy: "Gebaut von KC",
    copyright: (y) =>
      `© ${y} MANOVIK AI. Alle Rechte vorbehalten. „MANOVIK", „MANOVIK AI", das MANOVIK-Logo sowie alle zugehörigen Marken, Inhalte, Designs und Codes sind ausschließliches geistiges Eigentum von MANOVIK AI und sind durch indisches und internationales Urheber-, Marken- und Wettbewerbsrecht geschützt. Unbefugte Vervielfältigung, Weiterverbreitung, Scraping, Klonen, Reverse Engineering oder kommerzielle Nutzung — ganz oder teilweise — ist strengstens untersagt.`,
    paymentsSecuredBy: "Zahlungen abgesichert durch",
    languageLabel: "Sprache",
  },
  ja: {
    builtWord: "制作",
    byWord: "：",
    builtBy: "制作：KC",
    copyright: (y) =>
      `© ${y} MANOVIK AI. 無断複写・転載を禁じます。「MANOVIK」「MANOVIK AI」、MANOVIK ロゴおよび関連するすべての商標、コンテンツ、デザイン、コードは MANOVIK AI の独占的知的財産であり、インドおよび国際的な著作権法、商標法、不正競争防止法により保護されています。無断での複製、再配布、スクレイピング、クローン、リバースエンジニアリング、または商用利用（全部または一部）は固く禁じられています。`,
    paymentsSecuredBy: "決済保護：",
    languageLabel: "言語",
  },
  zh: {
    builtWord: "构建",
    byWord: "由",
    builtBy: "由 KC 构建",
    copyright: (y) =>
      `© ${y} MANOVIK AI。保留所有权利。"MANOVIK"、"MANOVIK AI"、MANOVIK 徽标以及所有相关标识、内容、设计和代码均为 MANOVIK AI 的专有知识产权，受印度及国际版权、商标和反不正当竞争法保护。未经授权的复制、再分发、抓取、克隆、逆向工程或商业使用——无论全部或部分——均被严格禁止。`,
    paymentsSecuredBy: "支付安全保障：",
    languageLabel: "语言",
  },
};

const STORAGE_KEY = "manovik.footer.locale";

function detectLocale(): FooterLocale {
  if (typeof window === "undefined") return "en";
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY) as FooterLocale | null;
    if (saved && dict[saved]) return saved;
  } catch {}
  const nav = (typeof navigator !== "undefined" ? navigator.language : "en").toLowerCase();
  const short = nav.split("-")[0] as FooterLocale;
  return dict[short] ? short : "en";
}

export function useFooterI18n() {
  const [locale, setLocaleState] = useState<FooterLocale>("en");

  useEffect(() => {
    setLocaleState(detectLocale());
  }, []);

  const setLocale = useCallback((next: FooterLocale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  }, []);

  return { locale, setLocale, t: dict[locale] };
}
