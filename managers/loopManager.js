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

// =======================
// QUEUES + FALLBACKS
// =======================

const yapQueue = [];
const rumorQueue = [];

const fallbackYaps = [
  "I was gonna say something deep but I forgot halfway through.",
  "Sleep is just a free trial of being dead but less dramatic.",
  "Why is it always one sock that disappears? Where are they going?",
  "Water has no taste but somehow still slaps at 3 AM.",
  "Nobody talks about how weird it is that mirrors just exist.",
  "If tomatoes are fruit then ketchup is technically a smoothie.",
];

const fallbackRumors = [
  "🚨 BREAKING: A celebrity was spotted arguing with a self-checkout machine. Source: a guy named Kevin.",
  "😱 Rumor has it a tech CEO rage quit their own app after forgetting their password. Source: trust me bro.",
  "🔥 A sports star allegedly blamed Mercury retrograde for missing practice. Source: my cousin's barber.",
  "👀 Reports say an influencer cried because their iced coffee had too much ice. Source: leaked vibes.",
  "🚨 A famous singer supposedly ghosted their group chat for 3 months then came back with 'my bad'. Source: a suspicious tweet.",
];

// =======================
// CONFIG
// =======================

function getConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return {};
  }
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

// =======================
// AI HELPERS
// =======================

function isQuotaError(err) {
  const msg = err?.message || String(err);
  return msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED");
}

async function fetchGifUrl(gifQuery) {
  try {
    const res = await fetch(
      `https://g.tenor.com/v1/search?q=${encodeURIComponent(gifQuery)}&key=${TENOR_KEY}&limit=20`
    );
    const data = await res.json();
    const results = data.results || [];

    if (!results.length) return null;

    const pick = results[Math.floor(Math.random() * results.length)];
    return pick.media?.[0]?.gif?.url || pick.media?.[0]?.mediumgif?.url || null;
  } catch {
    return null;
  }
}

// =======================
// BATCH GENERATION
// =======================

async function refillYapQueue() {
  if (yapQueue.length >= 3) return;

  try {
    console.log("[YAP QUEUE] Refilling...");

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `
Generate 8 separate chaotic, funny, chronically online Discord messages.
Rules:
- each one must be under 180 characters
- no hashtags
- no numbering
- no intro text
- one message per line
- casual tone
`,
      config: { maxOutputTokens: 8192 },
    });

    const raw = response.text?.trim() || "";
    const items = raw
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean)
      .filter((x) => x.length <= 180);

    if (items.length) {
      yapQueue.push(...items);
      console.log(`[YAP QUEUE] Added ${items.length} items`);
    }
  } catch (err) {
    if (isQuotaError(err)) {
      console.log("[YAP QUEUE] Gemini quota hit, using fallback queue.");
      yapQueue.push(...fallbackYaps);
      return;
    }

    console.error("[YAP QUEUE]", err?.message || String(err));
  }
}

async function refillRumorQueue() {
  if (rumorQueue.length >= 2) return;

  try {
    console.log("[RUMOR QUEUE] Refilling...");

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `
Generate 5 fake shocking viral rumors.
Rules:
- each rumor must be under 260 characters
- each rumor should sound like social media drama
- after each rumor, add " || " and then a 2-3 word gif search
- one rumor per line
- no numbering
`,
      config: { maxOutputTokens: 8192 },
    });

    const raw = response.text?.trim() || "";
    const items = raw
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean)
      .map((line) => {
        const [text, gifQuery] = line.split("||").map((x) => x?.trim());
        return {
          text: text || "BREAKING: nothing happened again.",
          gifQuery: gifQuery || "shocked face",
        };
      });

    if (items.length) {
      rumorQueue.push(...items);
      console.log(`[RUMOR QUEUE] Added ${items.length} items`);
    }
  } catch (err) {
    if (isQuotaError(err)) {
      console.log("[RUMOR QUEUE] Gemini quota hit, using fallback queue.");
      rumorQueue.push(
        ...fallbackRumors.map((text) => ({
          text,
          gifQuery: "shocked face",
        }))
      );
      return;
    }

    console.error("[RUMOR QUEUE]", err?.message || String(err));
  }
}

// =======================
// LOOP RUNNERS
// =======================

async function runYap(channelId) {
  try {
    console.log(`[YAP SENT] ${new Date().toISOString()}`);

    const channel = await _client.channels.fetch(channelId).catch(() => null);
    if (!channel) return;

    if (yapQueue.length === 0) {
      await refillYapQueue();
    }

    const yap = yapQueue.shift() || fallbackYaps[Math.floor(Math.random() * fallbackYaps.length)];
    await channel.send(`🗣️ ${yap}`);

    // refill in background if queue is low
    if (yapQueue.length < 2) {
      refillYapQueue().catch(() => {});
    }
  } catch (err) {
    const msg = err?.message || String(err);

    if (isQuotaError(err)) {
      console.log("[Yap loop] Gemini quota hit, skipping...");
      return;
    }

    console.error("[Yap loop]", msg);
  }
}

async function runRumors(channelId) {
  try {
    console.log(`[RUMOR SENT] ${new Date().toISOString()}`);

    const channel = await _client.channels.fetch(channelId).catch(() => null);
    if (!channel) return;

    if (rumorQueue.length === 0) {
      await refillRumorQueue();
    }

    const item =
      rumorQueue.shift() || {
        text: fallbackRumors[Math.floor(Math.random() * fallbackRumors.length)],
        gifQuery: "shocked face",
      };

    const gifUrl = await fetchGifUrl(item.gifQuery);

    const embed = new EmbedBuilder()
      .setColor(0xff6b35)
      .setDescription(item.text)
      .setFooter({ text: "📱 Trending..." })
      .setTimestamp();

    if (gifUrl) embed.setImage(gifUrl);

    await channel.send({ embeds: [embed] });

    // refill in background if queue is low
    if (rumorQueue.length < 2) {
      refillRumorQueue().catch(() => {});
    }
  } catch (err) {
    const msg = err?.message || String(err);

    if (isQuotaError(err)) {
      console.log("[Rumors loop] Gemini quota hit, skipping...");
      return;
    }

    console.error("[Rumors loop]", msg);
  }
}

// =======================
// LOOP SYSTEM
// =======================

function startLoop(guildId, type, channelId, intervalMs) {
  stopLoop(guildId, type);

  if (!activeIntervals[guildId]) activeIntervals[guildId] = {};

  const runners = {
    yap: runYap,
    rumors: runRumors,
  };

  const runner = runners[type];
  if (!runner) return;

  intervalMs = Number(intervalMs);

  console.log(`[START LOOP] ${type} every ${intervalMs}ms`);

  runner(channelId);

  activeIntervals[guildId][type] = setInterval(() => {
    console.log(`[LOOP TRIGGER] ${type}`);
    runner(channelId);
  }, intervalMs);
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

  config[guildId][type] = {
    channelId,
    intervalMs: Number(intervalMs),
    active: true,
  };

  saveConfig(config);
  startLoop(guildId, type, channelId, Number(intervalMs));
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
        console.log(`[RESTORE] ${type} loop`);
        startLoop(guildId, type, loopConfig.channelId, Number(loopConfig.intervalMs));
      }
    }
  }
}

async function init(client) {
  _client = client;

  // warm queues a little on startup
  refillYapQueue().catch(() => {});
  refillRumorQueue().catch(() => {});

  restoreLoops();
}

module.exports = {
  init,
  setLoop,
  clearLoop,
  getStatus,
};
