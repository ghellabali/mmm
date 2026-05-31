import express, { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { SEED_USERS, SEED_BOXES, DEFAULT_SETTINGS } from "./src/data/catalog";
import { User, MasterBox, BoxTrackingLog, AutoclaveCycleRecord, ConsumableDelivery, GlobalSettings, MissingAlert, GmailLog } from "./src/types";

const PORT = 3000;
const DATA_FILE = path.join(process.cwd(), "app_tracker_data.json");

// Structure for persistent file storage
interface StoreData {
  users: User[];
  boxes: MasterBox[];
  tracking: BoxTrackingLog[];
  cycles: AutoclaveCycleRecord[];
  consumption: ConsumableDelivery[];
  alerts: MissingAlert[];
  settings: GlobalSettings;
  gmailLogs?: GmailLog[];
}

// Lazy loader and persistence manager
function loadData(): StoreData {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const contents = fs.readFileSync(DATA_FILE, "utf-8");
      const parsedData = JSON.parse(contents);
      // Double check all tables exist
      return {
        users: parsedData.users || SEED_USERS,
        boxes: parsedData.boxes || SEED_BOXES,
        tracking: parsedData.tracking || [],
        cycles: parsedData.cycles || [],
        consumption: parsedData.consumption || [],
        alerts: parsedData.alerts || [],
        settings: parsedData.settings || DEFAULT_SETTINGS,
        gmailLogs: parsedData.gmailLogs || []
      };
    }
  } catch (error) {
    console.error("Error reading persistence file, using defaults:", error);
  }

  // File doesn't exist or is corrupted, seed default data
  const initialData: StoreData = {
    users: SEED_USERS,
    boxes: SEED_BOXES,
    tracking: [],
    cycles: [],
    consumption: [],
    alerts: [],
    settings: DEFAULT_SETTINGS,
    gmailLogs: []
  };
  saveData(initialData);
  return initialData;
}

function saveData(data: StoreData) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing data file to disk:", err);
  }
}

