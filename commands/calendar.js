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

function formatDate(date) {
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
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

function getCalendarEmbed(calendar) {
  const embed = new EmbedBuilder()
    .setTitle('📅 Calendrier')
    .setColor('#03a9f4')

  if (calendar.length === 0) {
    embed.setDescription('Aucune date enregistrée. Ajoute-en avec `!calendar add JJ/MM/YYYY raison`')
  } else {
    embed.setDescription(
      calendar.map((entry, i) => {
        const date = new Date(entry.date)
        const countdown = formatCountdown(date)
        const today = new Date()
        const isToday =
          date.getDate() === today.getDate() &&
          date.getMonth() === today.getMonth() &&
          date.getFullYear() === today.getFullYear()

        if (isToday) {
          return `🎉 **${i + 1}. AUJOURD'HUI : ${formatDate(date)} → ${entry.reason.toUpperCase()} !!!** 🎉`
        }

        return `**${i + 1}.** ${formatDate(date)} → ${entry.reason}` +
          (countdown ? ` (_${countdown} restants_)` : ' _(date passée, sera supprimée la prochaine fois)_')
      }).join('\n')
    )
  }
  return embed
}

module.exports = {
  name: 'calendar',
  description: 'Gérer un calendrier avec décompte',
  readCalendar,
  saveCalendar,
  formatCountdown,
  parseDate,
  formatDate,
  getCalendarEmbed,

  // Fonction utilitaire réutilisable ailleurs
  listCalendar: () => {
    const calendar = readCalendar()

    // suppression auto des dates déjà passées
    const now = new Date()
    const updated = calendar.filter(entry => new Date(entry.date) >= now)
    if (updated.length !== calendar.length) saveCalendar(updated)

    return getCalendarEmbed(updated)
  },

  execute(message, args) {
    let calendar = readCalendar()
    const now = new Date()

    // Suppression auto des dates passées
    calendar = calendar.filter(entry => new Date(entry.date) >= now)
    saveCalendar(calendar)

    if (args.length === 0) {
      const embed = getCalendarEmbed(calendar)
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
        .setDescription(`**Date :** ${formatDate(date)}\n**Raison :** ${reason}`)
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
        .setDescription(`**Date :** ${formatDate(new Date(removed[0].date))}\n**Raison :** ${removed[0].reason}`)
        .setFooter({ text: `Supprimé par ${message.author.tag}` })
        .setTimestamp()

      return message.channel.send({ embeds: [embed] })
    }

    if (sub === 'list') {
      const embed = getCalendarEmbed(calendar)
      return message.channel.send({ embeds: [embed] })
    }

    return message.channel.send('❌ Commande inconnue. Sous-commandes : add | del | list')
  }
}
