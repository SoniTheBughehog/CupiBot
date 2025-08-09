module.exports = {
  name: 'help',
  description: 'Affiche la liste des commandes disponibles',
  execute(message) {
    const commands = message.client.commands
    const helpMessage = commands.map(cmd => `!${cmd.name} — ${cmd.description}`).join('\n')
    message.channel.send(`Voici les commandes disponibles :\n${helpMessage}`)
  }
}
