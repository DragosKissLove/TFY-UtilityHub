TFY Discord Role Gate

Setup
1) Copy .env.example to .env
2) Fill DISCORD_TOKEN, GUILD_ID, ROLE_ID
3) Install deps: npm install
4) Run: npm start

Endpoints
- GET /health -> { ok: true }
- POST /check-role { userId } -> { ok, hasRole }

Notes
- Enable "Server Members Intent" in the Discord Developer Portal for the bot.
- The bot must be invited to the server and have access to the role.
