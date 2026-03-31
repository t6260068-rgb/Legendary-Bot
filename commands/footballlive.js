const { SlashCommandBuilder, PermissionsBitField } = require("discord.js");
const sportsLoopManager = require("../managers/sportsLoopManager");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("footballlive")
    .setDescription("Post current live football scores now"),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: "❌ Admin only.", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const result = await sportsLoopManager.postFootballLive(interaction.guildId, true);
      await interaction.editReply(result.posted ? "✅ Posted football live scores." : `ℹ️ ${result.reason}`);
    } catch (err) {
      console.error("footballlive error:", err);
      await interaction.editReply("❌ Couldn't fetch football live scores.");
    }
  },

  async executePrefix(message) {
    await message.reply("Use the slash command: /footballlive");
  },
};