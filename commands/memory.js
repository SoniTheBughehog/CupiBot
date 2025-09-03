const fs = require("fs");
const path = require("path");
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const filePath = path.join(__dirname, "..", "data", "memory.json");

// --- Lecture / écriture ---
function readMemory() {
  if (!fs.existsSync(filePath)) {
    return { memories: [], categories: ["général", "voyage", "travail", "famille", "amis"], nextId: 1 };
  }
  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    
    // Migration et initialisation si nécessaire
    if (!data.memories) data.memories = [];
    if (!data.categories) data.categories = ["général", "voyage", "travail", "famille", "amis"];
    if (!data.nextId) data.nextId = Math.max(...data.memories.map(m => m.id || 0), 0) + 1;
    
    return data;
  } catch {
    return { memories: [], categories: ["général", "voyage", "travail", "famille", "amis"], nextId: 1 };
  }
}

function saveMemory(data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// --- Utilitaires de date ---
function parseMemoryDate(dateStr) {
  if (!dateStr) return null;
  
  // Format complet JJ/MM/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
    const [day, month, year] = dateStr.split("/").map(Number);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return { type: "full", day, month, year, original: dateStr };
    }
  }
  
  // Format mois/année MM/YYYY
  if (/^\d{1,2}\/\d{4}$/.test(dateStr)) {
    const [month, year] = dateStr.split("/").map(Number);
    if (month >= 1 && month <= 12) {
      return { type: "month", month, year, original: dateStr };
    }
  }
  
  // Juste l'année YYYY
  if (/^\d{4}$/.test(dateStr)) {
    const year = Number(dateStr);
    if (year >= 1900 && year <= 2100) {
      return { type: "year", year, original: dateStr };
    }
  }
  
  return null;
}

function formatMemoryDate(dateObj) {
  if (!dateObj) return "Date inconnue";
  
  const months = [
    "Jan", "Fév", "Mar", "Avr", "Mai", "Juin",
    "Juil", "Août", "Sep", "Oct", "Nov", "Déc"
  ];
  
  switch (dateObj.type) {
    case "full":
      return `${dateObj.day}/${dateObj.month}/${dateObj.year}`;
    case "month":
      return `${months[dateObj.month - 1]} ${dateObj.year}`;
    case "year":
      return `${dateObj.year}`;
    default:
      return dateObj.original || "Date inconnue";
  }
}

// --- Embeds ---
function createEmbed({ title, description, color = 0x3498db, footer, fields = [] }) {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setTimestamp();
  if (footer) embed.setFooter({ text: footer });
  if (fields.length) embed.addFields(fields);
  return embed;
}

function createErrorEmbed(title, description) {
  return createEmbed({
    title: `❌ ${title}`,
    description,
    color: 0xff0000,
  });
}

// --- Catégories ---
const CATEGORY_EMOJIS = {
  "général": "📝",
  "voyage": "✈️",
  "travail": "💼",
  "famille": "👨‍👩‍👧‍👦",
  "amis": "👥",
  "école": "🎓",
  "sport": "⚽",
  "loisir": "🎮",
  "santé": "🏥",
  "projet": "🎯"
};

function getCategoryEmoji(category) {
  return CATEGORY_EMOJIS[category?.toLowerCase()] || "📄";
}

function getCategoryColor(category) {
  const colors = {
    "général": 0x95a5a6,
    "voyage": 0x3498db,
    "travail": 0xe67e22,
    "famille": 0xe74c3c,
    "amis": 0xf39c12,
    "école": 0x9b59b6,
    "sport": 0x27ae60,
    "loisir": 0x1abc9c,
    "santé": 0xe91e63,
    "projet": 0x34495e
  };
  return colors[category?.toLowerCase()] || 0x3498db;
}

// --- Pagination ---
const MEMORIES_PER_PAGE = 5;

function paginateMemories(memories, page = 1) {
  const start = (page - 1) * MEMORIES_PER_PAGE;
  const end = start + MEMORIES_PER_PAGE;
  const totalPages = Math.ceil(memories.length / MEMORIES_PER_PAGE);
  
  return {
    memories: memories.slice(start, end),
    currentPage: page,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1
  };
}

