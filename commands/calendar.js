const fs = require('fs')
const path = require('path')
const { EmbedBuilder } = require('discord.js')

const filePath = path.join(__dirname, '..', 'data', 'calendar.json')

function readCalendar() {
  if (!fs.existsSync(filePath)) return []
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function saveCalendar(data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
}

function parseDate(dateStr) {
  const [day, month, year] = dateStr.split('/').map(Number)
  if (!day || !month || !year) return null
  return new Date(year, month - 1, day)
}

function getCalendarEmbed(calendar) {
    const embed = new EmbedBuilder()
        .setTitle('📅 Calendrier')
        .setColor('#03a9f4')

    if (calendar.length === 0) {
        embed.setDescription('Aucune date enregistrée. Ajoute-en avec `!calendar add JJ/MM/YYYY raison`')
    } else if (calendar.length === 1) {
        const entry = calendar[0]
        const date = new Date(entry.date)
        embed.setDescription(`**Date :** ${date.toLocaleDateString()}\n**Raison :** ${entry.reason}\n**Décompte :** ${formatCountdown(date)}`)
    } else {
        embed.setDescription(
            calendar.map((entry, i) => {
                const date = new Date(entry.date)
                return `**${i + 1}.** ${date.toLocaleDateString()} → ${entry.reason} (_${formatCountdown(date)} restants_)`
            }).join('\n')
        )
    }
    return embed
}

function formatCountdown(target) {
  const now = new Date()
  const diffMs = target - now
  if (diffMs < 0) return null
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const diffHours = Math.floor((diffMs / (1000 * 60 * 60)) % 24)
  const diffMinutes = Math.floor((diffMs / (1000 * 60)) % 60)
  return `${diffDays}j ${diffHours}h ${diffMinutes}m`
}

module.exports = {
  name: 'calendar',
  description: 'Gérer un calendrier avec décompte',
  readCalendar,
  saveCalendar,
  formatCountdown,
  execute(message, args) {
    const calendar = readCalendar()

    if (args.length === 0) {
      const embed = new EmbedBuilder()
        .setTitle('📅 Calendrier')
        .setColor('#03a9f4')

      if (calendar.length === 0) {
        embed.setDescription('Aucune date enregistrée. Ajoute-en avec `!calendar add JJ/MM/YYYY raison`')
      } else if (calendar.length === 1) {
        const entry = calendar[0]
        const date = new Date(entry.date)
        embed.setDescription(`**Date :** ${date.toLocaleDateString()}\n**Raison :** ${entry.reason}\n**Décompte :** ${formatCountdown(date)}`)
      } else {
        embed.setDescription(
          calendar.map((entry, i) => {
            const date = new Date(entry.date)
            return `**${i + 1}.** ${date.toLocaleDateString()} → ${entry.reason} (_${formatCountdown(date)} restants_)`
          }).join('\n')
        )
      }

      return message.channel.send({ embeds: [embed] })
    }

    const sub = args.shift().toLowerCase()

    if (sub === 'add') {
      const dateStr = args.shift()
      const reason = args.join(' ')
      if (!dateStr || !reason) return message.channel.send('❌ Usage : `!calendar add JJ/MM/YYYY raison`')

      const date = parseDate(dateStr)
      if (!date || isNaN(date.getTime())) return message.channel.send('❌ Date invalide. Utilise le format JJ/MM/YYYY.')

      calendar.push({ date: date.toISOString(), reason, addedBy: message.author.tag })
      saveCalendar(calendar)

      const embed = new EmbedBuilder()
        .setTitle('✅ Date ajoutée')
        .setColor('#4caf50')
        .setDescription(`**Date :** ${date.toLocaleDateString()}\n**Raison :** ${reason}`)
        .setFooter({ text: `Ajouté par ${message.author.tag}` })
        .setTimestamp()

      return message.channel.send({ embeds: [embed] })
    }

    if (sub === 'del') {
      const num = parseInt(args[0])
      if (isNaN(num) || num < 1 || num > calendar.length) return message.channel.send('❌ Numéro invalide. Vérifie la liste avec `!calendar`.')

      const removed = calendar.splice(num - 1, 1)
      saveCalendar(calendar)

      const embed = new EmbedBuilder()
        .setTitle('🗑️ Date supprimée')
        .setColor('#f44336')
        .setDescription(`**Date :** ${new Date(removed[0].date).toLocaleDateString()}\n**Raison :** ${removed[0].reason}`)
        .setFooter({ text: `Supprimé par ${message.author.tag}` })
        .setTimestamp()

      return message.channel.send({ embeds: [embed] })
    }

    if (sub === 'list'){
        const embed = getCalendarEmbed(calendar)
        return message.channel.send({ embeds: [embed] })
    }

    return message.channel.send('❌ Commande inconnue. Sous-commandes : add | del')
  }
}
