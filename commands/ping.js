module.exports = {
  name: 'ping',
  description: 'Répond pong',
  execute(message, args) {
    message.channel.send('pong')
  }
}
