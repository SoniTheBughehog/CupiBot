const { EmbedBuilder } = require('discord.js')

module.exports = {
  name: 'dice',
  description: 'Lancer un dé (1 à 6)',
  execute(message) {
    const roll = Math.floor(Math.random() * 6) + 1

    const embed = new EmbedBuilder()
      .setTitle('🎲 Lancer de dé')
      .setDescription(`Tu as obtenu **${roll}** !`)
      .setColor('#e67e22')
      .setFooter({ text: '1 chance sur 6 👀' })
      .setTimestamp()

    message.channel.send({ embeds: [embed] })
  }
}
