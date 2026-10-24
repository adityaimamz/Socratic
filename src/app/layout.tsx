import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: { default:"Socratic — Ruang untuk berpikir",template:"%s · Socratic" },applicationName:"Socratic",description:"Socratic — Question · Reason · Progress. Kerjakan kuis dan ujian dengan aturan yang jelas, penyimpanan jawaban otomatis, dan sisa waktu yang mudah dilihat.",robots:{index:false,follow:false} };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="id"><body><a className="skip" href="#main">Lewati ke konten</a>{children}</body></html>; }
