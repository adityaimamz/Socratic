import type { Metadata } from "next";
import "./globals.css";
const title = "Socratic — Ruang Kuis & Ujian Online";
const description = "Kerjakan kuis dan ujian dengan tenang di Socratic. Aturan jelas, jawaban tersimpan otomatis, dan sisa waktu mudah dipantau.";

export const metadata: Metadata = {
  title: { default: title, template: "%s · Socratic" },
  applicationName: "Socratic",
  description,
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: "Socratic",
    title,
    description,
  },
  twitter: { card: "summary", title, description },
  robots: { index: false, follow: false },
};
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="id"><body><a className="skip" href="#main">Lewati ke konten</a>{children}</body></html>; }
