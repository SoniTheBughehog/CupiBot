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
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveGames(games) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(games, null, 2), 'utf8');
}

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY));
}

function renderBoard(board) {
  const header = Array.from({ length: COLS }, (_, i) => `${i + 1}`).join(' ');
  return `${header}\n${board.map(row => row.join('')).join('\n')}`;
}

function checkWin(board, piece) {
  // Horizontal
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      if (
        board[r][c] === piece &&
        board[r][c + 1] === piece &&
        board[r][c + 2] === piece &&
        board[r][c + 3] === piece
      ) return true;
    }
  }
  // Vertical
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r <= ROWS - 4; r++) {
      if (
        board[r][c] === piece &&
        board[r + 1][c] === piece &&
        board[r + 2][c] === piece &&
        board[r + 3][c] === piece
      ) return true;
    }
  }
  // Diagonal /
  for (let r = 0; r <= ROWS - 4; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      if (
        board[r][c] === piece &&
        board[r + 1][c + 1] === piece &&
        board[r + 2][c + 2] === piece &&
        board[r + 3][c + 3] === piece
      ) return true;
    }
  }
  // Diagonal \
  for (let r = 0; r <= ROWS - 4; r++) {
    for (let c = 3; c < COLS; c++) {
      if (
        board[r][c] === piece &&
        board[r + 1][c - 1] === piece &&
        board[r + 2][c - 2] === piece &&
        board[r + 3][c - 3] === piece
      ) return true;
    }
  }
  return false;
}

function errorEmbed(title, desc) {
  return new EmbedBuilder()
    .setTitle(`❌ ${title}`)
    .setDescription(desc)
    .setColor(0xff0000)
    .setTimestamp();
}

function getPlayerNames(game, guild) {
  return game.players.map(id => {
    const member = guild.members.cache.get(id);
    return member ? member.user.username : 'Joueur';
  });
}

module.exports = {
  name: 'puissance4',
  description: 'Joue à Puissance 4 ! Usage: start | <colonne> | reset',
  async execute(message, args) {
    let games = loadGames();
    const channelId = message.channel.id;
    if (!games[channelId]) {
      games[channelId] = { board: createBoard(), turn: 1, players: [] };
    }
    const game = games[channelId];
    const sub = args[0]?.toLowerCase();

    if (sub === 'start') {
      if (game.players.length === 0) game.players.push(message.author.id);
      saveGames(games);
      await message.channel.send(
        '🎮 Partie commencée ! Deux joueurs requis.\n➡️ Premier joueur tape `!puissance4 <colonne>` (1-7).'
      );
      return;
    }

    if (sub === 'board') {
      if (!game.board) {
      await message.channel.send({
        embeds: [
        errorEmbed('Aucun jeu en cours', 'Il n’y a pas de partie en cours dans ce salon.')
        ],
      });
      return;
      }
      const embed = new EmbedBuilder()
      .setTitle('Plateau actuel')
      .setDescription(renderBoard(game.board))
      .setColor(0x3498db)
      .setTimestamp();
      await message.channel.send({ embeds: [embed] });
      return;
    }

    if (sub === 'reset') {
      delete games[channelId];
      saveGames(games);
      await message.channel.send('♻️ Plateau réinitialisé. Partie effacée.');
      return;
    }

    if (!args.length) {
      await message.channel.send({
        embeds: [
          errorEmbed(
            'Commande invalide',
            'Utilisation :\n`!puissance4 start` → commencer une partie\n`!puissance4 <colonne>` → jouer (1-7)\n`!puissance4 reset` → réinitialiser'
          ),
        ],
      });
      return;
    }

    if (!game.players.includes(message.author.id) && game.players.length < 2) {
      game.players.push(message.author.id);
    }

    const currentPlayerId = game.players[game.turn - 1];
    if (message.author.id !== currentPlayerId) {
      await message.channel.send({
        embeds: [
          errorEmbed(
            'Ce n’est pas ton tour !',
            `C’est au tour de <@${currentPlayerId}> de jouer.`
          ),
        ],
      });
      return;
    }

    const col = Number(args[0]) - 1;
    if (Number.isNaN(col) || col < 0 || col >= COLS) {
      await message.channel.send({
        embeds: [
          errorEmbed(
            'Colonne invalide',
            'Choisis une colonne entre **1** et **7**.'
          ),
        ],
      });
      return;
    }

    let placed = false;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (game.board[r][col] === EMPTY) {
        game.board[r][col] = game.turn === 1 ? PLAYER1 : PLAYER2;
        placed = true;
        break;
      }
    }
    if (!placed) {
      await message.channel.send({
        embeds: [
          errorEmbed(
            'Colonne pleine',
            `La colonne **${col + 1}** est déjà remplie, choisis-en une autre.`
          ),
        ],
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('Puissance 4')
      .setDescription(renderBoard(game.board))
      .setColor(game.turn === 1 ? 0xff0000 : 0xffff00)
      .setFooter({ text: `Tour de ${message.author.username}` })
      .setTimestamp();
    await message.channel.send({ embeds: [embed] });

    const piece = game.turn === 1 ? PLAYER1 : PLAYER2;
    if (checkWin(game.board, piece)) {
      const winner = message.author.username;
      const playerNames = getPlayerNames(game, message.guild);
      const victoryEmbed = new EmbedBuilder()
        .setTitle('🏆 Victoire !')
        .setDescription(
          `${winner} a gagné la partie !\n\n${renderBoard(game.board)}\n\nParticipants : ${playerNames.join(' vs ')}`
        )
        .setColor(0x00ff00)
        .setTimestamp();
      await message.channel.send({ embeds: [victoryEmbed] });
      delete games[channelId];
      saveGames(games);
      return;
    }

    if (game.board.flat().every(cell => cell !== EMPTY)) {
      const playerNames = getPlayerNames(game, message.guild);
      const drawEmbed = new EmbedBuilder()
        .setTitle('🤝 Égalité !')
        .setDescription(
          `Le plateau est plein, personne n'a gagné.\n\n${renderBoard(game.board)}\n\nParticipants : ${playerNames.join(' vs ')}`
        )
        .setColor(0x808080)
        .setTimestamp();
      await message.channel.send({ embeds: [drawEmbed] });
      delete games[channelId];
      saveGames(games);
      return;
    }

    game.turn = game.turn === 1 ? 2 : 1;
    saveGames(games);
  },
};
