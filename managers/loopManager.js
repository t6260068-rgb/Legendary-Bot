const { GoogleGenAI } = require("@google/genai");
const { EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");

const CONFIG_PATH = path.join(__dirname, "../data/loops-config.json");
const CACHE_PATH = path.join(__dirname, "../data/ai-cache.json");
const TENOR_KEY = "LIVDSRZULELA";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const activeIntervals = {};
let _client = null;

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
});

const fallbackYaps = [
  "I was gonna say something deep but my brain clocked out early.",
  "Sleep is just loading screen for tomorrow’s chaos.",
  "Lowkey everything is fake but snacks are real.",
  "I had a thought and then immediately lost the plot.",
  "Why does 5 minutes feel like 2 hours in class but 2 minutes on my phone feels illegal?",
  "Some of y’all type 'bro' like it’s punctuation.",
  "Imagine being productive on purpose. Wild concept.",
  "I respect people who know what they’re doing because I definitely don’t.",
];

const fallbackRumors = [
  { text: "🚨 BREAKING: A celebrity allegedly got into an argument with a self-checkout machine. Source: my cousin’s friend.", gifQuery: "shocked reaction" },
  { text: "😱 Rumor says a tech CEO forgot their own password and blamed the interns. Source: an extremely dramatic tweet.", gifQuery: "facepalm reaction" },
  { text: "🔥 Reports claim a singer left the group chat for 3 months and returned with just 'my bad'. Source: trust me bro.", gifQuery: "awkward reaction" },
  { text: "👀 A sports star was apparently late to practice because they were rewatching their own highlights. Source: vibes.", gifQuery: "mind blown" },
  { text: "🚨 Allegedly, an influencer cried because their iced coffee had too much ice. Source: social media detectives.", gifQuery: "dramatic crying" },
];

function ensureJsonFile(filePath, defaultValue) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
  }
}

function getConfig() {
  ensureJsonFile(CONFIG_PATH, {});
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return {};
  }
}

function saveConfig(config) {
  ensureJsonFile(CONFIG_PATH, {});
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function getCache() {
  ensureJsonFile(CACHE_PATH, {
    dateKey: null,
    yaps: [],
    rumors: [],
  });

  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
  } catch {
    return {
      dateKey: null,
      yaps: [],
      rumors: [],
    };
  }
}

function saveCache(cache) {
  ensureJsonFile(CACHE_PATH, {
    dateKey: null,
    yaps: [],
    rumors: [],
  });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function isQuotaError(err) {
  const msg = err?.message || String(err);
  return msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED");
}

function calculateDailyNeeds() {
  const config = getConfig();
  let yapCount = 0;
  let rumorCount = 0;

  for (const loops of Object.values(config)) {
    if (loops.yap?.active && loops.yap.intervalMs) {
      yapCount += Math.ceil(ONE_DAY_MS / Number(loops.yap.intervalMs));
    }

    if (loops.rumors?.active && loops.rumors.intervalMs) {
      rumorCount += Math.ceil(ONE_DAY_MS / Number(loops.rumors.intervalMs));
    }
  }

  return {
    yapCount: Math.max(yapCount, 8),
    rumorCount: Math.max(rumorCount, 6),
  };
}

async function fetchGifUrl(gifQuery) {
  try {
    const res = await fetch(
      `https://g.tenor.com/v1/search?q=${encodeURIComponent(gifQuery)}&key=${TENOR_KEY}&limit=20&contentfilter=medium`
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

async function generateDailyYaps(count) {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `
Generate exactly ${count} separate chaotic, funny, chronically online Discord messages.

Rules:
- each message must be under 180 characters
- no hashtags
- no numbering
- no intro text
- one message per line only
- casual Discord tone
- make them varied
`,
    config: { maxOutputTokens: 8192 },
  });

  const raw = response.text?.trim() || "";
  return raw
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, count);
}

async function generateDailyRumors(count) {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `
Generate exactly ${count} fake viral rumors.

Rules:
- each rumor under 260 characters
- each rumor should sound like social media drama
- after each rumor, add " || " and then a 2-3 word gif search
- one rumor per line only
- no numbering
`,
    config: { maxOutputTokens: 8192 },
  });

  const raw = response.text?.trim() || "";
  return raw
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, count)
    .map((line) => {
      const [text, gifQuery] = line.split("||").map((x) => x?.trim());
      return {
        text: text || "🚨 BREAKING: Nothing happened. Source: vibes.",
        gifQuery: gifQuery || "shocked reaction",
      };
    });
}

