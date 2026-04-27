import { Zap, Shield, Cpu } from 'lucide-react';

const features = [
  {
    name: 'Push limits',
    description: 'Bypass standard restrictions and tune your system precisely for gaming. Ultimate power plans and raw input.',
    icon: Zap,
  },
  {
    name: 'Secure & Clean',
    description: 'No malware, no hidden scripts. 100% transparent open-source tools packaged conveniently.',
    icon: Shield,
  },
  {
    name: 'Advanced Debloat',
    description: 'Strip Windows 10/11 down to its core to squeeze every single frame out of your hardware.',
    icon: Cpu,
  },
]

export default function Features() {
  return (
    <div className="py-24 sm:py-32" id="features">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl lg:text-center">
          <h2 className="text-base font-semibold leading-7" style={{ color: 'rgb(var(--accent))' }}>Deploy faster</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Everything you need for zero input lag.
          </p>
          <p className="mt-6 text-lg leading-8 text-gray-400">
            TFY Utility Hub combines the best community configurations and proven optimization methods into a single elegant interface.
          </p>
        </div>
        <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-4xl">
          <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-10 lg:max-w-none lg:grid-cols-3 lg:gap-y-16">
            {features.map((feature) => (
              <div key={feature.name} className="relative pl-16">
                <dt className="text-base font-semibold leading-7 text-white">
                  <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: 'color-mix(in srgb, rgb(var(--accent)) 20%, transparent)', border: '1px solid color-mix(in srgb, rgb(var(--accent)) 30%, transparent)' }}>
                    <feature.icon className="h-6 w-6" aria-hidden="true" style={{ color: 'rgb(var(--accent))' }} />
                  </div>
                  {feature.name}
                </dt>
                <dd className="mt-2 text-base leading-7 text-gray-400">{feature.description}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  )
}
