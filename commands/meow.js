module.exports = {
  name: 'meow',
  description: 'Répond meow',
  execute(message, args) {
    message.channel.send('meow')
  }
}
