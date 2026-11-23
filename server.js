const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || "arijewel-admin";
const CULQI_PUBLIC_KEY = process.env.CULQI_PUBLIC_KEY || "";
const CULQI_PRIVATE_KEY = process.env.CULQI_PRIVATE_KEY || "";
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

const db = new Database("arijewel.db");
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  duration TEXT NOT NULL,
  price TEXT NOT NULL,
  image TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  service_id INTEGER NOT NULL,
  mode TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  notes TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  deposit_amount INTEGER NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  payment_id TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(service_id) REFERENCES services(id)
);
`);

for (const stmt of [
  "ALTER TABLE bookings ADD COLUMN deposit_amount INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE bookings ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'unpaid'",
  "ALTER TABLE bookings ADD COLUMN payment_id TEXT DEFAULT ''"
]) { try { db.exec(stmt); } catch (_) {} }

const serviceCount = db.prepare("SELECT COUNT(*) AS n FROM services").get().n;
if (serviceCount === 0) {
  const insert = db.prepare(`
    INSERT INTO services (name, description, duration, price, image)
    VALUES (?, ?, ?, ?, ?)
  `);
  const services = [
    ["Limpieza Facial Básica", "Higiene facial, exfoliación suave según tu tipo de piel, extracción si es necesario, mascarilla y crema hidratante.", "60 min", "45", "/assets/limpieza-facial.jpg"],
    ["Facial Hidratante", "Tratamiento para piel deshidratada, con activos humectantes, mascarilla hidratante y crema final.", "60 min", "50", "/assets/facial-hidratante.jpg"],
    ["Facial Revitalizante", "Limpieza profunda, productos específicos para piel grasa, mascarilla purificante y extracciones si es necesario.", "60–75 min", "60", "/assets/facial-revitalizante.jpg"],
    ["Facial Piel Sensible", "Rutina suave, productos calmantes, hidratación intensa y mascarilla especial para piel sensible.", "60 min", "55", "/assets/facial-piel-sensible.jpg"],
    ["Facial Peeling", "Higiene, renovación celular, mejora de textura, manchas y líneas de expresión según evaluación.", "60 min", "80", "/assets/facial-peeling.jpg"],
    ["Microneedling", "Estimula la producción de colágeno, mejora la textura y ayuda a tratar cicatrices y líneas de expresión.", "60 min", "75", "/assets/microneedling.jpg"]
  ];
  const tx = db.transaction(() => services.forEach(s => insert.run(...s)));
  tx();
}

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/services", (req, res) => {
  res.json(db.prepare("SELECT * FROM services ORDER BY id").all());
});

app.get("/api/availability", (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: "Falta la fecha." });
  const rows = db.prepare(`
    SELECT time FROM bookings
    WHERE date = ? AND status IN ('pending','confirmed')
  `).all(date);
  res.json({ date, booked: rows.map(r => r.time) });
});

app.post("/api/bookings", (req, res) => {
  const { name, phone, serviceId, mode, date, time, notes } = req.body;
  if (!name || !phone || !serviceId || !mode || !date || !time) {
    return res.status(400).json({ error: "Completa todos los campos obligatorios." });
  }

  const exists = db.prepare(`
    SELECT id FROM bookings
    WHERE date = ? AND time = ? AND status IN ('pending','confirmed')
  `).get(date, time);

  if (exists) {
    return res.status(409).json({ error: "Ese horario ya fue reservado. Elige otro." });
  }

  const service = db.prepare("SELECT * FROM services WHERE id = ?").get(serviceId);
  if (!service) return res.status(400).json({ error: "Servicio no válido." });

  const deposit = Math.round(Number(service.price) * 0.5 * 100) / 100;
  const result = db.prepare(`
    INSERT INTO bookings (name, phone, service_id, mode, date, time, notes, deposit_amount)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, phone, serviceId, mode, date, time, notes || "", deposit);

  res.status(201).json({
    id: result.lastInsertRowid,
    message: "Solicitud de cita registrada.",
    servicePrice: Number(service.price),
    depositAmount: deposit,
    paymentReady: Boolean(CULQI_PUBLIC_KEY && CULQI_PRIVATE_KEY),
    whatsapp: "51930774397"
  });
});


app.get("/api/payment-config", (req, res) => {
  res.json({
    provider: "Culqi",
    publicKey: CULQI_PUBLIC_KEY,
    ready: Boolean(CULQI_PUBLIC_KEY && CULQI_PRIVATE_KEY),
    currency: "PEN"
  });
});

app.post("/api/payments/charge", async (req, res) => {
  const { bookingId, tokenId, email } = req.body;
  if (!bookingId || !tokenId || !email) return res.status(400).json({error:"Faltan datos del pago."});
  if (!CULQI_PRIVATE_KEY) return res.status(503).json({error:"La pasarela aún no está configurada."});

  const booking = db.prepare(`
    SELECT b.*, s.name AS service_name
    FROM bookings b JOIN services s ON s.id=b.service_id
    WHERE b.id=?
  `).get(bookingId);

  if (!booking) return res.status(404).json({error:"Reserva no encontrada."});
  if (booking.payment_status === "paid") return res.status(409).json({error:"Esta reserva ya está pagada."});

  const response = await fetch("https://api.culqi.com/v2/charges", {
    method:"POST",
    headers:{
      "Authorization":`Bearer ${CULQI_PRIVATE_KEY}`,
      "Content-Type":"application/json"
    },
    body:JSON.stringify({
      amount:Math.round(Number(booking.deposit_amount)*100),
      currency_code:"PEN",
      email,
      source_id:tokenId,
      description:`Separación 50% - ${booking.service_name} - Reserva #${bookingId}`
    })
  });

  const data = await response.json();
  if (!response.ok) {
    return res.status(400).json({error:data.user_message || data.merchant_message || "Pago rechazado."});
  }

  db.prepare("UPDATE bookings SET payment_status='paid', payment_id=? WHERE id=?")
    .run(data.id || "", bookingId);

  res.json({ok:true,paymentId:data.id});
});

function admin(req, res, next) {
  if (req.headers["x-admin-key"] !== ADMIN_KEY) {
    return res.status(401).json({ error: "No autorizado." });
  }
  next();
}

app.get("/api/admin/bookings", admin, (req, res) => {
  const rows = db.prepare(`
    SELECT b.*, s.name AS service_name, s.price
    FROM bookings b
    JOIN services s ON s.id = b.service_id
    ORDER BY b.date ASC, b.time ASC
  `).all();
  res.json(rows);
});

app.patch("/api/admin/bookings/:id", admin, (req, res) => {
  const allowed = ["pending", "confirmed", "cancelled", "completed"];
  if (!allowed.includes(req.body.status)) {
    return res.status(400).json({ error: "Estado no válido." });
  }
  db.prepare("UPDATE bookings SET status = ? WHERE id = ?").run(req.body.status, req.params.id);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Arijewel Studio Beauty: http://localhost:${PORT}`);
});
