const fs = require('fs')
const path = require('path')

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
      message.channel.send('Usage: !callnotes add <qui> <sujet> | list | del <num>')
      return
    }

    const subcommand = args.shift().toLowerCase()

    if (subcommand === 'add') {
      if (args.length < 2) {
        message.channel.send('Usage: !callnotes add <qui> <sujet>')
        return
      }
      const qui = args.shift()
      const sujet = args.join(' ')
      calls.push({ qui, sujet, addedBy: message.author.tag })
      saveCalls(calls)
      message.channel.send(`Sujet ajouté pour "${qui}": "${sujet}"`)
    } else if (subcommand === 'list') {
      if (calls.length === 0) {
        message.channel.send('Aucun sujet dans la liste d\'appel.')
        return
      }
      const list = calls
        .map((c, i) => `${i + 1}. [${c.qui}] ${c.sujet} (ajouté par ${c.addedBy})`)
        .join('\n')
      message.channel.send(`Sujets pour l'appel :\n${list}`)
    } else if (subcommand === 'del') {
      const num = parseInt(args[0])
      if (isNaN(num) || num < 1 || num > calls.length) {
        message.channel.send('Numéro invalide.')
        return
      }
      const removed = calls.splice(num - 1, 1)
      saveCalls(calls)
      message.channel.send(`Sujet supprimé : "${removed[0].sujet}" pour ${removed[0].qui}`)
    } else {
      message.channel.send('Commande inconnue. Usage: add | list | del')
    }
  }
}
