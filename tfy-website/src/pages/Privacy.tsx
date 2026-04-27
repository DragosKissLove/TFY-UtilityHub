import { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';

export default function Privacy() {
  useEffect(() => { document.title = 'Privacy Policy | TFY Utility Hub'; }, []);
  return (
    <div className="min-h-screen bg-background text-white px-6 py-16 max-w-3xl mx-auto">
      <a href="/" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-10 transition-colors">
        <ArrowLeft size={16} /> Back to home
      </a>
      <h1 className="text-4xl font-extrabold mb-2">Privacy Policy</h1>
      <p className="text-gray-500 text-sm mb-8">Last updated: March 2025</p>
      <div className="space-y-6 text-gray-400 leading-8">
        <section>
          <h2 className="text-white font-semibold text-lg mb-2">1. Data We Collect</h2>
          <p>TFY Utility Hub connects to Discord via OAuth2 to verify your identity and check your roles. We store your Discord username and user ID locally on your machine only.</p>
        </section>
        <section>
          <h2 className="text-white font-semibold text-lg mb-2">2. How We Use Your Data</h2>
          <p>Your Discord ID is used solely to verify premium access status. We do not sell, rent, or share your data with third parties.</p>
        </section>
        <section>
          <h2 className="text-white font-semibold text-lg mb-2">3. Cookies</h2>
          <p>The TFY website uses localStorage to store your Discord login session. No third-party tracking cookies are used.</p>
        </section>
        <section>
          <h2 className="text-white font-semibold text-lg mb-2">4. Your Rights</h2>
          <p>You can remove your stored data at any time by clicking "Log out" on the website or clearing your browser's local storage.</p>
        </section>
        <section>
          <h2 className="text-white font-semibold text-lg mb-2">5. Contact</h2>
          <p>For privacy concerns, reach us on our <a href="https://discord.gg/PHsCwnaFYg" className="text-white underline hover:no-underline">Discord server</a>.</p>
        </section>
      </div>
    </div>
  );
}
