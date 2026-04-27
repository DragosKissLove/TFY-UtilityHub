import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Features from './components/Features';
import SupportedGames from './components/SupportedGames';
import Testimonials from './components/Testimonials';
import Pricing from './components/Pricing';
import Footer from './components/Footer';
import About from './pages/About';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import Refund from './pages/Refund';

function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen relative z-10 w-full overflow-hidden">
      <Navbar />
      <main className="flex-1 w-full max-w-7xl mx-auto px-6 lg:px-8">
        <Hero />
        <SupportedGames />
        <Features />
        <Pricing />
        <Testimonials />
      </main>
      <Footer />
    </div>
  );
}

function OAuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const [accessToken, tokenType] = [fragment.get('access_token'), fragment.get('token_type')];

    if (!accessToken) {
      navigate('/');
      return;
    }

    fetch('https://discord.com/api/users/@me', {
      headers: {
        authorization: `${tokenType} ${accessToken}`,
      },
    })
      .then(result => result.json())
      .then(response => {
        const { id, username, avatar } = response;
        localStorage.setItem('tfy.discord.id', id);
        localStorage.setItem('tfy.discord.name', username);
        if (avatar) {
          localStorage.setItem('tfy.discord.avatar', `https://cdn.discordapp.com/avatars/${id}/${avatar}.png?size=128`);
        }
        window.location.href = '/';
      })
      .catch(console.error);
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen text-white bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-white/10 border-t-blue-500 animate-spin" />
        <p className="animate-pulse text-lg font-medium text-gray-300">Authenticating with Discord...</p>
      </div>
    </div>
  );
}

function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen relative z-10 overflow-hidden">
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/callback" element={<OAuthCallback />} />
        <Route path="/about"   element={<PageWrapper><About /></PageWrapper>} />
        <Route path="/terms"   element={<PageWrapper><Terms /></PageWrapper>} />
        <Route path="/privacy" element={<PageWrapper><Privacy /></PageWrapper>} />
        <Route path="/refund"  element={<PageWrapper><Refund /></PageWrapper>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
