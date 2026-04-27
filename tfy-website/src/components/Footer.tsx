import { MessageCircle, Twitter, Youtube } from 'lucide-react';

const navigation = {
  quickLinks: [
    { name: 'All Products',  href: '/#pricing' },
    { name: 'Contact us',    href: 'https://discord.gg/PHsCwnaFYg', external: true },
    { name: 'About us',      href: '/about' },
  ],
  products: [
    { name: 'Full Optimization', href: '/#pricing' },
    { name: 'Extreme Debloat',   href: '/#features' },
    { name: 'Gaming Tweaks',     href: '/#features' },
  ],
  support: [
    { name: 'Discord',      href: 'https://discord.gg/PHsCwnaFYg', external: true },
    { name: 'Contact Info', href: 'https://discord.gg/PHsCwnaFYg', external: true },
  ],
  legal: [
    { name: 'Terms of Service', href: '/terms' },
    { name: 'Privacy Policy',   href: '/privacy' },
    { name: 'Refund Policy',    href: '/refund' },
  ],
};

export default function Footer() {
  return (
    <footer className="border-t border-white/5 bg-black/30 relative z-10 mt-16">
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="xl:grid xl:grid-cols-5 xl:gap-8">
          {/* Brand col */}
          <div className="xl:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <img src="/TFY-Logo.png" alt="TFY Logo" className="w-7 h-7 object-contain" />
              <span className="text-white font-bold text-lg">TFY Hub</span>
            </div>
            <p className="text-sm text-gray-400 max-w-[200px] leading-6">
              Pro PC optimization to boost FPS, cut latency, and improve gaming.
            </p>
            <div className="flex gap-3 mt-6">
              <a href="https://discord.gg/PHsCwnaFYg" target="_blank" rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg flex items-center justify-center glass-panel hover:border-[rgba(var(--accent),0.5)] transition-all duration-200 text-gray-400 hover:text-[rgb(var(--accent))]">
                <MessageCircle size={16} />
              </a>
              <a href="https://twitter.com/" target="_blank" rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg flex items-center justify-center glass-panel hover:border-[rgba(var(--accent),0.5)] transition-all duration-200 text-gray-400 hover:text-[rgb(var(--accent))]">
                <Twitter size={16} />
              </a>
              <a href="https://youtube.com/" target="_blank" rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg flex items-center justify-center glass-panel hover:border-[rgba(var(--accent),0.5)] transition-all duration-200 text-gray-400 hover:text-[rgb(var(--accent))]">
                <Youtube size={16} />
              </a>
            </div>
          </div>

          {/* Link columns */}
          <div className="mt-16 grid grid-cols-2 gap-8 xl:col-span-4 xl:mt-0">
            <div className="md:grid md:grid-cols-2 md:gap-8">
              <div>
                <h3 className="text-sm font-semibold leading-6 text-white">Quick Links</h3>
                <ul role="list" className="mt-6 space-y-4">
                  {navigation.quickLinks.map((item) => (
                    <li key={item.name}>
                      <a
                        href={item.href}
                        {...('external' in item && item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                        className="text-sm leading-6 text-gray-400 hover:text-[rgb(var(--accent))] transition-colors"
                      >
                        {item.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-10 md:mt-0">
                <h3 className="text-sm font-semibold leading-6 text-white">Products</h3>
                <ul role="list" className="mt-6 space-y-4">
                  {navigation.products.map((item) => (
                    <li key={item.name}>
                      <a href={item.href} className="text-sm leading-6 text-gray-400 hover:text-[rgb(var(--accent))] transition-colors">
                        {item.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="md:grid md:grid-cols-2 md:gap-8">
              <div>
                <h3 className="text-sm font-semibold leading-6 text-white">Support</h3>
                <ul role="list" className="mt-6 space-y-4">
                  {navigation.support.map((item) => (
                    <li key={item.name}>
                      <a href={item.href} target="_blank" rel="noopener noreferrer"
                        className="text-sm leading-6 text-gray-400 hover:text-[rgb(var(--accent))] transition-colors">
                        {item.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-10 md:mt-0">
                <h3 className="text-sm font-semibold leading-6 text-white">
                  Legal<span style={{ color: 'rgb(var(--accent))' }}> |</span>
                </h3>
                <ul role="list" className="mt-6 space-y-4">
                  {navigation.legal.map((item) => (
                    <li key={item.name}>
                      <a href={item.href} className="text-sm leading-6 text-gray-400 hover:text-[rgb(var(--accent))] transition-colors">
                        {item.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-16 border-t border-white/5 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-500">&copy; {new Date().getFullYear()} TFY Utility Hub. All rights reserved.</p>
          <p className="text-xs text-gray-600">Made for competitive gamers by DragosKissLove.</p>
        </div>
      </div>
    </footer>
  );
}
