const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'rps',
  description: 'Pierre Feuille Ciseaux (aléatoire)',
  execute(message) {
    const choices = ['✊ Pierre', '✋ Feuille', '✌️ Ciseaux'];
    const botChoice = choices[Math.floor(Math.random() * choices.length)];

    const embed = new EmbedBuilder()
      .setTitle('✊🤚✌️ Pierre Feuille Ciseaux')
      .setDescription(`<@${message.author.id}>, le bot a choisi : **${botChoice}**`)
      .setColor('#9b59b6')
      .setFooter({ text: 'Amuse-toi bien !' })
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  }
};
