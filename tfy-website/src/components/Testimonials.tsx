export default function Testimonials() {
  const reviews = [
    {
      name: 'Shadow',
      role: 'Valo Radiant',
      content: 'TFY Hub completely changed my PC. Went from 240fps with stutters to a buttery smooth 400+ lock. The debloat actually works.',
      avatar: 'https://cdn.discordapp.com/embed/avatars/0.png'
    },
    {
      name: 'kr1zz',
      role: 'CS2 Faceit lvl 10',
      content: 'Used to buy tweaks from Twitter guys. Found TFY and it does everything they did but better, and it\'s fully transparent. Crazy good.',
      avatar: 'https://cdn.discordapp.com/embed/avatars/1.png'
    },
    {
      name: 'ApexDemon',
      role: 'Predator',
      content: 'The input lag reduction is actually noticeable. Hitscan feels way more responsive. Best utility out there right now.',
      avatar: 'https://cdn.discordapp.com/embed/avatars/2.png'
    }
  ];

  return (
    <div className="py-24 sm:py-32 relative z-10" id="community">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-lg font-semibold leading-8 tracking-tight" style={{ color: 'rgb(var(--accent))' }}>Testimonials</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Trusted by top players
          </p>
        </div>
        <div className="mx-auto mt-16 flow-root max-w-2xl sm:mt-20 lg:mx-0 lg:max-w-none">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.map((review) => (
              <div key={review.name} className="glass-panel p-8 relative group overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-[rgba(var(--accent),0.5)]">
                {/* Glow sweep */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{ background: 'linear-gradient(135deg, transparent 40%, rgba(var(--accent), 0.1) 100%)' }} />
                
                <div className="flex items-center gap-x-4">
                  <img src={review.avatar} alt="" className="h-10 w-10 rounded-full bg-gray-800" />
                  <div>
                    <h3 className="text-sm font-semibold leading-6 text-white">{review.name}</h3>
                    <p className="text-xs text-gray-400">{review.role}</p>
                  </div>
                </div>
                <p className="mt-6 text-sm leading-6 text-gray-300">"{review.content}"</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
