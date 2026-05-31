import React, { useState, useEffect } from "react";
import { User, MasterBox, BoxTrackingLog, AutoclaveCycleRecord, ConsumableDelivery, GlobalSettings } from "../types";
import { Layers, ListPlus, Send, RefreshCw, Layers3, Check, CheckCircle2, ChevronRight, ShoppingCart, TrendingUp } from "lucide-react";

interface SterileInterfaceProps {
  currentUser: User;
  boxes: MasterBox[];
  trackingLogs: BoxTrackingLog[];
  recentCycles: AutoclaveCycleRecord[];
  recentConsumption: ConsumableDelivery[];
  globalSettings: GlobalSettings;
  onAddCycle: (payload: any) => Promise<void>;
  onAddConsumption: (payload: any) => Promise<void>;
  onDeliverBox: (trackingId: string, serviceDestinataire: string) => Promise<void>;
}

export default function SterileInterface({
  currentUser,
  boxes,
  trackingLogs,
  recentCycles,
  recentConsumption,
  globalSettings,
  onAddCycle,
  onAddConsumption,
  onDeliverBox
}: SterileInterfaceProps) {
  // Autoclave state elements
  const [cycleNumber, setCycleNumber] = useState("");
  const [autoclaveNumber, setAutoclaveNumber] = useState("Autoclave #1");
  const [cycleType, setCycleType] = useState("");
  const [heureChargement, setHeureChargement] = useState("");
  const [heureDechargement, setHeureDechargement] = useState("");
  const [resultat, setResultat] = useState<"Réussi" | "Échoué">("Réussi");
  const [selectedTrackingIds, setSelectedTrackingIds] = useState<string[]>([]);

  // Consumable transfer states
  const [transferService, setTransferService] = useState("");
  const [transferProduct, setTransferProduct] = useState("");
  const [transferQty, setTransferQty] = useState("");

  // Delivery of sterilised boxes to targeted services
  const [boxToDeliverId, setBoxToDeliverId] = useState("");
  const [serviceForBox, setServiceForBox] = useState("");

  // Populate default settings
  useEffect(() => {
    if (globalSettings.cycleTypes && globalSettings.cycleTypes.length > 0) {
      setCycleType(globalSettings.cycleTypes[0]);
    }
    if (globalSettings.services && globalSettings.services.length > 0) {
      setTransferService(globalSettings.services[0]);
      setServiceForBox(globalSettings.services[0]);
    }
    if (globalSettings.diversProducts && globalSettings.diversProducts.length > 0) {
      setTransferProduct(globalSettings.diversProducts[0]);
    }

    const now = new Date();
    setHeureChargement(now.toTimeString().substring(0, 5));
    // Default cycle completion time is +45 minutes later
    const end = new Date(now.getTime() + 45 * 60 * 1000);
    setHeureDechargement(end.toTimeString().substring(0, 5));

    // Dynamic cycle numbering
    setCycleNumber(`CYC-${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,"0")}${now.getDate().toString().padStart(2,"0")}-${Math.floor(Math.random()*900 + 100)}`);
  }, [globalSettings]);

  // Retrieve boxes in 'propre' state (cleaned, verified, and awaiting physical sterilization)
  const propreBoxes = trackingLogs.filter(t => t.status === "propre");
  // Retrieve boxes currently sterilized (status === 'sterile') awaiting direct deliver to clinical services
  const sterileBoxes = trackingLogs.filter(t => t.status === "sterile");

  const handleToggleBoxSelection = (trkId: string) => {
    setSelectedTrackingIds(prev => 
      prev.includes(trkId) ? prev.filter(id => id !== trkId) : [...prev, trkId]
    );
  };

  const handleCycleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTrackingIds.length === 0) {
      alert("Veuillez sélectionner au moins une boîte 'propre' à insérer dans l'autoclave.");
      return;
    }

    const payload = {
      cycleNumber,
      autoclaveNumber,
      cycleType,
      heureChargement,
      heureDechargement,
      resultat,
      boxesSelected: selectedTrackingIds,
      diversProducts: [], // Can register loaded products here too if needed
      doneBy: currentUser.name
    };

    try {
      await onAddCycle(payload);
      alert(`Cycle autoclave ${cycleNumber} enregistré avec succès (${resultat}) !`);
      
      // Setup next cycle number
      const now = new Date();
      setCycleNumber(`CYC-${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,"0")}${now.getDate().toString().padStart(2,"0")}-${Math.floor(Math.random()*900 + 100)}`);
      setSelectedTrackingIds([]);
    } catch (err: any) {
      alert("Erreur de sauvegarde autoclave: " + err.message);
    }
  };

  const handleConsumableSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qtyNum = parseInt(transferQty);
    if (!transferService || !transferProduct || isNaN(qtyNum) || qtyNum <= 0) {
      alert("Veuillez saisir une quantité valide supérieure à zéro.");
      return;
    }

    const payload = {
      service: transferService,
      product: transferProduct,
      quantity: qtyNum,
      doneBy: currentUser.name
    };

    try {
      await onAddConsumption(payload);
      setTransferQty("");
      alert(`Transfert de ${qtyNum} de ${transferProduct} vers le service '${transferService}' validé !`);
    } catch (err: any) {
      alert("Erreur transfert : " + err.message);
    }
  };

  const handleBoxDeliverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!boxToDeliverId || !serviceForBox) {
      alert("Sélectionner une boîte stérile et un service destinataire.");
      return;
    }

    try {
      await onDeliverBox(boxToDeliverId, serviceForBox);
      setBoxToDeliverId("");
      alert("La boîte d'instruments a été livrée et livrée en direct au service !");
    } catch (err: any) {
      alert("Erreur livraison : " + err.message);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-8" id="sterile-root">
      
      {/* Autoclave Cycle validation card */}
      <div className="xl:col-span-8 bg-white p-6 sm:p-8 rounded-2xl shadow-xs border border-slate-100 space-y-6">
        <div className="flex items-center gap-2 mb-2 pb-4 border-b border-slate-100">
          <Layers3 className="w-6 h-6 text-indigo-600" />
          <h2 className="text-xl font-bold text-slate-800">Gestion de Charge Autoclave (Désinfection Ultime)</h2>
        </div>

        <form onSubmit={handleCycleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="cycle-number" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Numéro Unique de Cycle</label>
              <input
                type="text"
                id="cycle-number"
                required
                value={cycleNumber}
                onChange={(e) => setCycleNumber(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold bg-slate-50"
              />
            </div>

            <div>
              <label htmlFor="autoclave-select" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Appareil Autoclave</label>
              <select
                id="autoclave-select"
                value={autoclaveNumber}
                onChange={(e) => setAutoclaveNumber(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-600 bg-white"
              >
                <option value="Autoclave #1 (Principal)">Autoclave #1 (Principal)</option>
                <option value="Autoclave #2 (Secondaire)">Autoclave #2 (Secondaire)</option>
                <option value="Autoclave #3 (Rapide)">Autoclave #3 (Rapide)</option>
              </select>
            </div>

            <div>
              <label htmlFor="cycle-type-select" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Type de Cycle Thérapeutique</label>
              <select
                id="cycle-type-select"
                value={cycleType}
                onChange={(e) => setCycleType(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-600 bg-white capitalize font-semibold text-slate-700"
              >
                {globalSettings.cycleTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="heure-chargement" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Heure de Chargement</label>
              <input
                type="time"
                id="heure-chargement"
                required
                value={heureChargement}
                onChange={(e) => setHeureChargement(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm"
              />
            </div>

            <div>
              <label htmlFor="heure-dechargement" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Heure de Déchargement</label>
              <input
                type="time"
                id="heure-dechargement"
                required
                value={heureDechargement}
                onChange={(e) => setHeureDechargement(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm"
              />
            </div>

            <div>
              <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Résultat Physico-Chimique (Intégrateur)</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  id="cycle-success-btn"
                  onClick={() => setResultat("Réussi")}
                  className={`flex-1 py-2 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                    resultat === "Réussi"
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  Déroulement Réussi
                </button>
                <button
                  type="button"
                  id="cycle-failed-btn"
                  onClick={() => setResultat("Échoué")}
                  className={`flex-1 py-2 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                    resultat === "Échoué"
                      ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  Déroulement Échoué
                </button>
              </div>
            </div>
          </div>

          {/* Selector of boxes in 'propre' state */}
          <div className="space-y-3">
            <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Sélectionner les Boites à Chargées ({propreBoxes.length} disponibles)</span>
            {propreBoxes.length === 0 ? (
              <div className="p-6 bg-slate-50 rounded-xl text-center border border-dashed border-slate-200 text-xs text-slate-400">
                Aucune boîte d'instrument n'est disponible en état de checkage validé (propre). 
                Complétez les checklists de la Zone Propre d'abord.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[190px] overflow-y-auto p-1">
                {propreBoxes.map((pBox) => {
                  const isChecked = selectedTrackingIds.includes(pBox.id);
                  return (
                    <button
                      key={pBox.id}
                      type="button"
                      id={`select-propre-box-${pBox.id}`}
                      onClick={() => handleToggleBoxSelection(pBox.id)}
                      className={`p-3.5 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                        isChecked
                          ? "border-emerald-600 bg-emerald-50/50"
                          : "border-slate-150 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div>
                        <span className="font-extrabold text-sm text-slate-800">{pBox.boxNumber}</span>
                        <span className="text-xs font-semibold text-slate-600 block truncate">{pBox.boxName}</span>
                        <span className="text-[10px] block font-mono text-slate-400 mt-0.5">Vérifié par: {pBox.propreDetails?.doneBy}</span>
                      </div>
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                        isChecked ? "bg-emerald-600 border-emerald-600 text-white" : "border-slate-300 bg-slate-50"
                      }`}>
                        {isChecked && <Check className="w-3 h-3" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button
            type="submit"
            id="register-cycle-submit-btn"
            disabled={selectedTrackingIds.length === 0}
            className={`w-full py-3.5 px-4 rounded-xl font-bold uppercase text-sm block cursor-pointer text-center shadow-md transition-all ${
              selectedTrackingIds.length > 0
                ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            }`}
          >
            Saisir le cycle et stériliser les boîtes cochées
          </button>
        </form>
      </div>

      {/* Consumable Deliveries Side Module */}
      <div className="xl:col-span-4 space-y-6">
        
        {/* Box Delivery Module to Surgical Departments */}
        <div id="box-deliveries-terminal" className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-teal-100">
            <CheckCircle2 className="w-5 h-5 text-teal-600" />
            <h3 className="font-bold text-slate-800 text-sm">Transfert de Boîte vers Service</h3>
          </div>

          {sterileBoxes.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Aucune boîte stérile prête pour livraison immédiate.</p>
          ) : (
            <form onSubmit={handleBoxDeliverySubmit} className="space-y-4">
              <div>
                <label htmlFor="box-to-deliver" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Boîte Stérile Dispo *</label>
                <select
                  id="box-to-deliver"
                  required
                  value={boxToDeliverId}
                  onChange={(e) => setBoxToDeliverId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 bg-white"
                >
                  <option value="">-- Choisir la boîte --</option>
                  {sterileBoxes.map((sb) => (
                    <option key={sb.id} value={sb.id}>
                      {sb.boxNumber} — {sb.boxName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="service-for-box" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Service Clinique Client *</label>
                <select
                  id="service-for-box"
                  required
                  value={serviceForBox}
                  onChange={(e) => setServiceForBox(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 bg-white"
                >
                  {globalSettings.services.map((srv) => (
                    <option key={srv} value={srv}>{srv}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                id="box-delivery-submit-btn"
                className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 rounded-xl text-xs uppercase"
              >
                Livrer la Boîte
              </button>
            </form>
          )}
        </div>

        {/* Consumables (Produits Divers) panel */}
        <div id="consumables-terminal" className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-indigo-100">
            <ShoppingCart className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-800 text-sm">Transfert de Consommables (Produits Divers)</h3>
          </div>

          <form onSubmit={handleConsumableSubmit} className="space-y-4">
            <div>
              <label htmlFor="transfer-product-select" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Produit Divers / Matériel</label>
              <select
                id="transfer-product-select"
                value={transferProduct}
                onChange={(e) => setTransferProduct(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 bg-white"
              >
                {globalSettings.diversProducts.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="transfer-service-select" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-sans">Service Destinataire</label>
                <select
                  id="transfer-service-select"
                  value={transferService}
                  onChange={(e) => setTransferService(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 bg-white"
                >
                  {globalSettings.services.map((srv) => (
                    <option key={srv} value={srv}>{srv}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="transfer-qty-input" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Quantité</label>
                <input
                  type="number"
                  placeholder="Ex: 50"
                  id="transfer-qty-input"
                  min="1"
                  required
                  value={transferQty}
                  onChange={(e) => setTransferQty(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200"
                />
              </div>
            </div>

            <button
              type="submit"
              id="consumable-submit-btn"
              className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 rounded-xl text-xs uppercase"
            >
              Enregistrer le Transfert
            </button>
          </form>

          {/* Quick stock tracking list recent */}
          <div className="pt-4 border-t border-slate-100">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-2">Historique du jour (Consomables)</span>
            <div className="space-y-1.5 max-h-[142px] overflow-y-auto pr-1">
              {recentConsumption.slice(0, 4).map((rc) => (
                <div key={rc.id} className="text-[11px] flex justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="font-semibold text-slate-700">{rc.product} ({rc.quantity})</span>
                  <span className="text-indigo-600 font-bold">👉 {rc.service}</span>
                </div>
              ))}
              {recentConsumption.length === 0 && (
                <span className="text-[10px] text-slate-400 italic block">Aucun transfert récent enregistré.</span>
              )}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
