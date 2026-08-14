// KaplanMC SMP - Site + Başvuru Botu (tek process)
// Gerekli paketler: npm install express discord.js dotenv

require('dotenv').config();
const path = require('path');
const express = require('express');
const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits,
} = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const APPLICATION_CHANNEL_ID = process.env.APPLICATION_CHANNEL_ID;
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID; // isteğe bağlı
const PORT = process.env.PORT || 3000;

// ---------- Discord Bot ----------
const client = new Client({
    intents: [GatewayIntentBits.Guilds],
});

client.once('ready', () => {
    console.log(`Discord bot ${client.user.tag} olarak bağlandı.`);
});

// Onayla / Reddet butonlarını işle
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    const [action] = interaction.customId.split('_');
    if (action !== 'onayla' && action !== 'reddet') return;

    const member = interaction.member;
    const isStaff =
        member.permissions.has(PermissionFlagsBits.ManageGuild) ||
        (STAFF_ROLE_ID && member.roles.cache.has(STAFF_ROLE_ID));

    if (!isStaff) {
        await interaction.reply({ content: 'Bu işlemi yapmak için yetkin yok.', ephemeral: true });
        return;
    }

    const oldEmbed = interaction.message.embeds[0];
    const newEmbed = EmbedBuilder.from(oldEmbed);
    const durumIndex = newEmbed.data.fields.findIndex(f => f.name === 'Durum');
    const yeniDurum =
        action === 'onayla'
            ? `✅ Onaylandı — ${interaction.user.username}`
            : `❌ Reddedildi — ${interaction.user.username}`;

    if (durumIndex >= 0) newEmbed.data.fields[durumIndex].value = yeniDurum;
    newEmbed.setColor(action === 'onayla' ? 0x2ecc71 : 0xe74c3c);

    const disabledRow = new ActionRowBuilder().addComponents(
        ButtonBuilder.from(interaction.message.components[0].components[0]).setDisabled(true),
        ButtonBuilder.from(interaction.message.components[0].components[1]).setDisabled(true),
    );

    await interaction.update({ embeds: [newEmbed], components: [disabledRow] });
});

client.login(TOKEN);

// ---------- Web Sitesi + API ----------
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const SERVER_IP = 'kaplanmc.aternos.me';

app.get('/api/status', async (req, res) => {
    try {
        const response = await fetch(`https://api.mcsrvstat.us/3/${SERVER_IP}`, {
            headers: { 'User-Agent': 'KaplanMC-Site/1.0' },
        });
        const data = await response.json();
        res.json(data);
    } catch (err) {
        console.error('Sunucu durumu alınamadı:', err);
        res.status(500).json({ online: false, error: 'Durum alınamadı' });
    }
});

app.post('/api/apply', async (req, res) => {
    try {
        const { name, age, role, hours, reason, discord } = req.body;

        if (!name || !age || !role || !hours || !reason || !discord) {
            return res.status(400).json({ error: 'Eksik alan var.' });
        }

        const embed = new EmbedBuilder()
            .setTitle('📋 Yeni Yetkili Başvurusu (Siteden)')
            .setColor(0xffcc00)
            .addFields(
                { name: 'Discord Kullanıcı Adı', value: discord, inline: true },
                { name: 'Minecraft Nick', value: name, inline: true },
                { name: 'Yaş', value: String(age), inline: true },
                { name: 'Başvurulan Grup', value: role, inline: true },
                { name: 'Günlük Aktiflik', value: hours, inline: true },
                { name: 'Sebep', value: reason },
                { name: 'Durum', value: '⏳ Beklemede' },
            )
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('onayla_web').setLabel('Onayla').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('reddet_web').setLabel('Reddet').setStyle(ButtonStyle.Danger),
        );

        const channel = await client.channels.fetch(APPLICATION_CHANNEL_ID);
        await channel.send({ embeds: [embed], components: [row] });

        res.json({ ok: true });
    } catch (err) {
        console.error('Başvuru gönderilemedi:', err);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

app.listen(PORT, () => {
    console.log(`Site http://localhost:${PORT} adresinde çalışıyor.`);
});
          
