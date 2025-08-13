const fs = require('fs')
const path = require('path')
const { EmbedBuilder } = require('discord.js')

const filePath = path.join(__dirname, '..', 'data', 'callnote.json')

function readCalls() {
  if (!fs.existsSync(filePath)) return []
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function saveCalls(calls) {
  fs.writeFileSync(filePath, JSON.stringify(calls, null, 2))
}

module.exports = {
  name: 'callnote',
  description: 'Gérer la liste des sujets pour un appel',
  execute(message, args) {
    const calls = readCalls()

    if (args.length === 0) {
      return message.channel.send('Usage: !callnote add <qui> <sujet> | list | del <num>')
    }

    const subcommand = args.shift().toLowerCase()

    if (subcommand === 'add') {
      if (args.length < 2) {
        return message.channel.send('Usage: !callnote add <qui> <sujet>')
      }
      const qui = args.shift()
      const sujet = args.join(' ')
      calls.push({ qui, sujet, addedBy: message.author.tag })
      saveCalls(calls)

      const embed = new EmbedBuilder()
        .setColor('#4caf50')
        .setTitle('Sujet ajouté 📌')
        .addFields(
          { name: 'Pour', value: qui, inline: true },
          { name: 'Sujet', value: sujet, inline: true },
          { name: 'Ajouté par', value: message.author.tag, inline: false }
        )
        .setTimestamp()

      message.channel.send({ embeds: [embed] })

    } else if (subcommand === 'list') {
      if (calls.length === 0) {
        return message.channel.send('📭 Aucun sujet dans la liste.')
      }

      const embed = new EmbedBuilder()
        .setColor('#2196f3')
        .setTitle('📋 Liste des sujets')
        .setDescription(calls.map((c, i) => `**${i + 1}.** [${c.qui}] ${c.sujet} _(par ${c.addedBy})_`).join('\n'))
        .setTimestamp()

      message.channel.send({ embeds: [embed] })

    } else if (subcommand === 'del') {
      const num = parseInt(args[0])
      if (isNaN(num) || num < 1 || num > calls.length) {
        return message.channel.send('❌ Numéro invalide.')
      }
      const removed = calls.splice(num - 1, 1)
      saveCalls(calls)

      const embed = new EmbedBuilder()
        .setColor('#f44336')
        .setTitle('Sujet supprimé 🗑️')
        .addFields(
          { name: 'Pour', value: removed[0].qui, inline: true },
          { name: 'Sujet', value: removed[0].sujet, inline: true }
        )
        .setTimestamp()

      message.channel.send({ embeds: [embed] })

    } else {
      message.channel.send('Commande inconnue. Usage: add | list | del')
    }
  }
}