function base64url(str: string | Buffer): string {
  const buffer = Buffer.isBuffer(str) ? str : Buffer.from(str, "utf-8");
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function buildRawEmail(to: string, subject: string, htmlContent: string): string {
  const parts = [
    `To: ${to}`,
    "Content-Type: text/html; charset=utf-8",
    "MIME-Version: 1.0",
    `Subject: =?utf-8?B?${Buffer.from(subject, "utf-8").toString("base64")}?=`,
    "",
    htmlContent
  ];
  return base64url(parts.join("\r\n"));
}

async function sendGmailAlert(subject: string, htmlContent: string): Promise<boolean> {
  const store = loadData();
  const settings = store.settings;
  if (!settings.gmailEnabled || !settings.gmailToken) {
    console.log("Gmail notification is disabled or token is not configured.");
    return false;
  }

  const recipient = settings.gmailRecipient || "ghellabali81500@gmail.com";
  const rawEmail = buildRawEmail(recipient, subject, htmlContent);

  try {
    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.gmailToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ raw: rawEmail })
    });

    const isOk = res.ok;
    const resText = await res.text();
    let resData: any = {};
    try {
      resData = JSON.parse(resText);
    } catch (_) {}

    // Add log
    const log: GmailLog = {
      id: "gml_" + Date.now() + "_" + Math.floor(Math.random() * 100),
      subject,
      recipient,
      date: new Date().toISOString(),
      status: isOk ? "success" : "error",
      error: isOk ? undefined : (resData.error?.message || `Status: ${res.status}. Body: ${resText.substring(0, 50)}`),
      bodyPreview: htmlContent.replace(/<[^>]*>/g, " ").substring(0, 100) + "..."
    };

    if (!store.gmailLogs) store.gmailLogs = [];
    store.gmailLogs.unshift(log);
    if (store.gmailLogs.length > 50) store.gmailLogs.pop();
    saveData(store);

    if (isOk) {
      console.log(`[GMAIL OK] Alert sent: "${subject}" to ${recipient}`);
    } else {
      console.error(`[GMAIL FAIL] Alert failed: "${subject}". Error:`, resData.error || resText);
    }
    return isOk;
  } catch (err: any) {
    console.error("[GMAIL SYSTEM ERROR] Failed to send email alert:", err);
    const log: GmailLog = {
      id: "gml_" + Date.now(),
      subject,
      recipient,
      date: new Date().toISOString(),
      status: "error",
      error: err.message || String(err),
      bodyPreview: htmlContent.replace(/<[^>]*>/g, " ").substring(0, 100) + "..."
    };
    if (!store.gmailLogs) store.gmailLogs = [];
    store.gmailLogs.unshift(log);
    saveData(store);
    return false;
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "20mb" })); // allow image payloads for box tracking

  // Serve static assets placeholder
  app.use("/assets", express.static(path.join(process.cwd(), "assets")));

  // API - AUTH: Login verification
  app.post("/api/auth/login", (req: Request, res: Response) => {
    const { login, pin } = req.body;
    const store = loadData();
    const user = store.users.find(u => u.login === login && u.pin === pin);
    
    if (!user) {
      return res.status(401).json({ error: "Identifiants ou code PIN incorrect." });
    }
    if (!user.active) {
      return res.status(403).json({ error: "Ce compte utilisateur a été désactivé." });
    }
    res.json(user);
  });

  // API - USERS: Retrieve and manage users
  app.get("/api/users", (req: Request, res: Response) => {
    const store = loadData();
    res.json(store.users);
  });

  app.post("/api/users", (req: Request, res: Response) => {
    const newUser = req.body as User;
    const store = loadData();
    if (!newUser.login || !newUser.pin || !newUser.role) {
      return res.status(400).json({ error: "Champs obligatoires manquants." });
    }
    
    if (store.users.some(u => u.login === newUser.login)) {
      return res.status(400).json({ error: "Ce login existe déjà." });
    }

    newUser.id = "u_" + Date.now();
    newUser.active = true;
    store.users.push(newUser);
    saveData(store);
    res.status(201).json(newUser);
  });

  app.put("/api/users/:id", (req: Request, res: Response) => {
    const { id } = req.params;
    const updated = req.body as Partial<User>;
    const store = loadData();
    const index = store.users.findIndex(u => u.id === id);
    if (index === -1) {
      return res.status(404).json({ error: "Utilisateur introuvable." });
    }

    store.users[index] = { ...store.users[index], ...updated };
    saveData(store);
    res.json(store.users[index]);
  });

  // API - MASTER BOXES: Design and details update
  app.get("/api/boxes", (req: Request, res: Response) => {
    const store = loadData();
    res.json(store.boxes);
  });

  app.post("/api/boxes", (req: Request, res: Response) => {
    const newBox = req.body as MasterBox;
    const store = loadData();
    if (!newBox.number || !newBox.name) {
      return res.status(400).json({ error: "Le numéro et le nom de boîte sont obligatoires." });
    }
    if (store.boxes.some(b => b.number.toUpperCase() === newBox.number.toUpperCase())) {
      return res.status(400).json({ error: "Une boîte avec ce numéro existe déjà." });
    }
    newBox.id = "box_" + Date.now();
    newBox.photo = newBox.photo || "default_box";
    newBox.instruments = newBox.instruments || [];
    store.boxes.push(newBox);
    saveData(store);
    res.status(201).json(newBox);
  });

  app.put("/api/boxes/:id", (req: Request, res: Response) => {
    const { id } = req.params;
    const updated = req.body as MasterBox;
    const store = loadData();
    const index = store.boxes.findIndex(b => b.id === id);
    if (index === -1) {
      return res.status(404).json({ error: "Boîte introuvable." });
    }
    store.boxes[index] = { ...store.boxes[index], ...updated };
    saveData(store);
    res.json(store.boxes[index]);
  });

  app.delete("/api/boxes/:id", (req: Request, res: Response) => {
    const { id } = req.params;
    const store = loadData();
    store.boxes = store.boxes.filter(b => b.id !== id);
    saveData(store);
    res.json({ success: true });
  });

  // API - PARAMETERS / SETTINGS: DROPDOWN OPTIONS
  app.get("/api/settings", (req: Request, res: Response) => {
    const store = loadData();
    res.json(store.settings);
  });

  app.put("/api/settings", (req: Request, res: Response) => {
    const updated = req.body as GlobalSettings;
    const store = loadData();
    store.settings = { ...store.settings, ...updated };
    saveData(store);
    res.json(store.settings);
  });

  // API - TRACKING: CORE ROTATION LIFECYCLE FOR BOXES
  app.get("/api/tracking", (req: Request, res: Response) => {
    const store = loadData();
    res.json(store.tracking);
  });

  // 1. Log Step Sale - Reception & pre-disinfectant completed
  app.post("/api/tracking/sale", (req: Request, res: Response) => {
    const { boxId, salle, heureReception, heureFinPredesinfectant, poidsConclue, scorePince, incident, commentaire, photoReelle, doneBy } = req.body;
    const store = loadData();
    const masterBox = store.boxes.find(b => b.id === boxId);
    if (!masterBox) {
      return res.status(404).json({ error: "Type de boîte d'origine introuvable." });
    }

    const newTracking: BoxTrackingLog = {
      id: "trk_" + Date.now(),
      boxId: masterBox.id,
      boxNumber: masterBox.number,
      boxName: masterBox.name,
      status: "sale",
      saleDetails: {
        salle,
        heureReception,
        heureFinPredesinfectant,
        poidsConclue: Number(poidsConclue),
        scorePince: Number(scorePince),
        incident,
        commentaire: commentaire || "",
        photoReelle,
        doneAt: new Date().toISOString(),
        doneBy
      },
      updates: [
        {
          status: "sale",
          time: new Date().toISOString(),
          user: doneBy,
          details: `Réceptionnée de la ${salle}. Heure de fin prédésinfection : ${heureFinPredesinfectant}. Contrôle de poids: ${poidsConclue}kg IP. Diagnostic: ${incident}`
        }
      ]
    };

    store.tracking.push(newTracking);
    saveData(store);
    res.status(201).json(newTracking);
  });

  // 2. Log Step Propre - Checkage matching items catalog
  app.post("/api/tracking/propre", (req: Request, res: Response) => {
    const { trackingId, checkedInstruments, conformite, tempsCheckageSeconds, doneBy } = req.body;
    const store = loadData();
    const trkIndex = store.tracking.findIndex(t => t.id === trackingId);
    if (trkIndex === -1) {
      return res.status(404).json({ error: "Fiche de traçabilité introuvable." });
    }

    let totalMissing = 0;
    let totalBroken = 0;
    let totalDirty = 0;

    // Build the inventory alerts and count indices
    checkedInstruments.forEach((ci: any) => {
      const delta = ci.expectedQuantity - ci.checkedQuantity;
      if (ci.status === "Manque" || delta > 0) {
        totalMissing += (delta > 0 ? delta : 1);
        store.alerts.push({
          id: "alert_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
          boxNumber: store.tracking[trkIndex].boxNumber,
          boxName: store.tracking[trkIndex].boxName,
          instrumentDesignation: ci.designation,
          reference: ci.reference,
          status: "Manque",
          reportedBy: doneBy,
          reportedAt: new Date().toISOString(),
          severity: "high",
          acknowledged: false
        });
      } else if (ci.status === "Cassé") {
        totalBroken++;
        store.alerts.push({
          id: "alert_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
          boxNumber: store.tracking[trkIndex].boxNumber,
          boxName: store.tracking[trkIndex].boxName,
          instrumentDesignation: ci.designation,
          reference: ci.reference,
          status: "Cassé",
          reportedBy: doneBy,
          reportedAt: new Date().toISOString(),
          severity: "high",
          acknowledged: false
        });
      } else if (ci.status === "Mal nettoyé") {
        totalDirty++;
        store.alerts.push({
          id: "alert_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
          boxNumber: store.tracking[trkIndex].boxNumber,
          boxName: store.tracking[trkIndex].boxName,
          instrumentDesignation: ci.designation,
          reference: ci.reference,
          status: "Mal nettoyé",
          reportedBy: doneBy,
          reportedAt: new Date().toISOString(),
          severity: "medium",
          acknowledged: false
        });
      }
    });

    store.tracking[trkIndex].status = "propre";
    store.tracking[trkIndex].propreDetails = {
      checkedInstruments,
      totalMissing,
      totalBroken,
      totalDirty,
      conformite,
      tempsCheckageSeconds: Number(tempsCheckageSeconds),
      doneAt: new Date().toISOString(),
      doneBy
    };

    store.tracking[trkIndex].updates.push({
      status: "propre",
      time: new Date().toISOString(),
      user: doneBy,
      details: `Vérification du contenu terminée. Conformité: ${conformite ? "OUI" : "NON"}. Manques: ${totalMissing}, Cassés: ${totalBroken}, Souillés: ${totalDirty}. Durée: ${tempsCheckageSeconds}s`
    });

    saveData(store);

    // If anomalies occur and settings.gmailAlertOnAnomaly is checked, trigger an alert!
    if (store.settings.gmailEnabled && store.settings.gmailAlertOnAnomaly && (totalMissing > 0 || totalBroken > 0 || totalDirty > 0)) {
      const anomaliesHTML = checkedInstruments
        .filter((ci: any) => ci.status !== "OK")
        .map((ci: any) => `
          <tr style="border-bottom: 1px solid #fee2e2;">
            <td style="padding: 10px; font-weight: bold; color: #1e293b;">${ci.designation}</td>
            <td style="padding: 10px; font-family: monospace; color: #475569;">${ci.reference}</td>
            <td style="padding: 10px;">
              <span style="padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: bold; background: ${
                ci.status === 'Manque' ? '#fef3c7; color: #d97706;' : ci.status === 'Cassé' ? '#fee2e2; color: #dc2626;' : '#f3f4f6; color: #4b5563;'
              }">
                ${ci.status}
              </span>
            </td>
            <td style="padding: 10px; font-weight: bold;">${ci.expectedQuantity - ci.checkedQuantity > 0 ? (ci.expectedQuantity - ci.checkedQuantity) : 1} élem.</td>
          </tr>
        `).join("");

      const emailSubject = `⚠️ Anomalie Traçabilité : Boîte ${store.tracking[trkIndex].boxNumber} (${store.tracking[trkIndex].boxName})`;
      const emailContent = `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <div style="background-color: #be123c; color: #ffffff; padding: 15px; border-radius: 8px 8px 0 0; text-align: center;">
            <h2 style="margin: 0; text-transform: uppercase; font-size: 18px; font-weight: bold;">⚠️ Clinique Alouia - Alerte Instrument</h2>
          </div>
          <div style="padding: 20px;">
            <p style="font-size: 14px; color: #334155;">Une non-conformité majeure a été signalée par <strong>${doneBy}</strong> lors de l'étape de contrôle (Zone Propre) :</p>
            
            <div style="background-color: #f8fafc; border-left: 4px solid #be123c; padding: 15px; margin: 15px 0; border-radius: 0 8px 8px 0;">
              <strong>Spécifications de la Boîte :</strong><br/>
              • N° Boîte : <strong style="color: #be123c;">${store.tracking[trkIndex].boxNumber}</strong><br/>
              • Nom Boîte : <strong>${store.tracking[trkIndex].boxName}</strong><br/>
              • Date Signalement : ${new Date().toLocaleString('fr-FR')}<br/>
            </div>

            <h3 style="color: #be123c; margin-top: 20px;">Détails des Anomalies Constatées :</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">
              <thead>
                <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
                  <th style="padding: 10px; color: #475569;">Instrument</th>
                  <th style="padding: 10px; color: #475569;">Référence</th>
                  <th style="padding: 10px; color: #475569;">Défaut</th>
                  <th style="padding: 10px; color: #475569;">Quantité</th>
                </tr>
              </thead>
              <tbody>
                ${anomaliesHTML}
              </tbody>
            </table>

            <div style="margin-top: 25px; padding-top: 15px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center;">
              Ce message a été généré automatiquement par le circuit de traçabilité de la Clinique Alouia.<br/>
              <strong>Veuillez planifier le remplacement d'inventaire dans les plus brefs délais.</strong>
            </div>
          </div>
        </div>
      `;

      sendGmailAlert(emailSubject, emailContent);
    }

    res.json(store.tracking[trkIndex]);
  });

  // 3. Log Step Sterile - Autoclave execution logging (is bound to direct cycles endpoints)
  app.post("/api/tracking/sterile", (req: Request, res: Response) => {
    const { trackingId, autoclaveNumber, cycleNumber, cycleType, heureChargement, heureDechargement, resultat, doneBy } = req.body;
    const store = loadData();
    const trkIndex = store.tracking.findIndex(t => t.id === trackingId);
    if (trkIndex === -1) {
      return res.status(404).json({ error: "Fiche de traçabilité introuvable pour la boîte." });
    }

    store.tracking[trkIndex].status = "sterile";
    store.tracking[trkIndex].sterileDetails = {
      autoclaveNumber,
      cycleNumber,
      cycleType,
      heureChargement,
      heureDechargement,
      resultat,
      doneAt: new Date().toISOString(),
      doneBy
    };

    store.tracking[trkIndex].updates.push({
      status: "sterile",
      time: new Date().toISOString(),
      user: doneBy,
      details: `Stérilisée dans autoclave ${autoclaveNumber}, cycle #${cycleNumber} (${cycleType}). Heure déchargement: ${heureDechargement}. Résultat validation: ${resultat}`
    });

    saveData(store);
    res.json(store.tracking[trkIndex]);
  });

  // 4. Log Step Deliver - Final disposal to operating services
  app.post("/api/tracking/deliver", (req: Request, res: Response) => {
    const { trackingId, serviceDestinataire, doneBy } = req.body;
    const store = loadData();
    const trkIndex = store.tracking.findIndex(t => t.id === trackingId);
    if (trkIndex === -1) {
      return res.status(404).json({ error: "Fiche de traçabilité introuvable." });
    }

    store.tracking[trkIndex].status = "livree";
    store.tracking[trkIndex].updates.push({
      status: "livree",
      time: new Date().toISOString(),
      user: doneBy,
      details: `Livrée et mise à disposition directe du service: ${serviceDestinataire}`
    });

    saveData(store);
    res.json(store.tracking[trkIndex]);
  });

  // API - ALERTS: Real-time warnings (lost/broken tools dashboard linked across cleaner accounts!)
  app.get("/api/alerts", (req: Request, res: Response) => {
    const store = loadData();
    res.json(store.alerts);
  });

  app.put("/api/alerts/:id/acknowledge", (req: Request, res: Response) => {
    const { id } = req.params;
    const store = loadData();
    const index = store.alerts.findIndex(a => a.id === id);
    if (index === -1) {
      return res.status(404).json({ error: "Alerte introuvable." });
    }
    store.alerts[index].acknowledged = true;
    saveData(store);
    res.json(store.alerts[index]);
  });

  app.delete("/api/alerts/clear", (req: Request, res: Response) => {
    const store = loadData();
    store.alerts = store.alerts.filter(a => !a.acknowledged);
    saveData(store);
    res.json({ success: true });
  });

  // API - CYCLES: Autoclave runs record register
  app.get("/api/cycles", (req: Request, res: Response) => {
    const store = loadData();
    res.json(store.cycles);
  });

  app.post("/api/cycles", (req: Request, res: Response) => {
    const { cycleNumber, autoclaveNumber, cycleType, heureChargement, heureDechargement, resultat, boxesSelected, diversProducts, doneBy } = req.body;
    const store = loadData();

    if (!cycleNumber || !autoclaveNumber || !cycleType || !heureChargement || !heureDechargement) {
      return res.status(400).json({ error: "Certains paramètres du cycle d'autoclave manquent." });
    }

    const boxesLoadedMapped: { trackingId: string; boxNumber: string; name: string }[] = [];

    // Cycle tracking updates
    boxesSelected.forEach((trackingId: string) => {
      const trkIndex = store.tracking.findIndex(t => t.id === trackingId);
      if (trkIndex !== -1) {
        store.tracking[trkIndex].status = "sterile";
        store.tracking[trkIndex].sterileDetails = {
          autoclaveNumber,
          cycleNumber,
          cycleType,
          heureChargement,
          heureDechargement,
          resultat,
          doneAt: new Date().toISOString(),
          doneBy
        };
        store.tracking[trkIndex].updates.push({
          status: "sterile",
          time: new Date().toISOString(),
          user: doneBy,
          details: `Stérilisée dans autoclave ${autoclaveNumber}, cycle ${cycleType} (Numéro: ${cycleNumber}). État: ${resultat}`
        });

        boxesLoadedMapped.push({
          trackingId: store.tracking[trkIndex].id,
          boxNumber: store.tracking[trkIndex].boxNumber,
          name: store.tracking[trkIndex].boxName
        });
      }
    });

    const newRecord: AutoclaveCycleRecord = {
      id: "cyc_" + Date.now(),
      cycleNumber,
      autoclaveNumber,
      cycleType,
      heureChargement,
      heureDechargement,
      resultat,
      boxesLoaded: boxesLoadedMapped,
      diversProducts: diversProducts || [],
      doneBy,
      createdAt: new Date().toISOString()
    };

    store.cycles.push(newRecord);
    saveData(store);

    // If settings have Gmail enabled and alert on cycle run is checked, notify!
    if (store.settings.gmailEnabled && store.settings.gmailAlertOnCycle) {
      const boxesNames = boxesLoadedMapped.map(b => `${b.boxNumber} (${b.name})`).join(", ") || "Aucune boîte (cycle à blanc/divers)";
      const isFailed = resultat === "Échoué";
      
      const emailSubject = `${isFailed ? '❌ Échec Cycle' : '✅ Cycle Validé'} Autoclave #${autoclaveNumber} (Cycle N° ${cycleNumber})`;
      const emailContent = `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <div style="background-color: ${isFailed ? '#dc2626' : '#059669'}; color: #ffffff; padding: 15px; border-radius: 8px 8px 0 0; text-align: center;">
            <h2 style="margin: 0; text-transform: uppercase; font-size: 18px; font-weight: bold;">
              ${isFailed ? '❌ Alerte Échec Cycle Autoclave' : '✅ Rapport de Cycle Autoclave Conforme'}
            </h2>
          </div>
          <div style="padding: 20px; font-size: 14px; line-height: 1.6; color: #334155;">
            <p>Le superviseur <strong>${doneBy}</strong> a enregistré un rapport de stérilisation :</p>
            
            <div style="background-color: #f8fafc; border-left: 4px solid ${isFailed ? '#dc2626' : '#059669'}; padding: 15px; margin: 15px 0; border-radius: 0 8px 8px 0;">
              <strong>Paramètres du Cycle :</strong><br/>
              • N° Autoclave : <strong>${autoclaveNumber}</strong><br/>
              • N° Cycle : <strong>${cycleNumber}</strong><br/>
              • Type de Programme : <strong>${cycleType}</strong><br/>
              • Chargement : <strong>${heureChargement}</strong> | Déchargement : <strong>${heureDechargement}</strong><br/>
              • Résultat : <strong style="color: ${isFailed ? '#dc2626' : '#059669'};">${resultat.toUpperCase()}</strong><br/>
            </div>

            <h3 style="color: #475569; margin-top: 20px;">Matériel Associé au Cycle :</h3>
            <p style="font-size: 13px; color: #1e293b; background: #f1f5f9; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0;">
              <strong>Boîtes stérilisées :</strong> ${boxesNames}
            </p>

            <div style="margin-top: 25px; padding-top: 15px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center;">
              Ce message de sécurité clinique a été généré automatiquement par la Clinique Alouia.<br/>
              <strong>Vérification obligatoire des paramètres physiques et de l'indicateur physico-chimique.</strong>
            </div>
          </div>
        </div>
      `;

      sendGmailAlert(emailSubject, emailContent);
    }

    res.status(201).json(newRecord);
  });

  // API - CONSUMPTION: Delivery of consumable products to various departments
  app.get("/api/consumption", (req: Request, res: Response) => {
    const store = loadData();
    res.json(store.consumption);
  });

  app.post("/api/consumption", (req: Request, res: Response) => {
    const { service, product, quantity, doneBy } = req.body;
    const store = loadData();
    if (!service || !product || !quantity || quantity <= 0) {
      return res.status(400).json({ error: "Saisie incomplète ou quantité invalide." });
    }

    const newDelivery: ConsumableDelivery = {
      id: "con_" + Date.now(),
      service,
      product,
      quantity: Number(quantity),
      date: new Date().toISOString(),
      doneBy
    };

    store.consumption.push(newDelivery);
    saveData(store);
    res.status(201).json(newDelivery);
  });

  // API - KPI: Retrieve dashboard indicators & graphs matrices
  app.get("/api/kpi", (req: Request, res: Response) => {
    const store = loadData();
    
    // Total boxes tracked
    const totalBoxesTracked = store.tracking.length;

    // Filters statuses
    const saleCount = store.tracking.filter(t => t.status === "sale").length;
    const propreCount = store.tracking.filter(t => t.status === "propre").length;
    const sterileCount = store.tracking.filter(t => t.status === "sterile").length;
    const deliveredCount = store.tracking.filter(t => t.status === "livree").length;

    // Incidents counted
    let totalIncidentsZoneSale = 0;
    let missingIncidentCount = 0;
    let brokenIncidentCount = 0;
    let dirtyIncidentCount = 0;

    store.tracking.forEach(t => {
      // Zone sale incidents
      if (t.saleDetails && t.saleDetails.incident !== "Rien") {
        totalIncidentsZoneSale++;
      }
      // Zone propre detail anomalies
      if (t.propreDetails) {
        missingIncidentCount += t.propreDetails.totalMissing;
        brokenIncidentCount += t.propreDetails.totalBroken;
        dirtyIncidentCount += t.propreDetails.totalDirty;
      }
    });

    // Washing mean duration
    let totalWashingTime = 0;
    let washedBoxesCount = 0;
    store.tracking.forEach(t => {
      if (t.saleDetails && t.saleDetails.heureReception && t.saleDetails.heureFinPredesinfectant) {
        try {
          // Parse hh:mm format
          const [h1, m1] = t.saleDetails.heureReception.split(":").map(Number);
          const [h2, m2] = t.saleDetails.heureFinPredesinfectant.split(":").map(Number);
          let diffMin = (h2 * 60 + m2) - (h1 * 60 + m1);
          if (diffMin < 0) diffMin += 24 * 60; // crossover midnight
          totalWashingTime += diffMin;
          washedBoxesCount++;
        } catch (e) {
          // ignore parsing error
        }
      }
    });
    const meanWashingMinutes = washedBoxesCount > 0 ? Math.round(totalWashingTime / washedBoxesCount) : 25;

    // Checkage mean durations
    let totalCheckSeconds = 0;
    let checkedCount = 0;
    store.tracking.forEach(t => {
      if (t.propreDetails && t.propreDetails.tempsCheckageSeconds) {
        totalCheckSeconds += t.propreDetails.tempsCheckageSeconds;
        checkedCount++;
      }
    });
    const meanCheckingSeconds = checkedCount > 0 ? Math.round(totalCheckSeconds / checkedCount) : 48;

    // Autoclave cycles overview
    const totalCycles = store.cycles.length;
    const successfulCycles = store.cycles.filter(c => c.resultat === "Réussi").length;
    const failedCycles = store.cycles.filter(c => c.resultat === "Échoué").length;

    // Consumption summaries by department
    const consumptionSummary: { [service: string]: { [product: string]: number } } = {};
    store.consumption.forEach(c => {
      if (!consumptionSummary[c.service]) {
        consumptionSummary[c.service] = {};
      }
      if (!consumptionSummary[c.service][c.product]) {
        consumptionSummary[c.service][c.product] = 0;
      }
      consumptionSummary[c.service][c.product] += c.quantity;
    });

    res.json({
      totalBoxesTracked,
      byStatus: { saleCount, propreCount, sterileCount, deliveredCount },
      anomalies: {
        zoneSaleIncidents: totalIncidentsZoneSale,
        zonePropreMissing: missingIncidentCount,
        zonePropreBroken: brokenIncidentCount,
        zonePropreDirty: dirtyIncidentCount
      },
      durations: {
        meanWashingMinutes,
        meanCheckingSeconds
      },
      autoclave: {
        totalCycles,
        successfulCycles,
        failedCycles
      },
      consumptionSummary
    });
  });

  // API - GMAIL: Retrieve logs
  app.get("/api/gmail/logs", (req: Request, res: Response) => {
    const store = loadData();
    res.json(store.gmailLogs || []);
  });

  // API - GMAIL: Save OAuth / temporary token
  app.post("/api/gmail/save-token", (req: Request, res: Response) => {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: "Token manquant" });
    }
    const store = loadData();
    store.settings.gmailToken = token;
    store.settings.gmailEnabled = true;
    saveData(store);
    res.json({ success: true, settings: store.settings });
  });

  // API - GMAIL: Test message sending
  app.post("/api/gmail/test-send", async (req: Request, res: Response) => {
    const store = loadData();
    const recipient = store.settings.gmailRecipient || "ghellabali81500@gmail.com";
    
    const subject = "🧪 Test d'Intégration Gmail - Clinique Alouia";
    const body = `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #cbd5e1; border-radius: 12px; background: #ffffff;">
        <div style="background-color: #4f46e5; color: #ffffff; padding: 15px; border-radius: 8px 8px 0 0; text-align: center;">
          <h2 style="margin: 0; font-size: 18px; font-weight: bold; text-transform: uppercase;">🧪 Test de Connexion Gmail Validé</h2>
        </div>
        <div style="padding: 20px; color: #334155; line-height: 1.6; font-size: 14px;">
          <p>Bonjour,</p>
          <p>Le système de traçabilité des dispositifs médicaux de la <strong>Clinique Alouia</strong> est désormais correctement configuré pour envoyer des alertes en temps réel via l'API Gmail.</p>
          
          <div style="background: #f8fafc; padding: 15px; border-radius: 6px; border: 1px solid #e2e8f0; margin: 15px 0;">
            • <strong>Statut :</strong> Connexion Active<br/>
            • <strong>Date de test :</strong> ${new Date().toLocaleString("fr-FR")}<br/>
            • <strong>Service :</strong> SMTP-Proxy Gmail API v1
          </div>
          
          <p>Les rapports d'anomalies (instruments cassés/manquants) et de cycles d'autoclave vous seront notifiés à cette adresse.</p>

          <div style="margin-top: 25px; padding-top: 15px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center;">
            Ce message est un message à caractère technique pour la plateforme de stérilisation de la Clinique Alouia.
          </div>
        </div>
      </div>
    `;

    const ok = await sendGmailAlert(subject, body);
    if (ok) {
      res.json({ success: true, message: `Email de test envoyé avec succès à ${recipient} !` });
    } else {
      res.status(500).json({ error: "Échec de l'envoi de l'email. Vérifiez que votre jeton Gmail (Access Token) est valide." });
    }
  });

  // OAuth Redirect Page Popup callback handler
  app.get(["/auth/callback", "/auth/callback/"], (req: Request, res: Response) => {
    res.send(`
      <html>
        <head>
          <title>Authentification Clinique</title>
        </head>
        <body style="font-family: sans-serif; text-align: center; padding: 50px; background: #f8fafc; color: #334155;">
          <h2 style="color: #4f46e5;">Authentification en cours...</h2>
          <p>Connexion sécurisée avec les serveurs de la Clinique Alouia et Google.</p>
          <script>
            const hash = window.location.hash;
            const urlParams = new URLSearchParams(window.location.search);
            const code = urlParams.get('code');
            
            let tokenPayload = null;
            if (hash) {
              const hashParams = new URLSearchParams(hash.substring(1));
              const accessToken = hashParams.get('access_token');
              if (accessToken) {
                tokenPayload = { type: 'OAUTH_AUTH_SUCCESS', token: accessToken, flow: 'implicit' };
              }
            } else if (code) {
              tokenPayload = { type: 'OAUTH_AUTH_SUCCESS', code: code, flow: 'code' };
            }
            
            if (tokenPayload) {
              if (window.opener) {
                window.opener.postMessage(tokenPayload, '*');
                window.close();
              } else {
                document.body.innerHTML = '<h2 style="color: #10b981;">Connexion établie !</h2><p>Vous pouvez fermer cet onglet.</p>';
              }
            } else {
              document.body.innerHTML = '<h2 style="color: #ef4444;">Erreur</h2><p>Impossible de récupérer l\\'autorisation Google. Veuillez réessayer.</p>';
            }
          </script>
        </body>
      </html>
    `);
  });

  // API - RESET: Utility to refresh database back to pristine initial state
  app.post("/api/reset-data", (req: Request, res: Response) => {
    const freshData: StoreData = {
      users: SEED_USERS,
      boxes: SEED_BOXES,
      tracking: [],
      cycles: [],
      consumption: [],
      alerts: [],
      settings: DEFAULT_SETTINGS
    };
    saveData(freshData);
    res.json({ success: true, message: "Les données d'usine ont été restaurées." });
  });

  // VITE DEV SERVER OR HIGH PERFORMANCE PRODUCTION SERVING MIDDLEWARE
  if (process.env.NODE_ENV !== "production") {
    console.log("Vite loading in development server mode...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Serving static files in high performance production mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Clinic Sterilization Tracker Server is running on port ${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Critical error while booting system backend server:", error);
});
