const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const ResendModule = require('resend');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'gowaymaps_gizli_anahtar';
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const ALICI_GMAIL = process.env.ALICI_GMAIL || "info.eyem43@gmail.com";

mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ MongoDB veritabanına bağlandı."))
    .catch((err) => console.error("❌ MongoDB Hata:", err.message));

const Resend = ResendModule.Resend || ResendModule;
const resend = new Resend(RESEND_API_KEY);

const LocationSchema = new mongoose.Schema({
    lat: Number,
    lng: Number,
    addressName: String
}, { _id: false });

const DriverSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    plate: { type: String, required: true },
    vehicleType: { 
        type: String, 
        enum: ['Lojistik Transfer Aracı', 'Genel Araç'], 
        default: 'Genel Araç' 
    },
    photoUrl: { type: String, default: '' },
    isApproved: { type: Boolean, default: false },
    
    // Telemetri
    currentLocation: {
        lat: Number,
        lng: Number,
        speed: { type: Number, default: 0 },
        heading: { type: Number, default: 0 },
        updatedAt: { type: Date, default: Date.now }
    },
    
    // Zaman Parametreleri
    estimatedDeparture: Date,
    actualDeparture: Date,
    estimatedArrival: Date,
    actualArrival: Date,

    // Rota Verileri
    startLocation: LocationSchema,
    destination: LocationSchema,
    routeGeometry: Array,  // Şu an izlenen aktif rota
    routeHistory: [LocationSchema], // Geçmiş izlenen rota (breadcrumbs)
    
    createdAt: { type: Date, default: Date.now }
});

const Driver = mongoose.model('Driver', DriverSchema);

// KAYIT OL
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, plate, vehicleType, photoUrl, estimatedDeparture, estimatedArrival } = req.body;
        if (!name || !email || !password || !plate) {
            return res.status(400).json({ success: false, error: "Zorunlu alanları doldurun." });
        }

        const existing = await Driver.findOne({ email });
        if (existing) return res.status(400).json({ success: false, error: "Bu e-posta kayıtlı." });

        const newDriver = new Driver({
            name, email, password, plate, vehicleType, photoUrl,
            estimatedDeparture, estimatedArrival
        });
        const savedDriver = await newDriver.save();

        const protocol = req.protocol;
        const host = req.get('host');
        const approveUrl = `${protocol}://${host}/api/approve/${savedDriver._id}`;

        if (RESEND_API_KEY) {
            resend.emails.send({
                from: 'GOWay MAPS <onboarding@resend.dev>',
                to: [ALICI_GMAIL],
                subject: `🚨 Yeni Sürücü Başvurusu: ${plate}`,
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px;">
                        <h2>GOWay MAPS - Yeni Sürücü Kaydı</h2>
                        <p><b>Sürücü:</b> ${name}<br><b>Plaka:</b> ${plate}<br><b>Araç Tipi:</b> ${vehicleType}</p>
                        ${photoUrl ? `<img src="${photoUrl}" style="max-width:200px; border-radius:8px;"/><br><br>` : ''}
                        <a href="${approveUrl}" style="background-color: #2e7d32; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">SÜRÜCÜYÜ ONAYLA</a>
                    </div>
                `
            }).catch(err => console.error("Mail hatası:", err.message));
        }

        res.json({ success: true, message: "Kayıt alındı. Onay sonrası giriş yapabilirsiniz.", driverId: savedDriver._id });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GİRİŞ YAP
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const driver = await Driver.findOne({ email, password });
        
        if (!driver) return res.status(401).json({ success: false, error: "E-posta veya şifre hatalı." });
        if (!driver.isApproved) return res.status(403).json({ success: false, error: "Hesabınız henüz onaylanmadı." });

        const token = jwt.sign({ id: driver._id }, JWT_SECRET, { expiresIn: '1d' });
        res.json({
            success: true,
            token,
            user: {
                id: driver._id,
                name: driver.name,
                plate: driver.plate,
                vehicleType: driver.vehicleType,
                photoUrl: driver.photoUrl,
                estimatedDeparture: driver.estimatedDeparture,
                estimatedArrival: driver.estimatedArrival
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/approve/:id', async (req, res) => {
    try {
        const driver = await Driver.findByIdAndUpdate(req.params.id, { isApproved: true }, { new: true });
        if (!driver) return res.status(404).send("Sürücü bulunamadı.");
        res.send(`<h1 style="color: #2e7d32; text-align:center;">✅ ${driver.plate} Plakalı Sürücü Onaylandı!</h1>`);
    } catch (error) {
        res.status(500).send("Onaylama hatası: " + error.message);
    }
});

app.get('/api/drivers', async (req, res) => {
    try {
        const drivers = await Driver.find({ isApproved: true }).select('-password');
        res.json({ success: true, drivers });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// SOCKET.IO CANLI TELEMETRİ
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    transports: ['websocket', 'polling']
});

io.on('connection', (socket) => {
    socket.on('startTrip', async ({ driverId }) => {
        if (driverId) {
            await Driver.findByIdAndUpdate(driverId, { actualDeparture: new Date() });
            io.emit('tripStarted', { driverId, actualDeparture: new Date() });
        }
    });

    socket.on('endTrip', async ({ driverId }) => {
        if (driverId) {
            await Driver.findByIdAndUpdate(driverId, { actualArrival: new Date() });
            io.emit('tripEnded', { driverId, actualArrival: new Date() });
        }
    });

    socket.on('sendLocation', async (data) => {
        const { driverId, lat, lng, speed, heading, routeGeometry, photoUrl, vehicleType } = data;
        if (driverId) {
            await Driver.findByIdAndUpdate(driverId, {
                $set: {
                    'currentLocation.lat': lat,
                    'currentLocation.lng': lng,
                    'currentLocation.speed': speed || 0,
                    'currentLocation.heading': heading || 0,
                    'currentLocation.updatedAt': new Date(),
                    ...(routeGeometry && { routeGeometry })
                },
                $push: { routeHistory: { lat, lng } }
            }).catch(err => console.error(err.message));
        }
        io.emit('updateLocation', data);
    });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`🚀 Sunucu ${PORT} portunda aktif.`));
