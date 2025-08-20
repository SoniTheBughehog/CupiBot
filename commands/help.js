const { EmbedBuilder } = require("discord.js");

function createEmbed({
  title,
  description,
  color = 0x00bcd4,
  fields = [],
  footer,
  timestamp = true,
}) {
  const embed = new EmbedBuilder().setTitle(title).setColor(color);
  if (description) embed.setDescription(description);
  if (fields.length) embed.addFields(fields);
  if (footer) embed.setFooter({ text: footer });
  if (timestamp) embed.setTimestamp();
  return embed;
}

function formatCommands(commands) {
  return commands.length
    ? commands.map((c) => `\`${c}\``).join("\n")
    : "Aucune commande";
}

module.exports = {
  name: "aide",
  description: "Affiche la liste des commandes disponibles",
  execute(message) {
    const commands = message.client.commands;

    const generalCmds = formatCommands(
      commands
        .filter(
          (cmd) =>
            !["callnote", "note", "memory", "puissance4", "calendar"].includes(
              cmd.name,
            ),
        )
        .map((cmd) => `!${cmd.name} — ${cmd.description}`),
    );

    const embed = createEmbed({
      title: "📖 Liste des commandes",
      description: "Voici les commandes disponibles sur ce bot.",
      fields: [
        { name: "⚙️ Commandes générales", value: generalCmds, inline: false },
        {
          name: "📋 Commandes Callnote",
          value: formatCommands([
            "!callnote add <qui> <sujet> — Ajouter un sujet à la liste d’appel",
            "!callnote list — Afficher tous les sujets enregistrés",
            "!callnote del <num> — Supprimer un sujet par son numéro",
          ]),
          inline: false,
        },
        {
          name: "📝 Commandes Note",
          value: formatCommands([
            "!note add <texte> — Ajouter une note personnelle",
            "!note list — Afficher tes notes",
            "!note del <num> — Supprimer une note",
            "!note setchannel — Définir le salon des rappels automatiques",
          ]),
          inline: false,
        },
        {
          name: "💭 Commandes Memory",
          value: formatCommands([
            "!memory add <texte> — Ajouter un souvenir",
            "!memory list — Lister tes souvenirs",
            "!memory del <num> — Supprimer un souvenir",
          ]),
          inline: false,
        },
        {
          name: "📅 Commandes Calendar",
          value: formatCommands([
            "!calendar add <date> <event> — Ajouter un événement au calendrier",
            "!calendar list — Afficher les événements à venir",
            "!calendar del <num> — Supprimer un événement",
          ]),
          inline: false,
        },
        {
          name: "🎮 Commandes Puissance4",
          value: formatCommands([
            "!p4 start — Commencer une partie",
            "!p4 <1-7> — Placer un pion dans la colonne",
            "!p4 board — Afficher le plateau de jeu",
            "!p4 reset — Réinitialiser la partie",
          ]),
          inline: false,
        },
      ],
      footer: `Demandé par ${message.author.tag}`,
    });

    message.channel.send({ embeds: [embed] });
  },
};
