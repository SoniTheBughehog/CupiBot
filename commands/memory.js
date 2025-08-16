const fs = require('fs')
const path = require('path')
const { EmbedBuilder } = require('discord.js')

const filePath = path.join(__dirname, '..', 'data', 'memory.json')

function readMemory() {
  if (!fs.existsSync(filePath)) return {}
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function saveMemory(memories) {
  fs.writeFileSync(filePath, JSON.stringify(memories, null, 2))
}

module.exports = {
  name: 'memory',
  description: 'Gérer tes souvenirs personnels',
  execute(message, args) {
    const memories = readMemory()
    const userId = message.author.id

    if (!memories[userId]) memories[userId] = []

    if (args.length === 0) {
      return message.channel.send('Usage: !memory add <texte> | list | del <num>')
    }

    const subcommand = args.shift().toLowerCase()

    if (subcommand === 'add') {
      const text = args.join(' ')
      if (!text) return message.channel.send('❌ Merci de préciser un souvenir !')
      memories[userId].push(text)
      saveMemory(memories)

      const embed = new EmbedBuilder()
        .setTitle('💾 Souvenir ajouté')
        .setDescription(`"${text}"`)
        .setColor('#2ecc71')
        .setFooter({ text: message.author.tag })
        .setTimestamp()

      return message.channel.send({ embeds: [embed] })
    }

    if (subcommand === 'list') {
      const list = memories[userId]
      if (list.length === 0) return message.channel.send('📭 Aucun souvenir enregistré.')

      const embed = new EmbedBuilder()
        .setTitle(`📚 Souvenirs de ${message.author.username}`)
        .setDescription(list.map((m, i) => `**${i + 1}.** ${m}`).join('\n'))
        .setColor('#3498db')
        .setTimestamp()

      return message.channel.send({ embeds: [embed] })
    }

    if (subcommand === 'del') {
      const num = parseInt(args[0])
      if (isNaN(num) || num < 1 || num > memories[userId].length) {
        return message.channel.send('❌ Numéro invalide.')
      }
      const removed = memories[userId].splice(num - 1, 1)
      saveMemory(memories)

      const embed = new EmbedBuilder()
        .setTitle('🗑️ Souvenir supprimé')
        .setDescription(`"${removed[0]}"`)
        .setColor('#e74c3c')
        .setFooter({ text: message.author.tag })
        .setTimestamp()

      return message.channel.send({ embeds: [embed] })
    }

    return message.channel.send('❌ Commande inconnue. Usage: add | list | del')
  }
}
