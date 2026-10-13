import type { SVGProps } from 'react';

export default function DoubleBusIcon({
  size = 24,
  className,
  ...props
}: SVGProps<SVGSVGElement> & { size?: number | string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* Rear trailer section */}
      <path d="M2 8a1.5 1.5 0 0 1 1.5-1.5H9v10H3.5A1.5 1.5 0 0 1 2 15Z" />
      <path d="M2 11h7" />
      <path d="M5.5 6.5v4.5" />
      {/* Articulation bellows joint */}
      <path d="M9 7.5h3.5" />
      <path d="M9 16h3.5" />
      <path d="M10.2 6.5v10" />
      <path d="M11.8 6.5v10" />
      {/* Front lead section */}
      <path d="M12.5 6.5h5.5a2 2 0 0 1 1.7 1l1.8 3.8c.3.7.5 1.5.5 2.2v1.5a1.5 1.5 0 0 1-1.5 1.5H12.5V6.5Z" />
      <path d="M12.5 11h9" />
      <path d="M16 6.5v4.5" />
      {/* Wheels */}
      <circle cx="5.5" cy="18" r="1.5" />
      <circle cx="17.5" cy="18" r="1.5" />
    </svg>
  );
}
