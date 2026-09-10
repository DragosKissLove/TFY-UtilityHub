require('dotenv').config();
const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');

const {
  DISCORD_TOKEN,
  GUILD_ID,
  ROLE_ID,
  TESTING_ROLE_ID,
  DEVELOPER_ROLE_ID
} = process.env;

const PORT = process.env.SERVER_PORT || process.env.PORT || 8787;

if (!DISCORD_TOKEN || !GUILD_ID || !ROLE_ID) {
  console.error('Missing DISCORD_TOKEN, GUILD_ID, or ROLE_ID in env.');
  process.exit(1);
}

const app = express();
app.use(express.json());

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, discordReady: client.isReady() });
});

app.post('/check-role', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ ok: false, error: 'userId required' });
    }

    if (!client.isReady()) {
      return res.status(503).json({ ok: false, error: 'discord_client_not_ready' });
    }

    const guild = await client.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(userId);
    const hasRole = member.roles.cache.has(ROLE_ID);

    return res.json({ ok: true, hasRole });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'internal_error', details: err.message });
  }
});

app.post('/check-role-testing', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ ok: false, error: 'userId required' });
    }

    if (!client.isReady()) {
      return res.status(503).json({ ok: false, error: 'discord_client_not_ready' });
    }

    if (!TESTING_ROLE_ID) {
      return res.json({ ok: true, hasRole: false });
    }

    const guild = await client.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(userId);
    const hasRole = member.roles.cache.has(TESTING_ROLE_ID);

    return res.json({ ok: true, hasRole });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'internal_error', details: err.message });
  }
});

app.post('/check-roles', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ ok: false, error: 'userId required' });
    }

    if (!client.isReady()) {
      return res.status(503).json({ ok: false, error: 'discord_client_not_ready' });
    }

    const guild = await client.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(userId);

    const hasDeveloper = Boolean(DEVELOPER_ROLE_ID) && member.roles.cache.has(DEVELOPER_ROLE_ID);
    const hasTesting = Boolean(TESTING_ROLE_ID) && member.roles.cache.has(TESTING_ROLE_ID);
    const hasPremium = member.roles.cache.has(ROLE_ID);

    let tier = 'Free User';
    if (hasDeveloper) tier = 'Developer';
    else if (hasTesting) tier = 'Tester TFY';
    else if (hasPremium) tier = 'tfy enjoyer';

    const roleNames = [];
    if (hasDeveloper) roleNames.push('Developer');
    if (hasTesting) roleNames.push('Tester TFY');
    if (hasPremium) roleNames.push('tfy enjoyer');

    return res.json({
      ok: true,
      hasDeveloper,
      hasTesting,
      hasPremium,
      tier,
      roleNames
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'internal_error', details: err.message });
  }
});

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`API listening on 0.0.0.0:${PORT}`);
});

client.once('ready', () => {
  console.log(`Bot logged in as ${client.user.tag}`);
});

client.login(DISCORD_TOKEN).catch(err => {
  console.error('Failed to log in to Discord:', err);
});

