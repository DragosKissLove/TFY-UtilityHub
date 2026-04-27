import { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';

export default function Refund() {
  useEffect(() => { document.title = 'Refund Policy | TFY Utility Hub'; }, []);
  return (
    <div className="min-h-screen bg-background text-white px-6 py-16 max-w-3xl mx-auto">
      <a href="/" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-10 transition-colors">
        <ArrowLeft size={16} /> Back to home
      </a>
      <h1 className="text-4xl font-extrabold mb-2">Refund Policy</h1>
      <p className="text-gray-500 text-sm mb-8">Last updated: March 2025</p>
      <div className="space-y-6 text-gray-400 leading-8">
        <section>
          <h2 className="text-white font-semibold text-lg mb-2">No Refunds</h2>
          <p>All purchases of TFY Utility Hub Premium access are <strong className="text-white">final and non-refundable</strong> due to the digital nature of the product. Once access is granted and verified via Discord, no refunds will be issued.</p>
        </section>
        <section>
          <h2 className="text-white font-semibold text-lg mb-2">Exceptions</h2>
          <p>If you were charged but never received access, or experienced a technical billing error, please contact us on Discord within 48 hours and we will resolve it.</p>
        </section>
        <section>
          <h2 className="text-white font-semibold text-lg mb-2">Contact</h2>
          <p>Open a support ticket on our <a href="https://discord.gg/PHsCwnaFYg" className="text-white underline hover:no-underline">Discord server</a> for any billing issues.</p>
        </section>
      </div>
    </div>
  );
}
