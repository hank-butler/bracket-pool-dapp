import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Bracket Pool",
  description: "On-chain March Madness bracket pools",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <Providers>
          {/* Windows 98 Title Bar */}
          <div className="titlebar">
            <div className="flex items-center gap-1.5">
              <div className="titlebar-icon">&#9917;</div>
              <span>Bracket Pool &mdash; On-Chain March Madness</span>
            </div>
            <div className="flex gap-0.5">
              <div className="titlebar-btn">&#9472;</div>
              <div className="titlebar-btn">&#9633;</div>
              <div className="titlebar-btn">&#10005;</div>
            </div>
          </div>

          {/* Marquee Ticker */}
          <div className="marquee-bar">
            <div className="marquee-scroll">
              &#9733; Welcome to Bracket Pool &#9733; On-chain March Madness bracket pools &#9733; Pick your winners &#9733; Powered by Ethereum &#9733; Submit your bracket today! &#9733;
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {children}
          </div>

          {/* Status Bar */}
          <div className="statusbar">
            <div className="statusbar-cell">Bracket Pool v1.0</div>
            <div className="statusbar-cell">Foundry Local</div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
