export default function SupportedGames() {
  const games = [
    { name: 'Counter-Strike 2', logo: '/game-cs2.png' },
    { name: 'Valorant',         logo: '/game-valorant.png' },
    { name: 'Fortnite',         logo: '/game-fortnite.png' },
    { name: 'League of Legends',logo: '/game-lol.png' },
    { name: 'Minecraft',        logo: '/game-minecraft.png' },
  ];

  return (
    <div className="py-16 sm:py-24 border-t border-white/5 relative z-10">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <h2 className="text-center text-sm font-semibold leading-8 text-gray-400 uppercase tracking-widest mb-12">
          Built to optimize the most demanding competitive titles
        </h2>
        <div className="mx-auto grid max-w-lg grid-cols-2 items-stretch gap-6 sm:max-w-xl sm:grid-cols-3 lg:mx-0 lg:max-w-none lg:grid-cols-5">
          {games.map((game) => (
            <div
              key={game.name}
              className="group flex flex-col justify-center items-center py-5 px-4 rounded-2xl glass-panel hover:border-[rgba(var(--accent),0.4)] transition-all duration-300 cursor-default gap-3 hover:shadow-[0_0_18px_-6px_rgba(var(--accent),0.3)] hover:-translate-y-1"
            >
              <img
                src={game.logo}
                alt={game.name}
                className="h-16 w-full object-cover rounded-xl opacity-75 group-hover:opacity-100 transition-opacity duration-300"
              />
              <span className="text-xs text-gray-400 group-hover:text-white transition-colors text-center font-medium leading-tight">
                {game.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
