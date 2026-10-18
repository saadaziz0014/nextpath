import type { Metadata, Viewport } from 'next';
import 'mapbox-gl/dist/mapbox-gl.css';
import './globals.css';
export const metadata: Metadata = { title: 'NextPath — Drive & Explore', description: 'Plan any road route, drive with WASD, or watch route playback.' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}


