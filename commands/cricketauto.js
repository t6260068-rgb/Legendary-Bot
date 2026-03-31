const { SlashCommandBuilder, PermissionsBitField } = require("discord.js");
const sportsLoopManager = require("../managers/sportsLoopManager");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("cricketauto")
    .setDescription("Turn cricket auto live posting on or off")
    .addStringOption((opt) =>
      opt
        .setName("state")
        .setDescription("on or off")
        .setRequired(true)
        .addChoices(
          { name: "on", value: "on" },
          { name: "off", value: "off" }
        )
    ),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: "❌ Admin only.", ephemeral: true });
    }

    const state = interaction.options.getString("state");
    sportsLoopManager.setAuto(interaction.guildId, "cricket", state === "on");
    sportsLoopManager.refreshGuildLoops(interaction.guildId);

    await interaction.reply(`✅ Cricket auto updates turned **${state}**.`);
  },

  async executePrefix(message) {
    await message.reply("Use the slash command: /cricketauto");
  },
};