// app/layout.js
import "./globals.css";

export const metadata = {
  title: "KalkuPaylator™ — EA Edition",
  description: "Kalkulator biasa, tapi hasilnya dijual terpisah.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}