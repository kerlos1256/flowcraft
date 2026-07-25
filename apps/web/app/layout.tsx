import type { Metadata } from 'next';
import './globals.css';
import { appConfig, buildThemeStylesheet } from '@/config/app.config';
import { SiteHeader } from '@/components/site-header';

export const metadata: Metadata = {
  title: `${appConfig.name} — ${appConfig.description}`,
  description: appConfig.description,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Theme tokens from the centralized config (single source of truth). */}
        <style dangerouslySetInnerHTML={{ __html: buildThemeStylesheet() }} />
        {/* Restore persisted theme before paint to avoid a flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.theme==='dark')document.documentElement.classList.add('dark')}catch(e){}`,
          }}
        />
      </head>
      <body>
        <SiteHeader />
        <main className="mx-auto w-full max-w-[1400px] px-5 py-6">{children}</main>
      </body>
    </html>
  );
}
