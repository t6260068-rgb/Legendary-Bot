const { SlashCommandBuilder, PermissionsBitField, ChannelType } = require("discord.js");
const sportsLoopManager = require("../managers/sportsLoopManager");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setfootballchannel")
    .setDescription("Set the football live score channel")
    .addChannelOption((opt) =>
      opt
        .setName("channel")
        .setDescription("Channel for football live scores")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: "❌ Admin only.", ephemeral: true });
    }

    const channel = interaction.options.getChannel("channel");
    sportsLoopManager.setChannel(interaction.guildId, "football", channel.id);
    sportsLoopManager.refreshGuildLoops(interaction.guildId);

    await interaction.reply(`✅ Football live score channel set to ${channel}`);
  },

  async executePrefix(message) {
    await message.reply("Use the slash command: /setfootballchannel");
  },
};