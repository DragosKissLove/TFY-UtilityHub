require('dotenv').config();
const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');

const {
  DISCORD_TOKEN,
  GUILD_ID,
  ROLE_ID,
  TESTING_ROLE_ID,
  DEVELOPER_ROLE_ID,
  PORT = 8787
} = process.env;

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
  res.json({ ok: true });
});

app.post('/check-role', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ ok: false, error: 'userId required' });
    }

    const guild = await client.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(userId);
    const hasRole = member.roles.cache.has(ROLE_ID);

    return res.json({ ok: true, hasRole });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

app.post('/check-role-testing', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ ok: false, error: 'userId required' });
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
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

app.post('/check-roles', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ ok: false, error: 'userId required' });
    }

    const guild = await client.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(userId);

    const hasDeveloper = Boolean(DEVELOPER_ROLE_ID) && member.roles.cache.has(DEVELOPER_ROLE_ID);
    const hasTesting = Boolean(TESTING_ROLE_ID) && member.roles.cache.has(TESTING_ROLE_ID);
    const hasPremium = member.roles.cache.has(ROLE_ID);

    let tier = 'Free User';
    if (hasDeveloper) tier = 'Developer';
    else if (hasTesting) tier = 'Tester App';
    else if (hasPremium) tier = 'Premium User';

    return res.json({
      ok: true,
      hasDeveloper,
      hasTesting,
      hasPremium,
      tier
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

client.once('ready', () => {
  console.log(`Bot logged in as ${client.user.tag}`);
  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`API listening on :${PORT}`);
  });
});

client.login(DISCORD_TOKEN);
