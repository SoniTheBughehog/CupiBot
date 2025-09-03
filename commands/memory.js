const fs = require("fs");
const path = require("path");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const filePath = path.join(__dirname, "..", "data", "memory.json");

// --- Fonctions de gestion des données ---

function readMemory() {
  if (!fs.existsSync(filePath)) return {};
  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    let changesMade = false;

    // Migration pour les anciennes données (tableau de strings -> objets + IDs séquentiels)
    for (const userId in data) {
      const userMemories = data[userId];
      if (!Array.isArray(userMemories)) continue;

      // Détecte les anciens formats (string ou ID timestamp) et les migre
      if (userMemories.length > 0 && (typeof userMemories[0] === 'string' || userMemories[0].id > 1000000000000)) {
        console.log(`Migrating data format and re-indexing IDs for user ${userId}...`);
        changesMade = true;
        data[userId] = userMemories.map((mem, index) => {
            const oldText = typeof mem === 'string' ? mem : mem.text;
            const oldCategory = typeof mem === 'object' ? mem.category : 'général';
            return {
                id: index + 1, // Nouvel ID séquentiel
                text: oldText,
                category: oldCategory,
                createdAt: typeof mem === 'object' ? mem.createdAt : new Date().toISOString(),
            };
        });
      }
    }

    if (changesMade) {
        saveMemory(data); // Sauvegarde les données migrées
    }
    return data;
  } catch (err) {
    console.error("Error reading or parsing memory.json:", err);
    return {};
  }
}

function saveMemory(memories) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(memories, null, 2));
  } catch (err) {
    console.error("Error writing to memory.json:", err);
  }
}

// --- Fonctions utilitaires ---

function createEmbed(options) {
  const embed = new EmbedBuilder()
    .setTitle(options.title)
    .setDescription(options.description)
    .setColor(options.color || 0x3498db);
  if (options.footer) embed.setFooter({ text: options.footer });
  if (options.timestamp !== false) embed.setTimestamp();
  return embed;
}

// --- Système de Pagination ---

async function createPaginatedEmbed(interactionOrMessage, user, list, title) {
  const itemsPerPage = 5;
  const totalPages = Math.ceil(list.length / itemsPerPage);
  let currentPage = 0;

  if (list.length === 0) {
    const embed = createEmbed({
      title: "📭 Aucun souvenir trouvé",
      description: "La liste est vide ou ta recherche n'a donné aucun résultat.",
      color: 0x95a5a6,
    });
    return interactionOrMessage.channel.send({ embeds: [embed] });
  }

  const generateEmbed = (page) => {
    const start = page * itemsPerPage;
    const end = start + itemsPerPage;
    const currentItems = list.slice(start, end);

    const description = currentItems
      .map(
        (m) =>
          `**ID:** \`${m.id}\` - **Catégorie:** [${m.category}]\n> ${m.text}`
      )
      .join("\n\n");

    return createEmbed({
      title: title,
      description: description,
      footer: `Page ${page + 1} / ${totalPages}  •  ${
        list.length
      } souvenir(s) au total`,
    });
  };

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("prev_page")
      .setLabel("⬅️ Précédent")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId("next_page")
      .setLabel("Suivant ➡️")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(totalPages <= 1)
  );

  const message = await interactionOrMessage.channel.send({
    embeds: [generateEmbed(currentPage)],
    components: [row],
  });

  const filter = (i) => i.user.id === user.id;
  const collector = message.createMessageComponentCollector({
    filter,
    time: 120000, // 2 minutes
  });

  collector.on("collect", async (interaction) => {
    if (interaction.customId === "next_page") {
      currentPage++;
    } else if (interaction.customId === "prev_page") {
      currentPage--;
    }

    row.components[0].setDisabled(currentPage === 0);
    row.components[1].setDisabled(currentPage >= totalPages - 1);

    await interaction.update({
      embeds: [generateEmbed(currentPage)],
      components: [row],
    });
  });

  collector.on("end", () => {
    const disabledRow = new ActionRowBuilder().addComponents(
      row.components[0].setDisabled(true),
      row.components[1].setDisabled(true)
    );
    message.edit({ components: [disabledRow] }).catch(() => {});
  });
}

// --- Commande Principale ---

