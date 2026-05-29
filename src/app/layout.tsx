import type { Metadata } from "next";
import { Inter, Sora } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const sora = Sora({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "ScreenRank — Find the best screen for any movie",
    template: "%s · ScreenRank",
  },
  description:
    "ScreenRank ranks the best theatre and screen for any movie based on the actual DCP technical specification first, and raw screen hardware second — with every cinema-tech term decoded in plain language.",
  keywords: [
    "cinema",
    "DCP",
    "IMAX",
    "Dolby Atmos",
    "best screen",
    "movie format",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${sora.variable} font-sans film-grain min-h-screen`}
      >
        {/* ambient backdrop glow */}
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute left-1/2 top-0 h-[480px] w-[820px] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />
          <div className="absolute bottom-0 right-0 h-[420px] w-[620px] rounded-full bg-cyan-500/5 blur-[120px]" />
        </div>
        <Navbar />
        <main className="relative z-10">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
