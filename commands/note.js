const fs = require('fs')
const path = require('path')
const { EmbedBuilder } = require('discord.js')

const filePath = path.join(__dirname, '..', 'data', 'note.json')

// --- Lecture / écriture ---
function readData() {
  if (!fs.existsSync(filePath)) return {}
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return {}
  }
}

function saveData(data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
}

// --- Embeds ---
function createEmbed({ title, description, color = '#2196f3', error = false, footer }) {
  const embed = new EmbedBuilder()
    .setTitle(error ? `❌ ${title}` : title)
    .setDescription(description)
    .setColor(error ? '#ff0000' : color)
    .setTimestamp()
  if (footer) embed.setFooter({ text: footer })
  return embed
}

// --- Liste des notes ---
function notesListEmbed(user, notes) {
  if (!notes || notes.length === 0) {
    return createEmbed({
      title: '📭 Aucune note',
      description: 'Ta liste est vide pour l’instant.',
      color: '#808080'
    })
  }

  if (notes.length === 1) {
    return createEmbed({
      title: `📋 Note unique de ${user.username}`,
      description: notes[0].sujet,
      color: '#2196f3',
      footer: '1 note'
    })
  }

  return createEmbed({
    title: `📋 Tes notes (${user.username})`,
    description: notes.map((n, i) => `**${i + 1}.** ${n.sujet}`).join('\n'),
    color: '#2196f3',
    footer: `Total : ${notes.length} notes`
  })
}

// --- Commande Discord ---
module.exports = {
  name: 'note',
  description: 'Gère ta liste personnelle de notes',
  
  execute(message, args) {
    const userId = message.author.id
    const data = readData()
    if (!data[userId]) data[userId] = { channelId: null, notes: [] }
    const userData = data[userId]

    if (!args.length) {
      return message.channel.send({
        content: `<@${userId}>`, // vrai ping
        embeds: [notesListEmbed(message.author, userData.notes)]
      })
    }

    const sub = args.shift().toLowerCase()

    switch (sub) {
      case 'add': {
        const sujet = args.join(' ').trim()
        if (!sujet) {
          return message.channel.send({
            embeds: [createEmbed({ title: 'Sujet manquant', description: 'Usage : `!note add <sujet>`', error: true })]
          })
        }
        userData.notes.push({ sujet, addedBy: message.author.tag })
        saveData(data)
        return message.channel.send({
          embeds: [createEmbed({
            title: 'Note ajoutée 📌',
            description: `**${sujet}**\n\nAjoutée par *${message.author.tag}*`,
            color: '#4caf50'
          })]
        })
      }

      case 'list':
        return message.channel.send({
          content: `<@${userId}>`, // vrai ping
          embeds: [notesListEmbed(message.author, userData.notes)]
        })

      case 'del': {
        const num = parseInt(args[0], 10)
        if (isNaN(num) || num < 1 || num > userData.notes.length) {
          return message.channel.send({
            embeds: [createEmbed({ title: 'Numéro invalide', description: `Choisis un numéro entre 1 et ${userData.notes.length}.`, error: true })]
          })
        }
        const [removed] = userData.notes.splice(num - 1, 1)
        saveData(data)
        return message.channel.send({
          embeds: [createEmbed({ title: '🗑️ Note supprimée', description: `**${removed.sujet}** a été retirée de ta liste.`, color: '#f44336' })]
        })
      }

      case 'setchannel': {
        userData.channelId = message.channel.id
        saveData(data)
        return message.channel.send({
          embeds: [createEmbed({ title: '✅ Salon défini', description: `Tes rappels seront désormais envoyés dans **#${message.channel.name}**.`, color: '#4caf50' })]
        })
      }

      default:
        return message.channel.send({
          content: `<@${userId}>`,
          embeds: [createEmbed({ title: 'Commande inconnue', description: 'Commandes disponibles : `add` | `list` | `del` | `setchannel`', error: true })]
        })
    }
  },

  // --- Fonctions réutilisables ---
  listNotes: (user) => {
    const data = readData()
    return notesListEmbed(user, (data[user.id]?.notes) || [])
  },

  getAllNotes: () => {
    const data = readData()
    return Object.entries(data)
      .filter(([_, userData]) => userData.channelId && Array.isArray(userData.notes) && userData.notes.length)
      .map(([userId, userData]) => ({ userId, channelId: userData.channelId, notes: userData.notes }))
  },

  // --- Cron avec vrai ping ---
  async sendNotesCron(client) {
    const allNotes = module.exports.getAllNotes()
    for (const { channelId, notes, userId } of allNotes) {
      const channel = await client.channels.fetch(channelId).catch(() => null)
      if (!channel) continue
      const user = { id: userId, username: `<@${userId}>` } // username pour affichage embed

      await channel.send({
        content: `<@${userId}>`, // vrai ping
        embeds: [module.exports.listNotes(user)] // affichage
      })
    }
  }
}
