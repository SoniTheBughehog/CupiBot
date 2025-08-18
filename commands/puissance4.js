const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');

const ROWS = 6;
const COLS = 7;
const EMPTY = '⚪';
const PLAYER1 = '🔴';
const PLAYER2 = '🟡';
const DATA_FILE = path.resolve(__dirname, '../data/puissance4.json');

function loadGames() {
  if (!fs.existsSync(DATA_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { return {}; }
}
function saveGames(games) { fs.writeFileSync(DATA_FILE, JSON.stringify(games, null, 2), 'utf8'); }
function createBoard() { return Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY)); }
function renderBoard(board) { return board.map(row => row.join('')).join('\n'); }

function checkWin(board, piece) {
  for (let r = 0; r < ROWS; r++) for (let c = 0; c <= COLS - 4; c++) if ([0,1,2,3].every(i => board[r][c+i] === piece)) return true;
  for (let c = 0; c < COLS; c++) for (let r = 0; r <= ROWS - 4; r++) if ([0,1,2,3].every(i => board[r+i][c] === piece)) return true;
  for (let r = 0; r <= ROWS - 4; r++) for (let c = 0; c <= COLS - 4; c++) if ([0,1,2,3].every(i => board[r+i][c+i] === piece)) return true;
  for (let r = 0; r <= ROWS - 4; r++) for (let c = 3; c < COLS; c++) if ([0,1,2,3].every(i => board[r+i][c-i] === piece)) return true;
  return false;
}

function sendError(message, title, description) {
  return message.channel.send({ embeds: [new EmbedBuilder().setTitle(`❌ ${title}`).setDescription(description).setColor(0xff0000).setTimestamp()] });
}

function getPlayerNames(game, guild) {
  return game.players.map(id => {
    const member = guild.members.cache.get(id);
    return member ? member.user.username : 'Joueur';
  });
}

function renderGameBoardEmbed(game, currentUser) {
  const color = game.turn === 1 ? 0xff0000 : 0xffff00;
  return new EmbedBuilder()
    .setTitle(`Puissance 4 - Tour de ${currentUser.username}`)
    .setDescription(renderBoard(game.board))
    .setColor(color)
    .setFooter({ text: `Tour de ${currentUser.username}` })
    .setTimestamp();
}

module.exports = {
  name: 'puissance4',
  description: 'Joue à Puissance 4 ! Usage: start | <colonne> | reset',
  async execute(message, args) {
    let games = loadGames();
    const channelId = message.channel.id;
    if (!games[channelId]) games[channelId] = { board: createBoard(), turn: 1, players: [] };
    const game = games[channelId];
    const sub = args[0]?.toLowerCase();

    if (sub === 'start') {
      if (!game.players.includes(message.author.id)) game.players.push(message.author.id);
      saveGames(games);
      return message.channel.send('🎮 Partie commencée ! Deux joueurs requis.\n➡️ Premier joueur tape `!puissance4 <colonne>` (1-7).');
    }

    if (sub === 'board') {
      if (!game.board) return sendError(message, 'Aucun jeu en cours', 'Il n’y a pas de partie en cours dans ce salon.');
      return message.channel.send({ embeds: [renderGameBoardEmbed(game, message.author)] });
    }

    if (sub === 'reset') {
      delete games[channelId];
      saveGames(games);
      return message.channel.send('♻️ Plateau réinitialisé. Partie effacée.');
    }

    if (!args.length) return sendError(message, 'Commande invalide', 'Usage : `start | <colonne> | reset`');

    if (!game.players.includes(message.author.id) && game.players.length < 2) game.players.push(message.author.id);
    const currentPlayerId = game.players[game.turn - 1];
    if (message.author.id !== currentPlayerId) return sendError(message, 'Ce n’est pas ton tour !', `C’est au tour de <@${currentPlayerId}> de jouer.`);

    const col = Number(args[0]) - 1;
    if (Number.isNaN(col) || col < 0 || col >= COLS) return sendError(message, 'Colonne invalide', 'Choisis une colonne entre **1** et **7**.');

    let placed = false;
    for (let r = ROWS - 1; r >= 0; r--) if (game.board[r][col] === EMPTY) { game.board[r][col] = game.turn === 1 ? PLAYER1 : PLAYER2; placed = true; break; }
    if (!placed) return sendError(message, 'Colonne pleine', `La colonne **${col + 1}** est déjà remplie.`);

    await message.channel.send({ embeds: [renderGameBoardEmbed(game, message.author)] });

    const piece = game.turn === 1 ? PLAYER1 : PLAYER2;
    if (checkWin(game.board, piece)) {
      const winner = message.author.username;
      const playerNames = getPlayerNames(game, message.guild);
      const victoryEmbed = new EmbedBuilder()
        .setTitle('🏆 Victoire !')
        .setDescription(`${winner} a gagné !\n\n${renderBoard(game.board)}\n\nParticipants : ${playerNames.join(' vs ')}`)
        .setColor(0x00ff00)
        .setTimestamp();
      await message.channel.send({ embeds: [victoryEmbed] });
      delete games[channelId];
      return saveGames(games);
    }

    if (game.board.flat().every(cell => cell !== EMPTY)) {
      const playerNames = getPlayerNames(game, message.guild);
      const drawEmbed = new EmbedBuilder()
        .setTitle('🤝 Égalité !')
        .setDescription(`Le plateau est plein, personne n'a gagné.\n\n${renderBoard(game.board)}\n\nParticipants : ${playerNames.join(' vs ')}`)
        .setColor(0x808080)
        .setTimestamp();
      await message.channel.send({ embeds: [drawEmbed] });
      delete games[channelId];
      return saveGames(games);
    }

    game.turn = game.turn === 1 ? 2 : 1;
    saveGames(games);
  },
};
