"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useLanguage } from "@/components/LanguageProvider";
import { clearToken, getToken } from "@/lib/session";

export default function GlobalLogoutButton() {
  const router = useRouter();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    function sync() {
      setVisible(Boolean(getToken()));
    }

    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("sw:auth-changed", sync);

    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("sw:auth-changed", sync);
    };
  }, [pathname]);

  if (!visible) return null;

  return (
    <button
      type="button"
      className="global-logout"
      onClick={() => {
        clearToken();
        router.push("/login");
        router.refresh();
      }}
    >
      {t("logout")}
    </button>
  );
}
