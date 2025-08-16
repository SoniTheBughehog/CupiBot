const fs = require('fs')
const path = require('path')
const { EmbedBuilder } = require('discord.js')

const filePath = path.join(__dirname, '..', 'data', 'note.json')

function readData() {
  if (!fs.existsSync(filePath)) return {}
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function saveData(data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
}

module.exports = {
  name: 'note',
  description: 'Gérer ta liste perso de notes',
  execute(message, args) {
    const userId = message.author.id
    const data = readData()
    if (!data[userId]) data[userId] = { channelId: null, notes: [] }
    const userData = data[userId]

    if (args.length === 0) {
      return message.channel.send('Usage: !note add <sujet> | list | del <num> | setchannel')
    }

    const sub = args.shift().toLowerCase()

    if (sub === 'add') {
      const sujet = args.join(' ')
      if (!sujet) return message.channel.send('Usage: !note add <sujet>')
      userData.notes.push({ sujet, addedBy: message.author.tag })
      saveData(data)
      const embed = new EmbedBuilder()
        .setColor('#4caf50')
        .setTitle('Note ajoutée 📌')
        .setDescription(sujet)
        .setFooter({ text: `Ajoutée par ${message.author.tag}` })
      return message.channel.send({ embeds: [embed] })

    } else if (sub === 'list') {
      if (userData.notes.length === 0) return message.channel.send('📭 Tu n’as aucune note.')
      const embed = new EmbedBuilder()
        .setColor('#2196f3')
        .setTitle(`📋 Tes notes (${message.author.username})`)
        .setDescription(userData.notes.map((n, i) => `**${i + 1}.** ${n.sujet}`).join('\n'))
      return message.channel.send({ embeds: [embed] })

    } else if (sub === 'del') {
      const num = parseInt(args[0])
      if (isNaN(num) || num < 1 || num > userData.notes.length) return message.channel.send('❌ Numéro invalide.')
      const removed = userData.notes.splice(num - 1, 1)
      saveData(data)
      return message.channel.send(`🗑️ Note supprimée : ${removed[0].sujet}`)

    } else if (sub === 'setchannel') {
      userData.channelId = message.channel.id
      saveData(data)
      return message.channel.send(`✅ Tes rappels seront envoyés dans **#${message.channel.name}**`)

    } else {
      return message.channel.send('Commande inconnue. Usage: add | list | del | setchannel')
    }
  }
}
