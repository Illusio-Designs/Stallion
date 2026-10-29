// Placeholder artwork shown when a frame has no photo yet.
export default function Glasses({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 120 50" fill="none" aria-hidden="true">
      <circle cx="30" cy="26" r="17" fill="var(--lens)" fillOpacity=".55" stroke="#0a0a0a" strokeWidth="4" />
      <circle cx="90" cy="26" r="17" fill="var(--lens)" fillOpacity=".55" stroke="#0a0a0a" strokeWidth="4" />
      <path d="M47 24c8-6 18-6 26 0M13 20L3 14M107 20l10-6" stroke="#0a0a0a" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
