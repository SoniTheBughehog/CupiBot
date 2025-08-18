const { EmbedBuilder } = require('discord.js')

module.exports = {
  name: 'aide',
  description: 'Affiche la liste des commandes disponibles',
  execute(message) {
    const commands = message.client.commands

    // Commandes générales (toutes sauf celles avec sous-commandes spécifiques)
    const generalCmds = commands
      .filter(cmd => !['callnote', 'note', 'memory', 'puissance4'].includes(cmd.name))
      .map(cmd => `\`!${cmd.name}\` — ${cmd.description}`)
      .join('\n') || 'Aucune commande'

    // Commandes Callnote
    const callnoteHelp = [
      '`!callnote add <qui> <sujet>` — Ajouter un sujet à la liste d’appel',
      '`!callnote list` — Afficher tous les sujets enregistrés',
      '`!callnote del <num>` — Supprimer un sujet par son numéro'
    ].join('\n')

    // Commandes Note
    const noteHelp = [
      '`!note add <texte>` — Ajouter une note personnelle',
      '`!note list` — Afficher tes notes',
      '`!note del <num>` — Supprimer une note',
      '`!note setchannel` — Définir le salon des rappels automatiques'
    ].join('\n')

    // Commandes Calendar
    const calendarHelp = [
      '`!calendar add <date> <event>` — Ajouter un événement au calendrier',
      '`!calendar list` — Afficher les événements à venir',
      '`!calendar del <num>` — Supprimer un événement',
    ].join('\n')

    // Commandes Memory
    const memoryHelp = [
      '`!memory add <texte>` — Ajouter un souvenir',
      '`!memory list` — Lister tes souvenirs',
      '`!memory del <num>` — Supprimer un souvenir'
    ].join('\n')

    // Commandes Puissance4
    const p4Help = [
      '`!puissance4 start` — Commencer une partie',
      '`!puissance4 <1-7>` — Placer un pion dans la colonne',
      '`!puissance4 board` — Afficher le plateau de jeu',
      '`!puissance4 reset` — Réinitialiser la partie'
    ].join('\n')

    const embed = new EmbedBuilder()
      .setColor('#00bcd4')
      .setTitle('📖 Liste des commandes')
      .setDescription('Voici les commandes disponibles sur ce bot.')
      .addFields(
        { name: '⚙️ Commandes générales', value: generalCmds, inline: false },
        { name: '📋 Commandes Callnote', value: callnoteHelp, inline: false },
        { name: '📝 Commandes Note', value: noteHelp, inline: false },
        { name: '💭 Commandes Memory', value: memoryHelp, inline: false },
        { name: '📅 Commandes Calendar', value: calendarHelp, inline: false },
        { name: '🎮 Commandes Puissance4', value: p4Help, inline: false }
      )
      .setFooter({ text: `Demandé par ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
      .setTimestamp()

    message.channel.send({ embeds: [embed] })
  }
}
