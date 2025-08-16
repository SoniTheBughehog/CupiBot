module.exports = {
  name: 'rps',
  description: 'Joue à Pierre / Papier / Ciseaux contre l’autre joueur',
  execute(message, args) {
    if (args.length === 0) return message.channel.send('Usage: !rps <pierre|papier|ciseaux>')

    const choices = ['pierre', 'papier', 'ciseaux']
    const userChoice = args[0].toLowerCase()
    if (!choices.includes(userChoice)) return message.channel.send('❌ Choix invalide : pierre, papier ou ciseaux.')

    const botChoice = choices[Math.floor(Math.random() * choices.length)]

    let result
    if (userChoice === botChoice) result = "🤝 Égalité !"
    else if (
      (userChoice === 'pierre' && botChoice === 'ciseaux') ||
      (userChoice === 'papier' && botChoice === 'pierre') ||
      (userChoice === 'ciseaux' && botChoice === 'papier')
    ) result = '🎉 Tu as gagné !'
    else result = '💔 Tu as perdu...'

    message.channel.send(`🧑 ${message.author.username} a choisi **${userChoice}**\n🤖 Le bot a choisi **${botChoice}**\n${result}`)
  }
}
