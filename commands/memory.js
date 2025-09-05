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

function getMemoryDateForSorting(memory) {
  if (!memory.date) return new Date(0);

  const y = Number(memory.date.year || 0);
  const m = Number((memory.date.month || 1)) - 1;
  const d = Number(memory.date.day || 1);

  switch (memory.date.type) {
    case "full":
      return new Date(y, m, d);
    case "month":
      return new Date(y, m, 1);
    case "year":
      return new Date(y, 0, 1);
    default:
      return new Date(0);
  }
}

function getMemoryPeriodKey(memory) {
  if (!memory.date) return "Sans date";
  
  const months = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
  ];
  
  switch (memory.date.type) {
    case "full":
    case "month":
      return `${months[memory.date.month - 1]} ${memory.date.year}`;
    case "year":
      return `${memory.date.year}`;
    default:
      return "Sans date";
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
  "amour": "❤️",
  "famille": "👨‍👩‍👧‍👦",
  "voyages / sorties": "🌍",
  "quotidien": "🏡",
  "événements spéciaux": "🎉",
  "amis": "👯",
  "humour": "😂",
  "émotions fortes": "🥹"
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
const MEMORIES_PER_PAGE = 15;

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

function createNavigationButtons(currentPage, totalPages, userId, sortBy = 'date', category = null, search = null) {
  if (totalPages <= 1) return [];
  
  const row = new ActionRowBuilder();
  
  if (currentPage > 1) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`memory_prev_${userId}_${currentPage - 1}_${sortBy}_${category || 'all'}_${search || 'none'}`)
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
        .setCustomId(`memory_next_${userId}_${currentPage + 1}_${sortBy}_${category || 'all'}_${search || 'none'}`)
        .setLabel("Suivant ▶")
        .setStyle(ButtonStyle.Primary)
    );
  }
  
  return [row];
}

// --- Tri des souvenirs ---
function sortMemoriesByDate(memories, newestFirst = true) {
  return [...memories].sort((a, b) => {
    const da = getMemoryDateForSorting(a).getTime();
    const db = getMemoryDateForSorting(b).getTime();

    if (da === db) {
      // tie-breaker avec createdAt si même date
      const ca = new Date(a.createdAt || 0).getTime();
      const cb = new Date(b.createdAt || 0).getTime();
      return newestFirst ? cb - ca : ca - cb;
    }
    return newestFirst ? db - da : da - db;
  });
}

function groupMemoriesByMonth(memories) {
  const groups = {};
  for (const m of memories) {
    const d = getMemoryDateForSorting(m);
    const label = d.toLocaleString("fr-FR", { month: "long", year: "numeric" });
    if (!groups[label]) groups[label] = [];
    groups[label].push(m);
  }
  return groups;
}

// --- Formatage des souvenirs ---
function formatMemoriesByDate(memories) {
  if (!memories || memories.length === 0) return "";
  
  const sortedMemories = sortMemoriesByDate([...memories]);
  const groupedByPeriod = {};
  
  sortedMemories.forEach(memory => {
    const periodKey = getMemoryPeriodKey(memory);
    if (!groupedByPeriod[periodKey]) {
      groupedByPeriod[periodKey] = [];
    }
    groupedByPeriod[periodKey].push(memory);
  });
  
  const sections = [];
  Object.keys(groupedByPeriod).forEach(period => {
    const periodMemories = groupedByPeriod[period];
    const memoriesText = periodMemories.map(memory => {
      const emoji = getCategoryEmoji(memory.category);
      const dateStr = memory.date ? formatMemoryDate(memory.date) : "";
      const dateDisplay = dateStr && dateStr !== period ? ` • ${dateStr}` : "";
      return `${emoji} ${memory.category}${dateDisplay} - ${memory.text}`;
    }).join("\n");
    
    sections.push(`**${period}**\n${memoriesText}`);
  });
  
  return sections.join("\n\n");
}

