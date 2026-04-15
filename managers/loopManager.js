const { GoogleGenAI } = require("@google/genai");
const { EmbedBuilder } = require("discord.js");

const LoopConfig = require("../models/LoopConfig");
const AiCache = require("../models/AiCache");

const TENOR_KEY = "LIVDSRZULELA";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const activeIntervals = {};
let _client = null;

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
});

const generationLocks = {
  yaps: null,
  rumors: null,
};

const fallbackYaps = [
  "I tried being productive today but my brain opened one tab, forgot the mission, and started free roaming like an NPC with no quest marker and zero survival instincts.",
  "Some of y’all say 'quick question' and then drop a side quest so long it needs lore, three plot twists, and a post-credit scene before anyone understands the assignment.",
  "Time moves differently when I’m doing something boring because five minutes feels like a whole documentary, but scrolling memes erases an hour like black magic with premium lag.",
  "The wildest part of life is pretending we all know what we’re doing when half the population is just guessing confidently and hoping nobody asks follow-up questions.",
  "Lowkey respect to people who wake up early, drink water, and have a plan because my morning routine is confusion, delayed reactions, and negotiating with my own existence.",
  "If overthinking burned calories I’d be the strongest person alive because my brain turns one awkward moment into a full cinematic universe with unnecessary sequels.",
  "It’s honestly impressive how I can be tired before doing anything, hungry right after eating, and confused in conversations I personally started with full confidence.",
  "Nobody talks enough about how weird mirrors are because society accepted free self-viewing portals and moved on like that isn’t one of reality’s strangest features.",
];

