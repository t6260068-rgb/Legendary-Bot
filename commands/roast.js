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
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

async function generateRoast(targetName) {
  const prompt = `You are the most savage, brutally honest roast bot. Roast the person named "${targetName}" with an extremely brutal, witty, offensive roast. Use dark humor, insults, destroy their ego. Under 3 sentences. No holding back.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: { maxOutputTokens: 8192 },
  });

  return response.text?.trim() || "I tried to roast you but even words can't describe how disappointing you are.";
}

async function generateComebackRoast(userName, userRoast) {
  const prompt = `You are the most savage roast bot alive. A user named "${userName}" just tried to roast you by saying: "${userRoast}". Now absolutely destroy them with the most vicious, savage comeback roast possible. Use their own words against them, be ruthless, dark, offensive. Under 3 sentences but make every word hit like a sledgehammer. No mercy.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: { maxOutputTokens: 8192 },
  });

  return response.text?.trim() || "Nice try. Unfortunately, your roast was as weak as your entire existence.";
}

function buildRoastBackButton() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("roastback_open")
      .setLabel("🔥 Roast Back")
      .setStyle(ButtonStyle.Danger)
  );
}

function buildRoastModal() {
  return new ModalBuilder()
    .setCustomId("roastback_modal")
    .setTitle("🔥 Roast Back — Show What You Got")
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("user_roast")
          .setLabel("Your Roast")
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder("Type your roast here... make it savage 🔥")
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
    .setDescription("Roast someone savagely with AI 🔥")
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
    const targetName = target.displayName ?? target.username;

    await interaction.deferReply();

    try {
      const roast = await generateRoast(targetName);
      await interaction.editReply({
        content: `🔥 **Roasting ${target}...**\n\n${roast}`,
        components: [buildRoastBackButton()],
      });
    } catch (err) {
      console.error("Roast error:", err);
      await interaction.editReply("❌ Couldn't generate a roast right now. Try again.");
    }
  },

  async executePrefix(message, args) {
    const roastChannel = getRoastChannel(message.guildId);
    if (roastChannel && message.channelId !== roastChannel) {
      return message.reply(`❌ Roasts are only allowed in <#${roastChannel}>. Take it there! 🔥`);
    }

    const target = message.mentions.users.first();
    if (!target) return message.reply("❌ You need to mention someone to roast! Usage: `$roast @user`");
    const targetName = target.displayName ?? target.username;

    const reply = await message.reply("🔥 Cooking up a roast...");

    try {
      const roast = await generateRoast(targetName);
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
  buildRoastModal,
};
