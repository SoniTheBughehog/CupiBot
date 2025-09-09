const fs = require('fs');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: "casino",
    description: "Système de casino complet avec machine à sous, roulette et blackjack multijoueurs",
    
    playersData: {},
    activeGames: new Map(),
    pendingGames: new Map(),
    
    // Initialisation
    init() {
        this.playersData = this.loadPlayersData();
    },
    
    loadPlayersData() {
        try {
            const dataPath = './data/casino_players.json';
            if (fs.existsSync(dataPath)) {
                return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
            }
        } catch (error) {
            console.log('Erreur de chargement des données casino:', error);
        }
        return {};
    },

    savePlayersData() {
        try {
            const dataDir = './data';
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }
            fs.writeFileSync('./data/casino_players.json', JSON.stringify(this.playersData, null, 2));
        } catch (error) {
            console.log('Erreur de sauvegarde casino:', error);
        }
    },

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
    },

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
    },

    // MACHINE À SOUS (solo uniquement)
    async playSlots(message, bet) {
        const userId = message.author.id;
        const player = this.getPlayer(userId);

        if (player.tokens < bet) {
            return message.reply('❌ Vous n\'avez pas assez de jetons !');
        }

        const symbols = ['🍒', '🍋', '🍊', '🍇', '⭐', '💎', '7️⃣'];
        const reel1 = symbols[Math.floor(Math.random() * symbols.length)];
        const reel2 = symbols[Math.floor(Math.random() * symbols.length)];
        const reel3 = symbols[Math.floor(Math.random() * symbols.length)];

        let winMultiplier = 0;
        let result = '';

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

        await message.reply({ embeds: [embed] });
    },

    // ROULETTE MULTIJOUEUR
    async startRouletteGame(message, bet, choice) {
        const userId = message.author.id;
        const channelId = message.channel.id;
        const gameId = `roulette_${channelId}_${Date.now()}`;
        
        const player = this.getPlayer(userId);
        if (player.tokens < bet) {
            return message.reply('❌ Vous n\'avez pas assez de jetons !');
        }

        const game = {
            type: 'roulette',
            channelId: channelId,
            players: [{
                id: userId,
                name: message.author.username,
                bet: bet,
                choice: choice,
                tokens: player.tokens
            }],
            status: 'waiting',
            timeLeft: 15,
            result: null
        };

        this.pendingGames.set(gameId, game);
        
        const embed = new EmbedBuilder()
            .setTitle('🎲 NOUVELLE PARTIE DE ROULETTE 🎲')
            .setDescription(`**${message.author.username}** lance une partie de roulette !\n\n🕒 Temps restant pour rejoindre: **15 secondes**`)
            .addFields(
                { name: '👥 Joueurs (1)', value: `${message.author.username} - ${bet} sur ${choice}`, inline: false },
                { name: '📝 Pour rejoindre', value: 'Cliquez sur le bouton "Rejoindre" ci-dessous', inline: false }
            )
            .setColor(0xff6b6b)
            .setFooter({ text: 'La roulette tournera automatiquement dans 15 secondes' });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`join_roulette_${gameId}`)
                    .setLabel('🎯 Rejoindre la partie')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`info_roulette_${gameId}`)
                    .setLabel('ℹ️ Infos')
                    .setStyle(ButtonStyle.Secondary)
            );

        const gameMessage = await message.reply({ embeds: [embed], components: [row] });
        
        const updateInterval = setInterval(async () => {
            game.timeLeft -= 3;
            
            if (game.timeLeft <= 0) {
                clearInterval(updateInterval);
                await this.startRouletteSpin(gameMessage, gameId);
                return;
            }

            const updatedEmbed = new EmbedBuilder()
                .setTitle('🎲 NOUVELLE PARTIE DE ROULETTE 🎲')
                .setDescription(`**${message.author.username}** lance une partie de roulette !\n\n🕒 Temps restant: **${game.timeLeft} secondes**`)
                .addFields(
                    { name: `👥 Joueurs (${game.players.length})`, value: game.players.map(p => `${p.name} - ${p.bet} sur ${p.choice}`).join('\n'), inline: false },
                    { name: '📝 Pour rejoindre', value: 'Cliquez sur le bouton "Rejoindre" ci-dessous', inline: false }
                )
                .setColor(0xff6b6b)
                .setFooter({ text: `La roulette tournera automatiquement dans ${game.timeLeft} secondes` });

            try {
                await gameMessage.edit({ embeds: [updatedEmbed], components: [row] });
            } catch (error) {
                console.log('Erreur mise à jour roulette:', error);
            }
        }, 3000);
    },

    async joinRouletteGame(interaction, gameId) {
        const game = this.pendingGames.get(gameId);
        if (!game || game.status !== 'waiting') {
            return interaction.reply({ content: '❌ Cette partie n\'existe plus ou a déjà commencé !', ephemeral: true });
        }

        const userId = interaction.user.id;
        
        if (game.players.find(p => p.id === userId)) {
            return interaction.reply({ content: '❌ Vous participez déjà à cette partie !', ephemeral: true });
        }

        const modal = {
            title: 'Rejoindre la roulette',
            custom_id: `roulette_join_${gameId}`,
            components: [
                {
                    type: 1,
                    components: [{
                        type: 4,
                        custom_id: 'bet_amount',
                        label: 'Mise (1-200 jetons)',
                        style: 1,
                        placeholder: '25',
                        required: true
                    }]
                },
                {
                    type: 1,
                    components: [{
                        type: 4,
                        custom_id: 'bet_choice',
                        label: 'Choix (rouge/noir/pair/impair/0-36)',
                        style: 1,
                        placeholder: 'rouge',
                        required: true
                    }]
                }
            ]
        };

        await interaction.showModal(modal);
    },

    async processRouletteJoin(interaction, gameId, bet, choice) {
        const game = this.pendingGames.get(gameId);
        if (!game || game.status !== 'waiting') {
            return interaction.reply({ content: '❌ Cette partie n\'existe plus ou a déjà commencé !', ephemeral: true });
        }

        const userId = interaction.user.id;
        const player = this.getPlayer(userId);

        if (player.tokens < bet) {
            return interaction.reply({ content: '❌ Vous n\'avez pas assez de jetons !', ephemeral: true });
        }

        if (bet < 1 || bet > 200) {
            return interaction.reply({ content: '❌ Mise entre 1 et 200 jetons !', ephemeral: true });
        }

        const validChoices = ['rouge', 'noir', 'pair', 'impair'];
        const numberChoice = parseInt(choice);
        
        if (!validChoices.includes(choice.toLowerCase()) && (isNaN(numberChoice) || numberChoice < 0 || numberChoice > 36)) {
            return interaction.reply({ content: '❌ Choix invalide ! (rouge, noir, pair, impair, ou 0-36)', ephemeral: true });
        }

        game.players.push({
            id: userId,
            name: interaction.user.username,
            bet: bet,
            choice: choice.toLowerCase(),
            tokens: player.tokens
        });

        await interaction.reply({ content: `✅ Vous avez rejoint la partie avec ${bet} jetons sur ${choice} !`, ephemeral: true });
    },

    async startRouletteSpin(message, gameId) {
        const game = this.pendingGames.get(gameId);
        if (!game) return;

        this.pendingGames.delete(gameId);
        this.activeGames.set(gameId, game);
        
        const spinEmbed = new EmbedBuilder()
            .setTitle('🎲 ROULETTE EN COURS 🎲')
            .setDescription('🌪️ **La roulette tourne...**\n\n🎯 La bille va s\'arrêter...')
            .addFields(
                { name: `👥 Joueurs (${game.players.length})`, value: game.players.map(p => `${p.name} - ${p.bet} sur ${p.choice}`).join('\n'), inline: false }
            )
            .setColor(0xffff00);

        await message.edit({ embeds: [spinEmbed], components: [] });

        const spinFrames = ['🌪️', '💫', '⭐', '✨', '🎯'];
        let currentFrame = 0;
        
        const spinAnimation = setInterval(async () => {
            currentFrame = (currentFrame + 1) % spinFrames.length;
            const animatedEmbed = new EmbedBuilder()
                .setTitle('🎲 ROULETTE EN COURS 🎲')
                .setDescription(`${spinFrames[currentFrame]} **La roulette tourne...**\n\n🎯 La bille va s\'arrêter...`)
                .addFields(
                    { name: `👥 Joueurs (${game.players.length})`, value: game.players.map(p => `${p.name} - ${p.bet} sur ${p.choice}`).join('\n'), inline: false }
                )
                .setColor(0xffff00);

            try {
                await message.edit({ embeds: [animatedEmbed] });
            } catch (error) {
                clearInterval(spinAnimation);
            }
        }, 500);

        setTimeout(async () => {
            clearInterval(spinAnimation);
            await this.finishRouletteGame(message, gameId);
        }, 4000);
    },

    async finishRouletteGame(message, gameId) {
        const game = this.activeGames.get(gameId);
        if (!game) return;

        const number = Math.floor(Math.random() * 37);
        const isRed = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(number);
        const isBlack = number > 0 && !isRed;
        const isEven = number > 0 && number % 2 === 0;
        const isOdd = number > 0 && number % 2 === 1;

        let color = '⚫';
        if (isRed) color = '🔴';
        else if (number === 0) color = '💚';

        let results = [];
        let totalWinnings = 0;
        let totalLosses = 0;

        for (const player of game.players) {
            const playerData = this.getPlayer(player.id);
            let won = false;
            let winMultiplier = 0;

            if (player.choice === 'rouge' && isRed) { won = true; winMultiplier = 2; }
            else if (player.choice === 'noir' && isBlack) { won = true; winMultiplier = 2; }
            else if (player.choice === 'pair' && isEven) { won = true; winMultiplier = 2; }
            else if (player.choice === 'impair' && isOdd) { won = true; winMultiplier = 2; }
            else if (parseInt(player.choice) === number) { won = true; winMultiplier = 36; }

            const winAmount = won ? player.bet * winMultiplier : 0;
            const netGain = winAmount - player.bet;
            
            playerData.tokens = playerData.tokens - player.bet + winAmount;
            playerData.stats.roulettePlayed++;
            
            if (won && netGain > 0) {
                playerData.stats.totalWon += netGain;
                totalWinnings += netGain;
            } else {
                playerData.stats.totalLost += player.bet;
                totalLosses += player.bet;
            }

            results.push({
                name: player.name,
                won: won,
                netGain: netGain,
                newBalance: playerData.tokens
            });

            this.savePlayersData();
        }

        const resultEmbed = new EmbedBuilder()
            .setTitle('🎲 RÉSULTAT DE LA ROULETTE 🎲')
            .setDescription(`🎯 **La bille s'arrête sur:** ${color} **${number}**`)
            .addFields(
                { name: '🏆 Résultats des joueurs', value: results.map(r => 
                    `${r.won ? '🎉' : '😔'} **${r.name}**: ${r.won ? `+${r.netGain}` : `${r.netGain}`} jetons (${r.newBalance} total)`
                ).join('\n'), inline: false },
                { name: '📊 Statistiques', value: `💰 Total gagné: ${totalWinnings} jetons\n💸 Total perdu: ${totalLosses} jetons\n👥 Joueurs: ${results.length}`, inline: false }
            )
            .setColor(totalWinnings > totalLosses ? 0x00ff00 : 0xff0000);

        await message.edit({ embeds: [resultEmbed], components: [] });
        this.activeGames.delete(gameId);
    },

    // BLACKJACK MULTIJOUEUR
    async startBlackjackLobby(message, maxPlayers = 4, bet = 25) {
        const userId = message.author.id;
        const channelId = message.channel.id;
        const gameId = `blackjack_${channelId}_${Date.now()}`;
        
        const player = this.getPlayer(userId);
        if (player.tokens < bet) {
            return message.reply('❌ Vous n\'avez pas assez de jetons !');
        }

        if (maxPlayers < 1 || maxPlayers > 6) {
            return message.reply('❌ Nombre de joueurs entre 1 et 6 !');
        }

        const game = {
            type: 'blackjack',
            channelId: channelId,
            maxPlayers: maxPlayers,
            currentPlayerIndex: 0,
            players: [{
                id: userId,
                name: message.author.username,
                bet: bet,
                cards: [],
                value: 0,
                status: 'waiting',
                tokens: player.tokens
            }],
            dealer: { cards: [], value: 0 },
            status: 'lobby',
            timeLeft: 20
        };

        this.pendingGames.set(gameId, game);
        
        const embed = new EmbedBuilder()
            .setTitle('🃏 NOUVELLE PARTIE DE BLACKJACK 🃏')
            .setDescription(`**${message.author.username}** lance une partie de blackjack !\n\n🕒 Temps restant pour rejoindre: **20 secondes**`)
            .addFields(
                { name: `👥 Joueurs (1/${maxPlayers})`, value: `${message.author.username} - ${bet} jetons`, inline: false },
                { name: '📝 Pour rejoindre', value: `Cliquez sur "Rejoindre" avec ${bet} jetons`, inline: false }
            )
            .setColor(0x0099ff);

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`join_blackjack_${gameId}`)
                    .setLabel(`🃏 Rejoindre (${bet} jetons)`)
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`start_blackjack_${gameId}`)
                    .setLabel('▶️ Commencer maintenant')
                    .setStyle(ButtonStyle.Primary)
            );

        const gameMessage = await message.reply({ embeds: [embed], components: [row] });
        
        const updateInterval = setInterval(async () => {
            game.timeLeft -= 5;
            
            if (game.timeLeft <= 0 || game.players.length >= maxPlayers) {
                clearInterval(updateInterval);
                await this.startBlackjackGame(gameMessage, gameId);
                return;
            }

            const updatedEmbed = new EmbedBuilder()
                .setTitle('🃏 NOUVELLE PARTIE DE BLACKJACK 🃏')
                .setDescription(`**${message.author.username}** lance une partie de blackjack !\n\n🕒 Temps restant: **${game.timeLeft} secondes**`)
                .addFields(
                    { name: `👥 Joueurs (${game.players.length}/${maxPlayers})`, value: game.players.map(p => `${p.name} - ${p.bet} jetons`).join('\n'), inline: false }
                )
                .setColor(0x0099ff);

            try {
                await gameMessage.edit({ embeds: [updatedEmbed], components: [row] });
            } catch (error) {
                console.log('Erreur mise à jour blackjack:', error);
            }
        }, 5000);
    },

    async joinBlackjackGame(interaction, gameId) {
        const game = this.pendingGames.get(gameId);
        if (!game || game.status !== 'lobby') {
            return interaction.reply({ content: '❌ Cette partie n\'existe plus ou a déjà commencé !', ephemeral: true });
        }

        const userId = interaction.user.id;
        const player = this.getPlayer(userId);
        
        if (game.players.find(p => p.id === userId)) {
            return interaction.reply({ content: '❌ Vous participez déjà à cette partie !', ephemeral: true });
        }

        if (game.players.length >= game.maxPlayers) {
            return interaction.reply({ content: '❌ Cette partie est complète !', ephemeral: true });
        }

        const requiredBet = game.players[0].bet;
        
        if (player.tokens < requiredBet) {
            return interaction.reply({ content: `❌ Vous avez besoin de ${requiredBet} jetons pour rejoindre cette partie !`, ephemeral: true });
        }

        game.players.push({
            id: userId,
            name: interaction.user.username,
            bet: requiredBet,
            cards: [],
            value: 0,
            status: 'waiting',
            tokens: player.tokens
        });

        await interaction.reply({ content: `✅ Vous avez rejoint la partie de blackjack avec ${requiredBet} jetons !`, ephemeral: true });
        
        if (game.players.length >= game.maxPlayers) {
            setTimeout(() => this.startBlackjackGame(interaction.message, gameId), 1000);
        }
    },

    async startBlackjackGame(message, gameId) {
        const game = this.pendingGames.get(gameId);
        if (!game) return;

        this.pendingGames.delete(gameId);
        this.activeGames.set(gameId, game);
        
        game.status = 'dealing';

        for (const player of game.players) {
            this.dealCard(player);
            this.dealCard(player);
            player.status = 'waiting';
        }
        
        this.dealCard(game.dealer);
        this.dealCard(game.dealer, true);

        game.status = 'playing';
        game.currentPlayerIndex = 0;
        game.players[0].status = 'playing';

        const embed = this.createMultiBlackjackEmbed(game, false);
        const row = this.createBlackjackButtons(gameId);

        await message.edit({ embeds: [embed], components: [row] });
    },

    // Méthodes utilitaires pour Blackjack
    dealCard(player, hidden = false) {
        const suits = ['♠️', '♥️', '♦️', '♣️'];
        const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
        
        const suit = suits[Math.floor(Math.random() * suits.length)];
        const value = values[Math.floor(Math.random() * values.length)];
        const card = { suit, value, hidden };

        player.cards.push(card);
        this.calculateValue(player);
    },

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

        while (value > 21 && aces > 0) {
            value -= 10;
            aces--;
        }

        player.value = value;
    },

    createMultiBlackjackEmbed(game, showDealerCard = false) {
        const currentPlayer = game.players[game.currentPlayerIndex];
        
        let dealerCards = game.dealer.cards.map(card => {
            if (card.hidden && !showDealerCard) return '🎴';
            return `${card.value}${card.suit}`;
        }).join(' ');

        const embed = new EmbedBuilder()
            .setTitle('🃏 BLACKJACK MULTIJOUEUR 🃏')
            .addFields(
                { name: '🏠 Croupier', value: `${dealerCards}\nValeur: ${showDealerCard ? game.dealer.value : '?'}`, inline: false }
            )
            .setColor(0x0099ff);

        for (let i = 0; i < game.players.length; i++) {
            const player = game.players[i];
            const playerCards = player.cards.map(card => `${card.value}${card.suit}`).join(' ');
            const isCurrentPlayer = i === game.currentPlayerIndex && game.status === 'playing';
            const statusIcon = this.getPlayerStatusIcon(player.status, isCurrentPlayer);
            
            embed.addFields({
                name: `${statusIcon} ${player.name}`,
                value: `${playerCards}\nValeur: ${player.value}\nMise: ${player.bet} jetons`,
                inline: true
            });
        }

        if (game.status === 'playing' && currentPlayer) {
            embed.setFooter({ text: `Tour de ${currentPlayer.name} - Cliquez sur Carte ou Rester` });
        }

        return embed;
    },

    getPlayerStatusIcon(status, isCurrent) {
        if (isCurrent) return '▶️';
        switch (status) {
            case 'waiting': return '⏳';
            case 'stand': return '✋';
            case 'bust': return '💥';
            case 'blackjack': return '🃏';
            case 'finished': return '✅';
            default: return '🎲';
        }
    },

    createBlackjackButtons(gameId) {
        return new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`bj_hit_${gameId}`)
                    .setLabel('🃏 Carte')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`bj_stand_${gameId}`)
                    .setLabel('✋ Rester')
                    .setStyle(ButtonStyle.Secondary)
            );
    },

    async handleBlackjackAction(interaction, action, gameId) {
        const game = this.activeGames.get(gameId);
        if (!game) return interaction.reply({ content: '❌ Partie non trouvée !', ephemeral: true });

        if (game.status !== 'playing') {
            return interaction.reply({ content: '❌ Ce n\'est pas le moment de jouer !', ephemeral: true });
        }

        const currentPlayer = game.players[game.currentPlayerIndex];
        if (!currentPlayer || currentPlayer.id !== interaction.user.id) {
            return interaction.reply({ content: '❌ Ce n\'est pas votre tour !', ephemeral: true });
        }

        if (action === 'hit') {
            this.dealCard(currentPlayer);
            if (currentPlayer.value > 21) {
                currentPlayer.status = 'bust';
                await this.nextBlackjackPlayer(interaction, gameId);
            } else if (currentPlayer.value === 21) {
                currentPlayer.status = 'blackjack';
                await this.nextBlackjackPlayer(interaction, gameId);
            } else {
                const embed = this.createMultiBlackjackEmbed(game, false);
                const row = this.createBlackjackButtons(gameId);
                await interaction.update({ embeds: [embed], components: [row] });
            }
        } else if (action === 'stand') {
            currentPlayer.status = 'stand';
            await this.nextBlackjackPlayer(interaction, gameId);
        }
    },

    async nextBlackjackPlayer(interaction, gameId) {
        const game = this.activeGames.get(gameId);
        
        game.currentPlayerIndex++;
        
        if (game.currentPlayerIndex >= game.players.length) {
            await this.finishMultiBlackjack(interaction, gameId);
        } else {
            game.players[game.currentPlayerIndex].status = 'playing';
            const embed = this.createMultiBlackjackEmbed(game, false);
            const row = this.createBlackjackButtons(gameId);
            await interaction.update({ embeds: [embed], components: [row] });
        }
    },

    async finishMultiBlackjack(interaction, gameId) {
        const game = this.activeGames.get(gameId);
        game.status = 'dealer_turn';

        game.dealer.cards.forEach(card => card.hidden = false);
        this.calculateValue(game.dealer);

        while (game.dealer.value < 17) {
            this.dealCard(game.dealer);
        }

        let results = [];
        let totalWinnings = 0;
        let totalLosses = 0;

        for (const player of game.players) {
            const playerData = this.getPlayer(player.id);
            let result = '';
            let winMultiplier = 0;

            if (player.status === 'bust') {
                result = '💥 Dépassé 21';
                winMultiplier = 0;
            } else if (game.dealer.value > 21) {
                result = '🎉 Croupier dépassé';
                winMultiplier = 2;
            } else if (player.value === 21 && player.cards.length === 2) {
                result = '🃏 BLACKJACK';
                winMultiplier = 2.5;
            } else if (player.value > game.dealer.value) {
                result = '🎉 Victoire';
                winMultiplier = 2;
            } else if (player.value === game.dealer.value) {
                result = '🤝 Égalité';
                winMultiplier = 1;
            } else {
                result = '😔 Défaite';
                winMultiplier = 0;
            }

            const winAmount = player.bet * winMultiplier;
            const netGain = winAmount - player.bet;
            
            playerData.tokens = playerData.tokens - player.bet + winAmount;
            playerData.stats.blackjackPlayed++;
            
            if (netGain > 0) {
                playerData.stats.totalWon += netGain;
                totalWinnings += netGain;
            } else if (netGain < 0) {
                playerData.stats.totalLost += Math.abs(netGain);
                totalLosses += Math.abs(netGain);
            }

            results.push({
                name: player.name,
                result: result,
                netGain: netGain,
                newBalance: playerData.tokens
            });

            player.status = 'finished';
            this.savePlayersData();
        }

        const finalEmbed = this.createMultiBlackjackEmbed(game, true);
        finalEmbed.addFields(
            { name: '🏆 Résultats finaux', value: results.map(r => 
                `${r.result.includes('🎉') || r.result.includes('🃏') ? '🎉' : r.result.includes('🤝') ? '🤝' : '😔'} **${r.name}**: ${r.result}\n` +
                `   💰 ${r.netGain >= 0 ? `+${r.netGain}` : r.netGain} jetons (${r.newBalance} total)`
            ).join('\n'), inline: false },
            { name: '📊 Statistiques de la partie', value: `💰 Total gagné: ${totalWinnings} jetons\n💸 Total perdu: ${totalLosses} jetons\n👥 Joueurs: ${results.length}`, inline: false }
        );
        
        finalEmbed.setColor(totalWinnings >= totalLosses ? 0x00ff00 : 0xff0000);
        finalEmbed.setFooter({ text: 'Partie terminée ! Merci d\'avoir joué !' });

        await interaction.update({ embeds: [finalEmbed], components: [] });
        this.activeGames.delete(gameId);
    },

    // Méthodes solo pour compatibilité
    async playSoloRoulette(message, bet, choice) {
        const userId = message.author.id;
        const player = this.getPlayer(userId);

        if (player.tokens < bet) {
            return message.reply('❌ Vous n\'avez pas assez de jetons !');
        }

        if (bet < 1 || bet > 200) {
            return message.reply('❌ Mise entre 1 et 200 jetons !');
        }

        const validChoices = ['rouge', 'noir', 'pair', 'impair'];
        const numberChoice = parseInt(choice);
        
        if (!validChoices.includes(choice) && (isNaN(numberChoice) || numberChoice < 0 || numberChoice > 36)) {
            return message.reply('❌ Choix invalide ! (rouge, noir, pair, impair, ou 0-36)');
        }

        const number = Math.floor(Math.random() * 37);
        const isRed = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(number);
        const isBlack = number > 0 && !isRed;
        const isEven = number > 0 && number % 2 === 0;
        const isOdd = number > 0 && number % 2 === 1;

        let won = false;
        let winMultiplier = 0;

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
            .setTitle('🎲 ROULETTE SOLO 🎲')
            .setDescription(`La bille s'arrête sur: ${color} **${number}**`)
            .addFields(
                { name: 'Votre mise', value: `${bet} sur ${choice}`, inline: true },
                { name: 'Résultat', value: won ? '🎉 Gagné !' : '😔 Perdu', inline: true },
                { name: 'Gain', value: `${winAmount} jetons`, inline: true },
                { name: 'Vos jetons', value: `${player.tokens}`, inline: true }
            )
            .setColor(won ? 0x00ff00 : 0xff0000);

        await message.reply({ embeds: [embed] });
    },

    async startSoloBlackjack(message, bet) {
        const userId = message.author.id;
        const player = this.getPlayer(userId);

        if (player.tokens < bet) {
            return message.reply('❌ Vous n\'avez pas assez de jetons !');
        }

        const gameId = `solo_bj_${message.channel.id}_${Date.now()}`;
        const game = {
            players: [{
                id: userId,
                name: message.author.username,
                cards: [],
                value: 0,
                bet: bet,
                status: 'playing'
            }],
            dealer: { cards: [], value: 0 },
            status: 'playing'
        };

        this.dealCard(game.players[0]);
        this.dealCard(game.players[0]);
        this.dealCard(game.dealer);
        this.dealCard(game.dealer, true);

        this.activeGames.set(gameId, game);

        const embed = this.createSoloBlackjackEmbed(game, false);
        const row = this.createBlackjackButtons(gameId);

        await message.reply({ embeds: [embed], components: [row] });
    },

    createSoloBlackjackEmbed(game, showDealerCard = false) {
        const player = game.players[0];
        let dealerCards = game.dealer.cards.map(card => {
            if (card.hidden && !showDealerCard) return '🎴';
            return `${card.value}${card.suit}`;
        }).join(' ');

        const playerCards = player.cards.map(card => `${card.value}${card.suit}`).join(' ');

        const embed = new EmbedBuilder()
            .setTitle('🃏 BLACKJACK SOLO 🃏')
            .addFields(
                { name: '🏠 Croupier', value: `${dealerCards}\nValeur: ${showDealerCard ? game.dealer.value : '?'}`, inline: false },
                { name: `🎲 ${player.name}`, value: `${playerCards}\nValeur: ${player.value}\nMise: ${player.bet}`, inline: false }
            )
            .setColor(0x0099ff);

        return embed;
    },

    async handleSoloBlackjackAction(interaction, action, gameId) {
        const game = this.activeGames.get(gameId);
        if (!game) return interaction.reply({ content: '❌ Partie non trouvée !', ephemeral: true });

        const player = game.players.find(p => p.id === interaction.user.id);
        if (!player) return interaction.reply({ content: '❌ Vous ne participez pas à cette partie !', ephemeral: true });

        if (action === 'hit') {
            this.dealCard(player);
            if (player.value > 21) {
                player.status = 'bust';
                await this.finishSoloBlackjack(interaction, gameId);
            } else if (player.value === 21) {
                player.status = 'blackjack';
                await this.finishSoloBlackjack(interaction, gameId);
            } else {
                const embed = this.createSoloBlackjackEmbed(game, false);
                const row = this.createBlackjackButtons(gameId);
                await interaction.update({ embeds: [embed], components: [row] });
            }
        } else if (action === 'stand') {
            player.status = 'stand';
            await this.finishSoloBlackjack(interaction, gameId);
        }
    },

    async finishSoloBlackjack(interaction, gameId) {
        const game = this.activeGames.get(gameId);
        const player = game.players[0];

        game.dealer.cards.forEach(card => card.hidden = false);
        this.calculateValue(game.dealer);

        while (game.dealer.value < 17) {
            this.dealCard(game.dealer);
        }

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

        const embed = this.createSoloBlackjackEmbed(game, true);
        embed.addFields({ name: 'Résultat', value: `${result}\nGain: ${winAmount} jetons\nVos jetons: ${playerData.tokens}` });
        embed.setColor(winAmount >= player.bet ? 0x00ff00 : 0xff0000);

        await interaction.update({ embeds: [embed], components: [] });
    },

    // Fonction d'exécution principale
    async execute(message, args) {
        if (!this.playersData || Object.keys(this.playersData).length === 0) {
            this.init();
        }

        const command = args[0]?.toLowerCase();

        if (command === 'daily') {
            const claimed = this.claimDailyBonus(message.author.id);
            const player = this.getPlayer(message.author.id);
            
            if (claimed) {
                message.reply(`🎁 Vous avez récupéré vos 20 jetons quotidiens !\nVous avez maintenant ${player.tokens} jetons.`);
            } else {
                message.reply('❌ Vous avez déjà récupéré vos jetons aujourd\'hui !');
            }
            return;
        }

        if (command === 'profil') {
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
            return;
        }

        if (command === 'slots') {
            const bet = parseInt(args[1]) || 10;
            if (bet < 1) return message.reply('❌ Mise minimum : 1 jeton !');
            if (bet > 100) return message.reply('❌ Mise maximum : 100 jetons !');
            
            await this.playSlots(message, bet);
            return;
        }

        if (command === 'roulette') {
            if (args[1] === 'solo') {
                const bet = parseInt(args[2]);
                const choice = args[3]?.toLowerCase();
                
                if (!bet || !choice) {
                    return message.reply('❌ Usage: `!casino roulette solo <mise> <choix>`\nChoix possibles: rouge, noir, pair, impair, ou un numéro (0-36)');
                }
                
                await this.playSoloRoulette(message, bet, choice);
            } else {
                const bet = parseInt(args[1]) || 25;
                const choice = args[2]?.toLowerCase() || 'rouge';
                
                if (bet < 1 || bet > 200) {
                    return message.reply('❌ Mise entre 1 et 200 jetons !');
                }

                const validChoices = ['rouge', 'noir', 'pair', 'impair'];
                const numberChoice = parseInt(choice);
                
                if (!validChoices.includes(choice) && (isNaN(numberChoice) || numberChoice < 0 || numberChoice > 36)) {
                    return message.reply('❌ Choix invalide ! (rouge, noir, pair, impair, ou 0-36)');
                }

                await this.startRouletteGame(message, bet, choice);
            }
            return;
        }

        if (command === 'blackjack') {
            if (args[1] === 'solo') {
                const bet = parseInt(args[2]) || 25;
                if (bet < 1) return message.reply('❌ Mise minimum : 1 jeton !');
                if (bet > 150) return message.reply('❌ Mise maximum : 150 jetons !');
                
                await this.startSoloBlackjack(message, bet);
            } else {
                const maxPlayers = parseInt(args[1]) || 4;
                const bet = parseInt(args[2]) || 25;
                
                if (bet < 1 || bet > 150) {
                    return message.reply('❌ Mise entre 1 et 150 jetons !');
                }
                
                await this.startBlackjackLobby(message, maxPlayers, bet);
            }
            return;
        }

        // Aide par défaut
        const embed = new EmbedBuilder()
            .setTitle('🎰 MINI CASINO MULTIJOUEUR 🎰')
            .setDescription('Bienvenue dans le casino !')
            .addFields(
                { name: '💰 Commandes de base', value: '`!casino daily` - Bonus quotidien (20 jetons)\n`!casino profil` - Voir vos statistiques', inline: false },
                { name: '🎰 Machine à sous (Solo)', value: '`!casino slots <mise>` - Jouer aux machines à sous\nMise: 1-100 jetons', inline: false },
                { name: '🎲 Roulette', value: '`!casino roulette <mise> <choix>` - **Multijoueur** (15s pour rejoindre)\n`!casino roulette solo <mise> <choix>` - Solo classique\nChoix: rouge, noir, pair, impair, 0-36', inline: false },
                { name: '🃏 Blackjack', value: '`!casino blackjack <joueurs> <mise>` - **Multijoueur** (20s pour rejoindre)\n`!casino blackjack solo <mise>` - Solo classique\nJoueurs: 1-6, Mise: 1-150 jetons', inline: false },
                { name: '🆕 Nouveautés', value: '• Roulette et Blackjack multijoueurs\n• Animations et effets visuels\n• Statistiques de partie\n• Lobbies avec timer', inline: false }
            )
            .setColor(0xff6b6b)
            .setFooter({ text: 'Vous commencez avec 500 jetons ! Les modes multijoueurs sont maintenant par défaut.' });
        
        message.reply({ embeds: [embed] });
    },

    // Gestion des interactions (boutons et modals)
    async handleInteraction(interaction) {
        if (interaction.isButton()) {
            const customId = interaction.customId;
            
            // Boutons Blackjack
            if (customId.startsWith('bj_')) {
                const parts = customId.split('_');
                const action = parts[1];
                const gameId = parts.slice(2).join('_');
                
                // Vérifier si c'est un jeu solo ou multi
                const game = this.activeGames.get(gameId);
                if (game && game.players && game.players.length === 1) {
                    await this.handleSoloBlackjackAction(interaction, action, gameId);
                } else {
                    await this.handleBlackjackAction(interaction, action, gameId);
                }
            }
            
            // Boutons Roulette
            else if (customId.startsWith('join_roulette_')) {
                const gameId = customId.replace('join_roulette_', '');
                await this.joinRouletteGame(interaction, gameId);
            }
            
            else if (customId.startsWith('info_roulette_')) {
                const embed = new EmbedBuilder()
                    .setTitle('ℹ️ Informations Roulette')
                    .setDescription('**Comment jouer à la roulette multijoueur :**')
                    .addFields(
                        { name: '🎯 Choix possibles', value: '• **rouge/noir** - Paye 2:1\n• **pair/impair** - Paye 2:1\n• **Numéro (0-36)** - Paye 36:1', inline: false },
                        { name: '⏰ Déroulement', value: '• 15 secondes pour rejoindre\n• Sélectionner mise et choix\n• Animation de la roulette\n• Résultats pour tous', inline: false }
                    )
                    .setColor(0x0099ff);
                await interaction.reply({ embeds: [embed], ephemeral: true });
            }
            
            // Boutons Blackjack
            else if (customId.startsWith('join_blackjack_')) {
                const gameId = customId.replace('join_blackjack_', '');
                await this.joinBlackjackGame(interaction, gameId);
            }
            
            else if (customId.startsWith('start_blackjack_')) {
                const gameId = customId.replace('start_blackjack_', '');
                const game = this.pendingGames.get(gameId);
                
                if (game && game.players.find(p => p.id === interaction.user.id)) {
                    await this.startBlackjackGame(interaction.message, gameId);
                    await interaction.reply({ content: '▶️ Partie lancée !', ephemeral: true });
                } else {
                    await interaction.reply({ content: '❌ Seul un participant peut démarrer la partie !', ephemeral: true });
                }
            }
        }
        
        // Gestion des modals pour la roulette
        else if (interaction.isModalSubmit()) {
            if (interaction.customId.startsWith('roulette_join_')) {
                const gameId = interaction.customId.replace('roulette_join_', '');
                const bet = parseInt(interaction.fields.getTextInputValue('bet_amount'));
                const choice = interaction.fields.getTextInputValue('bet_choice').toLowerCase();
                
                await this.processRouletteJoin(interaction, gameId, bet, choice);
            }
        }
    }
};