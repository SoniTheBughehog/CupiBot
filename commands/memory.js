const fs = require('fs')
const path = require('path')
const { EmbedBuilder } = require('discord.js')

const filePath = path.join(__dirname, '..', 'data', 'memory.json')

function readData() {
  if (!fs.existsSync(filePath)) return {}
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function saveData(data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
}

module.exports = {
  name: 'memory',
  description: 'Ajouter ou lister vos souvenirs',
  execute(message, args) {
    const userId = message.author.id
    const data = readData()
    if (!data[userId]) data[userId] = []

    if (args.length === 0) {
      // Liste des souvenirs
      if (data[userId].length === 0) return message.channel.send('📭 Tu n’as aucun souvenir.')
      const embed = new EmbedBuilder()
        .setColor('#ff9800')
        .setTitle(`📝 Souvenirs de ${message.author.username}`)
        .setDescription(data[userId].map((m, i) => `**${i+1}.** ${m}`).join('\n'))
        .setTimestamp()
      return message.channel.send({ embeds: [embed] })
    }

    const sub = args.shift().toLowerCase()
    if (sub === 'add') {
      const text = args.join(' ')
      if (!text) return message.channel.send('Usage: !memory add <texte>')
      data[userId].push(text)
      saveData(data)
      return message.channel.send('✅ Souvenir ajouté !')
    } else {
      return message.channel.send('Commande inconnue. Usage: add <texte> | list')
    }
  }
}
