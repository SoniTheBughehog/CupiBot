const { EmbedBuilder } = require('discord.js')

module.exports = {
  name: 'help',
  description: 'Affiche la liste des commandes disponibles',
  execute(message) {
    const commands = message.client.commands

    // Catégorie générale
    const generalCmds = commands
      .filter(cmd => !['callnote'].includes(cmd.name))
      .map(cmd => `\`!${cmd.name}\` — ${cmd.description}`)
      .join('\n') || 'Aucune commande'

    // Catégorie callnote avec ses sous-commandes détaillées
    const callnoteHelp = [
      '`!callnote add <qui> <sujet>` — Ajouter un sujet à la liste d’appel',
      '`!callnote list` — Afficher tous les sujets enregistrés',
      '`!callnote del <num>` — Supprimer un sujet par son numéro'
    ].join('\n')

    const embed = new EmbedBuilder()
      .setColor('#00bcd4')
      .setTitle('📖 Liste des commandes')
      .setDescription('Voici les commandes disponibles sur ce bot.')
      .addFields(
        { name: '⚙️ Commandes générales', value: generalCmds, inline: false },
        { name: '📋 Commandes Callnote', value: callnoteHelp, inline: false }
      )
      .setFooter({ text: `Demandé par ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
      .setTimestamp()

    message.channel.send({ embeds: [embed] })
  }
}
