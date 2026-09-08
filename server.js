const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const { Resend } = require('resend');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

// 1. MONGODB BAĞLANTISI
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://infoeyem43_db_user:Goway123456@gowaymaps.uuasw9u.mongodb.net/gowaymaps?retryWrites=true&w=majority&appName=GOWayMAPS";

mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ MongoDB veritabanına başarıyla bağlandı."))
    .catch((err) => console.error("❌ MongoDB Bağlantı Hatası:", err.message));

// 2. RESEND MAIL ENTEGRASYONU (Environment Variables Kullanımı)
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const ALICI_GMAIL = process.env.ALICI_GMAIL || "GMAIL_ADRESINIZ@gmail.com"; // Kendi Gmail adresinizi yazın

const resend = new Resend(RESEND_API_KEY);

// 3. SÜRÜCÜ MODELİ (DATABASE SCHEMA)
const DriverSchema = new mongoose.Schema({
    name: String,
    email: String,
    plate: String,
    vehicleType: String,
    photoUrl: String,
    isApproved: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

const Driver = mongoose.model('Driver', DriverSchema);

// 4. API: SÜRÜCÜ KAYDI VE BİLDİRİM MAİLİ
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, plate, vehicleType, photoUrl } = req.body;

        if (!name || !email || !plate) {
            return res.status(400).json({ success: false, error: "Lütfen tüm zorunlu alanları doldurun." });
        }

        const newDriver = new Driver({
            name,
            email,
            plate,
            vehicleType,
            photoUrl
        });

        const savedDriver = await newDriver.save();
        console.log("📝 Yeni sürücü kaydedildi:", plate);

        // Sunucu Adresi üzerinden otomatik onaylama linki
        const protocol = req.protocol;
        const host = req.get('host');
        const approveUrl = `${protocol}://${host}/api/approve/${savedDriver._id}`;

        // Mail Gönderimi (Resend HTTPS API)
        try {
            const data = await resend.emails.send({
                from: 'GOWay MAPS <onboarding@resend.dev>',
                to: [ALICI_GMAIL],
                subject: `🚨 Yeni Sürücü Başvurusu: ${plate}`,
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; max-width: 600px;">
                        <h2 style="color: #1a73e8; margin-top:0;">GOWay MAPS - Yeni Sürücü Başvurusu</h2>
                        <p>Sisteme yeni bir sürücü başvuruda bulundu. Detaylar aşağıdadır:</p>
                        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                            <tr><td style="padding: 6px 0;"><b>Sürücü / Firma:</b></td><td>${name}</td></tr>
                            <tr><td style="padding: 6px 0;"><b>E-posta:</b></td><td>${email}</td></tr>
                            <tr><td style="padding: 6px 0;"><b>Plaka:</b></td><td>${plate}</td></tr>
                            <tr><td style="padding: 6px 0;"><b>Araç Tipi:</b></td><td>${vehicleType || 'Genel Araç'}</td></tr>
                            ${photoUrl ? `<tr><td style="padding: 6px 0;"><b>Görsel:</b></td><td><a href="${photoUrl}" target="_blank">Görüntüle</a></td></tr>` : ''}
                        </table>
                        <br>
                        <a href="${approveUrl}" style="background-color: #2e7d32; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">SÜRÜCÜYÜ ONAYLA</a>
                    </div>
                `
            });
            console.log("✅ Bildirim maili başarıyla gönderildi:", data);
        } catch (mailErr) {
            console.error("❌ Mail Gönderim Hatası:", mailErr.message);
        }

        res.json({ success: true, message: "Kayıt başarıyla alındı." });
    } catch (error) {
        console.error("Kayıt Hatası:", error);
        res.status(500).json({ success: false, error: "Veritabanı kayıt hatası: " + error.message });
    }
});

// 5. API: TEK TIKLA SÜRÜCÜ ONAYLAMA
app.get('/api/approve/:id', async (req, res) => {
    try {
        const driverId = req.params.id;
        const driver = await Driver.findByIdAndUpdate(driverId, { isApproved: true }, { new: true });

        if (!driver) {
            return res.status(404).send("Sürücü bulunamadı.");
        }

        res.send(`
            <div style="text-align:center; padding:50px; font-family:sans-serif;">
                <h1 style="color: #2e7d32;">✅ Sürücü Başarıyla Onaylandı!</h1>
                <p><b>${driver.plate}</b> plakalı sürücü (<b>${driver.name}</b>) aktifleştirildi.</p>
                <p>Sürücü artık GOWay MAPS haritasında canlı konum paylaşabilir.</p>
            </div>
        `);
    } catch (error) {
        res.status(500).send("Onaylama hatası: " + error.message);
    }
});

// SUNUCU TEST ENDPOINT
app.get('/', (req, res) => res.send("GOWay MAPS Backend Sunucusu Aktif!"));

// 6. SOCKET.IO CANLI KONUM
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

io.on('connection', (socket) => {
    socket.on('sendLocation', (data) => {
        io.emit('updateLocation', data);
    });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`🚀 Sunucu ${PORT} portunda aktif.`));
