const admin = require('firebase-admin');

// Endpoint de SOLO LECTURA para el informe semanal de Vibe.
// Seguridad: requiere ?token=REPORTE_TOKEN (variable de entorno en Vercel)
// y usa la cuenta de servicio "vibe-reporte" (solo lectura, rol Viewer).
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const token = (req.query && req.query.token) || '';
  if (!process.env.REPORTE_TOKEN || token !== process.env.REPORTE_TOKEN) {
    return res.status(401).json({ error: 'Token inválido' });
  }

  try {
    if (!admin.apps.length) {
      const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
      if (sa) {
        admin.initializeApp({ credential: admin.credential.cert(JSON.parse(sa)) });
      } else {
        admin.initializeApp();
      }
    }
    const db = admin.firestore();
    const leer = async (col) => {
      const snap = await db.collection(col).get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    };
    // Timestamps de Firestore a ISO para que sean JSON-serializables
    const serializar = (arr) => arr.map(x => {
      const o = Object.assign({}, x);
      for (const k of Object.keys(o)) {
        const v = o[k];
        if (v && typeof v.toDate === 'function') o[k] = v.toDate().toISOString();
      }
      return o;
    });

    const [ventas, productos, solicitudes, newsletter, admins] = await Promise.all([
      leer('ventas'), leer('productos'), leer('solicitudes'), leer('newsletter'), leer('admins')
    ]);

    return res.status(200).json({
      generado: new Date().toISOString(),
      tienda: 'NEO TERM COLOMBIA',
      ventas: serializar(ventas),
      productos: serializar(productos),
      solicitudes: serializar(solicitudes),
      newsletter: serializar(newsletter),
      administradores: serializar(admins)
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};