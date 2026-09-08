const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const ResendModule = require('resend');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

// 1. MONGODB BAĞLANTISI
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ MongoDB veritabanına başarıyla bağlandı."))
    .catch((err) => console.error("❌ MongoDB Bağlantı Hatası:", err.message));

// 2. RESEND MAIL ENTEGRASYONU
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const ALICI_GMAIL = process.env.ALICI_GMAIL || "info.eyem43@gmail.com";

const Resend = ResendModule.Resend || ResendModule;
const resend = new Resend(RESEND_API_KEY);

// 3. GELİŞMİŞ SÜRÜCÜ VE NAVİGASYON ŞEMASI (SCHEMAS)
const LocationSchema = new mongoose.Schema({
    lat: Number,
    lng: Number,
    addressName: String
}, { _id: false });

const DriverSchema = new mongoose.Schema({
    name: String,
    email: String,
    plate: String,
    vehicleType: String,
    photoUrl: String,
    isApproved: { type: Boolean, default: false },
    
    // Canlı Navigasyon ve Rota Verileri
    currentLocation: {
        lat: Number,
        lng: Number,
        speed: { type: Number, default: 0 },       // km/h
        heading: { type: Number, default: 0 },     // Araç yönü (derece 0-360)
        updatedAt: { type: Date, default: Date.now }
    },
    startLocation: LocationSchema,                  // Başlangıç Noktası
    destination: LocationSchema,                    // Bitiş / Hedef Noktası
    
    // Zaman Takibi
    estimatedDeparture: Date,                       // Tahmini Kalkış
    estimatedArrival: Date,                         // Tahmini Varış
    actualDeparture: Date,                          // Gerçekleşen Kalkış
    actualArrival: Date,                            // Gerçekleşen Varış
    
    // Rota Bilgileri
    routeGeometry: Array,                           // Çizilecek rota çizgisi koordinat dizisi [[lat, lng], ...]
    routeHistory: [LocationSchema],                 // Sürücünün katettiği geçmiş konumlar (izler)
    
    createdAt: { type: Date, default: Date.now }
});

const Driver = mongoose.model('Driver', DriverSchema);

// 4. API: SÜRÜCÜ KAYDI VE BİLDİRİM MAİLİ
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, plate, vehicleType, photoUrl, startLocation, destination, estimatedDeparture } = req.body;

        if (!name || !email || !plate) {
            return res.status(400).json({ success: false, error: "Lütfen tüm zorunlu alanları doldurun." });
        }

        const newDriver = new Driver({
            name,
            email,
            plate,
            vehicleType,
            photoUrl,
            startLocation,
            destination,
            estimatedDeparture
        });

        const savedDriver = await newDriver.save();
        console.log("📝 Yeni sürücü kaydedildi:", plate);

        const protocol = req.protocol;
        const host = req.get('host');
        const approveUrl = `${protocol}://${host}/api/approve/${savedDriver._id}`;

        resend.emails.send({
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
                    </table>
                    <br>
                    <a href="${approveUrl}" style="background-color: #2e7d32; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">SÜRÜCÜYÜ ONAYLA</a>
                </div>
            `
        }).then(data => {
            console.log("✅ Bildirim maili başarıyla gönderildi:", data);
        }).catch(mailErr => {
            console.error("❌ Mail Gönderim Hatası:", mailErr.message);
        });

        res.json({ success: true, message: "Kayıt başarıyla alındı.", driverId: savedDriver._id });
    } catch (error) {
        console.error("Kayıt Hatası:", error);
        res.status(500).json({ success: false, error: "Veritabanı kayıt hatası: " + error.message });
    }
});

// 5. API: SÜRÜCÜ ONAYLAMA
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
                <p>Sürücü artık GOWay MAPS haritasında canlı navigasyon ve konum paylaşabilir.</p>
            </div>
        `);
    } catch (error) {
        res.status(500).send("Onaylama hatası: " + error.message);
    }
});

// 6. API: TÜM SÜRÜCÜLERİ VE ROTARLARI LİSTELEME (HARİTA İÇİN)
app.get('/api/drivers', async (req, res) => {
    try {
        const drivers = await Driver.find({ isApproved: true });
        res.json({ success: true, drivers });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// SUNUCU TEST ENDPOINT
app.get('/', (req, res) => res.send("GOWay MAPS Gelismis Lojistik Backend Aktif!"));

// 7. SOCKET.IO GELİŞMİŞ CANLI NAVİGASYON VE ROTA YAYINI
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

io.on('connection', (socket) => {
    console.log("⚡ Yeni istemci bağlandı:", socket.id);

    // Sürücü Yolculuğa Başladığında (Kalkış zamanı kaydı)
    socket.on('startTrip', async (data) => {
        const { driverId } = data;
        if (driverId) {
            await Driver.findByIdAndUpdate(driverId, { actualDeparture: new Date() });
            io.emit('tripStarted', { driverId, departureTime: new Date() });
        }
    });

    // Sürücü Canlı Konum, Hız ve Açısını Gönderdiğinde
    socket.on('sendLocation', async (data) => {
        // payload: { driverId, lat, lng, speed, heading, estimatedArrival, routeGeometry }
        const { driverId, lat, lng, speed, heading, estimatedArrival, routeGeometry } = data;

        const locationUpdate = {
            'currentLocation.lat': lat,
            'currentLocation.lng': lng,
            'currentLocation.speed': speed || 0,
            'currentLocation.heading': heading || 0,
            'currentLocation.updatedAt': new Date()
        };

        if (estimatedArrival) locationUpdate.estimatedArrival = estimatedArrival;
        if (routeGeometry) locationUpdate.routeGeometry = routeGeometry;

        // Veritabanını güncelle ve katettiği konumu geçmişe (routeHistory) ekle
        if (driverId) {
            await Driver.findByIdAndUpdate(driverId, {
                $set: locationUpdate,
                $push: { routeHistory: { lat, lng } }
            });
        }

        // Haritada izleyen tüm web panellerine canlı veriyi anlık fırlat
        io.emit('updateLocation', data);
    });

    // Sürücü Hedefe Vardığında
    socket.on('endTrip', async (data) => {
        const { driverId } = data;
        if (driverId) {
            await Driver.findByIdAndUpdate(driverId, { actualArrival: new Date() });
            io.emit('tripEnded', { driverId, arrivalTime: new Date() });
        }
    });

    socket.on('disconnect', () => {
        console.log("❌ İstemci ayrıldı:", socket.id);
    });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`🚀 Sunucu ${PORT} portunda aktif.`));
