import { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';

export default function About() {
  useEffect(() => { document.title = 'About | TFY Utility Hub'; }, []);
  return (
    <div className="min-h-screen bg-background text-white px-6 py-16 max-w-3xl mx-auto">
      <a href="/" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-10 transition-colors">
        <ArrowLeft size={16} /> Back to home
      </a>
      <img src="/TFY-Logo.png" alt="TFY Logo" className="w-16 h-16 mb-6 object-contain" />
      <h1 className="text-4xl font-extrabold mb-4 text-white">About TFY Utility Hub</h1>
      <p className="text-gray-400 leading-8 mb-6">
        TFY Utility Hub was created and is maintained by <span className="text-white font-semibold">DragosKissLove</span>, a passionate developer and competitive gamer dedicated to extracting every last frame from your hardware.
      </p>
      <p className="text-gray-400 leading-8 mb-6">
        What started as a personal project to optimize one gaming rig has evolved into a fully-featured optimization suite trusted by thousands of competitive players across CS2, Valorant, Fortnite, Apex, and more.
      </p>
      <p className="text-gray-400 leading-8 mb-6">
        DragosKissLove built TFY with a single principle in mind: <span className="text-white italic">"No junk, no bloat, just raw performance."</span> Every feature is tested personally and vetted by the community before shipping.
      </p>
      <div className="glass-panel p-6 mt-8 rounded-2xl">
        <h2 className="text-lg font-bold text-white mb-2">Developer</h2>
        <p className="text-gray-300">DragosKissLove</p>
        <p className="text-gray-500 text-sm mt-1">Founder &amp; Lead Developer — TFY Utility Hub</p>
        <a href="https://discord.gg/PHsCwnaFYg" target="_blank" rel="noopener noreferrer"
          className="inline-block mt-4 text-sm font-semibold px-4 py-2 rounded-lg" style={{ background: 'rgb(var(--accent))', color: '#fff' }}>
          Join Discord Community
        </a>
      </div>
    </div>
  );
}