function formatMemoriesByCategory(memories) {
  if (!memories || memories.length === 0) return "";
  
  const sortedMemories = sortMemoriesByCategory([...memories]);
  const groupedByCategory = {};
  
  sortedMemories.forEach(memory => {
    const category = memory.category || 'général';
    if (!groupedByCategory[category]) {
      groupedByCategory[category] = [];
    }
    groupedByCategory[category].push(memory);
  });
  
  const sections = [];
  Object.keys(groupedByCategory).sort().forEach(category => {
    const categoryMemories = groupedByCategory[category];
    const emoji = getCategoryEmoji(category);
    const memoriesText = categoryMemories.map(memory => {
      const dateStr = memory.date ? formatMemoryDate(memory.date) : "Sans date";
      return `${dateStr} - ${memory.text}`;
    }).join("\n");
    
    sections.push(`**${emoji} ${category}**\n${memoriesText}`);
  });
  
  return sections.join("\n\n");
}

function formatMemoriesPage(memories, pagination, sortBy = 'date', category = null, search = null) {
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
  
  const sortIcon = sortBy === 'category' ? '📂' : '📅';
  const sortText = sortBy === 'category' ? 'par catégorie' : 'par date';
  title += ` ${sortIcon}`;
  
  if (totalPages > 1) {
    title += ` (Page ${currentPage}/${totalPages})`;
  }

  let description;
  if (sortBy === 'category') {
    description = formatMemoriesByCategory(pageMemories);
  } else {
    description = formatMemoriesByDate(pageMemories);
  }

  const statsText = totalPages > 1 
    ? `Page ${currentPage}/${totalPages} • ${memories.length} souvenirs au total • Tri ${sortText}`
    : `${memories.length} souvenir${memories.length > 1 ? 's' : ''} au total • Tri ${sortText}`;

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

// --- Aide ---
function getHelpEmbed() {
  return createEmbed({
    title: "📖 Guide d'utilisation - Memory Bot",
    description: [
      "**🔸 Ajouter un souvenir**",
      "`!memory add <texte>` - Souvenir simple",
      "`!memory add [voyage] <texte>` - Avec catégorie",
      "`!memory add [voyage] [15/03/2024] <texte>` - Avec catégorie et date",
      "",
      "**🔸 Gérer les souvenirs**",
      "`!memory` ou `!memory list` - Afficher tous (tri par date)",
      "`!memory listcat` - Afficher tous (tri par catégorie)",
      "`!memory list [catégorie]` - Filtrer par catégorie",
      "`!memory search <mot-clé>` - Rechercher",
      "`!memory edit <id> <nouveau_texte>` - Modifier",
      "`!memory del <id>` - Supprimer",
      "",
      "**🔸 Catégories**",
      "`!memory categories` - Voir toutes les catégories",
      "`!memory addcat <nom>` - Ajouter une catégorie",
      "",
      "**🔸 Formats de date acceptés**",
      "`[15/03/2024]` - Date complète (JJ/MM/YYYY)",
      "`[03/2024]` - Mois et année (MM/YYYY)",
      "`[2024]` - Année seulement (YYYY)",
      "",
      "**🔸 Affichage**",
      "• **Tri par date** : Les souvenirs sont groupés par mois/année",
      "• **Tri par catégorie** : Les souvenirs sont groupés par catégorie, puis triés par date",
    ].join("\n"),
    color: 0x2ecc71,
    footer: "Utilise les boutons pour naviguer entre les pages • ID visible dans les embeds",
  });
}

module.exports = {
  name: "memory",
  description: "Gère tes souvenirs avec catégories et dates",
  async execute(message, args) {
    const data = readMemory();

    if (!args.length) {
      const filtered = filterMemories(data.memories);
      const sorted = sortMemoriesByDate(filtered);

      // Grouper par période pour que chaque mois/année reste ensemble
      const groupedLines = [];
      const grouped = {};
      sorted.forEach(memory => {
        const period = getMemoryPeriodKey(memory);
        if (!grouped[period]) grouped[period] = [];
        grouped[period].push(memory);
      });

      Object.keys(grouped)
        .sort((a, b) => {
          const firstA = getMemoryDateForSorting(grouped[a][0]);
          const firstB = getMemoryDateForSorting(grouped[b][0]);
          return firstB - firstA; // du plus récent au plus ancien
        })
        .forEach(period => {
          groupedLines.push({ type: 'header', text: period });
          grouped[period].forEach(mem => groupedLines.push({ type: 'memory', memory: mem }));
        });

      const pagination = paginateMemories(groupedLines);
      const embed = formatMemoriesPage(groupedLines, pagination, 'date');
      const buttons = createNavigationButtons(1, pagination.totalPages, message.author.id, 'date');

      return message.channel.send({
        embeds: [embed],
        components: buttons
      });
    }

    const sub = args.shift().toLowerCase();

    switch (sub) {
      case "help": {
        return message.channel.send({
          embeds: [getHelpEmbed()],
        });
      }

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
        const sorted = sortMemoriesByDate(filtered);

        // Grouper par période pour que chaque mois/année reste ensemble
        const groupedLines = [];
        const grouped = {};
        sorted.forEach(memory => {
          const period = getMemoryPeriodKey(memory);
          if (!grouped[period]) grouped[period] = [];
          grouped[period].push(memory);
        });

        Object.keys(grouped)
          .sort((a, b) => {
            const firstA = getMemoryDateForSorting(grouped[a][0]);
            const firstB = getMemoryDateForSorting(grouped[b][0]);
            return firstB - firstA; // du plus récent au plus ancien
          })
          .forEach(period => {
            groupedLines.push({ type: 'header', text: period });
            grouped[period].forEach(mem => groupedLines.push({ type: 'memory', memory: mem }));
          });

        const pagination = paginateMemories(groupedLines);
        const embed = formatMemoriesPage(groupedLines, pagination, 'date', category);
        const buttons = createNavigationButtons(1, pagination.totalPages, message.author.id, 'date', category);

        return message.channel.send({
          embeds: [embed],
          components: buttons
        });
      }

      case "listcat": {
        const category = args[0];
        const filtered = filterMemories(data.memories, category);

        // Grouper par catégorie
        const groupedLines = [];
        const grouped = {};
        filtered.forEach(memory => {
          const cat = memory.category || 'général';
          if (!grouped[cat]) grouped[cat] = [];
          grouped[cat].push(memory);
        });

        Object.keys(grouped)
          .sort() // ordre alphabétique des catégories
          .forEach(cat => {
            groupedLines.push({ type: 'header', text: cat });
            grouped[cat].forEach(mem => groupedLines.push({ type: 'memory', memory: mem }));
          });

        const pagination = paginateMemories(groupedLines);
        const embed = formatMemoriesPage(groupedLines, pagination, 'category', category);
        const buttons = createNavigationButtons(1, pagination.totalPages, message.author.id, 'category', category);

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
        const embed = formatMemoriesPage(filtered, pagination, 'date', null, search);
        const buttons = createNavigationButtons(1, pagination.totalPages, message.author.id, 'date', null, search);
        
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
              "`help` - Afficher l'aide complète",
              "`add [catégorie] [date] <texte>` - Ajouter",
              "`edit <id> <nouveau_texte>` - Modifier",
              "`del <id>` - Supprimer",
              "`list [catégorie]` - Lister (tri par date)",
              "`listcat [catégorie]` - Lister (tri par catégorie)",
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
    
    const [action, direction, userId, page, sortBy, category, search] = interaction.customId.split('_');
    
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
      sortBy,
      category === 'all' ? null : category,
      search === 'none' ? null : search
    );
    
    const buttons = createNavigationButtons(
      pagination.currentPage, 
      pagination.totalPages, 
      userId,
      sortBy,
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