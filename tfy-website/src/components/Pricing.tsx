import { Check } from 'lucide-react';

const tiers = [
  {
    name: 'Free Edition',
    id: 'tier-free',
    href: 'https://github.com/DragosKissLove/TFY-UtilityHub-Releases/releases',
    price: 'Free',
    description: 'Basic optimizations for casual competitive gamers.',
    features: [
      'Basic Network Tuning',
      'Telemetry Debloat',
      'System Cleaner',
      'Standard Power Plan',
    ],
    mostPopular: false,
  },
  {
    name: 'Premium / VIP',
    id: 'tier-premium',
    href: '#community',
    price: '$15',
    description: 'The ultimate zero-latency experience used by professionals.',
    features: [
      'Advanced Network Tuning (0 Ping)',
      'Aggressive Kernel Debloat',
      'Ultimate Power Plan (ParkControl)',
      'Exclusive HWID Spoof Access',
      'Priority Discord Support',
    ],
    mostPopular: true,
  },
]

export default function Pricing() {
  return (
    <div className="py-24 sm:py-32 relative z-10" id="pricing">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-base font-semibold leading-7" style={{ color: 'rgb(var(--accent))' }}>Pricing</h2>
          <p className="mt-2 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Choose the right power level
          </p>
        </div>
        <p className="mx-auto mt-6 max-w-2xl text-center text-lg leading-8 text-gray-400">
          Whether you want a solid baseline free tweak or the absolute maximum frame consistency, we have you covered.
        </p>
        <div className="isolate mx-auto mt-16 grid max-w-md grid-cols-1 gap-y-8 sm:mt-20 lg:mx-0 lg:max-w-none lg:grid-cols-2 lg:gap-x-8 xl:gap-x-12">
          {tiers.map((tier) => (
            <div
              key={tier.id}
              className={`glass-panel p-8 xl:p-10 relative overflow-hidden transition-all duration-300 hover:-translate-y-1 ${
                tier.mostPopular ? 'border-[rgba(var(--accent),0.5)] shadow-[0_0_40px_-15px_rgba(var(--accent),0.4)]' : ''
              }`}
            >
              {tier.mostPopular && (
                <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 0%, rgba(var(--accent), 0.15) 0%, transparent 70%)' }} />
              )}
              
              <div className="flex items-center justify-between gap-x-4 relative z-10">
                <h3 id={tier.id} className={`text-lg font-semibold leading-8 ${tier.mostPopular ? 'text-[rgb(var(--accent))]' : 'text-white'}`}>
                  {tier.name}
                </h3>
                {tier.mostPopular ? (
                  <p className="rounded-full px-2.5 py-1 text-xs font-semibold leading-5 text-white" style={{ background: 'rgba(var(--accent), 0.2)' }}>
                    Most popular
                  </p>
                ) : null}
              </div>
              <p className="mt-4 text-sm leading-6 text-gray-400 relative z-10">{tier.description}</p>
              <p className="mt-6 flex items-baseline gap-x-1 relative z-10">
                <span className="text-4xl font-bold tracking-tight text-white">{tier.price}</span>
                {tier.price !== 'Free' ? <span className="text-sm font-semibold leading-6 text-gray-400">/lifetime</span> : null}
              </p>
              <a
                href={tier.href}
                aria-describedby={tier.id}
                className={`mt-6 block rounded-xl px-3 py-2 text-center text-sm font-semibold leading-6 transition-all relative z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                  tier.mostPopular
                    ? 'bg-[rgb(var(--accent))] text-white hover:brightness-110 shadow-[0_0_20px_-5px_rgba(var(--accent),0.5)]'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {tier.price === 'Free' ? 'Download' : 'Buy Access'}
              </a>
              <ul role="list" className="mt-8 space-y-3 text-sm leading-6 text-gray-300 relative z-10">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex gap-x-3">
                    <Check className="h-6 w-5 flex-none" style={{ color: 'rgb(var(--accent))' }} aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
