import type { Metadata } from 'next';
import 'mapbox-gl/dist/mapbox-gl.css';
import './globals.css';
export const metadata: Metadata = { title: 'NextPath — Drive & Explore', description: 'Plan any road route, drive with WASD, or watch route playback.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}


