"use client";

import { useRouter } from "next/navigation";

import AuthForm from "@/components/AuthForm";
import { useLanguage } from "@/components/LanguageProvider";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useLanguage();

  return (
    <main
      className="container"
      style={{
        padding: "48px 0",
        display: "grid",
        gap: 20,
        width: "min(96vw, 1560px)",
        maxWidth: "1560px",
        justifyItems: "stretch",
        textAlign: "center",
      }}
    >
      <h1 style={{ margin: 0 }}>{t("appTitle")}</h1>
      <AuthForm initialMode="login" onAuth={() => router.push("/")} />
    </main>
  );
}
