const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');

const filePath = path.join(__dirname, '..', 'data', 'note.json');

function readData() {
  if (!fs.existsSync(filePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return {};
  }
}

function saveData(data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function createEmbed({ title, description, color = '#2196f3', error = false }) {
  return new EmbedBuilder()
    .setTitle(error ? `❌ ${title}` : title)
    .setDescription(description)
    .setColor(error ? '#ff0000' : color)
    .setTimestamp();
}

module.exports = {
  name: 'note',
  description: 'Gère ta liste personnelle de notes',
  execute(message, args) {
    const userId = message.author.id;
    const data = readData();
    if (!data[userId]) data[userId] = { channelId: null, notes: [] };
    const userData = data[userId];

    if (!args.length) {
      return message.channel.send({
        embeds: [
          createEmbed({
            title: 'Commande invalide',
            description:
              'Utilisation :\n`!note add <sujet>` → ajouter une note\n`!note list` → voir tes notes\n`!note del <num>` → supprimer une note\n`!note setchannel` → définir le salon pour les rappels',
            error: true,
          }),
        ],
      });
    }

    const sub = args.shift().toLowerCase();

    switch (sub) {
      case 'add': {
        const sujet = args.join(' ').trim();
        if (!sujet) {
          return message.channel.send({
            embeds: [
              createEmbed({
                title: 'Sujet manquant',
                description: 'Usage : `!note add <sujet>`',
                error: true,
              }),
            ],
          });
        }
        userData.notes.push({ sujet, addedBy: message.author.tag });
        saveData(data);
        return message.channel.send({
          embeds: [
            createEmbed({
              title: 'Note ajoutée 📌',
              description: `**${sujet}**\n\nAjoutée par *${message.author.tag}*`,
              color: '#4caf50',
            }),
          ],
        });
      }

      case 'list': {
        if (!userData.notes.length) {
          return message.channel.send({
            embeds: [
              createEmbed({
                title: '📭 Aucune note',
                description: 'Ta liste est vide pour l’instant.',
                color: '#808080',
              }),
            ],
          });
        }
        const notesList = userData.notes
          .map((n, i) => `**${i + 1}.** ${n.sujet}`)
          .join('\n');
        const embed = new EmbedBuilder()
          .setColor('#2196f3')
          .setTitle(`📋 Tes notes (${message.author.username})`)
          .setDescription(notesList)
          .setFooter({
            text: `Total : ${userData.notes.length} note${userData.notes.length > 1 ? 's' : ''}`,
          })
          .setTimestamp();
        return message.channel.send({
          content: `<@${message.author.id}>`,
          embeds: [embed],
        });
      }

      case 'del': {
        const num = parseInt(args[0], 10);
        if (isNaN(num) || num < 1 || num > userData.notes.length) {
          return message.channel.send({
            embeds: [
              createEmbed({
                title: 'Numéro invalide',
                description: `Choisis un numéro entre **1** et **${userData.notes.length}**.`,
                error: true,
              }),
            ],
          });
        }
        const [removed] = userData.notes.splice(num - 1, 1);
        saveData(data);
        return message.channel.send({
          embeds: [
            createEmbed({
              title: '🗑️ Note supprimée',
              description: `**${removed.sujet}** a été retirée de ta liste.`,
              color: '#f44336',
            }),
          ],
        });
      }

      case 'setchannel': {
        userData.channelId = message.channel.id;
        saveData(data);
        return message.channel.send({
          embeds: [
            createEmbed({
              title: '✅ Salon défini',
              description: `Tes rappels seront désormais envoyés dans **#${message.channel.name}**.`,
              color: '#4caf50',
            }),
          ],
        });
      }

      default:
        return message.channel.send({
          embeds: [
            createEmbed({
              title: 'Commande inconnue',
              description: 'Commandes disponibles : `add` | `list` | `del` | `setchannel`',
              error: true,
            }),
          ],
        });
    }
  },
};
