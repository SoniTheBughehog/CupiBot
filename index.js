require('dotenv').config()
const fs = require('fs')
const path = require('path')
const { Client, GatewayIntentBits, Collection, EmbedBuilder } = require('discord.js')
const cron = require('node-cron')
const config = require('./config.json')

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
})

client.commands = new Collection()
const prefix = config.prefix

// Charger les commandes
const commandFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(file => file.endsWith('.js'))
for (const file of commandFiles) {
  const command = require(`./commands/${file}`)
  client.commands.set(command.name, command)
}

// Fonction pour lire les callnotes
function readCalls() {
  const filePath = path.join(__dirname, 'data', 'callnote.json')
  if (!fs.existsSync(filePath)) return []
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

// Événement ready
client.once('ready', () => {
  console.log(`Connecté en tant que ${client.user.tag}`)

  // Envoi automatique tous les jours à 22h heure Paris
  // Envoi automatique tous les jours à 22h heure Paris
cron.schedule('0 22 * * *', () => {
  if (!config.reminderChannelId) return

  const calls = readCalls()
  const channel = client.channels.cache.get(config.reminderChannelId)
  if (!channel) return

  if (calls.length === 0) return // <-- au lieu d'envoyer un message "aucun sujet"

  const embed = new EmbedBuilder()
    .setColor('#2196f3')
    .setTitle('📋 Liste des sujets pour l’appel')
    .setDescription(calls.map((c, i) => `**${i + 1}.** [${c.qui}] ${c.sujet} _(par ${c.addedBy})_`).join('\n'))
    .setTimestamp()

  channel.send({ embeds: [embed] })
}, { timezone: 'Europe/Paris' })

// Rappel des notes perso à 22h
cron.schedule('0 18 * * *', () => {
  const filePath = path.join(__dirname, 'data', 'note.json')
  if (!fs.existsSync(filePath)) return
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))

  for (const userId in data) {
    const userData = data[userId]
    if (!userData.channelId || userData.notes.length === 0) continue

    const channel = client.channels.cache.get(userData.channelId)
    if (!channel) continue

    const embed = new EmbedBuilder()
      .setColor('#9c27b0')
      .setTitle(`📋 Notes de ${client.users.cache.get(userId)?.username || 'Utilisateur'}`)
      .setDescription(userData.notes.map((n, i) => `**${i + 1}.** ${n.sujet}`).join('\n'))
    channel.send({ embeds: [embed] })
  }
}, { timezone: 'Europe/Paris' })

})

// Événement messageCreate (commandes + meow)
client.on('messageCreate', message => {
  if (message.author.bot) return

  const text = message.content.toLowerCase()
  if (text.includes('meow') || text.includes('miaou')) {
    message.channel.send('meow')
    return
  }

  if (!message.content.startsWith(prefix)) return

  const args = message.content.slice(prefix.length).trim().split(/ +/)
  const commandName = args.shift().toLowerCase()

  if (!client.commands.has(commandName)) return

  try {
    client.commands.get(commandName).execute(message, args)
  } catch (error) {
    console.error(error)
    message.reply('Une erreur est survenue en exécutant la commande.')
  }
})

client.login(process.env.DISCORD_TOKEN)
