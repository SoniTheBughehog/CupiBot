const { EmbedBuilder } = require('discord.js')

module.exports = {
  name: 'cuddle',
  description: 'Envoie un câlin virtuel à quelqu’un',
  execute(message, args) {
    if (args.length === 0) return message.channel.send('Usage: !cuddle @utilisateur')

    const user = message.mentions.users.first()
    if (!user) return message.channel.send('❌ Mentionne quelqu’un pour lui envoyer un câlin.')

    const embed = new EmbedBuilder()
      .setColor('#ff69b4')
      .setTitle('🤗 Câlin virtuel !')
      .setDescription(`${message.author.username} envoie un gros câlin à ${user.username} !`)
      .setTimestamp()

    message.channel.send({ embeds: [embed] })
  }
}
