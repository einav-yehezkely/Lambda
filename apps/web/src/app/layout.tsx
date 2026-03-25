import type { Metadata, Viewport } from 'next';
import { Public_Sans } from 'next/font/google';
import './globals.css';
import 'katex/dist/katex.min.css';
import { Providers } from '@/components/providers';
import { Navbar } from '@/components/ui/navbar';
import { BackgroundAnimation } from '@/components/ui/background-animation';

const publicSans = Public_Sans({ subsets: ['latin'], variable: '--font-display' });

export const metadata: Metadata = {
  title: 'Lambda',
  description: 'Community-driven learning platform for CS & Math students',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{__html: `try{if(localStorage.getItem('theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}`}} />
      </head>
      <body className={`${publicSans.variable} font-display antialiased bg-[#f8f9fa] dark:bg-slate-950 text-slate-900 dark:text-slate-100`}>
        <Providers>
          <BackgroundAnimation />
          <Navbar />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
