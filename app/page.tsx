import Link from 'next/link';
import MapSimulator from '@/app/components/MapSimulator';
// Server wrapper; WebGL and animation stay within the client boundary.
export default function HomePage() { return <main><MapSimulator /><nav aria-label="Transport modes" className="glass absolute right-3 top-24 z-20 flex flex-col gap-3 rounded-xl px-4 py-3 text-xs sm:right-20 sm:top-4 sm:flex-row"><Link href="/rail" className="text-emerald-300">Pakistan Rail →</Link><Link href="/metro" className="text-orange-300">Orange Line →</Link><Link href="/metrobus" className="text-rose-300">Metrobus →</Link></nav></main>; }
