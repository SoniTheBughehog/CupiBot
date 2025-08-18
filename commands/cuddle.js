const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');

const gifFile = path.join(__dirname, '..', 'data', 'gifhug.json');

function getRandomGif() {
  if (!fs.existsSync(gifFile)) return null;
  try {
    const gifs = JSON.parse(fs.readFileSync(gifFile, 'utf8'));
    if (!Array.isArray(gifs) || gifs.length === 0) return null;
    return gifs[Math.floor(Math.random() * gifs.length)];
  } catch {
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

    const embed = new EmbedBuilder()
      .setColor('#ff69b4')
      .setTitle('🤗 Câlin virtuel !')
      .setDescription(`${message.author} envoie un gros câlin à ${user}!`)
      .setTimestamp();

    if (gif) embed.setImage(gif);

    message.channel.send({ content: `${user}`, embeds: [embed] });
  }
};
