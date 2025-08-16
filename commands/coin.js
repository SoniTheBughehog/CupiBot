module.exports = {
  name: 'coin',
  description: 'Lance une pièce (pile ou face)',
  execute(message) {
    const result = Math.random() < 0.5 ? 'Pile' : 'Face'
    message.channel.send(`🪙 ${message.author.username} a fait **${result}** !`)
  }
}
