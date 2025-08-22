async function sendEmbed(client, channelId, embed) {
  if (!channelId) return;
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel) return;
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error(`Erreur en envoyant un embed sur le channel ${channelId}:`, err);
  }
}

module.exports = { sendEmbed };
