const { EmbedBuilder } = require("discord.js");

function createEmbed({
  title,
  description,
  color = 0x3498db,
  fields = [],
  footer,
  timestamp = true,
}) {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color);
  
  if (fields.length) embed.addFields(fields);
  if (footer) embed.setFooter({ text: footer });
  if (timestamp) embed.setTimestamp();
  
  return embed;
}

function createErrorEmbed(title, description) {
  return createEmbed({
    title: `❌ ${title}`,
    description,
    color: 0xff0000,
  });
}

function getWeatherEmoji(weatherCode, isDay = true) {
  const weatherEmojis = {
    200: "⛈️", 201: "⛈️", 202: "⛈️", // Thunderstorm
    210: "🌩️", 211: "🌩️", 212: "🌩️", 221: "🌩️",
    230: "⛈️", 231: "⛈️", 232: "⛈️",
    
    300: "🌦️", 301: "🌦️", 302: "🌧️", // Drizzle
    310: "🌧️", 311: "🌧️", 312: "🌧️", 313: "🌧️", 314: "🌧️", 321: "🌧️",
    
    500: "🌧️", 501: "🌧️", 502: "🌧️", 503: "🌧️", 504: "🌧️", // Rain
    511: "🌨️", 520: "🌦️", 521: "🌦️", 522: "🌧️", 531: "🌧️",
    
    600: "❄️", 601: "❄️", 602: "❄️", // Snow
    611: "🌨️", 612: "🌨️", 613: "🌨️",
    615: "🌨️", 616: "🌨️", 620: "❄️", 621: "❄️", 622: "❄️",
    
    701: "🌫️", 711: "🌫️", 721: "🌫️", 731: "🌪️", // Atmosphere
    741: "🌫️", 751: "🌪️", 761: "🌪️", 762: "🌋", 771: "💨", 781: "🌪️",
    
    800: isDay ? "☀️" : "🌙", // Clear
    801: isDay ? "🌤️" : "☁️", // Few clouds
    802: "⛅", 803: "☁️", 804: "☁️" // Clouds
  };
  
  return weatherEmojis[weatherCode] || (isDay ? "☀️" : "🌙");
}

function formatTemperature(temp) {
  return `${Math.round(temp)}°C`;
}

function formatWindSpeed(speed) {
  return `${Math.round(speed * 3.6)} km/h`; // Conversion m/s vers km/h
}

function getWindDirection(degrees) {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return directions[Math.round(degrees / 22.5) % 16];
}

async function getWeatherData(city) {
  const API_KEY = process.env.OPENWEATHER_API_KEY;
  
  if (!API_KEY) {
    throw new Error("Clé API OpenWeatherMap manquante dans le fichier .env");
  }
  
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric&lang=fr`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (!response.ok) {
      if (data.cod === "404") {
        throw new Error(`Ville "${city}" introuvable. Vérifiez l'orthographe.`);
      }
      throw new Error(`Erreur API: ${data.message}`);
    }
    
    return data;
  } catch (error) {
    if (error.message.includes("fetch")) {
      throw new Error("Impossible de contacter le service météo. Réessayez plus tard.");
    }
    throw error;
  }
}

module.exports = {
  name: "weather",
  description: "Affiche la météo d'une ville",
  
  async execute(message, args) {
    if (!args.length) {
      const helpEmbed = createEmbed({
        title: "🌤️ Aide - Commande Météo",
        description: [
          "**Utilisation :**",
          "`!weather <ville>` - Météo d'une ville",
          "`!weather <ville>, <pays>` - Météo plus précise",
          "",
          "**Exemples :**",
          "`!weather Paris`",
          "`!weather London, UK`",
          "`!weather New York, US`",
          "`!weather Tokyo, JP`",
        ].join("\n"),
        color: 0xf39c12,
        footer: `Demandé par ${message.author.tag}`,
      });
      
      return message.channel.send({ embeds: [helpEmbed] });
    }

    const city = args.join(" ");
    
    // Message de chargement
    const loadingMessage = await message.channel.send("🔍 Recherche des données météo...");
    
    try {
      const weather = await getWeatherData(city);
      
      const emoji = getWeatherEmoji(weather.weather[0].id, weather.sys.sunrise < Date.now()/1000 < weather.sys.sunset);
      const temperature = formatTemperature(weather.main.temp);
      const feelsLike = formatTemperature(weather.main.feels_like);
      const tempMin = formatTemperature(weather.main.temp_min);
      const tempMax = formatTemperature(weather.main.temp_max);
      const description = weather.weather[0].description;
      const humidity = weather.main.humidity;
      const pressure = weather.main.pressure;
      const windSpeed = formatWindSpeed(weather.wind?.speed || 0);
      const windDir = weather.wind?.deg ? getWindDirection(weather.wind.deg) : "N/A";
      const visibility = weather.visibility ? Math.round(weather.visibility / 1000) : "N/A";
      
      // Calcul du lever/coucher de soleil
      const sunrise = new Date(weather.sys.sunrise * 1000).toLocaleTimeString('fr-FR', { 
        hour: '2-digit', 
        minute: '2-digit',
        timeZone: 'Europe/Paris'
      });
      const sunset = new Date(weather.sys.sunset * 1000).toLocaleTimeString('fr-FR', { 
        hour: '2-digit', 
        minute: '2-digit',
        timeZone: 'Europe/Paris'
      });
      
      const weatherEmbed = createEmbed({
        title: `${emoji} Météo à ${weather.name}, ${weather.sys.country}`,
        description: `**${temperature}** - ${description.charAt(0).toUpperCase() + description.slice(1)}`,
        color: 0x3498db,
        fields: [
          {
            name: "🌡️ Températures",
            value: [
              `**Actuelle:** ${temperature}`,
              `**Ressentie:** ${feelsLike}`,
              `**Min/Max:** ${tempMin} / ${tempMax}`
            ].join("\n"),
            inline: true
          },
          {
            name: "💨 Vent & Air",
            value: [
              `**Vitesse:** ${windSpeed}`,
              `**Direction:** ${windDir}`,
              `**Pression:** ${pressure} hPa`
            ].join("\n"),
            inline: true
          },
          {
            name: "💧 Humidité & Visibilité",
            value: [
              `**Humidité:** ${humidity}%`,
              `**Visibilité:** ${visibility} km`,
              `**Nuages:** ${weather.clouds?.all || 0}%`
            ].join("\n"),
            inline: true
          },
          {
            name: "🌅 Lever/Coucher de soleil",
            value: `🌅 ${sunrise} • 🌇 ${sunset}`,
            inline: false
          }
        ],
        footer: `Données fournies par OpenWeatherMap • Demandé par ${message.author.tag}`,
      });
      
      await loadingMessage.edit({ content: null, embeds: [weatherEmbed] });
      
    } catch (error) {
      console.error("Erreur météo:", error);
      
      const errorEmbed = createErrorEmbed(
        "Erreur météo",
        error.message || "Une erreur inattendue s'est produite."
      );
      
      await loadingMessage.edit({ content: null, embeds: [errorEmbed] });
    }
  },
};