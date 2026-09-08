const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

// 1. MONGODB BAĞLANTISI
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://infoeyem43_db_user:Goway123456@gowaymaps.uuasw9u.mongodb.net/gowaymaps?retryWrites=true&w=majority&appName=GOWayMAPS";

mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ MongoDB veritabanına başarıyla bağlandı."))
    .catch((err) => console.error("❌ MongoDB Bağlantı Hatası:", err.message));

// 2. GMAIL MAİL AYARLARI
// DİKKAT: Aşağıdaki mail adresini kendi Gmail adresinle değiştir!
const GMAIL_USER = process.env.GMAIL_USER || "info.eyem43@gmail.com"; 
const GMAIL_PASS = process.env.GMAIL_PASS || "nyad asik aima wzdd"; // Aldığın uygulama şifresi eklendi

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: GMAIL_USER,
        pass: GMAIL_PASS
    }
});

// 3. SÜRÜCÜ MODELİ
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

        // Sunucu Adresi (Render Linki üzerinden onaylama)
        const protocol = req.protocol;
        const host = req.get('host');
        const approveUrl = `${protocol}://${host}/api/approve/${savedDriver._id}`;

        // Yöneticiye Gidecek Bildirim Maili Tasarımı
        const mailOptions = {
            from: `"GOWay MAPS Sistem" <${GMAIL_USER}>`,
            to: GMAIL_USER, // Yeni başvuru maili sana gelsin
            subject: `🚨 Yeni Sürücü Başvurusu: ${plate}`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <h2 style="color: #1a73e8;">GOWay MAPS - Yeni Sürücü Başvurusu</h2>
                    <p>Sisteme yeni bir sürücü kaydı yapıldı. Detaylar aşağıdadır:</p>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr><td><b>Sürücü / Firma:</b></td><td>${name}</td></tr>
                        <tr><td><b>E-posta:</b></td><td>${email}</td></tr>
                        <tr><td><b>Plaka:</b></td><td>${plate}</td></tr>
                        <tr><td><b>Araç Tipi:</b></td><td>${vehicleType || 'Genel Araç'}</td></tr>
                        ${photoUrl ? `<tr><td><b>Fotoğraf:</b></td><td><a href="${photoUrl}" target="_blank">Görüntüle</a></td></tr>` : ''}
                    </table>
                    <br><br>
                    <a href="${approveUrl}" style="background-color: #2e7d32; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">SÜRÜCÜYÜ ONAYLA</a>
                </div>
            `
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error("Mail Gönderim Hatası:", error);
            } else {
                console.log("Bildirim maili gönderildi:", info.response);
            }
        });

        res.json({ success: true, message: "Kayıt başarıyla alındı." });
    } catch (error) {
        console.error("Kayıt Hatası:", error);
        res.status(500).json({ success: false, error: "Veritabanı kayıt hatası: " + error.message });
    }
});

// 5. API: TEK TIKLA SÜRÜCÜ ONAYLAMA (Maildeki linke tıklandığında çalışır)
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
                <p><b>${driver.plate}</b> plakalı sürücü (<b>${driver.name}</b>) başarıyla aktifleştirildi.</p>
                <p>Sürücü artık GOWay MAPS haritası üzerinde canlı konum paylaşımı yapabilir.</p>
            </div>
        `);
    } catch (error) {
        res.status(500).send("Onaylama işlemi sırasında hata oluştu: " + error.message);
    }
});

// TEST ENDPOINT
app.get('/', (req, res) => {
    res.send("GOWay MAPS Backend Sunucusu Aktif!");
});

// 6. SOCKET.IO CANLI KONUM
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

io.on('connection', (socket) => {
    socket.on('sendLocation', (data) => {
        io.emit('updateLocation', data);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Sunucu ${PORT} portunda aktif.`);
});
