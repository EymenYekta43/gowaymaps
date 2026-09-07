const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

// MongoDB Bağlantısı
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://infoeyem43_db_user:ch1DgmNEwiJr0SYg@gowaymaps.uuasw9u.mongodb.net/?appName=GOWayMAPS";
mongoose.connect(MONGO_URI)
    .then(() => console.log("MongoDB Bağlantısı Başarılı"))
    .catch(err => console.error("MongoDB Hatası:", err));

// Kullanıcı Şeması
const UserSchema = new mongoose.Schema({
    name: String,
    email: String,
    plate: String,
    vehicleType: String,
    isApproved: { type: Boolean, default: false }
});
const User = mongoose.model('User', UserSchema);

// Nodemailer (Gmail Mail Gönderici)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'info.eyem43@gmail.com',
        pass: process.env.GMAIL_APP_PASS // Render ortamında tanımlayacağız
    }
});

// Üye Başvuru Endpoint'i
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, plate, vehicleType } = req.body;
        const newUser = new User({ name, email, plate, vehicleType });
        await newUser.save();

        // Admin Maili Gönderme
        const approveLink = `https://${req.get('host')}/api/approve/${newUser._id}`;
        const mailOptions = {
            from: 'GOWay MAPS <info.eyem43@gmail.com>',
            to: 'info.eyem43@gmail.com',
            subject: '🔔 Yeni Sürücü / Üyelik Başvurusu - GOWay MAPS',
            html: `
                <h3>Yeni Bir Sürücü Başvurusu Geldi</h3>
                <p><strong>Ad Soyad / Firma:</strong> ${name}</p>
                <p><strong>E-posta:</strong> ${email}</p>
                <p><strong>Plaka:</strong> ${plate}</p>
                <p><strong>Araç Tipi:</strong> ${vehicleType}</p>
                <br>
                <a href="${approveLink}" style="padding: 10px 20px; background-color: #00adb5; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">Üyeliği Onayla</a>
            `
        };

        await transporter.sendMail(mailOptions);
        res.json({ success: true, message: 'Başvuru alındı, onay e-postası gönderildi.' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Admin Tek Tıkla Onay Endpoint'i
app.get('/api/approve/:id', async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.params.id, { isApproved: true });
        res.send("<h2>✅ Üyelik başarıyla onaylandı! Kullanıcı artık konum paylaşabilir.</h2>");
    } catch (err) {
        res.status(500).send("Hata oluştu.");
    }
});

// Socket.io Canlı Konum Paylaşımı
io.on('connection', (socket) => {
    socket.on('sendLocation', (data) => {
        io.emit('updateLocation', data);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Sunucu ${PORT} portunda aktif.`));
