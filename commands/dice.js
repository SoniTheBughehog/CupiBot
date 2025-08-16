module.exports = {
  name: 'dice',
  description: 'Lance un dé. Tu peux préciser le nombre de faces (ex: !dice 6)',
  execute(message, args) {
    const sides = parseInt(args[0]) || 6
    if (sides < 2) return message.channel.send('❌ Le dé doit avoir au moins 2 faces.')

    const result = Math.floor(Math.random() * sides) + 1
    message.channel.send(`🎲 ${message.author.username} a lancé un dé à ${sides} faces et a obtenu **${result}** !`)
  }
}
