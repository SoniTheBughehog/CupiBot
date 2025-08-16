const { EmbedBuilder } = require('discord.js')

const ROWS = 6
const COLS = 7
const EMPTY = '⚪'
const PLAYER1 = '🔴'
const PLAYER2 = '🟡'

const games = {}

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY))
}

function renderBoard(board) {
  return board.map(row => row.join('')).join('\n')
}

function checkWin(board, piece) {
  // Horizontal
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c <= COLS - 4; c++)
      if (board[r][c] === piece && board[r][c+1] === piece && board[r][c+2] === piece && board[r][c+3] === piece) return true
  // Vertical
  for (let c = 0; c < COLS; c++)
    for (let r = 0; r <= ROWS - 4; r++)
      if (board[r][c] === piece && board[r+1][c] === piece && board[r+2][c] === piece && board[r+3][c] === piece) return true
  // Diagonale descendante
  for (let r = 0; r <= ROWS - 4; r++)
    for (let c = 0; c <= COLS - 4; c++)
      if (board[r][c] === piece && board[r+1][c+1] === piece && board[r+2][c+2] === piece && board[r+3][c+3] === piece) return true
  // Diagonale montante
  for (let r = 0; r <= ROWS - 4; r++)
    for (let c = 3; c < COLS; c++)
      if (board[r][c] === piece && board[r+1][c-1] === piece && board[r+2][c-2] === piece && board[r+3][c-3] === piece) return true
  return false
}

module.exports = {
  name: 'puissance4',
  description: 'Joue à Puissance 4 ! Usage: start | <colonne> | stop | reset',
  execute(message, args) {
    const channelId = message.channel.id
    if (!games[channelId]) games[channelId] = { board: createBoard(), turn: 1, players: [] }
    const game = games[channelId]

    const sub = args[0]?.toLowerCase()

    if (sub === 'start') {
      if (game.players.length === 0) game.players.push(message.author.id)
      message.channel.send('🎮 Partie commencée ! Deux joueurs requis. Premier joueur tape `!puissance4 <colonne>` (1-7).')
      return
    }

    if (sub === 'stop') {
      if (!game.players.length) return message.channel.send('❌ Pas de partie en cours.')
      game.players = []
      message.channel.send('🛑 Partie arrêtée. Plateau conservé.')
      return
    }

    if (sub === 'reset') {
      games[channelId] = { board: createBoard(), turn: 1, players: [] }
      message.channel.send('♻️ Plateau réinitialisé. Partie effacée.')
      return
    }

    // Ajouter second joueur si nécessaire
    if (!game.players.includes(message.author.id) && game.players.length < 2) game.players.push(message.author.id)

    // Vérifie le tour
    const currentPlayerId = game.players[game.turn - 1]
    if (message.author.id !== currentPlayerId) return message.channel.send('⏳ Ce n’est pas ton tour !')

    const col = parseInt(args[0]) - 1
    if (isNaN(col) || col < 0 || col >= COLS) return message.channel.send('❌ Colonne invalide (1-7).')

    // Place le pion
    let placed = false
    for (let r = ROWS - 1; r >= 0; r--) {
      if (game.board[r][col] === EMPTY) {
        game.board[r][col] = game.turn === 1 ? PLAYER1 : PLAYER2
        placed = true
        break
      }
    }
    if (!placed) return message.channel.send('❌ Cette colonne est pleine !')

    // Embed plateau
    const embed = new EmbedBuilder()
      .setTitle('Puissance 4')
      .setDescription(renderBoard(game.board))
      .setColor(game.turn === 1 ? '#ff0000' : '#ffff00')
      .setFooter({ text: `Tour de ${message.author.username}` })
      .setTimestamp()
    message.channel.send({ embeds: [embed] })

    // Vérifie victoire
    const piece = game.turn === 1 ? PLAYER1 : PLAYER2
    if (checkWin(game.board, piece)) {
      const winner = message.author.username
      const playerNames = game.players.map(id => {
        const user = message.guild.members.cache.get(id)
        return user ? user.user.username : 'Joueur'
      })
      const victoryEmbed = new EmbedBuilder()
        .setTitle('🏆 Victoire !')
        .setDescription(`${winner} a gagné la partie !\n\n${renderBoard(game.board)}\n\nParticipants : ${playerNames.join(' vs ')}`)
        .setColor('#00ff00')
        .setTimestamp()
      message.channel.send({ embeds: [victoryEmbed] })
      games[channelId] = { board: createBoard(), turn: 1, players: [] }
      return
    }

    // Vérifie égalité
    if (game.board.flat().every(cell => cell !== EMPTY)) {
      const playerNames = game.players.map(id => {
        const user = message.guild.members.cache.get(id)
        return user ? user.user.username : 'Joueur'
      })
      const drawEmbed = new EmbedBuilder()
        .setTitle('🤝 Égalité !')
        .setDescription(`Le plateau est plein, personne n'a gagné.\n\n${renderBoard(game.board)}\n\nParticipants : ${playerNames.join(' vs ')}`)
        .setColor('#808080')
        .setTimestamp()
      message.channel.send({ embeds: [drawEmbed] })
      games[channelId] = { board: createBoard(), turn: 1, players: [] }
      return
    }

    // Changement de joueur
    game.turn = game.turn === 1 ? 2 : 1
  }
}
