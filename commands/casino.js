const fs = require('fs');
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

class CasinoBot {
    constructor() {
        this.client = new Client({ 
            intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] 
        });
        
        this.playersData = this.loadPlayersData();
        this.activeGames = new Map();
        
        this.setupEvents();
    }

    loadPlayersData() {
        try {
            if (fs.existsSync('../data/casino_players.json')) {
                return JSON.parse(fs.readFileSync('../data/casino_players.json', 'utf8'));
            }
        } catch (error) {
            console.log('Erreur de chargement des données:', error);
        }
        return {};
    }

    savePlayersData() {
        try {
            fs.writeFileSync('../data/casino_players.json', JSON.stringify(this.playersData, null, 2));
        } catch (error) {
            console.log('Erreur de sauvegarde:', error);
        }
    }

    getPlayer(userId) {
        if (!this.playersData[userId]) {
            this.playersData[userId] = {
                tokens: 500,
                lastDaily: null,
                stats: {
                    slotsPlayed: 0,
                    roulettePlayed: 0,
                    blackjackPlayed: 0,
                    totalWon: 0,
                    totalLost: 0
                }
            };
            this.savePlayersData();
        }
        return this.playersData[userId];
    }

    claimDailyBonus(userId) {
        const player = this.getPlayer(userId);
        const today = new Date().toDateString();
        
        if (player.lastDaily !== today) {
            player.tokens += 20;
            player.lastDaily = today;
            this.savePlayersData();
            return true;
        }
        return false;
    }

    // MACHINE À SOUS
    async playSlots(interaction, bet) {
        const userId = interaction.user.id;
        const player = this.getPlayer(userId);

        if (player.tokens < bet) {
            return interaction.reply('❌ Vous n\'avez pas assez de jetons !');
        }

        const symbols = ['🍒', '🍋', '🍊', '🍇', '⭐', '💎', '7️⃣'];
        const reel1 = symbols[Math.floor(Math.random() * symbols.length)];
        const reel2 = symbols[Math.floor(Math.random() * symbols.length)];
        const reel3 = symbols[Math.floor(Math.random() * symbols.length)];

        let winMultiplier = 0;
        let result = '';

        // Logique des gains
        if (reel1 === reel2 && reel2 === reel3) {
            if (reel1 === '💎') winMultiplier = 10;
            else if (reel1 === '7️⃣') winMultiplier = 8;
            else if (reel1 === '⭐') winMultiplier = 6;
            else winMultiplier = 4;
            result = '🎉 JACKPOT ! 🎉';
        } else if (reel1 === reel2 || reel2 === reel3 || reel1 === reel3) {
            winMultiplier = 2;
            result = '✨ Paire ! ✨';
        } else {
            result = '😔 Perdu...';
        }

        const winAmount = bet * winMultiplier;
        player.tokens = player.tokens - bet + winAmount;
        player.stats.slotsPlayed++;
        
        if (winAmount > bet) {
            player.stats.totalWon += (winAmount - bet);
        } else {
            player.stats.totalLost += bet;
        }

        this.savePlayersData();

        const embed = new EmbedBuilder()
            .setTitle('🎰 MACHINE À SOUS 🎰')
            .setDescription(`${reel1} | ${reel2} | ${reel3}`)
            .addFields(
                { name: 'Résultat', value: result, inline: true },
                { name: 'Mise', value: `${bet} jetons`, inline: true },
                { name: 'Gain', value: `${winAmount} jetons`, inline: true },
                { name: 'Vos jetons', value: `${player.tokens}`, inline: true }
            )
            .setColor(winAmount > bet ? 0x00ff00 : 0xff0000);

        await interaction.reply({ embeds: [embed] });
    }

    // ROULETTE
    async playRoulette(interaction, bet, choice) {
        const userId = interaction.user.id;
        const player = this.getPlayer(userId);

        if (player.tokens < bet) {
            return interaction.reply('❌ Vous n\'avez pas assez de jetons !');
        }

        const number = Math.floor(Math.random() * 37); // 0-36
        const isRed = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(number);
        const isBlack = number > 0 && !isRed;
        const isEven = number > 0 && number % 2 === 0;
        const isOdd = number > 0 && number % 2 === 1;

        let won = false;
        let winMultiplier = 0;

        // Vérification des gains
        if (choice === 'rouge' && isRed) { won = true; winMultiplier = 2; }
        else if (choice === 'noir' && isBlack) { won = true; winMultiplier = 2; }
        else if (choice === 'pair' && isEven) { won = true; winMultiplier = 2; }
        else if (choice === 'impair' && isOdd) { won = true; winMultiplier = 2; }
        else if (parseInt(choice) === number) { won = true; winMultiplier = 36; }

        const winAmount = won ? bet * winMultiplier : 0;
        player.tokens = player.tokens - bet + winAmount;
        player.stats.roulettePlayed++;
        
        if (won) {
            player.stats.totalWon += (winAmount - bet);
        } else {
            player.stats.totalLost += bet;
        }

        this.savePlayersData();

        let color = '⚫';
        if (isRed) color = '🔴';
        else if (number === 0) color = '💚';

        const embed = new EmbedBuilder()
            .setTitle('🎲 ROULETTE 🎲')
            .setDescription(`La bille s'arrête sur: ${color} **${number}**`)
            .addFields(
                { name: 'Votre mise', value: `${bet} sur ${choice}`, inline: true },
                { name: 'Résultat', value: won ? '🎉 Gagné !' : '😔 Perdu', inline: true },
                { name: 'Gain', value: `${winAmount} jetons`, inline: true },
                { name: 'Vos jetons', value: `${player.tokens}`, inline: true }
            )
            .setColor(won ? 0x00ff00 : 0xff0000);

        await interaction.reply({ embeds: [embed] });
    }

    // BLACKJACK
    async startBlackjack(interaction, bet) {
        const userId = interaction.user.id;
        const player = this.getPlayer(userId);

        if (player.tokens < bet) {
            return interaction.reply('❌ Vous n\'avez pas assez de jetons !');
        }

        const gameId = `${interaction.channelId}_${Date.now()}`;
        const game = {
            players: [{
                id: userId,
                name: interaction.user.username,
                cards: [],
                value: 0,
                bet: bet,
                status: 'playing' // playing, stand, bust, blackjack
            }],
            dealerCards: [],
            dealerValue: 0,
            status: 'playing' // playing, finished
        };

        // Distribution initiale
        this.dealCard(game.players[0]);
        this.dealCard(game.players[0]);
        this.dealCard(game.dealer = { cards: [], value: 0 });
        this.dealCard(game.dealer, true); // Carte cachée

        this.activeGames.set(gameId, game);

        const embed = this.createBlackjackEmbed(game, false);
        const row = this.createBlackjackButtons(gameId);

        await interaction.reply({ embeds: [embed], components: [row] });
    }

    dealCard(player, hidden = false) {
        const suits = ['♠️', '♥️', '♦️', '♣️'];
        const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
        
        const suit = suits[Math.floor(Math.random() * suits.length)];
        const value = values[Math.floor(Math.random() * values.length)];
        const card = { suit, value, hidden };

        player.cards.push(card);
        this.calculateValue(player);
    }

    calculateValue(player) {
        let value = 0;
        let aces = 0;

        for (const card of player.cards) {
            if (card.hidden) continue;
            
            if (card.value === 'A') {
                aces++;
                value += 11;
            } else if (['J', 'Q', 'K'].includes(card.value)) {
                value += 10;
            } else {
                value += parseInt(card.value);
            }
        }

        // Ajustement des As
        while (value > 21 && aces > 0) {
            value -= 10;
            aces--;
        }

        player.value = value;
    }

    createBlackjackEmbed(game, showDealerCard = false) {
        const player = game.players[0];
        let dealerCards = game.dealer.cards.map(card => {
            if (card.hidden && !showDealerCard) return '🎴';
            return `${card.value}${card.suit}`;
        }).join(' ');

        const playerCards = player.cards.map(card => `${card.value}${card.suit}`).join(' ');

        const embed = new EmbedBuilder()
            .setTitle('🃏 BLACKJACK 🃏')
            .addFields(
                { name: '🏠 Croupier', value: `${dealerCards}\nValeur: ${showDealerCard ? game.dealer.value : '?'}`, inline: false },
                { name: `🎲 ${player.name}`, value: `${playerCards}\nValeur: ${player.value}\nMise: ${player.bet}`, inline: false }
            )
            .setColor(0x0099ff);

        return embed;
    }

    createBlackjackButtons(gameId) {
        return new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`bj_hit_${gameId}`)
                    .setLabel('Carte')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`bj_stand_${gameId}`)
                    .setLabel('Rester')
                    .setStyle(ButtonStyle.Secondary)
            );
    }

    async handleBlackjackAction(interaction, action, gameId) {
        const game = this.activeGames.get(gameId);
        if (!game) return interaction.reply({ content: '❌ Partie non trouvée !', ephemeral: true });

        const player = game.players.find(p => p.id === interaction.user.id);
        if (!player) return interaction.reply({ content: '❌ Vous ne participez pas à cette partie !', ephemeral: true });

        if (action === 'hit') {
            this.dealCard(player);
            if (player.value > 21) {
                player.status = 'bust';
                await this.finishBlackjack(interaction, gameId);
            } else if (player.value === 21) {
                player.status = 'blackjack';
                await this.finishBlackjack(interaction, gameId);
            } else {
                const embed = this.createBlackjackEmbed(game, false);
                const row = this.createBlackjackButtons(gameId);
                await interaction.update({ embeds: [embed], components: [row] });
            }
        } else if (action === 'stand') {
            player.status = 'stand';
            await this.finishBlackjack(interaction, gameId);
        }
    }

    async finishBlackjack(interaction, gameId) {
        const game = this.activeGames.get(gameId);
        const player = game.players[0];

        // Révéler la carte cachée du croupier
        game.dealer.cards.forEach(card => card.hidden = false);
        this.calculateValue(game.dealer);

        // Le croupier tire jusqu'à 17
        while (game.dealer.value < 17) {
            this.dealCard(game.dealer);
        }

        // Déterminer le gagnant
        let result = '';
        let winMultiplier = 0;

        if (player.status === 'bust') {
            result = '💥 Vous avez dépassé 21 !';
        } else if (game.dealer.value > 21) {
            result = '🎉 Le croupier a dépassé 21 !';
            winMultiplier = 2;
        } else if (player.value === 21 && player.cards.length === 2) {
            result = '🃏 BLACKJACK !';
            winMultiplier = 2.5;
        } else if (player.value > game.dealer.value) {
            result = '🎉 Vous gagnez !';
            winMultiplier = 2;
        } else if (player.value === game.dealer.value) {
            result = '🤝 Égalité !';
            winMultiplier = 1;
        } else {
            result = '😔 Vous perdez !';
        }

        // Mise à jour des jetons
        const playerData = this.getPlayer(player.id);
        const winAmount = player.bet * winMultiplier;
        playerData.tokens = playerData.tokens - player.bet + winAmount;
        playerData.stats.blackjackPlayed++;
        
        if (winAmount > player.bet) {
            playerData.stats.totalWon += (winAmount - player.bet);
        } else if (winAmount < player.bet) {
            playerData.stats.totalLost += (player.bet - winAmount);
        }

        this.savePlayersData();
        this.activeGames.delete(gameId);

        const embed = this.createBlackjackEmbed(game, true);
        embed.addFields({ name: 'Résultat', value: `${result}\nGain: ${winAmount} jetons\nVos jetons: ${playerData.tokens}` });
        embed.setColor(winAmount >= player.bet ? 0x00ff00 : 0xff0000);

        await interaction.update({ embeds: [embed], components: [] });
    }

    setupEvents() {
        this.client.on('ready', () => {
            console.log(`🎰 ${this.client.user.tag} est connecté !`);
        });

        this.client.on('messageCreate', async (message) => {
            if (message.author.bot) return;

            const args = message.content.split(' ');
            const command = args[0].toLowerCase();

            // Bonus quotidien
            if (command === '!daily') {
                const claimed = this.claimDailyBonus(message.author.id);
                const player = this.getPlayer(message.author.id);
                
                if (claimed) {
                    message.reply(`🎁 Vous avez récupéré vos 20 jetons quotidiens !\nVous avez maintenant ${player.tokens} jetons.`);
                } else {
                    message.reply('❌ Vous avez déjà récupéré vos jetons aujourd\'hui !');
                }
            }

            // Profil joueur
            if (command === '!profil') {
                const player = this.getPlayer(message.author.id);
                const embed = new EmbedBuilder()
                    .setTitle(`💰 Profil de ${message.author.username}`)
                    .addFields(
                        { name: 'Jetons', value: `${player.tokens}`, inline: true },
                        { name: 'Machine à sous', value: `${player.stats.slotsPlayed} parties`, inline: true },
                        { name: 'Roulette', value: `${player.stats.roulettePlayed} parties`, inline: true },
                        { name: 'Blackjack', value: `${player.stats.blackjackPlayed} parties`, inline: true },
                        { name: 'Total gagné', value: `${player.stats.totalWon} jetons`, inline: true },
                        { name: 'Total perdu', value: `${player.stats.totalLost} jetons`, inline: true }
                    )
                    .setColor(0xffd700);
                
                message.reply({ embeds: [embed] });
            }

            // Machine à sous
            if (command === '!slots') {
                const bet = parseInt(args[1]) || 10;
                if (bet < 1) return message.reply('❌ Mise minimum : 1 jeton !');
                if (bet > 100) return message.reply('❌ Mise maximum : 100 jetons !');
                
                await this.playSlots({ user: message.author, reply: (content) => message.reply(content) }, bet);
            }

            // Roulette
            if (command === '!roulette') {
                const bet = parseInt(args[1]);
                const choice = args[2]?.toLowerCase();
                
                if (!bet || !choice) {
                    return message.reply('❌ Usage: `!roulette <mise> <choix>`\nChoix possibles: rouge, noir, pair, impair, ou un numéro (0-36)');
                }
                
                if (bet < 1 || bet > 200) {
                    return message.reply('❌ Mise entre 1 et 200 jetons !');
                }

                const validChoices = ['rouge', 'noir', 'pair', 'impair'];
                const numberChoice = parseInt(choice);
                
                if (!validChoices.includes(choice) && (isNaN(numberChoice) || numberChoice < 0 || numberChoice > 36)) {
                    return message.reply('❌ Choix invalide ! (rouge, noir, pair, impair, ou 0-36)');
                }

                await this.playRoulette({ user: message.author, reply: (content) => message.reply(content) }, bet, choice);
            }

            // Blackjack
            if (command === '!blackjack') {
                const bet = parseInt(args[1]) || 25;
                if (bet < 1) return message.reply('❌ Mise minimum : 1 jeton !');
                if (bet > 150) return message.reply('❌ Mise maximum : 150 jetons !');
                
                await this.startBlackjack({ 
                    user: message.author, 
                    channelId: message.channel.id,
                    reply: (content) => message.reply(content)
                }, bet);
            }

            // Aide
            if (command === '!casino') {
                const embed = new EmbedBuilder()
                    .setTitle('🎰 MINI CASINO 🎰')
                    .setDescription('Bienvenue dans le casino !')
                    .addFields(
                        { name: '💰 Commandes de base', value: '`!daily` - Bonus quotidien (20 jetons)\n`!profil` - Voir vos statistiques', inline: false },
                        { name: '🎰 Machine à sous', value: '`!slots <mise>` - Jouer aux machines à sous\nMise: 1-100 jetons', inline: false },
                        { name: '🎲 Roulette', value: '`!roulette <mise> <choix>`\nChoix: rouge, noir, pair, impair, 0-36\nMise: 1-200 jetons', inline: false },
                        { name: '🃏 Blackjack', value: '`!blackjack <mise>` - Jouer au blackjack\nMise: 1-150 jetons', inline: false }
                    )
                    .setColor(0xff6b6b)
                    .setFooter({ text: 'Vous commencez avec 500 jetons !' });
                
                message.reply({ embeds: [embed] });
            }
        });

        // Gestion des boutons Blackjack
        this.client.on('interactionCreate', async (interaction) => {
            if (!interaction.isButton()) return;

            if (interaction.customId.startsWith('bj_')) {
                const parts = interaction.customId.split('_');
                const action = parts[1];
                const gameId = parts.slice(2).join('_');
                
                await this.handleBlackjackAction(interaction, action, gameId);
            }
        });
    }

    start(token) {
        this.client.login(token);
    }
}

// Utilisation
const casino = new CasinoBot();

// Remplacez 'VOTRE_TOKEN_BOT' par le token de votre bot Discord
casino.start('VOTRE_TOKEN_BOT');

module.exports = CasinoBot;