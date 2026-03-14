import { Button } from "antd";
import { useTranslation } from "react-i18next";
import i18n from "../lib/i18n";

const LANGS = [
  { code: "zh", label: "中文" },
  { code: "en", label: "English" },
  { code: "th", label: "ภาษาไทย" },
];

export default function SettingsPage() {
  const { t, i18n: i18nInstance } = useTranslation();
  const currentLang = i18nInstance.language;

  function handleLangChange(code: string) {
    i18n.changeLanguage(code);
    localStorage.setItem("ezbill_lang", code);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 560 }}>

      {/* Language */}
      <Section title={t("settings.sectionLanguage")}>
        <div style={{ display: "flex", gap: 8 }}>
          {LANGS.map(({ code, label }) => (
            <Button
              key={code}
              type={currentLang === code ? "primary" : "default"}
              onClick={() => handleLangChange(code)}
            >
              {label}
            </Button>
          ))}
        </div>
      </Section>

      {/* PromptPay */}
      <Section title={t("settings.sectionPromptPay")}>
        <Button disabled style={{ width: "100%", justifyContent: "flex-start" }}>
          {t("settings.promptPayPlaceholder")}
        </Button>
      </Section>

      {/* ToS / Privacy */}
      <Section title={t("settings.sectionLegal")}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Button disabled style={{ width: "100%", justifyContent: "flex-start" }}>
            {t("settings.tos")}
          </Button>
          <Button disabled style={{ width: "100%", justifyContent: "flex-start" }}>
            {t("settings.privacy")}
          </Button>
        </div>
      </Section>

      {/* Premium */}
      <Section title={t("settings.sectionPremium")}>
        <Button disabled type="primary" style={{ opacity: 0.5 }}>
          {t("settings.upgradePremium")}
        </Button>
        <p style={{ margin: "8px 0 0", fontSize: 12, color: "#9CA3AF" }}>
          {t("settings.premiumDesc")}
        </p>
      </Section>

    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "#FFFFFF", borderRadius: 12, padding: "20px 24px",
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    }}>
      <p style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 600, color: "#111827" }}>{title}</p>
      {children}
    </div>
  );
}
