import Link from 'next/link';

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-[#fbfbfa] flex flex-col items-center justify-center px-6 text-center">
      <div className="mb-8">
        <svg viewBox="0 0 96 96" className="w-20 h-20 mx-auto mb-6" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="96" height="96" rx="18" fill="#01696f"/>
          <rect x="37" y="19" width="22" height="58" rx="6" fill="white"/>
          <rect x="19" y="37" width="58" height="22" rx="6" fill="white"/>
        </svg>
        <h1 className="text-3xl font-bold text-[#1a202c] font-serif mb-2">You're Offline</h1>
        <p className="text-[#64748b] text-base max-w-sm mx-auto leading-relaxed">
          CureQ needs an internet connection to sync your queue and patient data in real time.
        </p>
      </div>

      <div className="bg-white border border-[#e9e9e7] rounded-2xl p-6 max-w-sm w-full shadow-sm mb-6 text-left space-y-3">
        <p className="text-xs font-bold text-[#64748b] uppercase tracking-wider mb-3">What you can do</p>
        {[
          ['Check your Wi-Fi or mobile data connection', '📶'],
          ['Previously viewed pages are cached and may still load', '💾'],
          ['Patient queue data will sync automatically when reconnected', '🔄'],
        ].map(([text, emoji]) => (
          <div key={text} className="flex items-start gap-2.5">
            <span className="text-base">{emoji}</span>
            <p className="text-sm text-[#64748b] leading-snug">{text}</p>
          </div>
        ))}
      </div>

      <Link
        href="/dashboard"
        className="px-6 py-3 bg-[#01696f] text-white text-sm font-bold rounded-xl hover:bg-[#005459] transition-colors shadow-md"
      >
        Try Again
      </Link>
    </div>
  );
}
