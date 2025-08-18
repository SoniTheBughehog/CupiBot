const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');

const filePath = path.join(__dirname, '..', 'data', 'callnote.json');

function readCalls() {
  if (!fs.existsSync(filePath)) return [];
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return [];
  }
}

function saveCalls(calls) {
  fs.writeFileSync(filePath, JSON.stringify(calls, null, 2));
}

function usageEmbed(prefix, user) {
  return new EmbedBuilder()
    .setColor(0xff9800)
    .setTitle('⚠️ Utilisation de la commande')
    .setDescription([
      `**${prefix}callnote add <qui> <sujet>** → Ajouter un sujet`,
      `**${prefix}callnote list** → Voir la liste`,
      `**${prefix}callnote del <num>** → Supprimer un sujet`
    ].join('\n'))
    .setFooter({ text: `Demandé par ${user.tag}` })
    .setTimestamp();
}

function errorEmbed(title, description, user) {
  return new EmbedBuilder()
    .setColor(0xf44336)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: `Demandé par ${user.tag}` })
    .setTimestamp();
}

module.exports = {
  name: 'callnote',
  description: 'Gérer la liste des sujets pour un appel',
  async execute(message, args) {
    const prefix = '!';
    const calls = readCalls();

    if (!args.length) {
      await message.channel.send({ embeds: [usageEmbed(prefix, message.author)] });
      return;
    }

    const subcommand = args.shift().toLowerCase();

    switch (subcommand) {
      case 'add': {
        if (args.length < 2) {
          await message.channel.send({ embeds: [usageEmbed(prefix, message.author)] });
          return;
        }
        const qui = args.shift();
        const sujet = args.join(' ');
        calls.push({ qui, sujet, addedBy: message.author.tag });
        saveCalls(calls);

        const embed = new EmbedBuilder()
          .setColor(0x4caf50)
          .setTitle('✅ Sujet ajouté')
          .addFields(
            { name: 'Pour', value: qui, inline: true },
            { name: 'Sujet', value: sujet, inline: true },
            { name: 'Ajouté par', value: message.author.tag, inline: false }
          )
          .setTimestamp();

        await message.channel.send({ embeds: [embed] });
        break;
      }
      case 'list': {
        if (!calls.length) {
          const embed = new EmbedBuilder()
            .setColor(0x9e9e9e)
            .setTitle('📭 Liste vide')
            .setDescription('Aucun sujet n’a encore été ajouté.')
            .setFooter({ text: `Demandé par ${message.author.tag}` })
            .setTimestamp();
          await message.channel.send({ embeds: [embed] });
          return;
        }

        const embed = new EmbedBuilder()
          .setColor(0x2196f3)
          .setTitle('📋 Liste des sujets')
          .setDescription(
            calls.map((c, i) => `**${i + 1}.** [${c.qui}] ${c.sujet} _(par ${c.addedBy})_`).join('\n')
          )
          .setFooter({ text: `Demandé par ${message.author.tag}` })
          .setTimestamp();

        await message.channel.send({ embeds: [embed] });
        break;
      }
      case 'del': {
        const num = parseInt(args[0], 10);
        if (isNaN(num) || num < 1 || num > calls.length) {
          await message.channel.send({
            embeds: [errorEmbed('❌ Erreur', 'Numéro invalide. Vérifie avec `!callnote list`.', message.author)]
          });
          return;
        }

        const [removed] = calls.splice(num - 1, 1);
        saveCalls(calls);

        const embed = new EmbedBuilder()
          .setColor(0xf44336)
          .setTitle('🗑️ Sujet supprimé')
          .addFields(
            { name: 'Pour', value: removed.qui, inline: true },
            { name: 'Sujet', value: removed.sujet, inline: true }
          )
          .setFooter({ text: `Supprimé par ${message.author.tag}` })
          .setTimestamp();

        await message.channel.send({ embeds: [embed] });
        break;
      }
      default: {
        const embed = new EmbedBuilder()
          .setColor(0xff5722)
          .setTitle('❓ Commande inconnue')
          .setDescription(`La sous-commande \`${subcommand}\` n’existe pas.`)
          .addFields({ name: 'Commandes disponibles', value: '`add`, `list`, `del`' })
          .setFooter({ text: `Demandé par ${message.author.tag}` })
          .setTimestamp();

        await message.channel.send({ embeds: [embed] });
      }
    }
  }
};
