import { Download } from 'lucide-react';

export default function Hero() {
  const GITHUB_LINK = 'https://github.com/DragosKissLove/TFY-UtilityHub-Releases/releases/latest';

  return (
    <div className="relative pt-20 pb-16 sm:pt-32 sm:pb-24 lg:pb-32 flex flex-col items-center justify-center text-center">
      <h1 className="text-5xl md:text-7xl font-display font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-[1.1]">
        Elevate your gaming tuning with <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-[rgba(var(--accent))]">TFY Hub</span>
      </h1>
      
      <p className="mt-6 text-lg md:text-xl text-gray-400 max-w-2xl mx-auto">
        The ultimate optimization application for competitive gamers. Apply world-class presets, disable unnecessary telemetry, and reduce input lag in one click.
      </p>

      <div className="mt-10 flex items-center justify-center gap-x-6">
        <a 
          href={GITHUB_LINK} 
          target="_blank" 
          rel="noopener noreferrer"
          className="btn-primary flex items-center gap-2"
        >
          <Download size={18} /> Download Latest
        </a>
        <a href="#features" className="text-sm font-semibold leading-6 text-white group flex items-center gap-1">
          Learn more <span aria-hidden="true" className="group-hover:translate-x-1 transition-transform">→</span>
        </a>
      </div>

      <div className="mt-20 sm:mt-24 relative w-full max-w-6xl mx-auto">
        {/* Glow behind image */}
        <div className="absolute -inset-x-20 -top-20 -bottom-20 bg-gradient-to-b from-[rgba(var(--accent),0.15)] to-transparent blur-3xl rounded-[3rem] -z-10" />
        
        {/* Image Mockup container */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-2 backdrop-blur-sm shadow-2xl animate-fade-in shadow-[0_0_50px_-12px_rgba(var(--accent),0.3)]">
          <div className="rounded-xl overflow-hidden bg-[#050505] border border-white/5">
            <img src="/TFY-App.png" alt="TFY Utility Hub" className="w-full h-auto object-contain opacity-90 transition-opacity hover:opacity-100" />
          </div>
        </div>
      </div>
    </div>
  );
}
