import "./globals.css";

import CurrencySwitcher from "@/components/CurrencySwitcher";
import { CurrencyProvider } from "@/components/CurrencyProvider";
import GlobalLogoutButton from "@/components/GlobalLogoutButton";
import { LanguageProvider } from "@/components/LanguageProvider";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import PwaRegister from "@/components/PwaRegister";
import StarsField from "@/components/StarsField";
import ThemeToggle from "@/components/ThemeToggle";

export const metadata = {
  title: "Smart Wishlist",
  description: "Social wishlist with realtime reservations and group gifting",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Smart Wishlist",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0d111d" },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru" data-theme="dark" suppressHydrationWarning>
      <body>
        <PwaRegister />
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
