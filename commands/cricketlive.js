const { SlashCommandBuilder, PermissionsBitField } = require("discord.js");
const sportsLoopManager = require("../managers/sportsLoopManager");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("cricketlive")
    .setDescription("Post current live cricket scores now"),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: "❌ Admin only.", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const result = await sportsLoopManager.postCricketLive(interaction.guildId, true);
      await interaction.editReply(result.posted ? "✅ Posted cricket live scores." : `ℹ️ ${result.reason}`);
    } catch (err) {
      console.error("cricketlive error:", err);
      await interaction.editReply("❌ Couldn't fetch cricket live scores.");
    }
  },

  async executePrefix(message) {
    await message.reply("Use the slash command: /cricketlive");
  },
};