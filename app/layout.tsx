import type { Metadata } from "next";
import { Shell } from "@/components/shell";
import { AccountProvider } from "@/components/account-context";
import { PlaybackProvider } from "@/components/playback-context";
import { LibrarySyncProvider } from "@/components/library-sync";
import { spotlightInter, spotlightMarker, spotlightSyne } from "@/lib/fonts";
import "./globals.css";
import "./universal.css";
import "./midnight-cinema.css";
export const metadata: Metadata = {
  title: { default: "PinFlix — A world of stories", template: "%s · PinFlix" },
  description:
    "Discover movies and series. Keep your favourites close. Your next story starts here.",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${spotlightInter.variable} ${spotlightSyne.variable} ${spotlightMarker.variable}`}>
        <AccountProvider>
          <LibrarySyncProvider>
            <PlaybackProvider>
              <Shell>{children}</Shell>
            </PlaybackProvider>
          </LibrarySyncProvider>
        </AccountProvider>
      </body>
    </html>
  );
}
