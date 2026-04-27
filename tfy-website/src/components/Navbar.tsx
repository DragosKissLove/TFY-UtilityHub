import { ArrowRight, LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';

const CLIENT_ID = '1465554212770545728';

export default function Navbar() {
  const [user, setUser] = useState<{ name: string; avatar: string } | null>(null);

  useEffect(() => {
    const name = localStorage.getItem('tfy.discord.name');
    const avatar = localStorage.getItem('tfy.discord.avatar') || `https://ui-avatars.com/api/?name=${name}&background=random`;
    if (name) {
      setUser({ name, avatar });
    }
  }, []);

  const handleDiscordLogin = () => {
    const redirectUri = encodeURIComponent(window.location.origin + '/callback');
    const authUrl = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&response_type=token&redirect_uri=${redirectUri}&scope=identify`;
    window.location.href = authUrl;
  };

  const handleLogout = () => {
    localStorage.removeItem('tfy.discord.id');
    localStorage.removeItem('tfy.discord.name');
    localStorage.removeItem('tfy.discord.avatar');
    setUser(null);
  };

  return (
    <nav className="flex items-center justify-between py-6 px-6 lg:px-8 w-full max-w-7xl mx-auto">
      <div className="flex items-center gap-2">
        {/* Placeholder Logo */}
        <img src="/TFY-Logo.png" alt="TFY Logo" className="w-8 h-8 object-contain" />
        <span className="text-white font-display font-bold text-lg tracking-wide">TFY</span>
      </div>

      <div className="hidden md:flex items-center gap-8">
        <a href="#product" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">Product</a>
        <a href="#features" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">Features</a>
        <a href="#community" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">Community</a>
      </div>

      <div className="flex items-center gap-4">
        {user ? (
          <div className="flex items-center gap-3 glass-panel px-3 py-1.5 rounded-full pr-1.5">
            <img src={user.avatar} alt={user.name} className="w-7 h-7 rounded-full border border-white/10" />
            <span className="text-sm font-medium text-white max-w-[100px] truncate">{user.name}</span>
            <button onClick={handleLogout} className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white ml-1">
              <LogOut size={14} />
            </button>
          </div>
        ) : (
          <button onClick={handleDiscordLogin} className="group flex items-center gap-2 text-sm font-semibold text-white hover:text-purple-400 transition-colors">
            Log in <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </button>
        )}
      </div>
    </nav>
  );
}
