const fs = require("fs");
const path = require("path");
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
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

function parseDateTime(dateStr, timeStr = null) {
  const datePart = parseDate(dateStr);
  if (!datePart) return null;
  
  let hour = 0, minute = 0;
  if (timeStr && timeStr.includes(':')) {
    const [h, m] = timeStr.split(':').map(Number);
    if (!isNaN(h) && !isNaN(m) && h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      hour = h;
      minute = m;
    }
  }
  
  return { ...datePart, hour, minute, hasTime: !!timeStr };
}

function formatDate(dateObj) {
  const day = String(dateObj.day).padStart(2, "0");
  const month = String(dateObj.month).padStart(2, "0");
  return `${day}/${month}/${dateObj.year}`;
}

function formatDateTime(dateObj) {
  const dateStr = formatDate(dateObj);
  if (dateObj.hasTime) {
    const hour = String(dateObj.hour).padStart(2, "0");
    const minute = String(dateObj.minute).padStart(2, "0");
    return `${dateStr} ${hour}:${minute}`;
  }
  return dateStr;
}

// Compare deux dates simples (jour/mois/année)
function isSameDay(a, b) {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

// Retourne le nombre de jours restants
function daysRemaining(target) {
  const today = new Date();
  const targetDate = new Date(target.year, target.month - 1, target.day);
  const diffMs = targetDate - new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

// Calcul des mois/jours restants pour affichage
function getTimeRemaining(target) {
  const today = new Date();
  const targetDate = new Date(target.year, target.month - 1, target.day);
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  
  const diffMs = targetDate - todayDate;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (days === 0) return "Aujourd'hui";
  if (days < 0) return "Passé";
  
  if (days < 30) {
    return `${days} jour${days > 1 ? 's' : ''}`;
  }
  
  const months = Math.floor(days / 30);
  const remainingDays = days % 30;
  
  if (remainingDays === 0) {
    return `${months} mois`;
  } else if (months === 0) {
    return `${days} jours`;
  } else {
    return `${months} mois ${remainingDays} jour${remainingDays > 1 ? 's' : ''}`;
  }
}

// --- Génération du calendrier visuel (simplifié) ---
function generateVisualCalendar(year, month, events) {
  const monthNames = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
  ];
  
  // Premier jour du mois et nombre de jours
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const daysInMonth = lastDay.getDate();
  
  // Jour de la semaine du premier jour (0 = dimanche, 1 = lundi, etc.)
  let startDay = firstDay.getDay();
  if (startDay === 0) startDay = 7; // Dimanche = 7 pour placer en fin de semaine
  
  // Créer la grille du calendrier (plus compacte)
  let calendar = `**${monthNames[month - 1]} ${year}**\n`;
  calendar += "```\n";
  
  let dayCounter = 1;
  let currentRow = "";
  
  // Première semaine avec espaces pour les jours précédents
  for (let i = 1; i < startDay; i++) {
    currentRow += "  ";
  }
  
  // Remplir le calendrier
  for (let day = 1; day <= daysInMonth; day++) {
    const hasEvent = events.some(event => 
      event.date.year === year && 
      event.date.month === month && 
      event.date.day === day
    );
    
    const today = new Date();
    const isToday = (
      year === today.getFullYear() && 
      month === today.getMonth() + 1 && 
      day === today.getDate()
    );
    
    let dayStr = String(day).padStart(2, " ");
    
    if (isToday && hasEvent) {
      dayStr = `[${dayStr.trim()}]`; // Aujourd'hui avec événement
    } else if (isToday) {
      dayStr = `(${dayStr.trim()})`; // Aujourd'hui
    } else if (hasEvent) {
      dayStr = `${dayStr.trim()}*`; // Événement
    }
    
    currentRow += dayStr + " ";
    
    // Nouvelle ligne après dimanche (7 jours)
    if ((startDay + day - 1) % 7 === 0) {
      calendar += currentRow.trim() + "\n";
      currentRow = "";
    }
  }
  
  // Ajouter la dernière ligne si nécessaire
  if (currentRow.trim()) {
    calendar += currentRow.trim() + "\n";
  }
  
  calendar += "```";
  
  return calendar;
}

// --- Navigation par mois ---
function createMonthNavigation(year, month, userId) {
  const row = new ActionRowBuilder();
  
  // Mois précédent
  let prevMonth = month - 1;
  let prevYear = year;
  if (prevMonth < 1) {
    prevMonth = 12;
    prevYear--;
  }
  
  // Mois suivant
  let nextMonth = month + 1;
  let nextYear = year;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear++;
  }
  
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`cal_prev_${userId}_${prevYear}_${prevMonth}`)
      .setLabel("◀ Précédent")
      .setStyle(ButtonStyle.Primary),
    
    new ButtonBuilder()
      .setCustomId(`cal_current_${userId}`)
      .setLabel(`${year}/${month}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    
    new ButtonBuilder()
      .setCustomId(`cal_next_${userId}_${nextYear}_${nextMonth}`)
      .setLabel("Suivant ▶")
      .setStyle(ButtonStyle.Primary),
    
    new ButtonBuilder()
      .setCustomId(`cal_list_${userId}`)
      .setLabel("📋 Liste")
      .setStyle(ButtonStyle.Success)
  );
  
  return [row];
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

// --- Aide ---
function getHelpEmbed() {
  return createInfoEmbed(
    "📖 Guide d'utilisation - Calendar Bot",
    [
      "**🔸 Ajouter un événement**",
      "`!calendar add JJ/MM/YYYY <événement>` - Événement simple",
      "`!calendar add JJ/MM/YYYY HH:MM <événement>` - Avec heure",
      "",
      "**🔸 Gérer les événements**",
      "`!calendar` ou `!calendar view` - Affichage calendrier",
      "`!calendar list` - Liste détaillée",
      "`!calendar del <numéro>` - Supprimer",
      "",
      "**🔸 Exemples**",
      "`!calendar add 25/12/2024 Noël`",
      "`!calendar add 01/01/2025 14:30 Rendez-vous`",
      "`!calendar del 1` - Supprime le 1er événement",
      "",
      "**🔸 Affichage calendrier**",
      "• `(X)` - Aujourd'hui",
      "• `X*` - Jour avec événement",  
      "• `[X]` - Aujourd'hui avec événement",
      "",
      "**🔸 Navigation**",
      "Utilisez les boutons ◀▶ pour naviguer entre les mois",
      "Bouton 📋 pour basculer vers la liste détaillée"
    ].join("\n"),
    "#2ecc71"
  );
}

// --- Embed calendrier visuel ---
function getVisualCalendarEmbed(calendar, year, month) {
  const events = calendar.filter(entry => {
    const remaining = daysRemaining(entry.date);
    return remaining >= 0;
  });
  
  const monthEvents = events.filter(event => 
    event.date.year === year && event.date.month === month
  );
  
  const calendarGrid = generateVisualCalendar(year, month, monthEvents);
  
  let eventsList = "";
  if (monthEvents.length > 0) {
    eventsList = "\n**📅 Événements ce mois-ci :**\n";
    monthEvents
      .sort((a, b) => a.date.day - b.date.day)
      .forEach((event, i) => {
        const timeRemaining = getTimeRemaining(event.date);
        const dateStr = event.date.hasTime ? 
          `${String(event.date.day).padStart(2, '0')}/${String(event.date.month).padStart(2, '0')} ${String(event.date.hour).padStart(2, '0')}:${String(event.date.minute).padStart(2, '0')}` :
          `${String(event.date.day).padStart(2, '0')}/${String(event.date.month).padStart(2, '0')}`;
        
        const timeInfo = timeRemaining === "Aujourd'hui" ? " 🎉" : ` (${timeRemaining})`;
        eventsList += `**${dateStr}** - ${event.reason}${timeInfo}\n`;
      });
  }
  
  return createInfoEmbed(
    "📅 Calendrier",
    calendarGrid + eventsList,
    "#9b59b6"
  );
}

// --- Liste classique des événements (triée par date/mois) ---
function getCalendarListEmbed(calendar) {
  const today = new Date();
  const todayObj = {
    year: today.getFullYear(),
    month: today.getMonth() + 1,
    day: today.getDate(),
  };

  if (!calendar || calendar.length === 0) {
    return createInfoEmbed(
      "📋 Liste des événements",
      "Aucune date enregistrée. Ajoute-en avec `!calendar add JJ/MM/YYYY [HH:MM] raison`"
    );
  }

  // Trier par date
  calendar.sort((a, b) => {
    const dateA = new Date(a.date.year, a.date.month - 1, a.date.day);
    const dateB = new Date(b.date.year, b.date.month - 1, b.date.day);
    return dateA - dateB;
  });

  // Grouper par mois/année
  const groupedByMonth = {};
  const monthNames = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
  ];

  calendar.forEach((entry, index) => {
    const monthKey = `${monthNames[entry.date.month - 1]} ${entry.date.year}`;
    if (!groupedByMonth[monthKey]) {
      groupedByMonth[monthKey] = [];
    }
    
    const timeRemaining = getTimeRemaining(entry.date);
    const dateStr = formatDate(entry.date);
    const timeStr = entry.date.hasTime ? ` ${String(entry.date.hour).padStart(2, '0')}:${String(entry.date.minute).padStart(2, '0')}` : '';
    
    let timeInfo = "";
    if (timeRemaining === "Aujourd'hui") {
      timeInfo = " 🎉 **AUJOURD'HUI**";
    } else if (timeRemaining !== "Passé") {
      timeInfo = ` (${timeRemaining})`;
    } else {
      timeInfo = " _(passé)_";
    }
    
    groupedByMonth[monthKey].push({
      text: `${dateStr}${timeStr} - ${entry.reason}${timeInfo}`,
      index: index + 1,
      isToday: timeRemaining === "Aujourd'hui"
    });
  });

  // Construire la description
  let description = "";
  Object.keys(groupedByMonth).forEach(monthKey => {
    const events = groupedByMonth[monthKey];
    description += `**${monthKey}**\n`;
    
    events.forEach(event => {
      description += `**${event.index}.** ${event.text}\n`;
    });
    description += "\n";
  });

  return createInfoEmbed("📋 Liste des événements", description.trim());
}

// --- Fonctions réutilisables ---
function listCalendar() {
  let calendar = readCalendar();
  calendar = calendar.filter((entry) => {
    const remaining = daysRemaining(entry.date);
    return remaining >= 0;
  });

  saveCalendar(calendar);
  return getCalendarListEmbed(calendar);
}

// --- Commande principale ---
module.exports = {
  name: "calendar",
  description: "Gérer un calendrier avec affichage visuel",
  readCalendar,
  saveCalendar,
  parseDate,
  parseDateTime,
  formatDate,
  formatDateTime,
  getVisualCalendarEmbed,
  getCalendarListEmbed,
  listCalendar,

  execute(message, args) {
    let calendar = readCalendar();
    // Suppression auto des dates passées
    calendar = calendar.filter((entry) => daysRemaining(entry.date) >= 0);
    saveCalendar(calendar);

    if (args.length === 0) {
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth() + 1;
      
      const embed = getVisualCalendarEmbed(calendar, year, month);
      const buttons = createMonthNavigation(year, month, message.author.id);
      
      return message.channel.send({ 
        embeds: [embed],
        components: buttons
      });
    }

    const sub = args.shift().toLowerCase();

    if (sub === "help") {
      return message.channel.send({
        embeds: [getHelpEmbed()],
      });
    }

    if (sub === "add") {
      const dateStr = args.shift();
      let timeStr = null;
      let reason = args.join(" ");
      
      // Vérifier si le deuxième argument est une heure (format HH:MM)
      if (args.length && /^\d{1,2}:\d{2}$/.test(args[0])) {
        timeStr = args.shift();
        reason = args.join(" ");
      }
      
      if (!dateStr || !reason) {
        return message.channel.send({
          embeds: [
            createErrorEmbed("Usage : `!calendar add JJ/MM/YYYY [HH:MM] raison`\n\nExemples :\n• `!calendar add 25/12/2024 Noël`\n• `!calendar add 01/01/2025 14:30 Rendez-vous`"),
          ],
        });
      }

      const date = parseDateTime(dateStr, timeStr);
      if (!date) {
        return message.channel.send({
          embeds: [
            createErrorEmbed("Date invalide. Utilise le format JJ/MM/YYYY [HH:MM]."),
          ],
        });
      }

      calendar.push({ date, reason, addedBy: message.author.tag });
      saveCalendar(calendar);

      return message.channel.send({
        embeds: [
          createInfoEmbed(
            "✅ Événement ajouté",
            `**Date :** ${formatDateTime(date)}\n**Événement :** ${reason}`,
            "#4caf50",
          ),
        ],
      });
    }

    if (sub === "del") {
      const num = parseInt(args[0]);
      if (isNaN(num) || num < 1 || num > calendar.length) {
        return message.channel.send({
          embeds: [
            createErrorEmbed(
              "Numéro invalide. Vérifie la liste avec `!calendar list`.",
            ),
          ],
        });
      }

      const removed = calendar.splice(num - 1, 1);
      saveCalendar(calendar);

      return message.channel.send({
        embeds: [
          createInfoEmbed(
            "🗑️ Événement supprimé",
            `**Date :** ${formatDateTime(removed[0].date)}\n**Événement :** ${removed[0].reason}`,
            "#f44336",
          ),
        ],
      });
    }

    if (sub === "list") {
      const embed = getCalendarListEmbed(calendar);
      return message.channel.send({ embeds: [embed] });
    }

    if (sub === "visual" || sub === "view") {
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth() + 1;
      
      const embed = getVisualCalendarEmbed(calendar, year, month);
      const buttons = createMonthNavigation(year, month, message.author.id);
      
      return message.channel.send({ 
        embeds: [embed],
        components: buttons
      });
    }

    return message.channel.send({
      embeds: [
        createErrorEmbed(
          "**Commandes disponibles :**\n`help` - Aide complète\n`add` - Ajouter événement\n`del` - Supprimer\n`list` - Liste détaillée\n`view` - Affichage calendrier",
        ),
      ],
    });
  },

  // --- Gestion des interactions (boutons) ---
  async handleInteraction(interaction) {
    if (!interaction.isButton()) return;
    
    const [prefix, action, userId, year, month] = interaction.customId.split('_');
    
    if (prefix !== 'cal' || interaction.user.id !== userId) return;
    
    let calendar = readCalendar();
    calendar = calendar.filter((entry) => daysRemaining(entry.date) >= 0);
    saveCalendar(calendar);
    
    if (action === 'list') {
      const embed = getCalendarListEmbed(calendar);
      return interaction.update({ embeds: [embed], components: [] });
    }
    
    if (action === 'current') {
      return interaction.reply({ content: "🔄 Utilisez les flèches pour naviguer entre les mois.", ephemeral: true });
    }
    
    const targetYear = parseInt(year);
    const targetMonth = parseInt(month);
    
    const embed = getVisualCalendarEmbed(calendar, targetYear, targetMonth);
    const buttons = createMonthNavigation(targetYear, targetMonth, userId);
    
    await interaction.update({
      embeds: [embed],
      components: buttons
    });
  },

  async sendCalendarCron(client) {
    if (!config.reminderChannelId) return;
    const embed = listCalendar();
    await sendEmbed(client, config.reminderChannelId, embed);
  },
};