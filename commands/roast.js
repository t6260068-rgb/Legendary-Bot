const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const { GoogleGenAI } = require("@google/genai");
const fs = require("fs");
const path = require("path");

const CONFIG_PATH = path.join(__dirname, "../data/roast-config.json");

function getConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return {};
  }
}

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
});

const STYLE_PROMPTS = {
  soft: `
Style: light teasing, playful, friendly, still funny.
Rules:
- Keep it under 3 short sentences.
- Make it witty, not too harsh.
- No slurs.
- No threats.
- No hate speech.
- No overuse of words like "pathetic", "loser", "cringe".
- Use light meme energy if it fits.
`,
  savage: `
Style: savage, sharp, smug, group-chat roast energy.
Rules:
- Keep it under 3 short sentences.
- Be brutal but still playful-chaotic.
- No slurs.
- No threats.
- No hate speech.
- Do NOT overuse words like "pathetic", "loser", "cringe", "embarrassing".
- Can use internet slang like "L", "cooked", "bro", "skill issue", "NPC", "touch grass".
`,
  nuclear: `
Style: nuclear meme roast, dramatic, chaotic, internet-heavy.
Rules:
- Keep it under 3 short sentences.
- Make it hit hard with meme / internet energy.
- No slurs.
- No threats.
- No hate speech.
- Do NOT overuse words like "pathetic", "loser", "cringe", "embarrassing".
- Can use slang like "L", "cooked", "delulu", "bro", "skill issue", "NPC", "touch grass", "SYBAU".
`,
  unhinged: `
Style: unhinged, chaotic, absurdly overconfident, terminally online.
Rules:
- Keep it under 3 short sentences.
- Make it wild and creative.
- No slurs.
- No threats.
- No hate speech.
- Do NOT overuse words like "pathetic", "loser", "cringe", "embarrassing".
- Can use slang like "L", "cooked", "delulu", "bro", "skill issue", "NPC", "touch grass", "SYBAU".
`,
};

function normalizeStyle(style) {
  return ["soft", "savage", "nuclear", "unhinged"].includes(style) ? style : "savage";
}

function buildRoastPrompt(targetName, style = "savage") {
  style = normalizeStyle(style);

  return `
You are a Discord roast bot.

Roast the person named "${targetName}".

${STYLE_PROMPTS[style]}

Output:
- Just the roast.
- No intro.
- No explanation.
`;
}

function buildComebackPrompt(userName, userRoast, style = "savage") {
  style = normalizeStyle(style);

  return `
You are a Discord roast bot.

A user named "${userName}" tried roasting you with:
"${userRoast}"

Now reply with a comeback roast in this style:

${STYLE_PROMPTS[style]}

Output:
- Just the comeback roast.
- No intro.
- No explanation.
`;
}

async function generateRoast(targetName, style = "savage") {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: buildRoastPrompt(targetName, style),
    config: { maxOutputTokens: 300 },
  });

  return response.text?.trim() || "Bro got roasted so hard the Wi-Fi lagged.";
}

async function generateComebackRoast(userName, userRoast, style = "savage") {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: buildComebackPrompt(userName, userRoast, style),
    config: { maxOutputTokens: 300 },
  });

  return response.text?.trim() || "That roast was so weak it needed life support.";
}

function buildRoastBackButton() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("roastback_open")
      .setLabel("🔥 Roast Back")
      .setStyle(ButtonStyle.Danger)
  );
}

function buildRoastBackStyleButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("roastback_style_soft")
      .setLabel("Soft")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("roastback_style_savage")
      .setLabel("Savage")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("roastback_style_nuclear")
      .setLabel("Nuclear Meme Roast")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("roastback_style_unhinged")
      .setLabel("Unhinged")
      .setStyle(ButtonStyle.Success)
  );
}

function buildRoastModal(style = "savage") {
  style = normalizeStyle(style);

  return new ModalBuilder()
    .setCustomId(`roastback_modal_${style}`)
    .setTitle(`🔥 Roast Back — ${style.toUpperCase()}`)
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("user_roast")
          .setLabel("Your Roast")
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder("Type your roast here...")
          .setRequired(true)
          .setMaxLength(500)
      )
    );
}

function getRoastChannel(guildId) {
  const config = getConfig();
  return config[guildId]?.roastChannel || null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("roast")
    .setDescription("Roast someone with AI 🔥")
    .addUserOption((opt) =>
      opt.setName("user").setDescription("The person to roast").setRequired(true)
    ),

  async execute(interaction) {
    const roastChannel = getRoastChannel(interaction.guildId);
    if (roastChannel && interaction.channelId !== roastChannel) {
      return interaction.reply({
        content: `❌ Roasts are only allowed in <#${roastChannel}>. Take it there! 🔥`,
        ephemeral: true,
      });
    }

    const target = interaction.options.getUser("user");
    const targetName = target.globalName ?? target.username;

    await interaction.deferReply();

    try {
      const roast = await generateRoast(targetName, "savage");
      await interaction.editReply({
        content: `🔥 **Roasting ${target}...**\n\n${roast}`,
        components: [buildRoastBackButton()],
      });
    } catch (err) {
      console.error("Roast error:", err);
      await interaction.editReply("❌ Couldn't generate a roast right now. Try again.");
    }
  },

  async executePrefix(message) {
    const roastChannel = getRoastChannel(message.guildId);
    if (roastChannel && message.channelId !== roastChannel) {
      return message.reply(`❌ Roasts are only allowed in <#${roastChannel}>. Take it there! 🔥`);
    }

    const target = message.mentions.users.first();
    if (!target) {
      return message.reply("❌ You need to mention someone to roast! Usage: `$roast @user`");
    }

    const targetName = target.globalName ?? target.username;

    const reply = await message.reply("🔥 Cooking up a roast...");

    try {
      const roast = await generateRoast(targetName, "savage");
      await reply.edit({
        content: `🔥 **Roasting ${target}...**\n\n${roast}`,
        components: [buildRoastBackButton()],
      });
    } catch (err) {
      console.error("Roast error:", err);
      await reply.edit("❌ Couldn't generate a roast right now. Try again.");
    }
  },

  generateComebackRoast,
  buildRoastBackButton,
  buildRoastBackStyleButtons,
  buildRoastModal,
};
