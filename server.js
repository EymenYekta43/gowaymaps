const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// CORS İzinleri (Vercel ve Yerel Erişim İçin)
app.use(cors());
app.use(express.json());

// 1. MONGODB BAĞLANTISI
// DiKKAT: Kendi MongoDB Atlas Bağlantı Linkini Aşağıdaki Tırnak İçine Yaz!
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://infoeyem43_db_user:Goway123456@gowaymaps.uuasw9u.mongodb.net/gowaymaps?retryWrites=true&w=majority&appName=GOWayMAPS";

mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ MongoDB veritabanına başarıyla bağlandı."))
    .catch((err) => console.error("❌ MongoDB Bağlantı Hatası:", err.message));

// 2. SÜRÜCÜ MODELİ (DATABASE SCHEMA)
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

// 3. API ENDPOINT: SÜRÜCÜ KAYDI
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

        await newDriver.save();
        console.log(" Yeni sürücü kaydedildi:", plate);

        res.json({ success: true, message: "Kayıt başarıyla alındı." });
    } catch (error) {
        console.error("Kayıt Hatası:", error);
        res.status(500).json({ success: false, error: "Veritabanı kayıt hatası: " + error.message });
    }
});

// TEST ENDPOINT (SUNUCU AYAKTA MI CHECK)
app.get('/', (req, res) => {
    res.send("GOWay MAPS Backend Sunucusu Çalışıyor!");
});

// 4. SOCKET.IO CANLI KONUM
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {
    console.log('⚡ Yeni bir cihaz bağlandı:', socket.id);

    socket.on('sendLocation', (data) => {
        io.emit('updateLocation', data);
    });

    socket.on('disconnect', () => {
        console.log('❌ Cihaz ayrıldı:', socket.id);
    });
});

// SUNUCUYU BAŞLAT
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Sunucu ${PORT} portunda aktif.`);
});
