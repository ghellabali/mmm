import React, { useState, useEffect } from "react";
import { MasterBox, User, BoxTrackingLog, MasterInstrument } from "../types";
import { Check, X, ShieldAlert, Timer, ChevronRight, FileText, Play, Pause, RotateCcw, Compass, AlertTriangle } from "lucide-react";

interface PropreInterfaceProps {
  currentUser: User;
  boxes: MasterBox[];
  trackingLogs: BoxTrackingLog[];
  onUpdatePropreTracking: (payload: any) => Promise<void>;
}

export default function PropreInterface({
  currentUser,
  boxes,
  trackingLogs,
  onUpdatePropreTracking
}: PropreInterfaceProps) {
  // Select active box log to check
  const [activeTrkId, setActiveTrkId] = useState("");
  
  // Checking states
  const [checkedItems, setCheckedItems] = useState<{
    [ref: string]: {
      checkedQuantity: number;
      status: "OK" | "Manque" | "Cassé" | "Mal nettoyé";
    }
  }>({});

  // Chronometer states
  const [seconds, setSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  const activeTrk = trackingLogs.find(t => t.id === activeTrkId);
  const associatedBox = activeTrk ? boxes.find(b => b.id === activeTrk.boxId) : null;

  // List of packages currently in "sale" zone, awaiting control
  const pendingLogs = trackingLogs.filter(t => t.status === "sale");

  // Format seconds to mm:ss
  const formatTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Stopwatch ticking logic
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  // When active box selection shifts, reset instruments and restart timer
  useEffect(() => {
    if (associatedBox) {
      const initial: typeof checkedItems = {};
      associatedBox.instruments.forEach((inst) => {
        initial[inst.reference] = {
          checkedQuantity: inst.quantity,
          status: "OK"
        };
      });
      setCheckedItems(initial);
      setSeconds(0);
      setIsTimerRunning(true);
    } else {
      setIsTimerRunning(false);
      setSeconds(0);
    }
  }, [activeTrkId, associatedBox]);

  const handleStatusChange = (reference: string, status: "OK" | "Manque" | "Cassé" | "Mal nettoyé") => {
    if (!associatedBox) return;
    const inst = associatedBox.instruments.find(i => i.reference === reference);
    if (!inst) return;

    setCheckedItems(prev => {
      const current = { ...prev[reference] };
      current.status = status;
      if (status !== "OK") {
        // Automatically default verified target count to flawed if appropriate
        if (status === "Manque") {
          current.checkedQuantity = Math.max(0, inst.quantity - 1);
        }
      } else {
        current.checkedQuantity = inst.quantity;
      }
      return { ...prev, [reference]: current };
    });
  };

  const handleQuantityAdjust = (reference: string, delta: number) => {
    if (!associatedBox) return;
    const inst = associatedBox.instruments.find(i => i.reference === reference);
    if (!inst) return;

    setCheckedItems(prev => {
      const current = { ...prev[reference] };
      const newQty = Math.max(0, Math.min(inst.quantity, current.checkedQuantity + delta));
      current.checkedQuantity = newQty;
      if (newQty < inst.quantity) {
        current.status = current.status === "OK" ? "Manque" : current.status;
      } else if (newQty === inst.quantity) {
        current.status = "OK";
      }
      return { ...prev, [reference]: current };
    });
  };

  const calculateCompliance = () => {
    if (!associatedBox) return { percent: 0, compliants: 0, totals: 0 };
    let compliants = 0;
    let totals = 0;

    associatedBox.instruments.forEach((inst) => {
      totals += inst.quantity;
      const checked = checkedItems[inst.reference];
      if (checked && checked.status === "OK") {
        compliants += checked.checkedQuantity;
      } else if (checked) {
        // only portion checked count
        compliants += checked.checkedQuantity;
      }
    });

    const percent = totals > 0 ? Math.round((compliants / totals) * 100) : 100;
    return { percent, compliants, totals };
  };

  const handleValidateCheckage = async () => {
    if (!activeTrk || !associatedBox) return;

    // Convert checking states back to the array shape
    const formattedInstruments = associatedBox.instruments.map(inst => {
      const state = checkedItems[inst.reference] || { checkedQuantity: inst.quantity, status: "OK" };
      return {
        reference: inst.reference,
        designation: inst.designation,
        expectedQuantity: inst.quantity,
        checkedQuantity: state.checkedQuantity,
        status: state.status
      };
    });

    const { percent } = calculateCompliance();
    const isConform = percent === 100;

    const payload = {
      trackingId: activeTrk.id,
      checkedInstruments: formattedInstruments,
      conformite: isConform,
      tempsCheckageSeconds: seconds,
      doneBy: currentUser.name
    };

    try {
      await onUpdatePropreTracking(payload);
      setActiveTrkId("");
      setIsTimerRunning(false);
      alert(`Vérification de composition validée ! L'état est maintenant 'PROPRE'. ${
        isConform ? "✅ Boîte 100% conforme." : "⚠️ Anomalies et manques enregistrés et synchronisés."
      }`);
    } catch (e: any) {
      console.error(e);
      alert("Erreur validation : " + e.message);
    }
  };

  const renderBoxIllustration = (name: string) => {
    // Generate beautiful SVGs showing clean clinical layouts dynamically
    return (
      <svg viewBox="0 0 100 80" className="w-24 h-20 text-slate-400 mx-auto" stroke="currentColor" fill="none" strokeWidth="1.5">
        <rect x="10" y="15" width="80" height="50" rx="4" className="stroke-indigo-600 fill-indigo-50/20" />
        <line x1="10" y1="35" x2="90" y2="35" className="stroke-indigo-200" />
        <rect x="25" y="45" width="20" height="8" rx="2" className="stroke-slate-400 fill-slate-100" />
        <circle cx="65" cy="49" r="6" className="stroke-emerald-600" />
        <circle cx="75" cy="49" r="6" className="stroke-emerald-600" />
        <path d="M 65 49 L 75 49" className="stroke-emerald-600" />
      </svg>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="propre-root">
      {/* Sidebar: pending lists of sterile components preparation */}
      <div className="lg:col-span-4 space-y-6">
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-100">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
            <h3 className="font-bold text-slate-800 text-base">Boîtes En Attente de Checkage ({pendingLogs.length})</h3>
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
          </div>

          {pendingLogs.length === 0 ? (
            <div className="text-center py-8 text-slate-400 space-y-2">
              <Compass className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-xs">Aucune boîte en attente de lavage / prédésinfection.</p>
              <p className="text-[10px] text-slate-400">Valider une réception depuis la Zone Sale d'abord.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {pendingLogs.map((log) => {
                const isSelected = activeTrkId === log.id;
                return (
                  <button
                    key={log.id}
                    type="button"
                    id={`active-trk-btn-${log.id}`}
                    onClick={() => setActiveTrkId(log.id)}
                    className={`w-full p-3.5 rounded-xl border text-left transition-all flex items-center justify-between ${
                      isSelected
                        ? "border-indigo-600 bg-indigo-50/70 shadow-xs"
                        : "border-slate-100 hover:border-slate-200 bg-slate-50/50"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-sm text-slate-800">{log.boxNumber}</span>
                        <span className="text-[10px] uppercase font-bold text-slate-400">Salle {log.saleDetails?.salle.replace("Salle ", "")}</span>
                      </div>
                      <span className="text-xs font-medium text-slate-600 block mt-0.5 truncate max-w-[170px]">{log.boxName}</span>
                      <span className="text-[10px] block font-mono text-slate-400 mt-1">Reçu à: {log.saleDetails?.heureReception}</span>
                    </div>
                    <ChevronRight className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isSelected ? "translate-x-1 text-indigo-600" : ""}`} />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Global Warnings Panel linked to multi use alert notifications */}
        <div className="bg-indigo-900 text-white p-5 rounded-2xl shadow-md space-y-3">
          <h4 className="font-bold text-xs uppercase tracking-wider text-indigo-200">Rôle de la Zone Propre</h4>
          <p className="text-xs text-indigo-100 leading-relaxed">
            Ici s'effectue le comptage rigoureux pièce par pièce. L'objectif est double : s'assurer de la propreté clinique après lavage ET déclarer immédiatement tout manque afin que les services operandi soient informés.
          </p>
          <div className="p-3 bg-indigo-800/65 rounded-xl border border-indigo-700 text-xs text-indigo-200">
            💡 <strong className="text-white">Synchro en temps réel :</strong> Tout instrument marqué en "Manque" ou "Cassé" génère une alerte globale synchronisée sur tous les comptes.
          </div>
        </div>
      </div>

      {/* Main Check-list Interface with Chronometer */}
      <div className="lg:col-span-8">
        {activeTrk && associatedBox ? (
          <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-xs border border-slate-100 space-y-6">
            
            {/* Header containing timer & details */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-indigo-600 text-white text-xs font-black rounded-lg">
                    {associatedBox.number}
                  </span>
                  <h2 className="text-xl font-bold text-slate-800">{associatedBox.name}</h2>
                </div>
                <p className="text-xs text-slate-500">
                  Boîte lavée en provenance de la <strong className="text-indigo-600 font-bold">{activeTrk.saleDetails?.salle}</strong>. Remplie par {activeTrk.saleDetails?.doneBy} (Lavage fini à: {activeTrk.saleDetails?.heureFinPredesinfectant})
                </p>
              </div>

              {/* Ticking timer representation */}
              <div id="chrono-wrapper" className="flex items-center gap-3 bg-slate-50 border border-slate-200 p-3 rounded-2xl self-start sm:self-center">
                <Timer className={`w-5 h-5 text-indigo-600 ${isTimerRunning ? "animate-pulse" : ""}`} />
                <div className="font-mono text-lg font-black text-slate-700 tracking-wider">
                  {formatTime(seconds)}
                </div>
                <div className="flex gap-1.5 border-l border-slate-200 pl-1.5">
                  <button
                    type="button"
                    id="timer-play-pause"
                    onClick={() => setIsTimerRunning(!isTimerRunning)}
                    className="p-1 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                    title={isTimerRunning ? "Pause" : "Démarrer"}
                  >
                    {isTimerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    id="timer-reset"
                    onClick={() => setSeconds(0)}
                    className="p-1 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Remettre à zéro"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Reference Visual Card & Info */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 p-4 bg-slate-50/50 rounded-2xl border border-slate-100 items-center">
              <div className="sm:col-span-3 text-center bg-white p-3 rounded-xl border border-slate-150">
                {renderBoxIllustration(associatedBox.name)}
                <span className="text-[10px] text-slate-400 font-bold block mt-1">Modèle de Référence</span>
              </div>
              
              <div className="sm:col-span-9 space-y-2">
                <h4 className="text-xs font-black text-indigo-700 uppercase tracking-wider">Spécifications d'Origine (Validation d'entrée)</h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  <div>
                    <span className="text-slate-400 font-medium">Poids d'origine attendu:</span>{" "}
                    <strong className="text-slate-700 font-semibold">{associatedBox.weight} kg</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Poids nettoyé reçu:</span>{" "}
                    <strong className="text-slate-700 font-semibold">{activeTrk.saleDetails?.poidsConclue} kg</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Nb instruments estimé:</span>{" "}
                    <strong className="text-slate-700 font-semibold">{associatedBox.instruments.reduce((s, i) => s + i.quantity, 0)} pcs</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Anomalie signalée sale:</span>{" "}
                    <strong className={`font-black ${activeTrk.saleDetails?.incident !== "Rien" ? "text-rose-600" : "text-emerald-600"}`}>
                      {activeTrk.saleDetails?.incident}
                    </strong>
                  </div>
                </div>
                {activeTrk.saleDetails?.commentaire && (
                  <p id="comment-from-sale-box" className="p-2 bg-yellow-50 text-yellow-800 text-xs rounded-lg border border-yellow-100 italic">
                    Remarque zone sale: "{activeTrk.saleDetails.commentaire}"
                  </p>
                )}
              </div>
            </div>

            {/* Instruments Checklist Table */}
            <div className="space-y-4">
              <h3 className="font-bold text-slate-800 text-base flex items-center justify-between">
                <span>Inventaire des Pinces & Outils de chirurgie</span>
                <span className="text-xs font-semibold text-slate-500">Sélectionner l'état et ajuster si manquant</span>
              </h3>

              <div className="space-y-3">
                {associatedBox.instruments.map((inst) => {
                  const itemState = checkedItems[inst.reference] || { checkedQuantity: inst.quantity, status: "OK" };
                  const isFaulty = itemState.status !== "OK";

                  return (
                    <div
                      key={inst.reference}
                      className={`p-4 rounded-xl border transition-all ${
                        isFaulty
                          ? "border-rose-200 bg-rose-50/40"
                          : "border-slate-100 hover:border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-mono text-indigo-600 font-extrabold tracking-wider bg-indigo-50 px-2 py-0.5 rounded-md">
                            {inst.reference}
                          </span>
                          <h4 className="font-bold text-slate-800 text-sm mt-1">{inst.designation}</h4>
                          <span className="text-xs text-slate-400 block font-semibold">
                            Quantité théorique attendue : <strong className="text-slate-700 font-extrabold">{inst.quantity}</strong>
                          </span>
                        </div>

                        {/* Interactive adjustment and status selectors */}
                        <div className="flex flex-wrap items-center gap-3">
                          {/* Quantity slider controller */}
                          <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
                            <button
                              type="button"
                              onClick={() => handleQuantityAdjust(inst.reference, -1)}
                              className="w-7 h-7 bg-white rounded-md flex items-center justify-center font-bold text-slate-600 hover:bg-slate-50 shadow-xs cursor-pointer"
                            >
                              -
                            </button>
                            <span className="w-10 text-center font-bold text-sm text-slate-800">
                              {itemState.checkedQuantity} / {inst.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleQuantityAdjust(inst.reference, 1)}
                              className="w-7 h-7 bg-white rounded-md flex items-center justify-center font-bold text-slate-600 hover:bg-slate-50 shadow-xs cursor-pointer"
                            >
                              +
                            </button>
                          </div>

                          {/* Status toggle select */}
                          <select
                            value={itemState.status}
                            onChange={(e) => handleStatusChange(inst.reference, e.target.value as any)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold focus:outline-hidden ${
                              itemState.status === "OK"
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                : itemState.status === "Manque"
                                ? "bg-red-100 text-red-800 border border-red-200"
                                : itemState.status === "Cassé"
                                ? "bg-amber-100 text-amber-800 border border-amber-200"
                                : "bg-purple-100 text-purple-800 border border-purple-200"
                            }`}
                          >
                            <option value="OK">Conforme (OK)</option>
                            <option value="Manque">Pince Manquante</option>
                            <option value="Cassé">Pince Cassée</option>
                            <option value="Mal nettoyé">Mal Nettoyé</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Calculations and submit action details */}
            <div className="pt-6 border-t border-slate-150 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div className="space-y-1">
                  <span className="text-xs text-slate-400 font-bold uppercase block tracking-wider">État Global et Conformité</span>
                  {calculateCompliance().percent === 100 ? (
                    <div className="flex items-center gap-2 text-emerald-700 font-extrabold text-sm">
                      <Check className="w-5 h-5" />
                      <span>Boîte 100% complète et nettoyée</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-rose-700 font-extrabold text-sm">
                      <AlertTriangle className="w-5 h-5 animate-bounce" />
                      <span>Conformité partielle de {calculateCompliance().percent}% (Anomalies signalées !)</span>
                    </div>
                  )}
                </div>

                <div className="text-right sm:text-right space-y-0.5">
                  <span className="text-xs text-slate-400 font-bold block">Durée de contrôle à cet instant</span>
                  <span className="font-mono text-indigo-600 font-bold text-base">{seconds} secondes</span>
                </div>
              </div>

              {/* Validation Submission Buttons */}
              <button
                type="button"
                id="validate-checkage-execution-btn"
                onClick={handleValidateCheckage}
                className={`w-full py-3.5 px-4 rounded-xl font-bold shadow-md uppercase text-sm inline-flex items-center justify-center gap-2 cursor-pointer transition-all ${
                  calculateCompliance().percent === 100
                    ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                    : "bg-rose-600 hover:bg-rose-700 text-white"
                }`}
              >
                <Check className="w-5 h-5" />
                Valider l'inventaire ({calculateCompliance().percent}% conforme)
              </button>
            </div>

          </div>
        ) : (
          <div className="bg-white px-6 py-16 rounded-2xl text-center border border-slate-100 flex flex-col items-center justify-center space-y-3">
            <FileText className="w-12 h-12 text-slate-300" />
            <h3 className="text-lg font-bold text-slate-700">Aucun cycle de checkage ouvert</h3>
            <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
              Sélectionnez une des boîtes en attente de checkage chirurgical dans la barre latérale pour lancer le comptage précis et le chronomètre automatique de conformité.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
