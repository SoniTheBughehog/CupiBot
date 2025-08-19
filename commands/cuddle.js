const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');

const gifFile = path.join(__dirname, '..', 'data', 'gifhug.json');

function getRandomGif() {
  if (!fs.existsSync(gifFile)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(gifFile, 'utf8'));
    if (!Array.isArray(data.gifs) || data.gifs.length === 0) return null;
    return data.gifs[Math.floor(Math.random() * data.gifs.length)];
  } catch (e) {
    console.error(e);
    return null;
  }
}

module.exports = {
  name: 'cuddle',
  description: 'Envoie un câlin virtuel à quelqu’un',
  execute(message, args) {
    if (args.length === 0) {
      return message.channel.send('Usage: !cuddle @utilisateur');
    }

    const user = message.mentions.users.first();
    if (!user) {
      return message.channel.send('❌ Mentionne quelqu’un pour lui envoyer un câlin.');
    }

    const gif = getRandomGif();

    // message à afficher : si le gif a "message" on prend ça, sinon message par défaut
    const description = gif?.message
      ? gif.message.replace(/\{author\}/g, message.author.username).replace(/\{user\}/g, user.username)
      : `${message.author.username} envoie un gros câlin !`;

    const embed = new EmbedBuilder()
      .setColor('#ff69b4')
      .setTitle('🤗 Câlin virtuel !')
      .setDescription(description)
      .setTimestamp();

    if (gif?.url) {
      // Vérifie que l'URL commence bien par http(s)
      if (gif.url.startsWith('http')) {
        embed.setImage(gif.url);
      }
    }

    // mention dans content pour notifier l'utilisateur
    message.channel.send({ embeds: [embed] });
  }
};