function createNavigationButtons(currentPage, totalPages, userId, category = null, search = null) {
  if (totalPages <= 1) return [];
  
  const row = new ActionRowBuilder();
  
  if (currentPage > 1) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`memory_prev_${userId}_${currentPage - 1}_${category || 'all'}_${search || 'none'}`)
        .setLabel("◀ Précédent")
        .setStyle(ButtonStyle.Primary)
    );
  }
  
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`memory_page_${userId}`)
      .setLabel(`${currentPage}/${totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true)
  );
  
  if (currentPage < totalPages) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`memory_next_${userId}_${currentPage + 1}_${category || 'all'}_${search || 'none'}`)
        .setLabel("Suivant ▶")
        .setStyle(ButtonStyle.Primary)
    );
  }
  
  return [row];
}

// --- Formatage des souvenirs ---
function formatMemoriesPage(memories, pagination, category = null, search = null) {
  if (!memories || memories.length === 0) {
    const emptyMessage = search 
      ? `Aucun souvenir trouvé pour "${search}"`
      : category 
        ? `Aucun souvenir dans la catégorie "${category}"`
        : "Aucun souvenir enregistré pour l'instant.";
    
    return createEmbed({
      title: "📭 Aucun souvenir",
      description: emptyMessage + "\n\n💡 Ajoute un souvenir avec : `!memory add [catégorie] [date] <texte>`",
      color: 0x95a5a6,
    });
  }

  const { memories: pageMemories, currentPage, totalPages } = pagination;
  
  let title = "📚 Tes souvenirs";
  if (search) {
    title = `🔍 Recherche : "${search}"`;
  } else if (category) {
    const emoji = getCategoryEmoji(category);
    title = `${emoji} Souvenirs - ${category}`;
  }
  
  if (totalPages > 1) {
    title += ` (Page ${currentPage}/${totalPages})`;
  }

  const description = pageMemories.map((memory) => {
    const emoji = getCategoryEmoji(memory.category);
    const dateStr = formatMemoryDate(memory.date);
    const categoryBadge = `${emoji} **${memory.category}**`;
    const dateBadge = memory.date ? ` • 📅 ${dateStr}` : "";
    
    return `${categoryBadge}${dateBadge}\n**${memory.text}**`;
  }).join("\n\n");

  const statsText = totalPages > 1 
    ? `Page ${currentPage}/${totalPages} • ${memories.length} souvenirs au total`
    : `${memories.length} souvenir${memories.length > 1 ? 's' : ''} au total`;

  return createEmbed({
    title,
    description,
    color: category ? getCategoryColor(category) : 0x3498db,
    footer: statsText,
  });
}

// --- Filtrage ---
function filterMemories(memories, category = null, search = null) {
  let filtered = [...memories];
  
  if (category && category !== 'all') {
    filtered = filtered.filter(m => m.category?.toLowerCase() === category.toLowerCase());
  }
  
  if (search && search !== 'none') {
    const searchLower = search.toLowerCase();
    filtered = filtered.filter(m => 
      m.text.toLowerCase().includes(searchLower) ||
      m.category?.toLowerCase().includes(searchLower)
    );
  }
  
  // Trier par date (plus récent en premier)
  filtered.sort((a, b) => {
    if (!a.createdAt && !b.createdAt) return 0;
    if (!a.createdAt) return 1;
    if (!b.createdAt) return -1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
  
  return filtered;
}

// --- Affichage des catégories ---
function getCategoriesEmbed(data) {
  const categoryCounts = {};
  
  data.memories.forEach(memory => {
    const cat = memory.category || 'général';
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  });
  
  const categoryList = data.categories.map(cat => {
    const count = categoryCounts[cat] || 0;
    const emoji = getCategoryEmoji(cat);
    return `${emoji} **${cat}** (${count})`;
  }).join("\n");
  
  return createEmbed({
    title: "📂 Catégories disponibles",
    description: [
      categoryList,
      "",
      "**Utilisation :**",
      "`!memory add [catégorie] [date] <texte>` - Ajouter",
      "`!memory list [catégorie]` - Voir une catégorie",
      "`!memory addcat <nom>` - Ajouter une catégorie",
    ].join("\n"),
    color: 0x9b59b6,
    footer: `Total : ${data.memories.length} souvenirs`,
  });
}

module.exports = {
  name: "memory",
  description: "Gère tes souvenirs avec catégories et dates",

  async execute(message, args) {
    const data = readMemory();

    if (!args.length) {
      const filtered = filterMemories(data.memories);
      const pagination = paginateMemories(filtered);
      const embed = formatMemoriesPage(data.memories, pagination);
      const buttons = createNavigationButtons(1, pagination.totalPages, message.author.id);
      
      return message.channel.send({
        embeds: [embed],
        components: buttons
      });
    }

    const sub = args.shift().toLowerCase();

    switch (sub) {
      case "add": {
        // Format : !memory add [catégorie] [date] <texte>
        let category = null;
        let date = null;
        let startIndex = 0;
        
        // Vérifier catégorie entre crochets
        if (args[0]?.startsWith('[') && args[0]?.endsWith(']')) {
          category = args[0].slice(1, -1).toLowerCase();
          startIndex = 1;
        }
        
        // Vérifier date entre crochets
        if (args[startIndex]?.startsWith('[') && args[startIndex]?.endsWith(']')) {
          const dateStr = args[startIndex].slice(1, -1);
          date = parseMemoryDate(dateStr);
          if (!date) {
            return message.channel.send({
              embeds: [createErrorEmbed(
                "Format de date invalide",
                "Formats acceptés : `[JJ/MM/YYYY]`, `[MM/YYYY]`, ou `[YYYY]`\n\nExemples : `[15/03/2024]`, `[03/2024]`, `[2024]`"
              )],
            });
          }
          startIndex++;
        }
        
        const text = args.slice(startIndex).join(" ").trim();
        if (!text) {
          return message.channel.send({
            embeds: [createErrorEmbed(
              "Texte manquant",
              [
                "**Usage :**",
                "`!memory add <texte>` - Souvenir simple",
                "`!memory add [voyage] <texte>` - Avec catégorie",
                "`!memory add [voyage] [15/03/2024] <texte>` - Avec catégorie et date",
                "",
                "**Formats de date :**",
                "`[15/03/2024]` - Date complète",
                "`[03/2024]` - Mois et année",
                "`[2024]` - Année seulement"
              ].join("\n")
            )],
          });
        }
        
        // Utiliser catégorie par défaut si pas spécifiée
        if (!category) category = "général";
        
        // Ajouter la catégorie si elle n'existe pas
        if (!data.categories.includes(category)) {
          data.categories.push(category);
        }
        
        const newMemory = {
          id: data.nextId++,
          text,
          category,
          date,
          addedBy: message.author.tag,
          createdAt: new Date().toISOString()
        };
        
        data.memories.push(newMemory);
        saveMemory(data);
        
        const emoji = getCategoryEmoji(category);
        const dateStr = date ? ` • 📅 ${formatMemoryDate(date)}` : "";
        
        return message.channel.send({
          embeds: [createEmbed({
            title: `${emoji} Souvenir ajouté`,
            description: `**Catégorie :** ${category}${dateStr}\n**Contenu :** ${text}`,
            color: getCategoryColor(category),
            footer: `Ajouté par ${message.author.tag} • ID: ${newMemory.id}`,
          })],
        });
      }

      case "edit": {
        const id = parseInt(args[0]);
        if (!id || isNaN(id)) {
          return message.channel.send({
            embeds: [createErrorEmbed(
              "ID manquant",
              "Usage : `!memory edit <id> <nouveau_texte>`\n\nUtilise `!memory list` pour voir les IDs."
            )],
          });
        }
        
        const memory = data.memories.find(m => m.id === id);
        if (!memory) {
          return message.channel.send({
            embeds: [createErrorEmbed(
              "Souvenir introuvable",
              `Aucun souvenir avec l'ID ${id}. Vérifie avec \`!memory list\`.`
            )],
          });
        }
        
        const newText = args.slice(1).join(" ").trim();
        if (!newText) {
          return message.channel.send({
            embeds: [createErrorEmbed(
              "Nouveau texte manquant",
              `Usage : \`!memory edit ${id} <nouveau_texte>\``
            )],
          });
        }
        
        const oldText = memory.text;
        memory.text = newText;
        memory.modifiedAt = new Date().toISOString();
        memory.modifiedBy = message.author.tag;
        
        saveMemory(data);
        
        const emoji = getCategoryEmoji(memory.category);
        return message.channel.send({
          embeds: [createEmbed({
            title: `${emoji} Souvenir modifié`,
            fields: [
              { name: "Ancien texte", value: oldText, inline: false },
              { name: "Nouveau texte", value: newText, inline: false }
            ],
            color: getCategoryColor(memory.category),
            footer: `Modifié par ${message.author.tag} • ID: ${id}`,
          })],
        });
      }

      case "del": {
        const id = parseInt(args[0]);
        if (!id || isNaN(id)) {
          return message.channel.send({
            embeds: [createErrorEmbed(
              "ID manquant",
              "Usage : `!memory del <id>`\n\nUtilise `!memory list` pour voir les IDs."
            )],
          });
        }
        
        const index = data.memories.findIndex(m => m.id === id);
        if (index === -1) {
          return message.channel.send({
            embeds: [createErrorEmbed(
              "Souvenir introuvable",
              `Aucun souvenir avec l'ID ${id}. Vérifie avec \`!memory list\`.`
            )],
          });
        }
        
        const [removed] = data.memories.splice(index, 1);
        saveMemory(data);
        
        const emoji = getCategoryEmoji(removed.category);
        return message.channel.send({
          embeds: [createEmbed({
            title: "🗑️ Souvenir supprimé",
            description: `**${removed.text}**`,
            color: 0xf44336,
            footer: `Catégorie : ${removed.category} • ID: ${removed.id}`,
          })],
        });
      }

      case "list": {
        const category = args[0];
        const filtered = filterMemories(data.memories, category);
        const pagination = paginateMemories(filtered);
        const embed = formatMemoriesPage(filtered, pagination, category);
        const buttons = createNavigationButtons(1, pagination.totalPages, message.author.id, category);
        
        return message.channel.send({
          embeds: [embed],
          components: buttons
        });
      }

      case "search": {
        const search = args.join(" ").trim();
        if (!search) {
          return message.channel.send({
            embeds: [createErrorEmbed(
              "Recherche vide",
              "Usage : `!memory search <mot-clé>`\n\nExemple : `!memory search vacances`"
            )],
          });
        }
        
        const filtered = filterMemories(data.memories, null, search);
        const pagination = paginateMemories(filtered);
        const embed = formatMemoriesPage(filtered, pagination, null, search);
        const buttons = createNavigationButtons(1, pagination.totalPages, message.author.id, null, search);
        
        return message.channel.send({
          embeds: [embed],
          components: buttons
        });
      }

      case "categories":
      case "cat": {
        return message.channel.send({
          embeds: [getCategoriesEmbed(data)],
        });
      }

      case "addcat": {
        const newCategory = args.join(" ").trim().toLowerCase();
        if (!newCategory) {
          return message.channel.send({
            embeds: [createErrorEmbed(
              "Nom de catégorie manquant",
              "Usage : `!memory addcat <nom>`\n\nExemple : `!memory addcat musique`"
            )],
          });
        }
        
        if (data.categories.includes(newCategory)) {
          return message.channel.send({
            embeds: [createErrorEmbed(
              "Catégorie existante",
              `La catégorie "${newCategory}" existe déjà.`
            )],
          });
        }
        
        data.categories.push(newCategory);
        saveMemory(data);
        
        const emoji = getCategoryEmoji(newCategory);
        return message.channel.send({
          embeds: [createEmbed({
            title: "📂 Catégorie ajoutée",
            description: `${emoji} **${newCategory}** a été ajoutée aux catégories disponibles.`,
            color: getCategoryColor(newCategory),
            footer: `${data.categories.length} catégories au total`,
          })],
        });
      }

      default:
        return message.channel.send({
          embeds: [createErrorEmbed(
            "Commande inconnue",
            [
              "**Commandes disponibles :**",
              "`add [catégorie] [date] <texte>` - Ajouter",
              "`edit <id> <nouveau_texte>` - Modifier",
              "`del <id>` - Supprimer",
              "`list [catégorie]` - Lister",
              "`search <mot-clé>` - Rechercher",
              "`categories` - Voir les catégories",
              "`addcat <nom>` - Ajouter une catégorie"
            ].join("\n")
          )],
        });
    }
  },

  // --- Gestion des interactions (boutons) ---
  async handleInteraction(interaction) {
    if (!interaction.isButton()) return;
    
    const [action, direction, userId, page, category, search] = interaction.customId.split('_');
    
    if (action !== 'memory' || interaction.user.id !== userId) return;
    
    if (direction === 'page') {
      return interaction.reply({ content: "🔄 Utilisez les boutons précédent/suivant pour naviguer.", ephemeral: true });
    }
    
    const data = readMemory();
    const filtered = filterMemories(
      data.memories, 
      category === 'all' ? null : category,
      search === 'none' ? null : search
    );
    
    const pagination = paginateMemories(filtered, parseInt(page));
    const embed = formatMemoriesPage(
      filtered, 
      pagination, 
      category === 'all' ? null : category,
      search === 'none' ? null : search
    );
    
    const buttons = createNavigationButtons(
      pagination.currentPage, 
      pagination.totalPages, 
      userId, 
      category === 'all' ? null : category,
      search === 'none' ? null : search
    );
    
    await interaction.update({
      embeds: [embed],
      components: buttons
    });
  },

  // --- Fonction pour obtenir un souvenir par ID ---
  getMemoryById: (id) => {
    const data = readMemory();
    return data.memories.find(m => m.id === id);
  },

  // --- Liste des souvenirs pour utilisateur ---
  listMemories: () => {
    const data = readMemory();
    const pagination = paginateMemories(data.memories);
    return formatMemoriesPage(data.memories, pagination);
  },
};