module.exports = {
  name: "memory",
  description: "Gère tes souvenirs personnels",
  async execute(message, args) {
    const memories = readMemory();
    const userId = message.author.id;
    if (!memories[userId]) memories[userId] = [];

    const subcommand = (args.shift() || "help").toLowerCase();

    switch (subcommand) {
      case "add": {
        const text = args.join(" ").trim();
        if (!text) {
          return message.channel.send({ embeds: [createEmbed({ title: "⚠️ Erreur", description: "Merci de préciser un souvenir à enregistrer.\n\n**Exemple :** `!memory add Mon premier concert`", color: 0xe74c3c })] });
        }
        
        // Calcule le nouvel ID séquentiel
        const nextId = memories[userId].length > 0 ? Math.max(...memories[userId].map(m => m.id)) + 1 : 1;
        
        const newMemory = {
          id: nextId,
          text: text,
          category: "général",
          createdAt: new Date().toISOString(),
        };
        memories[userId].push(newMemory);
        saveMemory(memories);
        return message.channel.send({ embeds: [createEmbed({ title: "💾 Souvenir ajouté", description: `"${text}"`, color: 0x2ecc71, footer: `ID du souvenir : ${newMemory.id}` })] });
      }

      case "list": {
        const categoryQuery = args.join(" ").toLowerCase().trim();
        let list = memories[userId];
        let title = `📚 Souvenirs de ${message.author.username}`;

        if (categoryQuery) {
          list = memories[userId].filter(m => m.category.toLowerCase() === categoryQuery);
          title = `📂 Souvenirs de la catégorie [${categoryQuery}]`;
        }
        
        return createPaginatedEmbed(message, message.author, list, title);
      }

      case "del":
      case "delete": {
        const id = parseInt(args[0], 10);
        if (isNaN(id)) {
          return message.channel.send({ embeds: [createEmbed({ title: "⚠️ ID Invalide", description: "Tu dois spécifier un ID numérique valide.\n\n**Exemple :** `!memory del 3`", color: 0xe74c3c })] });
        }

        const memoryIndex = memories[userId].findIndex((m) => m.id === id);
        if (memoryIndex === -1) {
          return message.channel.send({ embeds: [createEmbed({ title: "❌ Introuvable", description: "Aucun souvenir trouvé avec cet ID.", color: 0xe74c3c })] });
        }

        const [removed] = memories[userId].splice(memoryIndex, 1);
        saveMemory(memories);
        return message.channel.send({ embeds: [createEmbed({ title: "🗑️ Souvenir supprimé", description: `"${removed.text}"`, color: 0xe74c3c })] });
      }

      case "search": {
        const query = args.join(" ").toLowerCase().trim();
        if (!query) {
          return message.channel.send({ embeds: [createEmbed({ title: "⚠️ Recherche vide", description: "Merci de spécifier un terme à rechercher.\n\n**Exemple :** `!memory search concert`", color: 0xe74c3c })] });
        }
        const results = memories[userId].filter(m => m.text.toLowerCase().includes(query));
        return createPaginatedEmbed(message, message.author, results, `🔎 Résultats pour "${query}"`);
      }

      case "edit": {
        const id = parseInt(args.shift(), 10);
        const newText = args.join(" ").trim();
        if (isNaN(id) || !newText) {
          return message.channel.send({ embeds: [createEmbed({ title: "⚠️ Usage incorrect", description: "Syntaxe : `!memory edit <ID> <nouveau texte>`", color: 0xe74c3c })] });
        }
        const memory = memories[userId].find((m) => m.id === id);
        if (!memory) {
          return message.channel.send({ embeds: [createEmbed({ title: "❌ Introuvable", description: "Aucun souvenir trouvé avec cet ID.", color: 0xe74c3c })] });
        }
        const oldText = memory.text;
        memory.text = newText;
        saveMemory(memories);
        return message.channel.send({ embeds: [createEmbed({ title: "✍️ Souvenir modifié", description: `**Ancien :** "${oldText}"\n**Nouveau :** "${newText}"`, color: 0x3498db })] });
      }

      case "category": {
        const id = parseInt(args.shift(), 10);
        const category = args.join(" ").trim().toLowerCase() || "général";
        if (isNaN(id)) {
          return message.channel.send({ embeds: [createEmbed({ title: "⚠️ Usage incorrect", description: "Syntaxe : `!memory category <ID> <nom de la catégorie>`", color: 0xe74c3c })] });
        }
        const memory = memories[userId].find((m) => m.id === id);
        if (!memory) {
          return message.channel.send({ embeds: [createEmbed({ title: "❌ Introuvable", description: "Aucun souvenir trouvé avec cet ID.", color: 0xe74c3c })] });
        }
        memory.category = category;
        saveMemory(memories);
        return message.channel.send({ embeds: [createEmbed({ title: "🏷️ Catégorie modifiée", description: `Le souvenir (ID ${memory.id}) est maintenant dans la catégorie **[${category}]**.`, color: 0x3498db })] });
      }

      case "help":
      default:
        return message.channel.send({ embeds: [createEmbed({ title: "❓ Aide de la commande Memory", description: [
            "**Commandes de base :**",
            "`!memory add <texte>` → Ajouter un souvenir.",
            "`!memory list` → Voir tous tes souvenirs.",
            "`!memory list <catégorie>` → Filtrer les souvenirs par catégorie.",
            "`!memory search <mot>` → Chercher un mot dans le texte de tes souvenirs.",
            "",
            "**Gestion des souvenirs (nécessite un ID) :**",
            "`!memory del <ID>` → Supprimer un souvenir.",
            "`!memory edit <ID> <nouveau texte>` → Modifier le texte d'un souvenir.",
            "`!memory category <ID> <catégorie>` → Assigner une catégorie à un souvenir.",
          ].join("\n"), color: 0xf1c40f, footer: `Demandé par ${message.author.tag}` })] });
    }
  },
};