import React, { useState, useEffect } from "react";
import { User, MasterBox, BoxTrackingLog, AutoclaveCycleRecord, ConsumableDelivery, GlobalSettings, MissingAlert } from "./types";
import SaleInterface from "./components/SaleInterface";
import PropreInterface from "./components/PropreInterface";
import SterileInterface from "./components/SterileInterface";
import AdminInterface from "./components/AdminInterface";
import { ShieldAlert, LogOut, RefreshCw, KeyRound, Radio, Users2, Activity, ShieldCheck, HeartPulse, ChevronUp, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  // Session authentication states
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loginInput, setLoginInput] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [isHeaderOpen, setIsHeaderOpen] = useState(true);

  // System raw states synchronized with express backend server
  const [users, setUsers] = useState<User[]>([]);
  const [boxes, setBoxes] = useState<MasterBox[]>([]);
  const [trackingLogs, setTrackingLogs] = useState<BoxTrackingLog[]>([]);
  const [cycles, setCycles] = useState<AutoclaveCycleRecord[]>([]);
  const [consumption, setConsumption] = useState<ConsumableDelivery[]>([]);
  const [alerts, setAlerts] = useState<MissingAlert[]>([]);
  const [settings, setSettings] = useState<GlobalSettings>({
    cycleTypes: [],
    services: [],
    diversProducts: []
  });

  const [isLoading, setIsLoading] = useState(true);
  const [syncCount, setSyncCount] = useState(0);

  // Sync logic helpers
  const syncAllData = async () => {
    try {
      const [resUsers, resBoxes, resTrack, resCycles, resCons, resAlerts, resSettings] = await Promise.all([
        fetch("/api/users").then(r => r.json()),
        fetch("/api/boxes").then(r => r.json()),
        fetch("/api/tracking").then(r => r.json()),
        fetch("/api/cycles").then(r => r.json()),
        fetch("/api/consumption").then(r => r.json()),
        fetch("/api/alerts").then(r => r.json()),
        fetch("/api/settings").then(r => r.json())
      ]);

      setUsers(resUsers);
      setBoxes(resBoxes);
      setTrackingLogs(resTrack);
      setCycles(resCycles);
      setConsumption(resCons);
      setAlerts(resAlerts);
      setSettings(resSettings);
      setSyncCount(prev => prev + 1);
    } catch (e) {
      console.error("Data synchronization error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // Run initial sync & setup polling
  useEffect(() => {
    syncAllData();
    // Real-time synchronization interval of 4.5 seconds
    const interval = setInterval(() => {
      syncAllData();
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: loginInput, pin: pinInput })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Lettre d'authentification refusée.");
      }
      const user = await response.json();
      setCurrentUser(user);
      setLoginInput("");
      setPinInput("");
    } catch (err: any) {
      setAuthError(err.message);
    }
  };

  // Quick switch role (demo utility) to test inter-account warnings instantly
  const handleQuickLogin = (user: User) => {
    setCurrentUser(user);
    setAuthError("");
  };

  const handleLogout = () => {
    setCurrentUser(null);
  };

  // API Call wrappers
  // 1. Add Box tracking Sale
  const handleAddTrackingSale = async (payload: any) => {
    const response = await fetch("/api/tracking/sale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      throw new Error("Lavage non enregistré");
    }
    syncAllData();
  };

  // 2. Propre Checklist Verification Finished
  const handleUpdatePropreCheck = async (payload: any) => {
    const response = await fetch("/api/tracking/propre", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      throw new Error("Validation checkage échouée");
    }
    syncAllData();
  };

  // 3. Add Autoclave Cycle
  const handleAddAutoclaveCycle = async (payload: any) => {
    const response = await fetch("/api/cycles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      throw new Error("Cycle non enregistré");
    }
    syncAllData();
  };

  // 4. Add Consumables Distribution
  const handleAddConsumption = async (payload: any) => {
    const response = await fetch("/api/consumption", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      throw new Error("Transfert consommable échoué");
    }
    syncAllData();
  };

  // 5. Deliver sterilised box back to operational rooms
  const handleDeliverBox = async (trackingId: string, serviceDestinataire: string) => {
    const response = await fetch("/api/tracking/deliver", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackingId, serviceDestinataire, doneBy: currentUser?.name || "Système" })
    });
    if (!response.ok) {
      throw new Error("Livraison non enregistrée");
    }
    syncAllData();
  };

  // 6. Admin edit users
  const handleAddUser = async (userPayload: any) => {
    const response = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userPayload)
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Échoué");
    }
    syncAllData();
  };

  const handleUpdateUser = async (id: string, updatedFields: any) => {
    const response = await fetch(`/api/users/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedFields)
    });
    if (!response.ok) {
      throw new Error("Ajustement échoué");
    }
    syncAllData();
  };

  // 7. Admin edit boxes catalogue structures
  const handleAddBox = async (boxPayload: any) => {
    const response = await fetch("/api/boxes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(boxPayload)
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Échoué");
    }
    syncAllData();
  };

  const handleUpdateBox = async (id: string, updatedBox: any) => {
    const response = await fetch(`/api/boxes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedBox)
    });
    if (!response.ok) {
      throw new Error("Sauvegarde catalogue échouée");
    }
    syncAllData();
  };

  const handleDeleteBox = async (id: string) => {
    const response = await fetch(`/api/boxes/${id}`, {
      method: "DELETE"
    });
    if (!response.ok) {
      throw new Error("Retrait échoué");
    }
    syncAllData();
  };

  // 8. Admin global dropdown configuration edit
  const handleUpdateSettings = async (settingsPayload: any) => {
    const response = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settingsPayload)
    });
    if (!response.ok) {
      throw new Error("Configuration non mise à jour");
    }
    syncAllData();
  };

  // 9. Acknowledge alert warning
  const handleAcknowledgeAlert = async (id: string) => {
    const response = await fetch(`/api/alerts/${id}/acknowledge`, {
      method: "PUT"
    });
    if (!response.ok) {
      throw new Error("Acquittement alerte échoué");
    }
    syncAllData();
  };

  // 10. Clean resets sandbox database trigger
  const handleResetFactoryData = async () => {
    const response = await fetch("/api/reset-data", {
      method: "POST"
    });
    if (!response.ok) {
      throw new Error("Réinitialisation impossible");
    }
    setCurrentUser(null);
    syncAllData();
  };

  // Calculate unacknowledged alerts to show global header ticker
  const activeUnacknowledgedAlerts = alerts.filter(a => !a.acknowledged);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col antialiased">
      
      {/* Real-time sync notifications strip & alert warning banner */}
      {activeUnacknowledgedAlerts.length > 0 && (
        <div id="live-global-ticker" className="bg-rose-600 text-white font-sm py-2 px-4 shadow-sm relative overflow-hidden shrink-0">
          <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-2 animate-pulse">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <span className="font-bold text-xs uppercase tracking-wider">
                Alerte Bloquante Synchro : {activeUnacknowledgedAlerts.length} Manque(s) / Anomalie(s) active(s) détectée(s) !
              </span>
            </div>
            <span className="text-[10.5px] bg-rose-700/80 px-2.5 py-0.5 rounded-md font-mono">
              Inspecté activement en Zone Propre
            </span>
          </div>
        </div>
      )}

      {/* Pull-out toggle tab when header is collapsed/hidden */}
      {!isHeaderOpen && (
        <motion.div
          initial={{ y: -65, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -65, opacity: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 20 }}
          style={{ zIndex: 100 }}
          className="fixed top-0 left-1/2 -translate-x-1/2 flex justify-center pb-2 pointer-events-auto"
        >
          <button
            type="button"
            onClick={() => setIsHeaderOpen(true)}
            className="group flex items-center gap-2 bg-indigo-600 hover:bg-indigo-750 text-white font-extrabold text-[11px] tracking-wider uppercase px-4 py-2 rounded-b-2xl border-t-0 border border-indigo-500 shadow-md cursor-pointer transition-all hover:scale-102 active:scale-98 duration-150"
            title="Afficher l'En-tête de la Clinique"
          >
            <HeartPulse className="w-4 h-4 text-white group-hover:scale-110 transition-transform duration-200" />
            <span>Afficher l'En-tête</span>
            <ChevronDown className="w-3.5 h-3.5 transition-transform group-hover:translate-y-0.5 duration-200" />
          </button>
        </motion.div>
      )}

      {/* Main system header */}
      <AnimatePresence initial={false}>
        {isHeaderOpen && (
          <motion.header
            initial={{ height: 0, opacity: 0, overflow: "hidden" }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0, overflow: "hidden" }}
            transition={{ type: "spring", stiffness: 200, damping: 24 }}
            className="bg-white border-b border-slate-150 sticky top-0 z-40 shadow-xs shrink-0"
          >
            <div className="max-w-8xl mx-auto py-3 px-6 md:px-12 flex flex-col sm:flex-row items-center justify-between gap-4">
              
              {/* Logo brand */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-black shadow-indigo-200 shadow-md">
                  <HeartPulse className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="font-black text-lg text-slate-900 tracking-tight leading-none uppercase">Clinique Alouia</h1>
                  <span className="text-[10px] text-indigo-600 font-extrabold tracking-widest uppercase block mt-1">Circuit de Traçabilité & Stérilisation</span>
                </div>
              </div>

              {/* Connected User and Controls */}
              {currentUser ? (
                <div className="flex items-center gap-4">
                  <div className="bg-indigo-50/50 p-2 rounded-xl border border-indigo-100 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-600/10 text-indigo-700 flex items-center justify-center font-bold text-xs border border-indigo-200">
                      {currentUser.name[0]}
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-medium block">Poste de contrôle</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-xs text-slate-800 capitalize">{currentUser.name}</span>
                        <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[9px] font-black uppercase rounded-sm">
                          {currentUser.role === "sale" ? "Zone Sale" : currentUser.role === "propre" ? "Zone Propre" : currentUser.role === "sterile" ? "Zone Stérile" : "Directeur"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div id="header-actions" className="flex items-center gap-1.5">
                    {/* Active Synced Beacon */}
                    <div className="px-2.5 py-1.5 bg-slate-50 rounded-xl border flex items-center gap-1 text-[10px] text-slate-400 font-semibold" title="Fréquence de Synchronisation">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                      <span>Sync #{syncCount}</span>
                    </div>

                    <button
                      type="button"
                      id="user-logout-btn"
                      onClick={handleLogout}
                      className="p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 rounded-xl transition-all font-semibold text-xs flex items-center gap-1 border border-rose-100 cursor-pointer"
                      title="Changer de compte utilisateur"
                    >
                      <LogOut className="w-4 h-4" />
                      <span className="hidden md:inline">Changer de Poste</span>
                    </button>

                    {/* Collapse Button inside Header */}
                    <button
                      type="button"
                      id="header-collapse-btn"
                      onClick={() => setIsHeaderOpen(false)}
                      className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-800 rounded-xl transition-all font-semibold text-xs flex items-center gap-1.5 border border-slate-200 cursor-pointer"
                      title="Masquer l'en-tête"
                    >
                      <ChevronUp className="w-4 h-4" />
                      <span className="hidden md:inline">Masquer</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="text-[11px] bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg font-bold">
                    🔒 Accès Sécurisé — Cryptage Clinique
                  </div>
                  {/* Collapse Button inside Header for unauthenticated users */}
                  <button
                    type="button"
                    id="header-collapse-btn-unauthed"
                    onClick={() => setIsHeaderOpen(false)}
                    className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-800 rounded-xl transition-all font-semibold text-xs flex items-center gap-1 border border-slate-200 cursor-pointer"
                    title="Masquer l'en-tête"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                </div>
              )}

            </div>
          </motion.header>
        )}
      </AnimatePresence>

      {/* Main Container body Content */}
      <main className="flex-1 max-w-8xl mx-auto w-full p-4 md:p-8">
        
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <RefreshCw className="w-10 h-10 text-indigo-600 animate-spin" />
            <p className="text-sm font-semibold text-slate-500">Chargement de la base de données de stérilisation...</p>
          </div>
        ) : !currentUser ? (
          
          /* Authentication Access Page with quick demo role shortcuts */
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 py-8 items-center" id="auth-screen">
            
            {/* Logo and Hospital Meta intro */}
            <div className="md:col-span-5 space-y-4">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">
                Portail Administrative de Stérilisation
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                Connectez-vous à l'aide de votre identifiant personnel ou scannez votre badge d'agent de chirurgie pour entrer dans votre zone d'affectation réglementaire.
              </p>

              {/* Roles list description */}
              <div className="space-y-3">
                <div className="flex gap-3 text-xs bg-white p-3 rounded-xl border border-slate-100">
                  <span className="w-6 h-6 rounded-md bg-rose-100 text-rose-700 flex items-center justify-center font-bold">1</span>
                  <span><b>Zone Sale (Arrière Bloc) :</b> Réception des boîtes arrivées du bloc opératoire, prédésinfection, contrôle de poids.</span>
                </div>
                <div className="flex gap-3 text-xs bg-white p-3 rounded-xl border border-slate-100">
                  <span className="w-6 h-6 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">2</span>
                  <span><b>Zone Propre :</b> Checkage qualitatif, comptage des pinces, signalement des manques en direct.</span>
                </div>
                <div className="flex gap-3 text-xs bg-white p-3 rounded-xl border border-slate-100">
                  <span className="w-6 h-6 rounded-md bg-cyan-100 text-cyan-700 flex items-center justify-center font-bold">3</span>
                  <span><b>Zone Stérile :</b> Chargement autoclave, validation des thermo-cycles, transferts consommables.</span>
                </div>
              </div>
            </div>

            {/* Verification Form and Keypad */}
            <div className="md:col-span-7 bg-white p-6 sm:p-8 rounded-2xl shadow-xl border border-slate-100 space-y-6">
              
              <div className="text-center">
                <span className="text-[10px] bg-slate-100 text-slate-500 px-2.5 py-1 rounded-md uppercase font-black tracking-wider inline-block mb-2">Identification</span>
                <h3 className="text-lg font-bold text-slate-800">Saisie du Code PIN</h3>
              </div>

              {authError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-xs text-rose-800 rounded-xl font-semibold">
                  ⚠️ {authError}
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label htmlFor="login-username" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Identifiant Agent *</label>
                  <select
                    id="login-username"
                    required
                    value={loginInput}
                    onChange={(e) => setLoginInput(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-600 bg-slate-50/50 font-bold text-slate-700 focus:outline-hidden"
                  >
                    <option value="">-- Sélectionner l'Opérateur --</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.login}>
                        {u.name} ({u.role === "admin" ? "Superviseur / Chef" : u.role.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="login-pin" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Code PIN à 4 Chiffres</label>
                  <input
                    type="password"
                    id="login-pin"
                    required
                    maxLength={4}
                    placeholder="••••"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-center text-xl font-bold tracking-widest focus:ring-2 focus:ring-indigo-600 bg-slate-50/50 focus:outline-hidden"
                  />
                </div>

                <button
                  type="submit"
                  id="auth-submit-btn"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all inline-flex items-center justify-center gap-2 text-sm uppercase cursor-pointer"
                >
                  <KeyRound className="w-4 h-4" />
                  Déverrouiller l'Interface Clinique
                </button>
              </form>

              {/* DEMO SWITCHER UTILITY */}
              <div className="pt-6 border-t border-slate-150">
                <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block text-center mb-3">Accès Sandbox Rapide (Mode Test)</span>
                <div className="grid grid-cols-2 gap-2">
                  {users.map((shortcutUser) => (
                    <button
                      key={shortcutUser.id}
                      type="button"
                      id={`fast-login-btn-${shortcutUser.id}`}
                      onClick={() => handleQuickLogin(shortcutUser)}
                      className="px-3 py-2 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 text-[11px] border border-slate-200 rounded-xl font-bold text-slate-700 transition-all flex items-center justify-between text-left"
                    >
                      <span className="truncate pr-1">{shortcutUser.name.split(" ")[0]} ({shortcutUser.role.toUpperCase()})</span>
                      <span className="font-mono text-[9px] text-indigo-600 bg-white px-1.5 py-0.5 rounded-md border font-black">{shortcutUser.pin}</span>
                    </button>
                  ))}
                </div>
              </div>

            </div>

          </div>
        ) : (
          
          /* Active Logged-in screens render based on roles */
          <div className="space-y-6">
            
            {/* Active alerts warnings sync banner for standard operators */}
            {activeUnacknowledgedAlerts.length > 0 && currentUser.role !== "admin" && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-amber-600 animate-spin" />
                  <span className="text-sm text-amber-900 font-bold">
                    ⚠️ {activeUnacknowledgedAlerts.length} Manque(s) d'instrument ou pince cassée déclarée(s) :
                  </span>
                  <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md font-semibold">
                    Dernière: Boîte "{activeUnacknowledgedAlerts[0].boxNumber}" - {activeUnacknowledgedAlerts[0].instrumentDesignation} ({activeUnacknowledgedAlerts[0].status})
                  </span>
                </div>
                <span className="text-xs text-amber-600 font-bold">Liaison continue active</span>
              </div>
            )}

            {/* Switch view screen based on roles */}
            {currentUser.role === "sale" && (
              <SaleInterface
                currentUser={currentUser}
                boxes={boxes}
                onAddTracking={handleAddTrackingSale}
                recentTracking={trackingLogs}
              />
            )}

            {currentUser.role === "propre" && (
              <PropreInterface
                currentUser={currentUser}
                boxes={boxes}
                trackingLogs={trackingLogs}
                onUpdatePropreTracking={handleUpdatePropreCheck}
              />
            )}

            {currentUser.role === "sterile" && (
              <SterileInterface
                currentUser={currentUser}
                boxes={boxes}
                trackingLogs={trackingLogs}
                recentCycles={cycles}
                recentConsumption={consumption}
                globalSettings={settings}
                onAddCycle={handleAddAutoclaveCycle}
                onAddConsumption={handleAddConsumption}
                onDeliverBox={handleDeliverBox}
              />
            )}

            {currentUser.role === "admin" && (
              <AdminInterface
                currentUser={currentUser}
                users={users}
                boxes={boxes}
                trackingLogs={trackingLogs}
                cycles={cycles}
                consumption={consumption}
                alerts={alerts}
                globalSettings={settings}
                onAddUser={handleAddUser}
                onUpdateUser={handleUpdateUser}
                onAddBox={handleAddBox}
                onUpdateBox={handleUpdateBox}
                onDeleteBox={handleDeleteBox}
                onUpdateSettings={handleUpdateSettings}
                onAcknowledgeAlert={handleAcknowledgeAlert}
                onResetFactoryData={handleResetFactoryData}
                onAddTracking={handleAddTrackingSale}
                onUpdatePropreTracking={handleUpdatePropreCheck}
                onAddCycle={handleAddAutoclaveCycle}
                onAddConsumption={handleAddConsumption}
                onDeliverBox={handleDeliverBox}
              />
            )}

          </div>
        )}

      </main>

      {/* Hospital application footer */}
      <footer className="bg-white border-t border-slate-150 py-4 px-6 md:px-12 text-center text-xs text-slate-400 mt-20 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span>© 2026 CLINIQUE ALOUIA — Système de Traçabilité Modèle v1.0. Tous droits réservés.</span>
          <div className="flex items-center gap-1">
            <Radio className="w-3.5 h-3.5 text-emerald-500 font-bold" />
            <span className="font-extrabold uppercase text-[10px] tracking-wider text-emerald-600">OnSpace Synchro Live active</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
