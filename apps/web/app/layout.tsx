import type { Metadata } from 'next';
import './globals.css';
import { appConfig, buildThemeStylesheet } from '@/config/app.config';

export const metadata: Metadata = {
  title: `${appConfig.name} — ${appConfig.description}`,
  description: appConfig.description,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{ __html: buildThemeStylesheet() }} />
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.theme==='dark')document.documentElement.classList.add('dark')}catch(e){}`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
