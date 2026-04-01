const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { hasPermission } = require("../utils");

const PUBLIC_COMMANDS = [
  {
    category: "🎮 Fun",
    list: [
      { name: "$joke  /joke", desc: "Get a random joke (no repeats for 72 hours)" },
      { name: "$roll [sides]  /roll [sides]", desc: "Roll a dice — e.g. `$roll 20` (default: 6 sides)" },
      { name: "$coinflip heads/tails  /coinflip", desc: "Flip a coin and guess the result" },
      { name: "$rps rock/paper/scissors  /rps", desc: "Play rock paper scissors vs the bot" },
      { name: "$8ball question  /eightball", desc: "Ask the magic 8-ball a yes/no question" },
      { name: "$meme  /meme", desc: "Get a random meme from Reddit" },
      { name: "$trivia  /trivia", desc: "Get a random trivia question with a hidden answer" },
      { name: "$choose opt1, opt2  /choose", desc: "Let the bot pick — e.g. `$choose Pizza, Burger, Sushi`" },
      { name: "$reverse text  /reverse", desc: "Reverse any text — e.g. `$reverse Hello World`" },
      { name: "$roast [@user]  /roast", desc: "AI-roasts a user with randomized styles 🔥 — click Roast Back to fight back" },
    ],
  },
  {
    category: "🖼️ Info",
    list: [
      { name: "$avatar [@user]  /avatar", desc: "Show your avatar or someone else's" },
      { name: "$serverinfo  /serverinfo", desc: "Show server stats — members, roles, channels, and more" },
      { name: "$userinfo [@user]  /userinfo", desc: "Show info about a user — joined date, roles, and more" },
    ],
  },
  {
    category: "📊 Utility",
    list: [
      { name: '$poll "Question?" ["Opt1"] ["Opt2"]  /poll', desc: "Create a yes/no or multi-option poll" },
      { name: "$remind time message  /remind", desc: "Set a reminder — e.g. `$remind 30m Team meeting`" },
      { name: "$weather city  /weather", desc: "Real-time weather — e.g. `$weather Dubai`" },
      { name: "$quote  /quote", desc: "Get a random inspirational quote" },
      { name: "$define word  /define", desc: "Look up a word's definition — e.g. `$define serendipity`" },
      { name: "$ping  /ping", desc: "Check bot latency (live, updates every 5s)" },
      { name: "$hello  /hello", desc: "Get a greeting from the bot" },
      { name: "$help  /help", desc: "Show this help message" },
    ],
  },
];

const STAFF_COMMANDS = [
  {
    category: "📢 Announcements",
    list: [
      { name: "$announce #channel message  /announce", desc: "Send a message to a specific channel" },
      { name: "$say message  /say", desc: "Make the bot say something in the current channel" },
      { name: "$setroastchannel #channel  /setroastchannel", desc: "Restrict roasts to a specific channel (leave empty to clear)" },
    ],
  },
  {
    category: "🔨 Moderation",
    list: [
      { name: "$kick @user [reason]  /kick", desc: "Kick a member from the server" },
      { name: "$ban @user [reason]  /ban", desc: "Ban a member from the server" },
      { name: "$mute @user 10m [reason]  /mute", desc: "Mute a member — duration: s/m/h/d" },
      { name: "$unmute @user  /unmute", desc: "Remove a member's mute/timeout" },
      { name: "$unban userID [reason]  /unban", desc: "Unban a user by their Discord ID" },
      { name: "$clear amount  /clear", desc: "Bulk delete messages — e.g. `$clear 10`" },
      { name: "$dm @user message  /dm", desc: "Send a private DM to a user" },
    ],
  },
  {
    category: "⚽🏏 Sports Admin",
    list: [
      { name: "$setfootballchannel #channel  /setfootballchannel", desc: "Set and lock the football live score channel" },
      { name: "$setcricketchannel #channel  /setcricketchannel", desc: "Set and lock the cricket live score channel" },
      { name: "$unlockfootballchannel  /unlockfootballchannel", desc: "Unlock football channel so you can change it again" },
      { name: "$unlockcricketchannel  /unlockcricketchannel", desc: "Unlock cricket channel so you can change it again" },
      { name: "$footballlive  /footballlive", desc: "Update the football live scoreboard now" },
      { name: "$cricketlive  /cricketlive", desc: "Update the cricket live scoreboard now" },
      { name: "$footballauto on/off  /footballauto", desc: "Turn football auto live updates on or off" },
      { name: "$cricketauto on/off  /cricketauto", desc: "Turn cricket auto live updates on or off" },
    ],
  },
  {
    category: "📨 Auto Message Admin",
    list: [
      { name: "$setautomessage  /setautomessage", desc: "Set a message that auto-sends every 12 hours in a chosen channel" },
      { name: "$stopautomessage  /stopautomessage", desc: "Stop the 12-hour auto message system" },
    ],
  },
  {
    category: "💰 Prediction Admin",
    list: [
      { name: "$startprediction  /startprediction", desc: "Start a prediction with 2 options and fake points" },
      { name: "$closeprediction  /closeprediction", desc: "Close the active prediction and award points to winners" },
      { name: "$predictionleaderboard  /predictionleaderboard", desc: "Show the top prediction points leaderboard" },
    ],
  },
];

function buildEmbed(isStaff) {
  const categories = isStaff ? [...PUBLIC_COMMANDS, ...STAFF_COMMANDS] : PUBLIC_COMMANDS;

  const embed = new EmbedBuilder()
    .setTitle("📖 Bot Commands")
    .setColor(0x5865f2)
    .setDescription("Commands work with both `$` prefix and `/` slash.");

  if (isStaff) {
    embed.setFooter({ text: "You have staff access — all commands are visible" });
  } else {
    embed.setFooter({ text: "Staff-only commands are hidden" });
  }

  for (const category of categories) {
    embed.addFields({
      name: category.category,
      value: category.list
        .map((cmd) => `\`${cmd.name}\`\n↳ ${cmd.desc}`)
        .join("\n\n"),
    });
  }

  return embed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show all available commands"),

  async execute(interaction) {
    const isStaff = hasPermission(interaction.member);
    await interaction.reply({ embeds: [buildEmbed(isStaff)], ephemeral: true });
  },

  async executePrefix(message) {
    const isStaff = hasPermission(message.member);
    await message.reply({ embeds: [buildEmbed(isStaff)] });
  },
};
