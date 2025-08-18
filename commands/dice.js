const { EmbedBuilder } = require('discord.js');

function createEmbed({ title, description, color = 0xe67e22, footer, timestamp = true }) {
  const embed = new EmbedBuilder().setTitle(title).setColor(color);
  if (description) embed.setDescription(description);
  if (footer) embed.setFooter({ text: footer });
  if (timestamp) embed.setTimestamp();
  return embed;
}

module.exports = {
  name: 'dice',
  description: 'Lancer un dé (1 à 6)',
  execute(message) {
    const roll = Math.floor(Math.random() * 6) + 1;

    const embed = createEmbed({
      title: '🎲 Lancer de dé',
      description: `Tu as obtenu **${roll}** !`,
      footer: '1 chance sur 6 👀'
    });

    message.channel.send({ embeds: [embed] });
  }
};
