const { GoogleGenAI } = require("@google/genai");
const { EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");

const CONFIG_PATH = path.join(__dirname, "../data/loops-config.json");
const TENOR_KEY = "LIVDSRZULELA";

const activeIntervals = {};
let _client = null;

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
});

function getConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")); }
  catch { return {}; }
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

async function generateYap() {
  const styles = [
    "Give an unhinged hot take no one asked for.",
    "Share a wild shower thought that makes people question reality.",
    "Drop an unpopular opinion confidently.",
    "Say something totally random like you're terminally online.",
    "Share a fun fact most people don't know.",
    "Give a completely random observation about everyday life.",
    "Say something that sounds deep but means absolutely nothing.",
    "Give a chaotic take on food, sleep, or social media.",
  ];
  const style = styles[Math.floor(Math.random() * styles.length)];

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `You are a chaotic, funny, chronically online Discord bot. ${style} Under 180 characters. No hashtags. Very casual tone. Just say the thing directly, no intro.`,
    config: { maxOutputTokens: 8192 },
  });
  return response.text?.trim() || "I had a thought but I forgot it. Probably wasn't important.";
}

async function generateRumorWithGif() {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Create a fake shocking social media rumor about a celebrity, tech company, sports star, or entertainment. Format it like a viral tweet with emojis and urgency. Include a fake "Source:" at the end. Keep it under 260 characters. Then on a NEW LINE write ONLY a 2-3 word gif search term that matches the vibe (e.g. "mind blown" or "shocked reaction" or "oh no").`,
    config: { maxOutputTokens: 8192 },
  });

  const raw = response.text?.trim() || "BREAKING: Nothing happened. Source: Trust me bro\nshocked face";
  const lines = raw.split("\n").map(l => l.trim()).filter(Boolean);
  const gifQuery = lines[lines.length - 1];
  const rumorText = lines.slice(0, -1).join("\n");

  let gifUrl = null;
  try {
    const gifRes = await fetch(
      `https://g.tenor.com/v1/search?q=${encodeURIComponent(gifQuery)}&key=${TENOR_KEY}&limit=20&contentfilter=medium`
    );
    const gifData = await gifRes.json();
    const results = gifData.results || [];
    if (results.length) {
      const pick = results[Math.floor(Math.random() * results.length)];
      gifUrl = pick.media?.[0]?.gif?.url || pick.media?.[0]?.mediumgif?.url || null;
    }
  } catch { /* no gif is fine */ }

  return { text: rumorText, gifUrl };
}

async function runRumors(channelId) {
  try {
    console.log(`[RUMOR SENT] ${new Date().toISOString()}`);

    const channel = await _client.channels.fetch(channelId).catch(() => null);
    if (!channel) return;

    const { text, gifUrl } = await generateRumorWithGif();
    const embed = new EmbedBuilder()
      .setColor(0xff6b35)
      .setDescription(text)
      .setFooter({ text: "📱 Trending on social media..." })
      .setTimestamp();

    if (gifUrl) embed.setImage(gifUrl);
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[Rumors loop]", err.message);
  }
}
async function runRumors(channelId) {
  try {
    const channel = await _client.channels.fetch(channelId).catch(() => null);
    if (!channel) return;
    const { text, gifUrl } = await generateRumorWithGif();
    const embed = new EmbedBuilder()
      .setColor(0xff6b35)
      .setDescription(text)
      .setFooter({ text: "📱 Trending on social media..." })
      .setTimestamp();
    if (gifUrl) embed.setImage(gifUrl);
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[Rumors loop]", err.message);
  }
}

function startLoop(guildId, type, channelId, intervalMs) {
  stopLoop(guildId, type);
  if (!activeIntervals[guildId]) activeIntervals[guildId] = {};
  const runners = { yap: runYap, rumors: runRumors };
  const runner = runners[type];
  if (!runner) return;

  runner(channelId);
  activeIntervals[guildId][type] = setInterval(() => runner(channelId), intervalMs);
}

function stopLoop(guildId, type) {
  if (activeIntervals[guildId]?.[type]) {
    clearInterval(activeIntervals[guildId][type]);
    delete activeIntervals[guildId][type];
  }
}

function setLoop(guildId, type, channelId, intervalMs) {
  const config = getConfig();
  if (!config[guildId]) config[guildId] = {};
  config[guildId][type] = { channelId, intervalMs, active: true };
  saveConfig(config);
  startLoop(guildId, type, channelId, intervalMs);
}

function clearLoop(guildId, type) {
  const config = getConfig();
  if (config[guildId]?.[type]) {
    config[guildId][type].active = false;
    saveConfig(config);
  }
  stopLoop(guildId, type);
}

function getStatus(guildId, type) {
  return getConfig()[guildId]?.[type] || null;
}

function restoreLoops() {
  const config = getConfig();
  for (const [guildId, loops] of Object.entries(config)) {
    for (const [type, loopConfig] of Object.entries(loops)) {
      if (loopConfig.active) {
        console.log(`[LoopManager] Restoring ${type} loop for guild ${guildId}`);
        startLoop(guildId, type, loopConfig.channelId, loopConfig.intervalMs);
      }
    }
  }
}

function init(discordClient) {
  _client = discordClient;
  restoreLoops();
}

module.exports = { init, setLoop, clearLoop, getStatus };
