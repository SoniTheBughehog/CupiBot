const fs = require("fs");
const path = require("path");
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const filePath = path.join(__dirname, "..", "data", "note.json");

// --- Lecture / écriture et Migration ---
function readData() {
  if (!fs.existsSync(filePath)) return {};
  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    let changesMade = false;

    // Migration pour chaque utilisateur vers le nouveau système de catégories dynamiques
    for (const userId in data) {
      const userData = data[userId];
      if (!userData.categories) {
        changesMade = true;
        userData.categories = []; // Initialise le tableau des catégories
        
        // Catégorie par défaut
        userData.categories.push({ name: "autre", emoji: "📝" });

        // Scanne les notes existantes pour créer les catégories initiales
        const existingCats = new Set(userData.notes.map(n => n.category).filter(Boolean));
        
        // Liste des anciennes catégories pour récupérer les emojis
        const OLD_CATEGORIES = {
          "travail": { emoji: "💼" }, "perso": { emoji: "🏠" }, "sante": { emoji: "🏥" },
          "shopping": { emoji: "🛒" }, "rdv": { emoji: "📅" }, "idee": { emoji: "💡" },
          "urgent": { emoji: "🚨" }, "projet": { emoji: "🎯" }
        };

        existingCats.forEach(catName => {
          if (catName !== 'autre' && !userData.categories.some(c => c.name === catName)) {
            userData.categories.push({
              name: catName,
              emoji: OLD_CATEGORIES[catName]?.emoji || '📌' // Utilise l'ancien emoji ou un par défaut
            });
          }
        });
        console.log(`Migrated categories for user ${userId}.`);
      }
    }

    if (changesMade) {
      saveData(data);
    }
    return data;
  } catch {
    return {};
  }
}