const fallbackRumors = [
  {
    text: "🚨 BREAKING: A celebrity allegedly got into an argument with a self-checkout machine after it rejected the same avocado three times. Source: my cousin’s friend.",
    gifQuery: "shocked reaction",
  },
  {
    text: "😱 Rumor says a tech CEO forgot their own password, blamed the interns, then posted a motivational thread about leadership ten minutes later. Source: dramatic tweets.",
    gifQuery: "facepalm reaction",
  },
  {
    text: "🔥 Reports claim a singer vanished from the group chat for three months, came back with 'my bad,' then immediately asked who took the charger. Source: trust me bro.",
    gifQuery: "awkward reaction",
  },
  {
    text: "👀 A sports star was apparently late to practice because they were rewatching their own highlights and calling it film study. Source: suspiciously confident vibes.",
    gifQuery: "mind blown",
  },
  {
    text: "🚨 Allegedly, an influencer cried because their iced coffee had too much ice, then called it emotional sabotage in a seven-part story. Source: social detectives.",
    gifQuery: "dramatic crying",
  },
];

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function isQuotaOrBusyError(err) {
  const msg = err?.message || String(err);
  return (
    msg.includes("429") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("503") ||
    msg.includes("UNAVAILABLE") ||
    msg.includes("high demand")
  );
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
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

async function ensureGuildDoc(guildId) {
  let doc = await LoopConfig.findOne({ guildId });

  if (!doc) {
    doc = await LoopConfig.create({
      guildId,
      yap: {
        channelId: null,
        intervalMs: 1800000,
        active: false,
      },
      rumors: {
        channelId: null,
        intervalMs: 3600000,
        active: false,
      },
    });
  }

  return doc;
}

async function calculateDailyNeeds() {
  const configs = await LoopConfig.find({
    $or: [{ "yap.active": true }, { "rumors.active": true }],
  });

  let yapCount = 0;
  let rumorCount = 0;

  for (const cfg of configs) {
    if (cfg.yap?.active && cfg.yap?.intervalMs) {
      yapCount += Math.ceil(ONE_DAY_MS / Number(cfg.yap.intervalMs));
    }

    if (cfg.rumors?.active && cfg.rumors?.intervalMs) {
      rumorCount += Math.ceil(ONE_DAY_MS / Number(cfg.rumors.intervalMs));
    }
  }

  return {
    yapCount: Math.max(yapCount, 8),
    rumorCount: Math.max(rumorCount, 6),
  };
}

async function getOrCreateTodayCache() {
  const dateKey = getTodayKey();

  let cache = await AiCache.findOne({ dateKey });
  if (!cache) {
    cache = await AiCache.create({
      dateKey,
      yaps: [],
      rumors: [],
    });
  }

  return cache;
}

async function generateDailyYaps(count) {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `
Generate exactly ${count} separate Discord messages.

Randomize the style across these categories:
- funny
- deep
- chaotic
- brainrot
- shower-thought
- terminally-online

Rules:
- each message should be around 25 to 35 words
- each message must stay under 240 characters if possible
- no hashtags
- no numbering
- no intro text
- one message per line only
- casual Discord tone
- make them very varied
- do not repeat the same joke structure
- mix the styles randomly
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

async function ensureYapsForToday(targetCount) {
  if (generationLocks.yaps) return generationLocks.yaps;

  generationLocks.yaps = (async () => {
    const cache = await getOrCreateTodayCache();
    if (cache.yaps.length >= targetCount) return;

    console.log(`[CACHE] Generating ${targetCount} yaps for today...`);

    try {
      const items = await generateDailyYaps(targetCount);
      cache.yaps = items.length ? items : [...fallbackYaps];
      while (cache.yaps.length < targetCount) {
        cache.yaps.push(...fallbackYaps);
      }
      cache.yaps = cache.yaps.slice(0, targetCount);
      await cache.save();
    } catch (err) {
      console.error("[CACHE] Yap generation error:", err.message || String(err));

      if (isQuotaOrBusyError(err)) {
        console.log("[CACHE] Yap fallback mode active.");
        cache.yaps = [];
        while (cache.yaps.length < targetCount) {
          cache.yaps.push(...fallbackYaps);
        }
        cache.yaps = cache.yaps.slice(0, targetCount);
        await cache.save();
      } else {
        throw err;
      }
    }
  })();

  try {
    await generationLocks.yaps;
  } finally {
    generationLocks.yaps = null;
  }
}

async function ensureRumorsForToday(targetCount) {
  if (generationLocks.rumors) return generationLocks.rumors;

  generationLocks.rumors = (async () => {
    const cache = await getOrCreateTodayCache();
    if (cache.rumors.length >= targetCount) return;

    console.log(`[CACHE] Generating ${targetCount} rumors for today...`);

    try {
      const items = await generateDailyRumors(targetCount);
      cache.rumors = items.length ? items : [...fallbackRumors];
      while (cache.rumors.length < targetCount) {
        cache.rumors.push(...fallbackRumors);
      }
      cache.rumors = cache.rumors.slice(0, targetCount);
      await cache.save();
    } catch (err) {
      console.error("[CACHE] Rumor generation error:", err.message || String(err));

      if (isQuotaOrBusyError(err)) {
        console.log("[CACHE] Rumor fallback mode active.");
        cache.rumors = [];
        while (cache.rumors.length < targetCount) {
          cache.rumors.push(...fallbackRumors);
        }
        cache.rumors = cache.rumors.slice(0, targetCount);
        await cache.save();
      } else {
        throw err;
      }
    }
  })();

  try {
    await generationLocks.rumors;
  } finally {
    generationLocks.rumors = null;
  }
}

async function ensureDailyCache() {
  const { yapCount, rumorCount } = await calculateDailyNeeds();
  await ensureYapsForToday(yapCount);
  await ensureRumorsForToday(rumorCount);
}

async function takeNextYap() {
  await ensureDailyCache();

  const cache = await getOrCreateTodayCache();

  if (!cache.yaps.length) {
    return randomItem(fallbackYaps);
  }

  const yap = cache.yaps.shift();
  await cache.save();

  return yap;
}

async function takeNextRumor() {
  await ensureDailyCache();

  const cache = await getOrCreateTodayCache();

  if (!cache.rumors.length) {
    return randomItem(fallbackRumors);
  }

  const rumor = cache.rumors.shift();
  await cache.save();

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
    console.error("[Yap loop]", err.message || String(err));
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
    console.error("[Rumors loop]", err.message || String(err));
  }
}

function stopLoop(guildId, type) {
  if (activeIntervals[guildId]?.[type]) {
    clearInterval(activeIntervals[guildId][type]);
    delete activeIntervals[guildId][type];
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

  runner(channelId).catch((err) => console.error(`[${type} immediate run]`, err.message));

  activeIntervals[guildId][type] = setInterval(() => {
    console.log(`[LOOP TRIGGER] ${type}`);
    runner(channelId).catch((err) => console.error(`[${type} interval run]`, err.message));
  }, intervalMs);
}

async function setLoop(guildId, type, channelId, intervalMs) {
  const cfg = await ensureGuildDoc(guildId);

  cfg[type] = {
    channelId,
    intervalMs: Number(intervalMs),
    active: true,
  };

  await cfg.save();

  await ensureDailyCache();
  startLoop(guildId, type, channelId, Number(intervalMs));
}

async function clearLoop(guildId, type) {
  const cfg = await ensureGuildDoc(guildId);

  cfg[type].active = false;
  await cfg.save();

  stopLoop(guildId, type);
}

async function getStatus(guildId, type) {
  const cfg = await ensureGuildDoc(guildId);
  return cfg[type] || null;
}

async function restoreLoops() {
  const configs = await LoopConfig.find({
    $or: [{ "yap.active": true }, { "rumors.active": true }],
  });

  for (const cfg of configs) {
    const guildId = cfg.guildId;

    if (cfg.yap?.active && cfg.yap?.channelId) {
      console.log(`[RESTORE] yap loop`);
      startLoop(guildId, "yap", cfg.yap.channelId, Number(cfg.yap.intervalMs));
    }

    if (cfg.rumors?.active && cfg.rumors?.channelId) {
      console.log(`[RESTORE] rumors loop`);
      startLoop(guildId, "rumors", cfg.rumors.channelId, Number(cfg.rumors.intervalMs));
    }
  }
}

async function init(discordClient) {
  _client = discordClient;

  await ensureDailyCache();
  await restoreLoops();
}

module.exports = {
  init,
  setLoop,
  clearLoop,
  getStatus,
};
