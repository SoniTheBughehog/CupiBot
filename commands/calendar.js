const fs = require("fs");
const path = require("path");
const { EmbedBuilder } = require("discord.js");
const { sendEmbed } = require("../utils/sendEmbed");
const config = require("../config.json");

const filePath = path.join(__dirname, "..", "data", "calendar.json");

// --- Lecture / écriture ---
function readCalendar() {
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function saveCalendar(data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// --- Utilitaires date ---
function parseDate(dateStr) {
  const [day, month, year] = dateStr.split("/").map(Number);
  if (!day || !month || !year) return null;
  return { year, month, day };
}

function formatDate(dateObj) {
  const day = String(dateObj.day).padStart(2, "0");
  const month = String(dateObj.month).padStart(2, "0");
  return `${day}/${month}/${dateObj.year}`;
}

// Compare deux dates simples (jour/mois/année)
function isSameDay(a, b) {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

// Retourne le nombre de jours restants
function daysRemaining(target) {
  const today = new Date();
  const targetDate = new Date(target.year, target.month - 1, target.day);
  const diffMs =
    targetDate -
    new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

// --- Embeds ---
function createErrorEmbed(msg) {
  return new EmbedBuilder()
    .setTitle("❌ Erreur")
    .setDescription(msg)
    .setColor("#ff0000")
    .setTimestamp();
}

function createInfoEmbed(title, msg, color = "#2196f3") {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(msg)
    .setColor(color)
    .setTimestamp();
}

// --- Embed calendrier ---
function getCalendarEmbed(calendar) {
  const today = new Date();
  const todayObj = {
    year: today.getFullYear(),
    month: today.getMonth() + 1,
    day: today.getDate(),
  };

  if (!calendar || calendar.length === 0) {
    return createInfoEmbed(
      "📅 Calendrier",
      "Aucune date enregistrée. Ajoute-en avec `!calendar add JJ/MM/YYYY raison`",
    );
  }

  // Séparer les événements d'aujourd'hui et les autres
  const todayEvents = [];
  const upcomingEvents = [];

  for (const entry of calendar) {
    const remaining = daysRemaining(entry.date);
    if (isSameDay(entry.date, todayObj)) {
      todayEvents.push(`🎉 AUJOURD'HUI → ${entry.reason.toUpperCase()} !!! 🎉`);
    } else {
      upcomingEvents.push(
        `**${upcomingEvents.length + 1}.** ${formatDate(entry.date)} → ${entry.reason}` +
          (remaining > 0
            ? ` (_${remaining} jours restants_)`
            : " _(date passée, sera supprimée la prochaine fois)_"),
      );
    }
  }

  const description = [...todayEvents, ...upcomingEvents].join("\n");

  return createInfoEmbed("📅 Calendrier", description);
}

// --- Fonctions réutilisables ---
function listCalendar() {
  let calendar = readCalendar();
  calendar = calendar.filter((entry) => {
    const remaining = daysRemaining(entry.date);
    return remaining >= 0;
  });
  saveCalendar(calendar);

  return getCalendarEmbed(calendar);
}

// --- Commande principale ---
module.exports = {
  name: "calendar",
  description: "Gérer un calendrier avec décompte (jours uniquement)",
  readCalendar,
  saveCalendar,
  parseDate,
  formatDate,
  getCalendarEmbed,
  listCalendar,

  execute(message, args) {
    let calendar = readCalendar();
    // suppression auto (uniquement < aujourd'hui)
    calendar = calendar.filter((entry) => daysRemaining(entry.date) >= 0);
    saveCalendar(calendar);

    if (args.length === 0) {
      return message.channel.send({ embeds: [getCalendarEmbed(calendar)] });
    }

    const sub = args.shift().toLowerCase();

    if (sub === "add") {
      const dateStr = args.shift();
      const reason = args.join(" ");
      if (!dateStr || !reason)
        return message.channel.send({
          embeds: [
            createErrorEmbed("Usage : `!calendar add JJ/MM/YYYY raison`"),
          ],
        });

      const date = parseDate(dateStr);
      if (!date)
        return message.channel.send({
          embeds: [
            createErrorEmbed("Date invalide. Utilise le format JJ/MM/YYYY."),
          ],
        });

      calendar.push({ date, reason, addedBy: message.author.tag });
      saveCalendar(calendar);

      return message.channel.send({
        embeds: [
          createInfoEmbed(
            "✅ Date ajoutée",
            `**Date :** ${formatDate(date)}\n**Raison :** ${reason}`,
            "#4caf50",
          ),
        ],
      });
    }

    if (sub === "del") {
      const num = parseInt(args[0]);
      if (isNaN(num) || num < 1 || num > calendar.length)
        return message.channel.send({
          embeds: [
            createErrorEmbed(
              "Numéro invalide. Vérifie la liste avec `!calendar`.",
            ),
          ],
        });

      const removed = calendar.splice(num - 1, 1);
      saveCalendar(calendar);

      return message.channel.send({
        embeds: [
          createInfoEmbed(
            "🗑️ Date supprimée",
            `**Date :** ${formatDate(removed[0].date)}\n**Raison :** ${removed[0].reason}`,
            "#f44336",
          ),
        ],
      });
    }

    if (sub === "list") {
      return message.channel.send({ embeds: [getCalendarEmbed(calendar)] });
    }

    return message.channel.send({
      embeds: [
        createErrorEmbed(
          "Commande inconnue. Sous-commandes : `add` | `del` | `list`",
        ),
      ],
    });
  },
  async sendCalendarCron(client) {
    if (!config.reminderChannelId) return;
    const embed = listCalendar();
    await sendEmbed(client, config.reminderChannelId, embed);
  },
};