function saveData(data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// --- Fonctions utilitaires ---
function createEmbed({ title, description, color = "#2196f3", error = false, footer, fields = [] }) {
  const embed = new EmbedBuilder()
    .setTitle(error ? `❌ ${title}` : title)
    .setDescription(description)
    .setColor(error ? "#ff0000" : color)
    .setTimestamp();
  if (footer) embed.setFooter({ text: footer });
  if (fields.length) embed.addFields(fields);
  return embed;
}

function getUserCategory(userData, categoryName) {
    return userData.categories.find(c => c.name === categoryName) || userData.categories.find(c => c.name === 'autre');
}

// --- Pagination et Affichage ---
const NOTES_PER_PAGE = 5;

function paginateNotes(notes, page = 1) {
  const start = (page - 1) * NOTES_PER_PAGE;
  return {
    notes: notes.slice(start, start + NOTES_PER_PAGE),
    currentPage: page,
    totalPages: Math.ceil(notes.length / NOTES_PER_PAGE)
  };
}

function createNavigationButtons(currentPage, totalPages, userId, filter = null) {
  if (totalPages <= 1) return [];
  const filterString = filter ? `${filter.type}_${filter.value}` : 'all_none';
  const row = new ActionRowBuilder();
  
  if (currentPage > 1) {
    row.addComponents(new ButtonBuilder().setCustomId(`note_prev_${userId}_${currentPage - 1}_${filterString}`).setLabel("◀ Précédent").setStyle(ButtonStyle.Primary));
  }
  row.addComponents(new ButtonBuilder().setCustomId('note_page').setLabel(`${currentPage}/${totalPages}`).setStyle(ButtonStyle.Secondary).setDisabled(true));
  if (currentPage < totalPages) {
    row.addComponents(new ButtonBuilder().setCustomId(`note_next_${userId}_${currentPage + 1}_${filterString}`).setLabel("Suivant ▶").setStyle(ButtonStyle.Primary));
  }
  return [row];
}

function formatNotesPage(userData, allNotes, pagination, filter = null) {
  if (!allNotes || allNotes.length === 0) {
    let emptyMessage = "Ta liste est vide pour l'instant.";
    if (filter) {
        emptyMessage = filter.type === 'search' 
            ? `Aucune note trouvée pour "${filter.value}"` 
            : `Aucune note dans la catégorie "${filter.value}"`;
    }
    return createEmbed({
      title: "📭 Aucune note",
      description: emptyMessage + "\n\n💡 Ajoute une note avec : `!note add [catégorie] <texte>`",
    });
  }

  const { notes: pageNotes, currentPage, totalPages } = pagination;
  let title = "📋 Tes notes";
  if (filter) {
    if (filter.type === 'search') title = `🔍 Recherche : "${filter.value}"`;
    else if (filter.type === 'category') {
        const cat = getUserCategory(userData, filter.value);
        title = `${cat.emoji} Notes - ${cat.name}`;
    }
  }
  
  const startIndex = (currentPage - 1) * NOTES_PER_PAGE;
  const description = pageNotes.map((note, i) => {
    const globalIndex = startIndex + i + 1;
    const cat = getUserCategory(userData, note.category);
    return `**${globalIndex}.** ${cat.emoji} ${note.sujet}`;
  }).join("\n");

  return createEmbed({
    title,
    description,
    footer: `Page ${currentPage}/${totalPages} • ${allNotes.length} notes au total`,
  });
}

function filterNotes(notes, filter = null) {
  if (!filter) return notes;
  if (filter.type === 'category') {
    return notes.filter(note => note.category === filter.value);
  }
  if (filter.type === 'search') {
    const searchLower = filter.value.toLowerCase();
    return notes.filter(note => note.sujet.toLowerCase().includes(searchLower));
  }
  return notes;
}

// --- Module ---
module.exports = {
  name: "note",
  description: "Gère ta liste personnelle de notes avec des catégories personnalisées",

  async execute(message, args) {
    const userId = message.author.id;
    const data = readData();
    if (!data[userId]) data[userId] = { channelId: null, notes: [], categories: [{name: "autre", emoji: "📝"}] };
    const userData = data[userId];

    if (!args.length) {
      const filtered = filterNotes(userData.notes);
      const pagination = paginateNotes(filtered);
      const embed = formatNotesPage(userData, filtered, pagination);
      const buttons = createNavigationButtons(1, pagination.totalPages, userId);
      return message.channel.send({ embeds: [embed], components: buttons });
    }

    const sub = args.shift().toLowerCase();

    switch (sub) {
      case "add": {
        let categoryName = 'autre';
        let sujet = args.join(" ").trim();
        
        const catMatch = sujet.match(/^\[([a-zA-Z0-9]+)\]\s*/);
        if (catMatch) {
            const potentialCat = catMatch[1].toLowerCase();
            if (userData.categories.some(c => c.name === potentialCat)) {
                categoryName = potentialCat;
                sujet = sujet.substring(catMatch[0].length);
            }
        }

        if (!sujet) {
            return message.channel.send({ embeds: [createEmbed({ title: "Sujet manquant", description: "Usage : `!note add [catégorie] <texte>`", error: true })] });
        }
        
        const newNote = { sujet, category: categoryName, addedAt: new Date().toISOString() };
        userData.notes.push(newNote);
        saveData(data);
        
        const cat = getUserCategory(userData, categoryName);
        return message.channel.send({ embeds: [createEmbed({ title: `${cat.emoji} Note ajoutée`, description: `**Contenu :** ${sujet}`, footer: `Catégorie : ${cat.name} • Note #${userData.notes.length}` })] });
      }

      case "list": {
        const category = args[0]?.toLowerCase();
        const filter = category ? { type: 'category', value: category } : null;
        const filtered = filterNotes(userData.notes, filter);
        const pagination = paginateNotes(filtered);
        const embed = formatNotesPage(userData, filtered, pagination, filter);
        const buttons = createNavigationButtons(1, pagination.totalPages, userId, filter);
        return message.channel.send({ embeds: [embed], components: buttons });
      }

      case "search": {
        const search = args.join(" ").trim();
        if (!search) return message.channel.send({ embeds: [createEmbed({ title: "Recherche vide", description: "Usage : `!note search <mot-clé>`", error: true })] });
        
        const filter = { type: 'search', value: search };
        const filtered = filterNotes(userData.notes, filter);
        const pagination = paginateNotes(filtered);
        const embed = formatNotesPage(userData, filtered, pagination, filter);
        const buttons = createNavigationButtons(1, pagination.totalPages, userId, filter);
        return message.channel.send({ embeds: [embed], components: buttons });
      }

      case "cat": {
        const action = args.shift()?.toLowerCase();
        switch (action) {
            case 'add':
                const [emoji, ...nameParts] = args;
                const name = nameParts.join(' ').toLowerCase();
                if (!emoji || !name) return message.channel.send({ embeds: [createEmbed({ title: "Usage incorrect", description: "Syntaxe : `!note cat add <emoji> <nom>`", error: true })] });
                if (userData.categories.some(c => c.name === name)) return message.channel.send({ embeds: [createEmbed({ title: "Catégorie existante", description: `La catégorie "${name}" existe déjà.`, error: true })] });
                
                userData.categories.push({ name, emoji });
                saveData(data);
                return message.channel.send({ embeds: [createEmbed({ title: "✅ Catégorie ajoutée", description: `La catégorie ${emoji} **${name}** a été créée.` })] });

            case 'del':
                const catToDelete = args.join(' ').toLowerCase();
                if (!catToDelete || catToDelete === 'autre') return message.channel.send({ embeds: [createEmbed({ title: "Usage incorrect", description: "Syntaxe : `!note cat del <nom>`\nLa catégorie 'autre' ne peut pas être supprimée.", error: true })] });

                const catIndex = userData.categories.findIndex(c => c.name === catToDelete);
                if (catIndex === -1) return message.channel.send({ embeds: [createEmbed({ title: "Introuvable", description: `La catégorie "${catToDelete}" n'existe pas.`, error: true })] });

                // Réassigner les notes de cette catégorie à 'autre'
                userData.notes.forEach(note => {
                    if (note.category === catToDelete) {
                        note.category = 'autre';
                    }
                });

                const [removed] = userData.categories.splice(catIndex, 1);
                saveData(data);
                return message.channel.send({ embeds: [createEmbed({ title: "🗑️ Catégorie supprimée", description: `La catégorie ${removed.emoji} **${removed.name}** a été supprimée. Les notes associées ont été déplacées dans "autre".` })] });
            
            case 'list':
            default:
                const categoryList = userData.categories.map(c => `${c.emoji} **${c.name}**`).join("\n");
                return message.channel.send({ embeds: [createEmbed({ title: "📂 Tes catégories personnalisées", description: [categoryList, "", "**Commandes :**", "`!note cat add <emoji> <nom>`", "`!note cat del <nom>`"].join('\n')})] });
        }
      }

      case "del": {
        const num = parseInt(args[0], 10);
        if (isNaN(num) || num < 1 || num > userData.notes.length) {
          return message.channel.send({ embeds: [createEmbed({ title: "Numéro invalide", description: `Choisis un numéro entre 1 et ${userData.notes.length}.`, error: true })] });
        }
        const [removed] = userData.notes.splice(num - 1, 1);
        saveData(data);
        const cat = getUserCategory(userData, removed.category);
        return message.channel.send({ embeds: [createEmbed({ title: "🗑️ Note supprimée", description: `**${removed.sujet}** a été retirée de ta liste.`, footer: `Catégorie : ${cat.name}` })] });
      }

      default:
        // Aide générale
        return message.channel.send({embeds: [createEmbed({ title: "Commande inconnue", description: "**Commandes principales :**\n`!note add [cat] <texte>`\n`!note list [cat]`\n`!note search <mot>`\n`!note del <num>`\n`!note cat list` (pour gérer les catégories)", error: true })]});
    }
  },

  async handleInteraction(interaction) {
    if (!interaction.isButton() || !interaction.customId.startsWith('note_')) return;
    const [action, direction, userId, page, filterType, filterValue] = interaction.customId.split('_');
    if (interaction.user.id !== userId) return interaction.reply({ content: "Vous ne pouvez pas utiliser ces boutons.", ephemeral: true });

    if (direction === 'page') return;
    
    const data = readData();
    const userData = data[userId];
    if (!userData) return;

    const filter = filterType === 'all' ? null : { type: filterType, value: filterValue };
    const filteredNotes = filterNotes(userData.notes, filter);
    const pagination = paginateNotes(filteredNotes, parseInt(page));
    const embed = formatNotesPage(userData, filteredNotes, pagination, filter);
    const buttons = createNavigationButtons(pagination.currentPage, pagination.totalPages, userId, filter);
    
    await interaction.update({ embeds: [embed], components: buttons });
  },

  // --- Fonctions réutilisables pour cron ou autre ---
  listNotes: (userId) => {
    const data = readData();
    const userData = data[userId] || { notes: [], categories: [{ name: "autre", emoji: "📝" }] };
    const filtered = filterNotes(userData.notes);
    const pagination = paginateNotes(filtered);
    return formatNotesPage(userData, filtered, pagination);
  },

  getAllNotes: () => {
    const data = readData();
    return Object.entries(data)
      .filter(
        ([_, userData]) =>
          userData.channelId &&
          Array.isArray(userData.notes) &&
          userData.notes.length,
      )
      .map(([userId, userData]) => ({
        userId,
        channelId: userData.channelId,
        notes: userData.notes,
        categories: userData.categories,
      }));
  },

  async sendNotesCron(client) {
    const allNotes = module.exports.getAllNotes();
    for (const { channelId, notes, userId, categories } of allNotes) {
      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (!channel) continue;
      const userData = { notes, categories };
      const filtered = filterNotes(notes);
      const pagination = paginateNotes(filtered);
      await channel.send({
        content: `<@${userId}>`,
        embeds: [formatNotesPage(userData, filtered, pagination)],
      });
    }
  },
};