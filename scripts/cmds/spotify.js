const axios = require("axios");

module.exports = {
  config: {
    name: "spotify",
    version: "1.0.0",
    author: "April Manalo",
    role: 0,
    category: "music",
    guide: "-spotify <song name>"
  },

  onStart: async function ({ api, event, args }) {
    const { threadID, messageID, senderID } = event;
    const query = args.join(" ").trim();

    if (!query)
      return api.sendMessage(
        "⚠️ Usage: -spotify <song name>",
        threadID,
        messageID
      );

    try {
      const msg = await api.sendMessage("🔎 Searching Spotify...", threadID);

      const res = await axios.get(
        "https://norch-project.gleeze.com/api/spotify",
        { params: { q: query } }
      );

      const songs = res.data?.results?.slice(0, 5);
      if (!songs || songs.length === 0)
        return api.editMessage("❌ No results found.", msg.messageID);

      let text = "🎧 Spotify Results:\n\n";
      songs.forEach((s, i) => {
        text += `${i + 1}. ${s.title} - ${s.artist}\n⏱ ${s.duration}\n\n`;
      });
      text += "👉 Reply with a number (1–5)";

      await api.editMessage(text, msg.messageID);

      // ✅ VERY IMPORTANT
      global.client.handleReply.push({
        type: "spotify_selection",
        name: this.config.name,
        messageID: msg.messageID,
        author: senderID,
        songs
      });

    } catch (err) {
      console.error("[SPOTIFY SEARCH]", err);
      api.sendMessage("❌ Failed to search.", threadID, messageID);
    }
  },

  onReply: async function ({ api, event, handleReply }) {
    const { threadID, senderID, body } = event;

    if (senderID !== handleReply.author) return;
    if (handleReply.type !== "spotify_selection") return;

    const index = parseInt(body);
    if (isNaN(index) || index < 1 || index > handleReply.songs.length)
      return api.sendMessage("❌ Invalid number.", threadID);

    const song = handleReply.songs[index - 1];

    try {
      await api.unsendMessage(handleReply.messageID);

      await api.sendMessage(
        `⬇️ Downloading\n🎵 ${song.title}\n👤 ${song.artist}`,
        threadID
      );

      const dl = await axios.get(
        "https://norch-project.gleeze.com/api/spotify-dl-v2",
        { params: { url: song.spotify_url } }
      );

      const track = dl.data?.trackData?.[0];
      if (!track?.download_url) throw new Error("No download link");

      // cover
      await api.sendMessage(
        {
          body: `🎧 ${track.name}\n👤 ${track.artists}`,
          attachment: await global.utils.getStreamFromURL(track.image)
        },
        threadID
      );

      // mp3
      await api.sendMessage(
        {
          attachment: await global.utils.getStreamFromURL(track.download_url)
        },
        threadID
      );

      // 🧹 cleanup
      global.client.handleReply =
        global.client.handleReply.filter(
          r => r.messageID !== handleReply.messageID
        );

    } catch (err) {
      console.error("[SPOTIFY DOWNLOAD]", err);
      api.sendMessage("❌ Download failed.", threadID);
    }
  }
};
