import React, { useState, useRef, useEffect } from "react";
import { MasterBox, User, BoxTrackingLog } from "../types";
import { Clipboard, Camera, AlertTriangle, CheckCircle, Search, RefreshCw } from "lucide-react";

interface SaleInterfaceProps {
  currentUser: User;
  boxes: MasterBox[];
  onAddTracking: (trackingData: any) => Promise<void>;
  recentTracking: BoxTrackingLog[];
}

export default function SaleInterface({
  currentUser,
  boxes,
  onAddTracking,
  recentTracking
}: SaleInterfaceProps) {
  const [selectedBoxId, setSelectedBoxId] = useState("");
  const [salle, setSalle] = useState("Salle 1");
  const [heureReception, setHeureReception] = useState("");
  const [heureFinPredesinfectant, setHeureFinPredesinfectant] = useState("");
  const [poidsConclue, setPoidsConclue] = useState("");
  const [scorePince, setScorePince] = useState("");
  const [incident, setIncident] = useState<any>("Rien");
  const [commentaire, setCommentaire] = useState("");
  const [photoReelle, setPhotoReelle] = useState<string | null>(null);

  // Search/Scan barcode mockup
  const [scanQuery, setScanQuery] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState("");

  // Webcam states
  const [useWebcam, setUseWebcam] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState("");

  const selectedBox = boxes.find((b) => b.id === selectedBoxId);

  // Set default hours on load
  useEffect(() => {
    const now = new Date();
    const hhmm = now.toTimeString().substring(0, 5);
    setHeureReception(hhmm);

    // Default pre-disinfectant +20 minutes later
    const endMinutes = now.getMinutes() + 20;
    const endDate = new Date(now.getTime());
    endDate.setMinutes(endMinutes);
    setHeureFinPredesinfectant(endDate.toTimeString().substring(0, 5));
  }, []);

  // Sync default box parameters on change
  useEffect(() => {
    if (selectedBox) {
      setPoidsConclue((selectedBox.weight + (Math.random() * 0.1 - 0.05)).toFixed(2));
      const totalTheoreticalInstruments = selectedBox.instruments.reduce((sum, inst) => sum + inst.quantity, 0);
      setScorePince(totalTheoreticalInstruments.toString());
    } else {
      setPoidsConclue("");
      setScorePince("");
    }
  }, [selectedBoxId]);

  // Clean webcam on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handleStartCamera = async () => {
    setCameraError("");
    try {
      setUseWebcam(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      console.error(err);
      setCameraError("Caméra inaccessible. Utilisation du simulateur haute fidélité.");
      // Simulated camera logic: Generate a simulated captured image
      simulatePhoto();
    }
  };

  const simulatePhoto = () => {
    // Generate a high fidelity blueprint of surgical box
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(0, 0, 320, 240);
      // draw box container
      ctx.strokeStyle = "#a7f3d0";
      ctx.lineWidth = 4;
      ctx.strokeRect(40, 40, 240, 160);
      // grid lines inside box
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1;
      for (let i = 60; i < 280; i += 30) {
        ctx.beginPath();
        ctx.moveTo(i, 40);
        ctx.lineTo(i, 200);
        ctx.stroke();
      }
      // write text details
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 14px monospace";
      ctx.fillText(`BOX ID: ${selectedBox?.number || "B-TEST"}-${Math.floor(Math.random()*90 + 10)}`, 55, 75);
      ctx.fillStyle = "#34d399";
      ctx.font = "11px sans-serif";
      ctx.fillText(`CLINIQUE ALOUIA — ZONE SALE`, 55, 100);
      ctx.fillText(`POIDS: ${poidsConclue || "0.0"} KG`, 55, 120);
      ctx.fillText("PREDESINFECTION OK", 55, 140);
      ctx.fillStyle = "#f87171";
      ctx.fillText(`Dépôt: ${salle}`, 55, 165);

      setPhotoReelle(canvas.toDataURL("image/jpeg"));
    }
  };

  const handleCaptureSnapshot = () => {
    if (videoRef.current && streamRef.current) {
      const canvas = canvasRef.current || document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        
        // Watermark with timestamp and Clinique metadata
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(0, canvas.height - 40, canvas.width, 40);
        ctx.fillStyle = "#10b981";
        ctx.font = "bold 14px sans-serif";
        ctx.fillText(`CLINIQUE ALOUIA - ${selectedBox?.number || "B-03"} - REP: ${heureReception}`, 15, canvas.height - 15);

        setPhotoReelle(canvas.toDataURL("image/jpeg"));
        // Stop camera tracks
        streamRef.current.getTracks().forEach((track) => track.stop());
        setUseWebcam(false);
      }
    } else {
      simulatePhoto();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoReelle(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBarcodeSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setScanMessage("");
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      const query = scanQuery.toUpperCase().trim();
      const matched = boxes.find(
        (b) => b.number.toUpperCase() === query || b.name.toLowerCase().includes(query.toLowerCase())
      );
      if (matched) {
        setSelectedBoxId(matched.id);
        setScanMessage(`✅ Boîte trouvée : ${matched.name} (${matched.number})`);
      } else {
        setScanMessage("❌ Aucun instrument ou boîte ne correspond au code.");
      }
    }, 800);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBoxId) {
      alert("Veuillez sélectionner ou scanner une boîte opératoire.");
      return;
    }

    const payload = {
      boxId: selectedBoxId,
      salle,
      heureReception,
      heureFinPredesinfectant,
      poidsConclue: parseFloat(poidsConclue) || 0,
      scorePince: parseInt(scorePince) || 0,
      incident,
      commentaire,
      photoReelle: photoReelle || "",
      doneBy: currentUser.name
    };

    try {
      await onAddTracking(payload);
      // clean form
      setSelectedBoxId("");
      setPhotoReelle(null);
      setCommentaire("");
      setScanQuery("");
      setScanMessage("");
      setIncident("Rien");
      alert("Réception et prédésinfection de la boîte enregistrées avec succès !");
    } catch (err: any) {
      console.error(err);
      alert("Erreur lors de la sauvegarde: " + err.message);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="sale-root">
      {/* Simulation scanning layout */}
      <div className="lg:col-span-4 space-y-6">
        <div id="scan-qr-section" className="bg-white p-6 rounded-2xl shadow-xs border border-slate-100">
          <div className="flex items-center gap-2 mb-4">
            <Search className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-800 text-lg">Mode 1 : Scan Rapide (QR Code / Manuel)</h3>
          </div>
          <p className="text-xs text-slate-500 mb-4 leading-relaxed">
            Scanner le QR code de la boîte ou saisissez son numéro physique pour charger ses paramètres de référence (poids, photo, inventaire).
          </p>

          <form onSubmit={handleBarcodeSearch} className="space-y-3">
            <div className="relative">
              <input
                type="text"
                id="search-box-input"
                placeholder="Ex: B-03, Ortho..."
                value={scanQuery}
                onChange={(e) => setScanQuery(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-600"
              />
              <button
                type="submit"
                id="search-box-submit-btn"
                className="absolute right-2 top-2 bg-indigo-50 text-indigo-600 p-1.5 rounded-lg hover:bg-indigo-100 transition-colors text-xs font-semibold"
              >
                Rechercher
              </button>
            </div>
          </form>

          {isScanning && (
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 justify-center">
              <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
              <span>Interrogation de la base de données...</span>
            </div>
          )}

          {scanMessage && (
            <div className={`mt-4 p-3 rounded-xl text-xs font-medium ${scanMessage.includes("✅") ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
              {scanMessage}
            </div>
          )}

          {/* Quick Shortcuts */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <span className="text-xs font-semibold text-slate-400 block mb-3 uppercase tracking-wider">Accès Instantané Clinique</span>
            <div className="grid grid-cols-2 gap-2">
              {boxes.slice(0, 4).map((b) => (
                <button
                  key={b.id}
                  type="button"
                  id={`shortcut-box-${b.id}`}
                  onClick={() => {
                    setSelectedBoxId(b.id);
                    setScanQuery(b.number);
                    setScanMessage(`✅ Sélection rapide : ${b.number}`);
                  }}
                  className={`px-3 py-2 text-xs font-medium rounded-xl border text-left transition-all ${
                    selectedBoxId === b.id
                      ? "border-indigo-600 bg-indigo-50/50 text-indigo-700"
                      : "border-slate-100 hover:border-slate-200 bg-slate-50 text-slate-600"
                  }`}
                >
                  <span className="font-bold block text-slate-800">{b.number}</span>
                  <span className="truncate block font-normal opacity-85">{b.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Live System Alerts Warning Indicator */}
        <div className="bg-amber-50/50 p-6 rounded-2xl border border-amber-200/50">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-amber-900 text-sm">Zone Sale — Sécurité d'Exposition</h4>
              <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                Port des équipements de protection obligatoire (gants, tablier étanche, lunettes de sécurité). 
                Chaque boîte reçue doit être immergée dans la solution de prédésinfection pendant 15 minutes minimum.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main log form */}
      <div className="lg:col-span-8 bg-white p-6 sm:p-8 rounded-2xl shadow-xs border border-slate-100">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100 justify-between">
          <div className="flex items-center gap-2">
            <Clipboard className="w-6 h-6 text-emerald-600" />
            <h2 className="text-xl font-bold text-slate-800">Formulaire de Réception & Prédésinfection</h2>
          </div>
          <span className="px-3 py-1 bg-rose-50 text-rose-700 rounded-full font-semibold text-xs border border-rose-100 capitalize">
            Auteur: {currentUser.name}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="box-id-select" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Choisir la Boîte d'Instrument *</label>
              <select
                id="box-id-select"
                required
                value={selectedBoxId}
                onChange={(e) => setSelectedBoxId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-600 focus:outline-hidden bg-slate-50 font-medium"
              >
                <option value="">-- Sélectionner --</option>
                {boxes.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.number} — {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="salle-select" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Provenance (Salle Opératoire)</label>
              <select
                id="salle-select"
                value={salle}
                onChange={(e) => setSalle(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-600 focus:outline-hidden bg-slate-50 font-medium"
              >
                {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                  <option key={num} value={`Salle ${num}`}>
                    Salle {num}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="heure-reception" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Heure Réception (Entrée)</label>
              <input
                type="time"
                id="heure-reception"
                required
                value={heureReception}
                onChange={(e) => setHeureReception(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-600 focus:outline-hidden"
              />
            </div>

            <div>
              <label htmlFor="heure-fin-predesinfectant" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Heure Fin Prédésinfectant</label>
              <input
                type="time"
                id="heure-fin-predesinfectant"
                required
                value={heureFinPredesinfectant}
                onChange={(e) => setHeureFinPredesinfectant(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-600 focus:outline-hidden"
              />
            </div>
          </div>

          {selectedBox && (
            <div className="p-4 bg-indigo-50/40 rounded-xl border border-indigo-100 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-indigo-700 block uppercase tracking-wider">Données Théoriques de la Boîte</span>
                <span className="text-sm font-semibold text-slate-800 mt-1 block">
                  {selectedBox.name} : {selectedBox.weight} kg attendu | {selectedBox.instruments.reduce((sum, i) => sum + i.quantity, 0)} instruments totaux.
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs text-indigo-600 block font-medium">Contrôle Rapide auto-rempli</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="weight-check" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Poids Constaté (kg) {selectedBox && <span className="text-xs font-normal text-slate-400">(Ampleur ~{selectedBox.weight} kg)</span>}
              </label>
              <input
                type="number"
                id="weight-check"
                step="0.01"
                placeholder="Ex: 4.25"
                required
                value={poidsConclue}
                onChange={(e) => setPoidsConclue(e.target.value)}
                className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-600 ${
                  selectedBox && Math.abs(parseFloat(poidsConclue) - selectedBox.weight) > 0.4
                    ? "border-rose-400 bg-rose-50 text-rose-800 focus:ring-rose-500"
                    : "border-slate-200"
                }`}
              />
              {selectedBox && Math.abs(parseFloat(poidsConclue) - selectedBox.weight) > 0.4 && (
                <span id="weight-alert-span" className="text-xs text-rose-600 font-semibold block mt-1.5">
                  ⚠️ Poids anormal détecté (écart supérieur de 400g au poids d'origine de {selectedBox.weight} kg !).
                </span>
              )}
            </div>

            <div>
              <label htmlFor="pince-check" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nombre d'Instruments Comptés</label>
              <input
                type="number"
                id="pince-check"
                placeholder="Ex: 22"
                required
                value={scorePince}
                onChange={(e) => setScorePince(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-600 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="incident-select" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Anomalie Constatée ?</label>
              <select
                id="incident-select"
                value={incident}
                onChange={(e) => setIncident(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-600 focus:outline-hidden bg-slate-50 font-semibold text-slate-700"
              >
                <option value="Rien">Aucun (En ordre)</option>
                <option value="Pince manquante">Pince manquante</option>
                <option value="Pince cassée">Pince cassée</option>
                <option value="Boîte incomplète">Boîte incomplète</option>
                <option value="Instrument contaminé">Instrument contaminé / Souillé</option>
              </select>
            </div>

            <div>
              <label htmlFor="commentaire-input" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Commentaires / Précision</label>
              <input
                type="text"
                id="commentaire-input"
                placeholder="Décrire l'instrument défectueux ou remarques..."
                value={commentaire}
                onChange={(e) => setCommentaire(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-600 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Photo & Capture system */}
          <div className="p-5 border border-slate-100 rounded-2xl bg-slate-50/50">
            <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Prise de Photo Réelle (Appareil / Simulateur)</span>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-4 bg-white min-h-[160px] relative">
                {photoReelle ? (
                  <div className="relative w-full max-w-[280px]">
                    <img
                      src={photoReelle}
                      alt="Aperçu boîte reçue"
                      id="real-captured-preview"
                      className="rounded-lg object-cover w-full h-[150px] shadow-xs"
                    />
                    <button
                      type="button"
                      id="reset-photo-btn"
                      onClick={() => setPhotoReelle(null)}
                      className="absolute -top-2 -right-2 bg-rose-600 hover:bg-rose-700 text-white rounded-full p-1 shadow-md text-xs font-bold"
                    >
                      Supprimer
                    </button>
                  </div>
                ) : useWebcam ? (
                  <div className="relative w-full max-w-[280px] text-center">
                    <video
                      ref={videoRef}
                      id="live-webcam-stream"
                      className="w-full h-[150px] bg-black rounded-lg object-cover"
                      playsInline
                      muted
                    ></video>
                    <button
                      type="button"
                      id="capture-snap-btn"
                      onClick={handleCaptureSnapshot}
                      className="mt-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-lg font-bold"
                    >
                      Prendre la photo
                    </button>
                    <canvas ref={canvasRef} className="hidden"></canvas>
                  </div>
                ) : (
                  <div className="text-center space-y-2">
                    <Camera className="w-8 h-8 text-slate-400 mx-auto" />
                    <span className="text-xs text-slate-500 block">Aucun cliché enregistré</span>
                    <button
                      type="button"
                      id="start-camera-btn"
                      onClick={handleStartCamera}
                      className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-semibold inline-flex items-center gap-1.5"
                    >
                      Démarrer la Caméra
                    </button>
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-3 shrink-0 flex flex-col justify-center">
                <p className="text-xs text-slate-500 leading-relaxed">
                  Vous pouvez soit connecter un périphérique de capture (Caméra intégrée/Webcam), soit téléverser une image de diagnostic existante :
                </p>
                
                <div>
                  <input
                    type="file"
                    id="sale-file-upload"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                  />
                </div>

                {cameraError && (
                  <span className="text-[10px] text-amber-600 font-medium block">
                    ⚠️ {cameraError}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="submit"
            id="register-sale-submit-btn"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all inline-flex items-center justify-center gap-2 text-sm uppercase"
          >
            <CheckCircle className="w-5 h-5" />
            Enregistrer la réception & lancer la désinfection
          </button>
        </form>
      </div>
    </div>
  );
}