async function ensureDailyCache() {
  const cache = getCache();
  const todayKey = getTodayKey();
  const { yapCount, rumorCount } = calculateDailyNeeds();

  let changed = false;

  if (cache.dateKey !== todayKey) {
    cache.dateKey = todayKey;
    cache.yaps = [];
    cache.rumors = [];
    changed = true;
  }

  if (cache.yaps.length < yapCount) {
    try {
      console.log(`[CACHE] Generating ${yapCount} yaps for today...`);
      cache.yaps = await generateDailyYaps(yapCount);
      changed = true;
    } catch (err) {
      if (isQuotaError(err)) {
        console.log("[CACHE] Yap Gemini quota hit, using fallback yaps.");
        while (cache.yaps.length < yapCount) {
          cache.yaps.push(...fallbackYaps);
        }
        cache.yaps = cache.yaps.slice(0, yapCount);
        changed = true;
      } else {
        console.error("[CACHE] Yap generation error:", err?.message || String(err));
      }
    }
  }

  if (cache.rumors.length < rumorCount) {
    try {
      console.log(`[CACHE] Generating ${rumorCount} rumors for today...`);
      cache.rumors = await generateDailyRumors(rumorCount);
      changed = true;
    } catch (err) {
      if (isQuotaError(err)) {
        console.log("[CACHE] Rumor Gemini quota hit, using fallback rumors.");
        while (cache.rumors.length < rumorCount) {
          cache.rumors.push(...fallbackRumors);
        }
        cache.rumors = cache.rumors.slice(0, rumorCount);
        changed = true;
      } else {
        console.error("[CACHE] Rumor generation error:", err?.message || String(err));
      }
    }
  }

  if (changed) saveCache(cache);
}

async function takeNextYap() {
  const cache = getCache();
  if (!cache.yaps.length) {
    await ensureDailyCache();
  }

  const updated = getCache();
  const yap = updated.yaps.shift() || fallbackYaps[Math.floor(Math.random() * fallbackYaps.length)];
  saveCache(updated);
  return yap;
}

async function takeNextRumor() {
  const cache = getCache();
  if (!cache.rumors.length) {
    await ensureDailyCache();
  }

  const updated = getCache();
  const rumor =
    updated.rumors.shift() ||
    fallbackRumors[Math.floor(Math.random() * fallbackRumors.length)];

  saveCache(updated);
  return rumor;
}

async function runYap(channelId) {
  try {
    console.log(`[YAP SENT] ${new Date().toISOString()}`);

    const channel = await _client.channels.fetch(channelId).catch(() => null);
    if (!channel) return;

    const yap = await takeNextYap();
    await channel.send(`🗣️ ${yap}`);
  } catch (err) {
    console.error("[Yap loop]", err?.message || String(err));
  }
}

async function runRumors(channelId) {
  try {
    console.log(`[RUMOR SENT] ${new Date().toISOString()}`);

    const channel = await _client.channels.fetch(channelId).catch(() => null);
    if (!channel) return;

    const item = await takeNextRumor();
    const gifUrl = await fetchGifUrl(item.gifQuery);

    const embed = new EmbedBuilder()
      .setColor(0xff6b35)
      .setDescription(item.text)
      .setFooter({ text: "📱 Trending..." })
      .setTimestamp();

    if (gifUrl) embed.setImage(gifUrl);

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[Rumors loop]", err?.message || String(err));
  }
}

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
  ensureDailyCache().catch(() => {});
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
  await ensureDailyCache();
  restoreLoops();
}

module.exports = {
  init,
  setLoop,
  clearLoop,
  getStatus,
};
