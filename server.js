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

// MONGODB BAĞLANTISI
const MONGO_URI = process.env.MONGO_URI;
mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ MongoDB veritabanına başarıyla bağlandı."))
    .catch((err) => console.error("❌ MongoDB Bağlantı Hatası:", err.message));

// RESEND E-POSTA
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const ALICI_GMAIL = process.env.ALICI_GMAIL || "info.eyem43@gmail.com";
const Resend = ResendModule.Resend || ResendModule;
const resend = new Resend(RESEND_API_KEY);

// MONGOOSE ŞEMALARI
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
    currentLocation: {
        lat: Number,
        lng: Number,
        speed: { type: Number, default: 0 },
        heading: { type: Number, default: 0 },
        updatedAt: { type: Date, default: Date.now }
    },
    startLocation: LocationSchema,
    destination: LocationSchema,
    estimatedDeparture: Date,
    estimatedArrival: Date,
    actualDeparture: Date,
    actualArrival: Date,
    routeGeometry: Array,
    routeHistory: [LocationSchema],
    createdAt: { type: Date, default: Date.now }
});

const Driver = mongoose.model('Driver', DriverSchema);

// REST API ENDPOINTS
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, plate, vehicleType, photoUrl, startLocation, destination, estimatedDeparture } = req.body;
        if (!name || !email || !plate) {
            return res.status(400).json({ success: false, error: "Lütfen zorunlu alanları doldurun." });
        }

        const newDriver = new Driver({ name, email, plate, vehicleType, photoUrl, startLocation, destination, estimatedDeparture });
        const savedDriver = await newDriver.save();

        const protocol = req.protocol;
        const host = req.get('host');
        const approveUrl = `${protocol}://${host}/api/approve/${savedDriver._id}`;

        resend.emails.send({
            from: 'GOWay MAPS <onboarding@resend.dev>',
            to: [ALICI_GMAIL],
            subject: `🚨 Yeni Sürücü Başvurusu: ${plate}`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <h2 style="color: #1a73e8;">GOWay MAPS - Yeni Sürücü Başvurusu</h2>
                    <p><b>Sürücü:</b> ${name}<br><b>E-posta:</b> ${email}<br><b>Plaka:</b> ${plate}<br><b>Araç:</b> ${vehicleType || 'Genel Araç'}</p>
                    <a href="${approveUrl}" style="background-color: #2e7d32; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">SÜRÜCÜYÜ ONAYLA</a>
                </div>
            `
        }).catch(err => console.error("Mail hatası:", err.message));

        res.json({ success: true, message: "Kayıt başarıyla alındı.", driverId: savedDriver._id });
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
        const drivers = await Driver.find({ isApproved: true });
        res.json({ success: true, drivers });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/', (req, res) => res.send("GOWay MAPS Backend Aktif!"));

// SOCKET.IO CANLI TELEMETRİ
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling']
});

io.on('connection', (socket) => {
    console.log("⚡ Yeni istemci bağlandı:", socket.id);

    socket.on('startTrip', async ({ driverId }) => {
        if (driverId) await Driver.findByIdAndUpdate(driverId, { actualDeparture: new Date() });
    });

    socket.on('sendLocation', async (data) => {
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

        if (driverId) {
            await Driver.findByIdAndUpdate(driverId, {
                $set: locationUpdate,
                $push: { routeHistory: { lat, lng } }
            }).catch(err => console.error(err.message));
        }

        io.emit('updateLocation', data);
    });

    socket.on('disconnect', () => console.log("❌ İstemci ayrıldı:", socket.id));
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`🚀 Sunucu ${PORT} portunda aktif.`));
