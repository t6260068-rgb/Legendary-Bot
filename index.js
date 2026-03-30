const { Client, GatewayIntentBits, Events, Collection, REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");
const loopManager = require("./managers/loopManager");

const PREFIX = "$";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();

const ALIASES = {
  "8ball": "eightball",
};

const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs.readdirSync(commandsPath).filter((f) => f.endsWith(".js"));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (command.data && command.execute) {
    client.commands.set(command.data.name, command);
  }
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
  await loopManager.init(client);

  const rest = new REST().setToken(process.env.DISCORD_TOKEN);
  const commandData = [...client.commands.values()].map((cmd) => cmd.data.toJSON());

  try {
    console.log("Registering slash commands...");
    await rest.put(Routes.applicationCommands(readyClient.user.id), { body: commandData });
    console.log(`Successfully registered ${commandData.length} slash command(s).`);
  } catch (error) {
    console.error("Failed to register commands:", error);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);
    if (command?.autocomplete) {
      try {
        await command.autocomplete(interaction);
      } catch (err) {
        console.error("Autocomplete error:", err);
      }
    }
    return;
  }

  if (interaction.isButton()) {
    if (interaction.customId === "roastback_open") {
      const { buildRoastBackStyleButtons, getBlockedMessage } = require("./commands/roast");

      const blocked = getBlockedMessage(interaction.user.id, interaction.member);
      if (blocked) {
        await interaction.reply({
          content: blocked,
          ephemeral: true,
        });
        return;
      }

      await interaction.reply({
        content: "🔥 Choose your roast-back style:",
        components: [buildRoastBackStyleButtons()],
        ephemeral: true,
      });
      return;
    }

    if (interaction.customId.startsWith("roastback_style_")) {
      const { buildRoastModal, getBlockedMessage } = require("./commands/roast");

      const blocked = getBlockedMessage(interaction.user.id, interaction.member);
      if (blocked) {
        await interaction.reply({
          content: blocked,
          ephemeral: true,
        });
        return;
      }

      const style = interaction.customId.replace("roastback_style_", "");
      await interaction.showModal(buildRoastModal(style));
      return;
    }

    return;
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith("roastback_modal_")) {
      const {
        generateComebackRoast,
        buildRoastBackButton,
        getBlockedMessage,
        recordRoastUse,
      } = require("./commands/roast");

      const blocked = getBlockedMessage(interaction.user.id, interaction.member);
      if (blocked) {
        await interaction.reply({
          content: blocked,
          ephemeral: true,
        });
        return;
      }

      const style = interaction.customId.replace("roastback_modal_", "");
      const userRoast = interaction.fields.getTextInputValue("user_roast");
      const userName = interaction.member?.displayName ?? interaction.user.username;

      await interaction.deferReply();
      recordRoastUse(interaction.user.id, interaction.member);

      try {
        const comeback = await generateComebackRoast(userName, userRoast, style);
        await interaction.editReply({
          content: `🔥 **${interaction.user} said:** *"${userRoast}"*\n\n💀 **Bot fires back (${style}):**\n${comeback}`,
          components: [buildRoastBackButton()],
        });
      } catch (err) {
        console.error("Roast comeback error:", err);
        await interaction.editReply("❌ Couldn't cook up a comeback. Try again.");
      }

      return;
    }

    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Error executing /${interaction.commandName}:`, error);
    const msg = { content: "Something went wrong while running that command.", ephemeral: true };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(msg);
    } else {
      await interaction.reply(msg);
    }
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const rawName = args.shift()?.toLowerCase();
  const commandName = ALIASES[rawName] ?? rawName;

  const command = client.commands.get(commandName);
  if (!command) return;

  try {
    await command.executePrefix(message, args);
  } catch (error) {
    console.error(`Error executing ${PREFIX}${commandName}:`, error);
    await message.reply("Something went wrong while running that command.");
  }
});

client.login(process.env.DISCORD_TOKEN);