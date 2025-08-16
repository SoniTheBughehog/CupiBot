const { EmbedBuilder } = require('discord.js')

module.exports = {
  name: 'rps',
  description: 'Pierre Feuille Ciseaux (aléatoire)',
  execute(message) {
    const choices = ['✊ Pierre', '✋ Feuille', '✌️ Ciseaux']
    const result = choices[Math.floor(Math.random() * choices.length)]

    const embed = new EmbedBuilder()
      .setTitle('✊🤚✌️ Pierre Feuille Ciseaux')
      .setDescription(`Le bot choisit : **${result}**`)
      .setColor('#9b59b6')
      .setTimestamp()

    message.channel.send({ embeds: [embed] })
  }
}
