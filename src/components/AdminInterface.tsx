import React, { useState, useEffect } from "react";
import { User, MasterBox, BoxTrackingLog, AutoclaveCycleRecord, ConsumableDelivery, GlobalSettings, MissingAlert, MasterInstrument } from "../types";
import { Settings, Users, BookOpen, AlertCircle, FileSpreadsheet, RefreshCw, BarChart4, Plus, Trash2, Check, Download, Layers, Activity, ShieldAlert, Mail, Send, ToggleLeft, ToggleRight, Sparkles, AlertTriangle, ShieldCheck, CheckCircle, Info, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import SaleInterface from "./SaleInterface";
import PropreInterface from "./PropreInterface";
import SterileInterface from "./SterileInterface";

interface AdminInterfaceProps {
  currentUser: User;
  users: User[];
  boxes: MasterBox[];
  trackingLogs: BoxTrackingLog[];
  cycles: AutoclaveCycleRecord[];
  consumption: ConsumableDelivery[];
  alerts: MissingAlert[];
  globalSettings: GlobalSettings;
  onAddUser: (user: any) => Promise<void>;
  onUpdateUser: (id: string, updated: any) => Promise<void>;
  onAddBox: (box: any) => Promise<void>;
  onUpdateBox: (id: string, updated: any) => Promise<void>;
  onDeleteBox: (id: string) => Promise<void>;
  onUpdateSettings: (settings: GlobalSettings) => Promise<void>;
  onAcknowledgeAlert: (id: string) => Promise<void>;
  onResetFactoryData: () => Promise<void>;
  // Administrative control callbacks for the other stations
  onAddTracking: (trackingData: any) => Promise<void>;
  onUpdatePropreTracking: (payload: any) => Promise<void>;
  onAddCycle: (payload: any) => Promise<void>;
  onAddConsumption: (payload: any) => Promise<void>;
  onDeliverBox: (trackingId: string, serviceDestinataire: string) => Promise<void>;
}

export default function AdminInterface({
  currentUser,
  users,
  boxes,
  trackingLogs,
  cycles,
  consumption,
  alerts,
  globalSettings,
  onAddUser,
  onUpdateUser,
  onAddBox,
  onUpdateBox,
  onDeleteBox,
  onUpdateSettings,
  onAcknowledgeAlert,
  onResetFactoryData,
  onAddTracking,
  onUpdatePropreTracking,
  onAddCycle,
  onAddConsumption,
  onDeliverBox
}: AdminInterfaceProps) {
  const [activeTab, setActiveTab] = useState<
    "kpi" | "users" | "catalog" | "parameters" | "history" | "gmail" | "perspective_sale" | "perspective_propre" | "perspective_sterile"
  >("kpi");

  // Gmail states
  const [gmailLogs, setGmailLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  const [gEnabled, setGEnabled] = useState(globalSettings.gmailEnabled || false);
  const [gRecipient, setGRecipient] = useState(globalSettings.gmailRecipient || "ghellabali81500@gmail.com");
  const [gClientId, setGClientId] = useState(globalSettings.gmailClientId || "");
  const [gClientSecret, setGClientSecret] = useState(globalSettings.gmailClientSecret || "");
  const [gToken, setGToken] = useState(globalSettings.gmailToken || "");
  const [gAlertOnAnomaly, setGAlertOnAnomaly] = useState(globalSettings.gmailAlertOnAnomaly !== false);
  const [gAlertOnCycle, setGAlertOnCycle] = useState(globalSettings.gmailAlertOnCycle !== false);
  const [gAlertOnDelivery, setGAlertOnDelivery] = useState(globalSettings.gmailAlertOnDelivery || false);

  // Sync parameters with globalSettings changes
  useEffect(() => {
    setGEnabled(globalSettings.gmailEnabled || false);
    setGRecipient(globalSettings.gmailRecipient || "ghellabali81500@gmail.com");
    setGClientId(globalSettings.gmailClientId || "");
    setGClientSecret(globalSettings.gmailClientSecret || "");
    setGToken(globalSettings.gmailToken || "");
    setGAlertOnAnomaly(globalSettings.gmailAlertOnAnomaly !== false);
    setGAlertOnCycle(globalSettings.gmailAlertOnCycle !== false);
    setGAlertOnDelivery(globalSettings.gmailAlertOnDelivery || false);
  }, [globalSettings]);

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch("/api/gmail/logs");
      if (res.ok) {
        const data = await res.json();
        setGmailLogs(data);
      }
    } catch (err) {
      console.error("Fetch logs failed:", err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (activeTab === "gmail") {
      fetchLogs();
    }
  }, [activeTab]);

  useEffect(() => {
    const handleOAuthMessage = async (event: MessageEvent) => {
      if (event.data?.type === "OAUTH_AUTH_SUCCESS") {
        const receivedToken = event.data?.token;
        if (receivedToken) {
          setGToken(receivedToken);
          setGEnabled(true);
          try {
            await fetch("/api/gmail/save-token", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token: receivedToken })
            });
            await onUpdateSettings({
              ...globalSettings,
              gmailToken: receivedToken,
              gmailEnabled: true
            });
            alert("🎉 Connexion Gmail réussie ! Votre compte est associé.");
            fetchLogs();
          } catch (err) {
            console.error("Save token error:", err);
          }
        }
      }
    };
    window.addEventListener("message", handleOAuthMessage);
    return () => window.removeEventListener("message", handleOAuthMessage);
  }, [globalSettings, onUpdateSettings]);

  // User forms inputs
  const [newUserLogin, setNewUserLogin] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserPin, setNewUserPin] = useState("");
  const [newUserRole, setNewUserRole] = useState<"sale" | "propre" | "sterile" | "admin">("sale");

  // Box catalog forms inputs
  const [newBoxNumber, setNewBoxNumber] = useState("");
  const [newBoxName, setNewBoxName] = useState("");
  const [newBoxWeight, setNewBoxWeight] = useState("");
  const [boxInstrumentsStr, setBoxInstrumentsStr] = useState("KCH-01, Kelly fine, 4\nPM-02, Porte-aiguille, 2");

  // Custom parameters lists states
  const [tempCycleTypes, setTempCycleTypes] = useState(globalSettings.cycleTypes.join("\n"));
  const [tempServices, setTempServices] = useState(globalSettings.services.join("\n"));
  const [tempProducts, setTempProducts] = useState(globalSettings.diversProducts.join("\n"));

  // Printing selected box history representation
  const [selectedPrintBoxId, setSelectedPrintBoxId] = useState("");

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserLogin || !newUserPin || !newUserName) {
      alert("Saisir toutes les informations.");
      return;
    }
    try {
      await onAddUser({
        login: newUserLogin,
        name: newUserName,
        pin: newUserPin,
        role: newUserRole
      });
      setNewUserLogin("");
      setNewUserName("");
      setNewUserPin("");
      alert("✅ Nouvel utilisateur de clinique enregistré !");
    } catch (err: any) {
      alert("Erreur utilisateur: " + err.message);
    }
  };

  const handleToggleUserActive = async (user: User) => {
    try {
      await onUpdateUser(user.id, { active: !user.active });
    } catch (e: any) {
      alert("Erreur de modification utilisateur : " + e.message);
    }
  };

  const handleCreateBox = async (e: React.FormEvent) => {
    e.preventDefault();
    const weightNum = parseFloat(newBoxWeight);
    if (!newBoxNumber || !newBoxName || isNaN(weightNum)) {
      alert("Veuillez saisir un numéro, nom de boîte et poids de référence corrects.");
      return;
    }

    // Parse instruments from textarea text
    const parsedInstruments: MasterInstrument[] = [];
    const lines = boxInstrumentsStr.split("\n");
    lines.forEach((line) => {
      const parts = line.split(",");
      if (parts.length >= 3) {
        parsedInstruments.push({
          reference: parts[0].trim(),
          designation: parts[1].trim(),
          quantity: parseInt(parts[2].trim()) || 1
        });
      }
    });

    try {
      await onAddBox({
        number: newBoxNumber,
        name: newBoxName,
        weight: weightNum,
        photo: "custom_box",
        instruments: parsedInstruments
      });
      setNewBoxNumber("");
      setNewBoxName("");
      setNewBoxWeight("");
      setBoxInstrumentsStr("KCH-01, Kelly fine, 4\nPM-02, Porte-aiguille, 2");
      alert("✅ Boîte d'instruments et fiche inventaire ajoutées avec succès !");
    } catch (err: any) {
      alert("Erreur boîte: " + err.message);
    }
  };

  const handleSaveSettings = async () => {
    try {
      await onUpdateSettings({
        cycleTypes: tempCycleTypes.split("\n").map(l => l.trim()).filter(Boolean),
        services: tempServices.split("\n").map(l => l.trim()).filter(Boolean),
        diversProducts: tempProducts.split("\n").map(l => l.trim()).filter(Boolean)
      });
      alert("✅ Paramétrages globaux mis à jour !");
    } catch (err: any) {
      alert("Erreur de modification settings : " + err.message);
    }
  };

  // KPI Calculations
  const totalBoxesProcessed = trackingLogs.length;
  const washCompleted = trackingLogs.filter(t => t.saleDetails).length;
  const qcCompleted = trackingLogs.filter(t => t.status !== "sale" && t.propreDetails).length;
  const totalCyclesRun = cycles.length;
  const cycleFailures = cycles.filter(c => c.resultat === "Échoué").length;
  const cycleSuccessRate = totalCyclesRun > 0 ? Math.round(((totalCyclesRun - cycleFailures) / totalCyclesRun) * 100) : 100;

  // Compile statistics for charts rendering
  // 1. Incidents counted by Operating Room
  const incidentByRoomDetails: { [salle: string]: number } = {};
  trackingLogs.forEach((log) => {
    if (log.saleDetails && log.saleDetails.incident !== "Rien") {
      const room = log.saleDetails.salle;
      incidentByRoomDetails[room] = (incidentByRoomDetails[room] || 0) + 1;
    }
  });
  const roomIncidentsChartData = Object.keys(incidentByRoomDetails).map((room) => ({
    name: room,
    "Incidents constatés": incidentByRoomDetails[room]
  }));

  // 2. Consumption chart compiled formatting
  const rawServiceProductSummary: { [service: string]: number } = {};
  consumption.forEach((c) => {
    rawServiceProductSummary[c.service] = (rawServiceProductSummary[c.service] || 0) + c.quantity;
  });
  const consumptionChartData = Object.keys(rawServiceProductSummary).map((serv) => ({
    name: serv,
    "Consommables transférés": rawServiceProductSummary[serv]
  }));

  // 3. Status proportions chart
  const statusCounts = {
    "Zone Sale (Prédésinfection)": trackingLogs.filter(t => t.status === "sale").length,
    "Zone Propre (Checkage)": trackingLogs.filter(t => t.status === "propre").length,
    "Zone Stérile (Autoclave)": trackingLogs.filter(t => t.status === "sterile").length,
    "Livrée au Bloc": trackingLogs.filter(t => t.status === "livree").length
  };
  const pieChartData = Object.keys(statusCounts).map((k) => ({
    name: k,
    value: (statusCounts as any)[k]
  })).filter(x => x.value > 0);

  const PIE_COLORS = ["#f87171", "#6366f1", "#06b6d4", "#10b981"];

  // Custom visual template to print beautiful PDF summary for clinic audit
  const handlePrintReport = (log: BoxTrackingLog) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const timelineHTML = log.updates.map(u => `
      <div style="margin-bottom: 12px; border-left: 3px solid #6366f1; padding-left: 12px;">
        <span style="font-weight: bold; color: #1e293b; font-size: 13px;">[${u.status.toUpperCase()}] — ${new Date(u.time).toLocaleTimeString()}</span>
        <div style="font-size: 12px; color: #475569; margin-top: 2px;">${u.details}</div>
        <div style="font-size: 11px; color: #94a3b8; font-style: italic;">Opérateur: ${u.user}</div>
      </div>
    `).join("");

    const checklistHTML = log.propreDetails?.checkedInstruments.map(i => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 12px;">${i.reference}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 12px; font-weight: bold;">${i.designation}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 12px; text-align: center;">${i.expectedQuantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 12px; text-align: center;">${i.checkedQuantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 12px; font-weight: bold; text-align: right; color: ${i.status === "OK" ? "#10b981" : "#ef4444"};">${i.status}</td>
      </tr>
    `).join("") || `<tr><td colspan="5" style="padding: 12px; text-align: center; color: #94a3b8; font-size: 12px;">Aucun checkage d'inventaire effectué en Zone Propre à ce stade.</td></tr>`;

    printWindow.document.write(`
      <html>
        <head>
          <title>Rapport de Traçabilité - Boîte ${log.boxNumber}</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #1e293b; background: #fff; line-height: 1.5; }
            .header { border-bottom: 3px double #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
            .badge { padding: 4px 8px; background: #6366f1; color: #fff; font-weight: bold; border-radius: 4px; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th { background: #f8fafc; padding: 10px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; border-bottom: 2px solid #cbd5e1; }
            .footer { margin-top: 50px; border-top: 1px solid #e2e8f0; padding-top: 20px; display: flex; justify-content: space-between; font-size: 11px; color: #94a3b8; }
            .stamp { border: 2px solid #ef4444; color: #ef4444; padding: 10px; font-size: 14px; text-transform: uppercase; font-weight: bold; display: inline-block; transform: rotate(-5deg); margin-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #0f172a;">CLINIQUE ALOUIA</h1>
              <span style="font-size: 12px; color: #64748b;">SERVICE DE STÉRILISATION ET BLOC OPÉRATOIRE</span>
            </div>
            <div style="text-align: right;">
              <span class="badge font-mono">FICHE UNIQUE DE TRAÇABILITÉ</span>
              <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Edité le: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</div>
            </div>
          </div>

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px; margin-bottom: 30px; display: flex; justify-content: space-between;">
            <div>
              <h3 style="margin: 0 0 8px 0; color: #0f172a; font-size: 14px; text-transform: uppercase;">1. Identification de la Boîte</h3>
              <p style="margin: 4px 0; font-size: 13px;"><b>Numéro de Boîte :</b> ${log.boxNumber}</p>
              <p style="margin: 4px 0; font-size: 13px;"><b>Désignation :</b> ${log.boxName}</p>
              <p style="margin: 4px 0; font-size: 13px;"><b>Salle op. expédition :</b> ${log.saleDetails?.salle || "N/A"}</p>
            </div>
            <div>
              <h3 style="margin: 0 0 8px 0; color: #0f172a; font-size: 14px; text-transform: uppercase;">2. Statut Clinique Actuel</h3>
              <span style="font-size: 14px; font-weight: bold; color: #4f46e5; text-transform: uppercase;">${log.status === "livree" ? "✅ LIVRÉE ET DISPOSÉE AU BLOC" : log.status.toUpperCase()}</span>
              <div>
                <span class="stamp">CONFORME STERILE</span>
              </div>
            </div>
          </div>

          <h3 style="margin-top: 30px; color: #0f172a; font-size: 14px; border-bottom: 2px solid #f1f5f9; padding-bottom: 6px;">3. Log de Validation Inventaire (Zone Propre)</h3>
          <table>
            <thead>
              <tr>
                <th>Référence</th>
                <th>Désignation Instrument</th>
                <th style="text-align: center;">Requis</th>
                <th style="text-align: center;">Inspecté</th>
                <th style="text-align: right;">Statut Individuel</th>
              </tr>
            </thead>
            <tbody>
              ${checklistHTML}
            </tbody>
          </table>

          <h3 style="margin-top: 35px; color: #0f172a; font-size: 14px; border-bottom: 2px solid #f1f5f9; padding-bottom: 6px;">4. Historique Chronologique de Rotation</h3>
          <div style="margin-top: 15px;">
            ${timelineHTML}
          </div>

          <div class="footer">
            <div>
              <p style="margin: 0;"><b>Visa du Chef de Bloc Opératoire :</b></p>
              <div style="margin-top: 40px; width: 180px; border-bottom: 1px solid #111;"></div>
            </div>
            <div style="text-align: right;">
              <p style="margin: 0;"><b>Visa de l'Opérateur Stérilité :</b></p>
              <div style="margin-top: 40px; margin-left: auto; width: 180px; border-bottom: 1px solid #111;"></div>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div id="admin-root" className="space-y-6">
      
      {/* Top action header for Admin tab switches */}
      <div className="flex flex-wrap items-center gap-2 bg-indigo-50/40 p-1.5 rounded-2xl border border-indigo-100">
        <button
          onClick={() => setActiveTab("kpi")}
          id="tab-kpi"
          className={`px-4 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === "kpi"
              ? "bg-white text-indigo-700 shadow-md"
              : "text-slate-600 hover:text-slate-800"
          }`}
        >
          <BarChart4 className="w-4 h-4" />
          Tableau de Bord & KPIs
        </button>

        <button
          onClick={() => setActiveTab("users")}
          id="tab-users"
          className={`px-4 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === "users"
              ? "bg-white text-indigo-700 shadow-md"
              : "text-slate-600 hover:text-slate-800"
          }`}
        >
          <Users className="w-4 h-4" />
          Ressources Humaines ({users.length})
        </button>

        <button
          onClick={() => setActiveTab("catalog")}
          id="tab-catalog"
          className={`px-4 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === "catalog"
              ? "bg-white text-indigo-700 shadow-md"
              : "text-slate-600 hover:text-slate-800"
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Modifier Inventaires ({boxes.length})
        </button>

        <button
          onClick={() => setActiveTab("parameters")}
          id="tab-parameters"
          className={`px-4 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === "parameters"
              ? "bg-white text-indigo-700 shadow-md"
              : "text-slate-600 hover:text-slate-800"
          }`}
        >
          <Settings className="w-4 h-4" />
          Cycles & Services Cliniques
        </button>

        <button
          onClick={() => setActiveTab("gmail")}
          id="tab-gmail"
          className={`px-4 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === "gmail"
              ? "bg-white text-rose-700 shadow-md"
              : "text-slate-600 hover:text-slate-800"
          }`}
        >
          <Mail className="w-4 h-4 text-rose-500" />
          Messagerie/Gmail Config
        </button>

        <button
          onClick={() => setActiveTab("history")}
          id="tab-history"
          className={`px-4 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === "history"
              ? "bg-white text-indigo-700 shadow-md"
              : "text-slate-600 hover:text-slate-800"
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Traçabilité Hospitalière ({trackingLogs.length})
        </button>

        {/* Separator to highlight operator perspectives */}
        <div className="h-6 w-px bg-indigo-200 hidden md:block" />

        <button
          onClick={() => setActiveTab("perspective_sale")}
          id="tab-perspective-sale"
          className={`px-4 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === "perspective_sale"
              ? "bg-rose-600 text-white shadow-md font-black"
              : "text-rose-600 hover:text-rose-700 bg-rose-50/50 hover:bg-rose-100/50"
          }`}
        >
          <Activity className="w-4 h-4" />
          Poste Zone Sale
        </button>

        <button
          onClick={() => setActiveTab("perspective_propre")}
          id="tab-perspective-propre"
          className={`px-4 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === "perspective_propre"
              ? "bg-indigo-600 text-white shadow-md font-black"
              : "text-indigo-600 hover:text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100/50"
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          Poste Zone Propre
        </button>

        <button
          onClick={() => setActiveTab("perspective_sterile")}
          id="tab-perspective-sterile"
          className={`px-4 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === "perspective_sterile"
              ? "bg-cyan-600 text-white shadow-md font-black"
              : "text-cyan-600 hover:text-cyan-700 bg-cyan-50/50 hover:bg-cyan-100/50"
          }`}
        >
          <Layers className="w-4 h-4" />
          Poste Zone Stérile
        </button>
      </div>

      {activeTab === "kpi" && (
        <div className="space-y-6" id="tab-kpi-content">
          {/* Main KPI counter numbers */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
              <span className="text-[10px] uppercase font-black text-rose-500 block">Désinfectés (Sale)</span>
              <span className="text-3xl font-black text-slate-800 mt-2 block">{washCompleted} Boîtes</span>
              <span className="text-[10px] text-slate-400 block mt-1">Moyenne: {trackingLogs.some(t => t.saleDetails) ? "15-20 min" : "N/A"}</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
              <span className="text-[10px] uppercase font-black text-indigo-500 block">Vérifiées (Propre)</span>
              <span className="text-3xl font-black text-slate-800 mt-2 block">{qcCompleted} Contrôles</span>
              <span className="text-[10px] text-slate-400 block mt-1">Instrumental et conformité</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
              <span className="text-[10px] uppercase font-black text-emerald-500 block">Stérilisées (Stérile)</span>
              <span className="text-3xl font-black text-emerald-700 mt-2 block">{totalCyclesRun} Cycles run</span>
              <span className="text-[10px] text-slate-400 block mt-1">Conformité de cycle : {cycleSuccessRate}%</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-xs hover:border-indigo-200 transition-colors">
              <span className="text-[10px] uppercase font-black text-purple-500 block">Anomalies Déclenchées</span>
              <span className="text-3xl font-black text-rose-600 mt-2 block">{alerts.length} Warnings</span>
              <span className="text-[10px] text-slate-400 block mt-1">Pertes / cassures signalées</span>
            </div>
          </div>

          {/* Graphics layout representation */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Pie Chart of Statuses */}
            <div className="lg:col-span-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-xs">
              <h3 className="font-bold text-slate-800 text-sm mb-4">Proportion par Zone de Traçabilité</h3>
              <div className="h-[200px]" id="piechart-container">
                {pieChartData.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-xs text-slate-400 font-sans italic">
                    Aucune boîte active enregistrée.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4">
                {pieChartData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-1.5 text-[10px] font-medium text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}></span>
                    <span className="truncate">{entry.name} ({entry.value})</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bar charts for room incidents */}
            <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-sm mb-1">Nombre d'Incidents Historiques par Salle Opératoire</h3>
                <p className="text-[11px] text-slate-400 mb-4">Totalise les pinces perdues, cassures et instruments sales détectés lors de la réception.</p>
              </div>
              <div className="h-[200px]" id="barchart-container">
                {roomIncidentsChartData.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-xs text-slate-400 font-sans italic">
                    Aucun incident déclaré dans les blocs opératoires.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={roomIncidentsChartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" fontSize={10} tickLine={false} />
                      <YAxis fontSize={10} tickLine={false} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="Incidents constatés" fill="#f87171" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 text-sm">Volume Global de Distribution des Consommables par Service</h3>
              <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-md">Consommations du mois</span>
            </div>
            <div className="h-[220px]" id="linechart-container">
              {consumptionChartData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-xs text-slate-400 font-sans italic">
                  Aucun consommable n'a été transféré aux services cliniques.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={consumptionChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" fontSize={10} tickLine={false} />
                    <YAxis fontSize={10} tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="Consommables transférés" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Critical Warnings / Active System Alerts sync */}
          <div className="bg-amber-50 rounded-2xl p-6 border border-amber-200" id="alerts-terminal">
            <h3 className="font-bold text-amber-900 text-base flex items-center gap-2 mb-4">
              <AlertCircle className="w-5 h-5 text-amber-600 animate-bounce" />
              <span>Tableau Hospitalier Inter-Comptes des Anomalies ({alerts.filter(a => !a.acknowledged).length} en cours)</span>
            </h3>

            {alerts.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-xs font-semibold">
                🟢 Aucun manque, défection d'instrument, ou cassure n'est actuellement en souffrance.
              </div>
            ) : (
              <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                {alerts.map((al) => (
                  <div
                    key={al.id}
                    className={`p-3.5 rounded-xl border flex items-center justify-between gap-4 bg-white ${
                      al.acknowledged ? "opacity-55 border-slate-200" : "border-rose-200 shadow-xs"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-md uppercase">
                          {al.status}
                        </span>
                        <strong className="text-slate-800 text-sm">Boîte {al.boxNumber} ({al.boxName})</strong>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">
                        Instrument: <strong className="text-slate-900">{al.instrumentDesignation}</strong> ({al.reference}) — signalé par {al.reportedBy}
                      </p>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Reporté le: {new Date(al.reportedAt).toLocaleDateString()} à {new Date(al.reportedAt).toLocaleTimeString()}</span>
                    </div>

                    {!al.acknowledged ? (
                      <button
                        type="button"
                        id={`ack-alert-btn-${al.id}`}
                        onClick={() => onAcknowledgeAlert(al.id)}
                        className="px-3.5 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Acquitter l'Alerte
                      </button>
                    ) : (
                      <span className="text-xs text-slate-450 font-bold italic shrink-0">Traité</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {activeTab === "users" && (
        <div className="space-y-6" id="tab-users-content">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Create account form */}
            <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-4">
              <h3 className="font-extrabold text-slate-800 text-base pb-2 border-b border-slate-100">Ajouter un Compte Utilisateur</h3>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label htmlFor="new-user-name" className="block text-xs font-bold text-slate-500 uppercase mb-2">Nom & Prénom</label>
                  <input
                    type="text"
                    id="new-user-name"
                    required
                    placeholder="Ex: Dr. Samy B."
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    className="w-full px-4 py-2 text-sm border rounded-xl"
                  />
                </div>

                <div>
                  <label htmlFor="new-user-login" className="block text-xs font-bold text-slate-500 uppercase mb-2">Identifiant de Connexion (Login)</label>
                  <input
                    type="text"
                    id="new-user-login"
                    required
                    placeholder="Ex: samy_bloc"
                    value={newUserLogin}
                    onChange={(e) => setNewUserLogin(e.target.value)}
                    className="w-full px-4 py-2 text-sm border rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="new-user-pin" className="block text-xs font-bold text-slate-500 uppercase mb-2">Code Unique PIN (4 Chiffres)</label>
                    <input
                      type="password"
                      id="new-user-pin"
                      required
                      placeholder="Ex: 8888"
                      maxLength={4}
                      value={newUserPin}
                      onChange={(e) => setNewUserPin(e.target.value.replace(/\D/g, ""))}
                      className="w-full px-4 py-2 text-sm border rounded-xl text-center font-black tracking-widest"
                    />
                  </div>

                  <div>
                    <label htmlFor="new-user-role" className="block text-xs font-bold text-slate-500 uppercase mb-2">Zone d'Affectation</label>
                    <select
                      id="new-user-role"
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value as any)}
                      className="w-full px-4 py-2 text-sm border rounded-xl bg-white"
                    >
                      <option value="sale">Zone Sale (Arrière bloc)</option>
                      <option value="propre">Zone Propre (Checkage)</option>
                      <option value="sterile">Zone Stérile (Autoclave)</option>
                      <option value="admin">Administrateur / Chef bloc</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  id="create-user-submit-btn"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-xs uppercase"
                >
                  Créer le Compte Opératoire
                </button>
              </form>
            </div>

            {/* Listing accounts managed */}
            <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-4">
              <h3 className="font-extrabold text-slate-800 text-base pb-2 border-b border-slate-100">Comptes Utilisateurs Actifs</h3>
              <div className="space-y-2">
                {users.map((user) => (
                  <div key={user.id} className="p-3 border border-slate-100 rounded-xl flex items-center justify-between hover:bg-slate-50/50">
                    <div>
                      <strong className="text-slate-800 text-sm">{user.name}</strong>
                      <div className="flex gap-2 text-xs text-slate-400 mt-0.5">
                        <span>Login: <b className="text-slate-600">{user.login}</b></span>
                        <span>•</span>
                        <span className="capitalize font-bold text-indigo-600">Rôle: {user.role === "sale" ? "Zone Sale" : user.role === "propre" ? "Zone Propre" : user.role === "sterile" ? "Zone Stérile" : "Admin"}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      id={`toggle-user-active-btn-${user.id}`}
                      onClick={() => handleToggleUserActive(user)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors ${
                        user.active ? "bg-emerald-50 text-emerald-800 hover:bg-emerald-100" : "bg-rose-50 text-rose-800 hover:bg-rose-100"
                      }`}
                    >
                      {user.active ? "Actif" : "Désactivé"}
                    </button>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      {activeTab === "catalog" && (
        <div className="space-y-6" id="tab-catalog-content">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Create Box and Reference Photos catalog and reference counts */}
            <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-4">
              <h3 className="font-extrabold text-slate-800 text-base pb-2 border-b border-slate-100">Ajouter un Modèle de Boîte</h3>
              <form onSubmit={handleCreateBox} className="space-y-4">
                <div>
                  <label htmlFor="new-box-number" className="block text-xs font-bold text-slate-500 uppercase mb-2">Code Boîte (Ex: B-20)</label>
                  <input
                    type="text"
                    id="new-box-number"
                    required
                    placeholder="B-20"
                    value={newBoxNumber}
                    onChange={(e) => setNewBoxNumber(e.target.value)}
                    className="w-full px-4 py-2 text-sm border rounded-xl"
                  />
                </div>

                <div>
                  <label htmlFor="new-box-name" className="block text-xs font-bold text-slate-500 uppercase mb-2">Nom de la Boîte d'Instruments</label>
                  <input
                    type="text"
                    id="new-box-name"
                    required
                    placeholder="Boîte Chirurgie Cardiaque"
                    value={newBoxName}
                    onChange={(e) => setNewBoxName(e.target.value)}
                    className="w-full px-4 py-2 text-sm border rounded-xl"
                  />
                </div>

                <div>
                  <label htmlFor="new-box-weight" className="block text-xs font-bold text-slate-500 uppercase mb-2">Poids de Référence Standard (kg)</label>
                  <input
                    type="number"
                    id="new-box-weight"
                    step="0.01"
                    required
                    placeholder="Ex: 5.40"
                    value={newBoxWeight}
                    onChange={(e) => setNewBoxWeight(e.target.value)}
                    className="w-full px-4 py-2 text-sm border rounded-xl"
                  />
                </div>

                <div>
                  <label htmlFor="box-instruments-str" className="block text-xs font-bold text-slate-500 uppercase mb-2">
                    Liste des Instruments Théoriques (Format: Code, Nom, Quantité)
                  </label>
                  <textarea
                    id="box-instruments-str"
                    rows={4}
                    required
                    value={boxInstrumentsStr}
                    onChange={(e) => setBoxInstrumentsStr(e.target.value)}
                    placeholder="KCH-01, Kelly fine, 4&#10;PM-02, Porte-aiguille, 2"
                    className="w-full px-4 py-2 text-xs border rounded-xl font-mono leading-relaxed"
                  ></textarea>
                  <span className="text-[10px] text-slate-400 block">Saisir une ligne par instrument en utilisant des virgules de séparation.</span>
                </div>

                <button
                  type="submit"
                  id="create-box-submit-btn"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-xs uppercase"
                >
                  Ajouter au Catalogue
                </button>
              </form>
            </div>

            {/* Listing active boxes managed */}
            <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-4">
              <h3 className="font-extrabold text-slate-800 text-base pb-2 border-b border-slate-100">Fiches de Boîtes existantes ({boxes.length})</h3>
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                {boxes.map((b) => (
                  <div key={b.id} className="p-4 border border-slate-100 rounded-xl hover:bg-slate-50/50 space-y-2 relative">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 text-xs font-black rounded-md">{b.number}</span>
                      <strong className="text-slate-800 text-sm">{b.name}</strong>
                      <span className="text-xs text-slate-400">({b.weight} kg attendu)</span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[10px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      {b.instruments.map((i) => (
                        <div key={i.reference} className="truncate">
                          • {i.designation} : <b>x{i.quantity}</b>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      id={`delete-box-btn-${b.id}`}
                      onClick={() => {
                        if (confirm(`Voulez-vous supprimer la boîte ${b.number} définitivement ?`)) {
                          onDeleteBox(b.id);
                        }
                      }}
                      className="absolute top-2 right-2 text-rose-500 hover:text-rose-700 p-1.5 transition-colors"
                      title="Supprimer la boîte"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      {activeTab === "parameters" && (
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-100 shadow-xs space-y-6" id="tab-parameters-content">
          <h3 className="font-extrabold text-slate-800 text-base pb-2 border-b border-slate-100">Configuration des Paramètres du Bloc opératoire</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label htmlFor="temp-cycle-types" className="block text-xs font-bold text-slate-500 uppercase mb-2">Types de Cycles de Stérilisation</label>
              <textarea
                id="temp-cycle-types"
                rows={6}
                value={tempCycleTypes}
                onChange={(e) => setTempCycleTypes(e.target.value)}
                className="w-full p-3 text-xs border rounded-xl font-mono leading-relaxed bg-slate-50"
              />
            </div>

            <div>
              <label htmlFor="temp-services" className="block text-xs font-bold text-slate-500 uppercase mb-2">Services Cliniques Destinataires</label>
              <textarea
                id="temp-services"
                rows={6}
                value={tempServices}
                onChange={(e) => setTempServices(e.target.value)}
                className="w-full p-3 text-xs border rounded-xl font-mono leading-relaxed bg-slate-50"
              />
            </div>

            <div>
              <label htmlFor="temp-products" className="block text-xs font-bold text-slate-500 uppercase mb-2">Consommables / Produits Divers</label>
              <textarea
                id="temp-products"
                rows={6}
                value={tempProducts}
                onChange={(e) => setTempProducts(e.target.value)}
                className="w-full p-3 text-xs border rounded-xl font-mono leading-relaxed bg-slate-50"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between flex-wrap gap-4">
            <span className="text-xs text-slate-400 font-sans italic">Saisir une entrée par ligne. Cliquer sur Enregistrer pour propager à tous les utilisateurs.</span>
            <button
              type="button"
              id="save-settings-submit-btn"
              onClick={handleSaveSettings}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs uppercase rounded-xl shadow-xs cursor-pointer"
            >
              Enregistrer tous les paramètres
            </button>
          </div>
        </div>
      )}

      {activeTab === "gmail" && (
        <div className="space-y-6 animate-fade-in" id="tab-gmail-content">
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-100 shadow-xs space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 flex-wrap gap-4">
              <div>
                <h3 className="font-extrabold text-slate-800 text-base">Configuration des Alertes et Notifications Cliniques</h3>
                <p className="text-xs text-slate-400">Automatisez la messagerie de votre clinique avec l'API Gmail sécurisée pour notifier les anomalies et les validations d'autoclave.</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-black uppercase flex items-center gap-1.5 border ${
                  gEnabled && gToken
                    ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                    : "bg-amber-50 text-amber-700 border-amber-100"
                }`}>
                  <span className={`w-2 h-2 rounded-full ${gEnabled && gToken ? "bg-emerald-500" : "bg-amber-500 animate-pulse"}`} />
                  {gEnabled && gToken ? "Gmail Connecté" : "Email Désactivé / En Attente"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Card 1: Configuration Credentials */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 space-y-4">
                  <h4 className="text-xs font-black text-indigo-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-rose-500" />
                    Authentification Google OAuth 2.0
                  </h4>
                  
                  <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                    Pour lier la boîte de réception à votre application, utilisez l'authentification sécurisée Google ou collez directement un jeton d'accès (Access Token) temporaire de test généré sur l'OAuth Playground.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 mb-1">Google Client ID (Optionnel)</label>
                      <input
                        type="text"
                        placeholder="Ex: 103632348574-xxxxxx.apps.googleusercontent.com"
                        value={gClientId}
                        onChange={(e) => setGClientId(e.target.value)}
                        className="w-full text-xs p-2.5 border rounded-xl font-mono bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 mb-1">Adresse de Callback Applet (Redirection)</label>
                      <input
                        type="text"
                        readOnly
                        value={window.location.origin + "/auth/callback"}
                        className="w-full text-xs p-2.5 border rounded-xl font-mono bg-slate-100 text-slate-500 cursor-not-allowed select-all"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        const clientIdToUse = gClientId || "103632348574-test.apps.googleusercontent.com";
                        const redirectUri = encodeURIComponent(window.location.origin + "/auth/callback");
                        const scope = encodeURIComponent([
                          "https://www.googleapis.com/auth/gmail.send",
                          "https://www.googleapis.com/auth/gmail.readonly"
                        ].join(" "));
                        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientIdToUse}&redirect_uri=${redirectUri}&response_type=token&scope=${scope}&prompt=consent`;
                        const oauthWindow = window.open(authUrl, "g_oauth_popup", "width=600,height=700");
                        if (!oauthWindow) {
                          alert("⚠️ Veuillez autoriser les popups dans votre navigateur pour l'authentification Google.");
                        }
                      }}
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      S'authentifier via Client Google
                    </button>
                    <span className="text-slate-400 text-xs">ou</span>
                    <button
                      type="button"
                      onClick={() => {
                        window.open("https://developers.google.com/oauthplayground", "_blank");
                      }}
                      className="px-4 py-2.5 border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Info className="w-3.5 h-3.5 text-blue-500" />
                      Générer sur Playground
                    </button>
                  </div>

                  <div className="pt-4 border-t border-slate-100 space-y-3">
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-extrabold text-slate-700 mb-1">
                          Google OAuth Access Token (Jeton de Connexion Principal)
                        </label>
                        {gToken && (
                          <span className="text-[10px] font-mono text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">Jeton actif</span>
                        )}
                      </div>
                      <input
                        type="password"
                        placeholder="Ex: ya29.a0ARWdfY7xxxxxx..."
                        value={gToken}
                        onChange={(e) => setGToken(e.target.value)}
                        className="w-full text-xs p-2.5 border rounded-xl font-mono bg-white"
                      />
                      <p className="text-[10px] text-slate-400 mt-1 select-none">
                        Il s'agit du jeton d'accès temporaire ou à longue durée utilisé par le serveur pour expédier les rapports.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Automation Rules */}
                <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 space-y-4">
                  <h4 className="text-xs font-black text-indigo-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Settings className="w-4 h-4 text-indigo-500" />
                    Paramètres Cliniques de Messagerie
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 mb-1">Destinataire Principal des Rapports</label>
                      <input
                        type="email"
                        placeholder="ghellabali81500@gmail.com"
                        value={gRecipient}
                        onChange={(e) => setGRecipient(e.target.value)}
                        className="w-full text-xs p-2.5 border rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 mb-1">État de l'Intégration Active</label>
                      <div className="flex items-center gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setGEnabled(!gEnabled)}
                          className="text-slate-600 hover:text-slate-800 transition-colors cursor-pointer"
                        >
                          {gEnabled ? (
                            <ToggleRight className="w-9 h-9 text-indigo-600" />
                          ) : (
                            <ToggleLeft className="w-9 h-9 text-slate-400" />
                          )}
                        </button>
                        <span className="text-xs font-extrabold text-slate-600">
                          {gEnabled ? "Notifications Actives" : "Notifications Suspendues"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100">
                      <div className="space-y-0.5">
                        <strong className="text-xs text-slate-800 font-bold block">Alerte Immédiate d'Anomalie (Zone Propre)</strong>
                        <span className="text-[10px] text-slate-400">Envoie un rapport détaillé lors de la découverte d'une pince perdue, cassée ou mal nettoyée.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setGAlertOnAnomaly(!gAlertOnAnomaly)}
                        className="cursor-pointer"
                      >
                        {gAlertOnAnomaly ? (
                          <ToggleRight className="w-8 h-8 text-emerald-500" />
                        ) : (
                          <ToggleLeft className="w-8 h-8 text-slate-300" />
                        )}
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100">
                      <div className="space-y-0.5">
                        <strong className="text-xs text-slate-800 font-bold block">Rapport et Validation d'Autoclave (Zone Stérile)</strong>
                        <span className="text-[10px] text-slate-400">Envoie un email de certification conforme avec l'heure de chauffe ou alerte rouge si le cycle échoue.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setGAlertOnCycle(!gAlertOnCycle)}
                        className="cursor-pointer"
                      >
                        {gAlertOnCycle ? (
                          <ToggleRight className="w-8 h-8 text-emerald-500" />
                        ) : (
                          <ToggleLeft className="w-8 h-8 text-slate-300" />
                        )}
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100">
                      <div className="space-y-0.5">
                        <strong className="text-xs text-slate-800 font-bold block">Notification de Récupération / Livraison au Bloc</strong>
                        <span className="text-[10px] text-slate-400">Notifie le destinataire dès qu'une boîte est scellée et acheminée au bloc chirurgical.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setGAlertOnDelivery(!gAlertOnDelivery)}
                        className="cursor-pointer"
                      >
                        {gAlertOnDelivery ? (
                          <ToggleRight className="w-8 h-8 text-emerald-500" />
                        ) : (
                          <ToggleLeft className="w-8 h-8 text-slate-300" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Test send and Quick Status */}
              <div className="space-y-6">
                <div className="bg-slate-900 text-white p-6 rounded-2xl space-y-4 shadow-md">
                  <h4 className="text-xs font-black text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    Diagnostics & Test Direct
                  </h4>
                  
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Testez instantanément votre configuration en envoyant un e-mail de contrôle clinique formaté avec les logos officiels de la clinique.
                  </p>

                  <div className="p-3 bg-slate-800 rounded-xl space-y-1 text-[11px] font-mono border border-slate-700">
                    <div className="text-yellow-400">// Diagnostic variables</div>
                    <div>Target: {gRecipient}</div>
                    <div>Enabled: {gEnabled ? "true" : "false"}</div>
                    <div>Token: {gToken ? "xxxx..." : "none"}</div>
                  </div>

                  <button
                    type="button"
                    disabled={sendingTest || !gToken}
                    onClick={async () => {
                      setSendingTest(true);
                      try {
                        await onUpdateSettings({
                          ...globalSettings,
                          gmailEnabled: true,
                          gmailRecipient: gRecipient,
                          gmailClientId: gClientId,
                          gmailClientSecret: gClientSecret,
                          gmailToken: gToken,
                          gmailAlertOnAnomaly: gAlertOnAnomaly,
                          gmailAlertOnCycle: gAlertOnCycle,
                          gmailAlertOnDelivery: gAlertOnDelivery
                        });

                        const res = await fetch("/api/gmail/test-send", { method: "POST" });
                        const data = await res.json();
                        if (res.ok) {
                          alert("🎉 Envoi réussi : " + data.message);
                          fetchLogs();
                        } else {
                          alert("❌ Échec d'envoi : " + (data.error || "Échec de l'envoi, vérifiez le jeton."));
                        }
                      } catch (err: any) {
                        alert("Erreur de test : " + err.message);
                      } finally {
                        setSendingTest(false);
                      }
                    }}
                    className={`w-full py-3 ${sendingTest ? "bg-slate-700 text-slate-400 cursor-not-allowed" : "bg-gradient-to-r from-red-500 to-indigo-600 hover:opacity-90 text-white font-black cursor-pointer"} text-xs uppercase tracking-wider rounded-xl transition-all shadow flex items-center justify-center gap-2`}
                  >
                    {sendingTest ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Traitement API...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Envoyer un Email de Diagnostic
                      </>
                    )}
                  </button>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-100 space-y-4">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b pb-2 border-slate-100">
                    <Info className="w-4 h-4 text-blue-500" />
                    Instructions Rapides
                  </h4>
                  <ol className="text-[11px] text-slate-500 space-y-2 list-decimal list-inside leading-relaxed font-semibold">
                    <li>Rendez-vous sur l'<strong>OAuth Playground</strong> en cliquant ci-dessus.</li>
                    <li>Saisissez l'authentification s'il s'agit de votre première utilisation.</li>
                    <li>Autorisez la messagerie pour votre clinicien.</li>
                    <li>Copiez le code d'accès temporaire et collez-le ici !</li>
                  </ol>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between flex-wrap gap-4">
              <span className="text-xs text-slate-400 font-sans italic">Sauvegardez pour appliquer les règles cliniques.</span>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await onUpdateSettings({
                      ...globalSettings,
                      gmailEnabled: gEnabled,
                      gmailRecipient: gRecipient,
                      gmailClientId: gClientId,
                      gmailClientSecret: gClientSecret,
                      gmailToken: gToken,
                      gmailAlertOnAnomaly: gAlertOnAnomaly,
                      gmailAlertOnCycle: gAlertOnCycle,
                      gmailAlertOnDelivery: gAlertOnDelivery
                    });
                    alert("✅ Paramètres Gmail sauvegardés.");
                    fetchLogs();
                  } catch (err: any) {
                    alert("Erreur de sauvegarde : " + err.message);
                  }
                }}
                className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs uppercase rounded-xl shadow-xs cursor-pointer"
              >
                Sauvegarder la Messagerie Clinique
              </button>
            </div>
          </div>

          {/* Real-time System Logs */}
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-100 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-extrabold text-slate-800 text-sm">Chronologie des Alertes Expédiées</h4>
                <p className="text-[11px] text-slate-400">Consultez l'historique et le journal de diagnostic de toutes les notifications email traitées par le serveur.</p>
              </div>
              <button
                onClick={fetchLogs}
                disabled={loadingLogs}
                className="p-2 border rounded-lg hover:bg-slate-50 transition-colors cursor-pointer text-slate-500 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? "animate-spin" : ""}`} />
              </button>
            </div>

            {loadingLogs ? (
              <div className="py-12 flex items-center justify-center gap-2 text-xs text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                Chargement du journal d'émissions de la clinique...
              </div>
            ) : gmailLogs.length === 0 ? (
              <div className="py-8 bg-slate-50 rounded-xl text-center text-xs text-slate-400 italic">
                Aucune notification Gmail envoyée à ce jour. Essayez d'envoyer un email de diagnostic ci-dessus !
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto pr-1">
                {gmailLogs.map((log) => (
                  <div key={log.id} className="py-3 flex items-center justify-between gap-4 text-xs font-sans leading-relaxed">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <strong className="text-slate-800 font-bold block">{log.subject}</strong>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                          log.status === "success"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                            : "bg-rose-50 text-rose-700 border border-rose-100"
                        }`}>
                          {log.status === "success" ? "Expédié" : "Échoué"}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Destinataire : <strong className="text-slate-600 font-bold">{log.recipient}</strong> • Date : {new Date(log.date).toLocaleString("fr-FR")}
                      </div>
                      {log.error && (
                        <div className="text-[10px] text-red-600 font-semibold font-mono bg-red-50 p-1.5 rounded-md mt-1">
                          Erreur API : {log.error}
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold shrink-0">{log.id.split("_")[1] || log.id}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "history" && (
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-100 shadow-xs space-y-6" id="tab-history-content">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 flex-wrap gap-4">
            <div>
              <h3 className="font-extrabold text-slate-800 text-base">Fiches Actives de Traçabilité des Boîtes</h3>
              <p className="text-xs text-slate-400">Visualisez le cycle de rotation ou exportez et imprimez le rapport de traçabilité officiel par boîte.</p>
            </div>
            
            {/* System factory reset sandbox helper */}
            <button
              type="button"
              id="factory-reset-action-btn"
              onClick={async () => {
                if (confirm("⚠️ Voulez-vous restaurer les données à leur origine d'usine ? Toutes les fiches créées seront purgées.")) {
                  await onResetFactoryData();
                  alert("Données d'usine restaurées.");
                }
              }}
              className="px-4 py-2 border border-slate-200 text-xs font-extrabold text-rose-600 hover:bg-slate-50 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Réinitialiser à l'état d'usine
            </button>
          </div>

          <div className="space-y-4">
            {trackingLogs.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center italic">Aucun enregistrement de traçabilité en cours dans la base clinique.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {trackingLogs.map((log) => (
                  <div key={log.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 border text-xs font-bold rounded-lg">{log.boxNumber}</span>
                        <strong className="text-slate-800 text-sm">{log.boxName}</strong>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border uppercase shrink-0 ${
                          log.status === "sale"
                            ? "bg-rose-50 text-rose-700 border-rose-100"
                            : log.status === "propre"
                            ? "bg-indigo-50 text-indigo-700 border-indigo-100"
                            : log.status === "sterile"
                            ? "bg-cyan-50 text-cyan-700 border-cyan-100"
                            : "bg-emerald-50 text-emerald-700 border-emerald-100"
                        }`}>
                          {log.status === "livree" ? "Livrée au Bloc" : log.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Date d'ouverture : {new Date(log.updates[0].time).toLocaleDateString()} à {new Date(log.updates[0].time).toLocaleTimeString()} — Provenance : {log.saleDetails?.salle}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        id={`print-report-btn-${log.id}`}
                        onClick={() => handlePrintReport(log)}
                        className="px-3.5 py-2 hover:bg-slate-50 text-indigo-600 border border-slate-200 text-xs font-black rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Exporter Rapport PDF Trace
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "perspective_sale" && (
        <div className="space-y-4">
          <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-xs font-black text-rose-700 bg-rose-100 px-2.5 py-1 rounded-md uppercase block w-max">
                Simulateur / Perspective Superviseur
              </span>
              <p className="text-xs text-rose-950 font-semibold mt-1">
                Vous opérez en tant qu'administrateur avec les droits de la Zone Sale (Prédésinfection). Vos actions impactent la base clinique synchronisée.
              </p>
            </div>
          </div>
          <SaleInterface
            currentUser={currentUser}
            boxes={boxes}
            onAddTracking={onAddTracking}
            recentTracking={trackingLogs}
          />
        </div>
      )}

      {activeTab === "perspective_propre" && (
        <div className="space-y-4">
          <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-xs font-black text-indigo-700 bg-indigo-100 px-2.5 py-1 rounded-md uppercase block w-max">
                Simulateur / Perspective Superviseur
              </span>
              <p className="text-xs text-indigo-950 font-semibold mt-1">
                Vous opérez en tant qu'administrateur avec les droits de la Zone Propre (Checkage). Vos vérifications de conformité d'inventaires impactent la traçabilité clinique.
              </p>
            </div>
          </div>
          <PropreInterface
            currentUser={currentUser}
            boxes={boxes}
            trackingLogs={trackingLogs}
            onUpdatePropreTracking={onUpdatePropreTracking}
          />
        </div>
      )}

      {activeTab === "perspective_sterile" && (
        <div className="space-y-4">
          <div className="bg-cyan-50 border border-cyan-200 p-4 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-xs font-black text-cyan-700 bg-cyan-100 px-2.5 py-1 rounded-md uppercase block w-max">
                Simulateur / Perspective Superviseur
              </span>
              <p className="text-xs text-cyan-955 font-semibold mt-1">
                Vous opérez en tant qu'administrateur avec les droits de la Zone Stérile (Autoclave). Vos lancements d'cycles de chauffe et transferts distribuent instantanément le matériel au bloc.
              </p>
            </div>
          </div>
          <SterileInterface
            currentUser={currentUser}
            boxes={boxes}
            trackingLogs={trackingLogs}
            recentCycles={cycles}
            recentConsumption={consumption}
            globalSettings={globalSettings}
            onAddCycle={onAddCycle}
            onAddConsumption={onAddConsumption}
            onDeliverBox={onDeliverBox}
          />
        </div>
      )}

    </div>
  );
}
