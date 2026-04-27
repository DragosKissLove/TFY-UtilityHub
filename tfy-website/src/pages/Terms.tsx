import { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';

export default function Terms() {
  useEffect(() => { document.title = 'Terms of Service | TFY Utility Hub'; }, []);
  return (
    <div className="min-h-screen bg-background text-white px-6 py-16 max-w-3xl mx-auto">
      <a href="/" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-10 transition-colors">
        <ArrowLeft size={16} /> Back to home
      </a>
      <h1 className="text-4xl font-extrabold mb-2">Terms of Service</h1>
      <p className="text-gray-500 text-sm mb-8">Last updated: March 2025</p>
      <div className="space-y-6 text-gray-400 leading-8">
        <section>
          <h2 className="text-white font-semibold text-lg mb-2">1. Acceptance of Terms</h2>
          <p>By downloading or using TFY Utility Hub, you agree to these terms. If you disagree, please do not use the software.</p>
        </section>
        <section>
          <h2 className="text-white font-semibold text-lg mb-2">2. Use of Software</h2>
          <p>TFY Utility Hub is provided for personal, non-commercial use. Redistribution, resale, or reverse engineering without written permission is prohibited.</p>
        </section>
        <section>
          <h2 className="text-white font-semibold text-lg mb-2">3. No Warranty</h2>
          <p>The software is provided "as is" without warranty of any kind. The developer is not liable for any system issues that may arise from its use. Always create a system restore point before applying optimizations.</p>
        </section>
        <section>
          <h2 className="text-white font-semibold text-lg mb-2">4. Premium Access</h2>
          <p>Premium features are granted as a lifetime license per Discord account. Sharing, reselling, or transferring access is not permitted and will result in revocation.</p>
        </section>
        <section>
          <h2 className="text-white font-semibold text-lg mb-2">5. Changes</h2>
          <p>We reserve the right to modify these terms at any time. Continued use of the software constitutes acceptance of updated terms.</p>
        </section>
      </div>
    </div>
  );
}
