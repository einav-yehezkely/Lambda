import type { Metadata } from 'next';
import { Public_Sans } from 'next/font/google';
import './globals.css';
import 'katex/dist/katex.min.css';
import { Providers } from '@/components/providers';
import { Navbar } from '@/components/ui/navbar';
import { BackgroundAnimation } from '@/components/ui/background-animation';

const publicSans = Public_Sans({ subsets: ['latin'], variable: '--font-display' });

export const metadata: Metadata = {
  title: 'Lambda | Computer Science Practice',
  description: 'Community-driven learning platform for CS & Math students',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${publicSans.variable} font-display antialiased bg-[#f8f9fa] text-slate-900`}>
        <Providers>
          <BackgroundAnimation />
          <Navbar />
          <main className="max-w-7xl mx-auto px-6 py-10">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
