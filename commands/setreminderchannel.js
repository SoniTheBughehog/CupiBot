const fs = require("fs");
const path = require("path");

const configPath = path.join(__dirname, "..", "config.json");

module.exports = {
  name: "setreminderchannel",
  description: "Définir le salon pour les rappels automatiques",
  execute(message) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

    config.reminderChannelId = message.channel.id;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    message.channel.send(
      `✅ Salon des rappels défini sur **#${message.channel.name}**`,
    );
  },
};
