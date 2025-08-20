const { EmbedBuilder } = require("discord.js");

module.exports = {
  name: "coin",
  description: "Lancer une pièce",
  execute(message) {
    const result = Math.random() < 0.5 ? "Pile" : "Face";

    const embed = new EmbedBuilder()
      .setTitle("🪙 Pile ou Face")
      .setDescription(`La pièce est tombée sur **${result}** !`)
      .setColor(result === "Pile" ? "#f1c40f" : "#3498db")
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  },
};
