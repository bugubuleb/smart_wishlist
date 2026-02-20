import "./globals.css";

import CurrencySwitcher from "@/components/CurrencySwitcher";
import { CurrencyProvider } from "@/components/CurrencyProvider";
import GlobalLogoutButton from "@/components/GlobalLogoutButton";
import { LanguageProvider } from "@/components/LanguageProvider";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import StarsField from "@/components/StarsField";
import ThemeToggle from "@/components/ThemeToggle";

export const metadata = {
  title: "Smart Wishlist",
  description: "Social wishlist with realtime reservations and group gifting",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru" data-theme="dark" suppressHydrationWarning>
      <body>
        <LanguageProvider>
          <CurrencyProvider>
            <StarsField />
            <div className="root-ui">
              <div className="global-actions">
                <LanguageSwitcher />
                <CurrencySwitcher />
                <GlobalLogoutButton />
                <div className="theme-toggle-wrap">
                  <ThemeToggle />
                </div>
              </div>
              <div className="app-shell">{children}</div>
            </div>
          </CurrencyProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
