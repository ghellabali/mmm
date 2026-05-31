export interface User {
  id: string;
  login: string;
  name: string;
  role: "sale" | "propre" | "sterile" | "admin";
  pin: string;
  active: boolean;
}

export interface MasterInstrument {
  reference: string;
  designation: string;
  quantity: number;
}

export interface MasterBox {
  id: string;
  number: string;
  name: string;
  weight: number; // in kg, expected
  photo: string; // Base64 or standard asset template
  instruments: MasterInstrument[];
}

export interface BoxTrackingLog {
  id: string;
  boxId: string;
  boxNumber: string;
  boxName: string;
  status: "sale" | "propre" | "sterile" | "livree";
  saleDetails?: {
    salle: string; // e.g. "Salle 1" to "Salle 7"
    heureReception: string;
    heureFinPredesinfectant: string;
    poidsConclue: number;
    scorePince: number; // rapid check quantity
    incident: "Rien" | "Pince manquante" | "Pince cassée" | "Boîte incomplète" | "Instrument contaminé";
    commentaire: string;
    photoReelle?: string; // Captured camera image
    doneAt: string;
    doneBy: string;
  };
  propreDetails?: {
    checkedInstruments: {
      reference: string;
      designation: string;
      expectedQuantity: number;
      checkedQuantity: number; // quantity marked as OK
      status: "OK" | "Manque" | "Cassé" | "Mal nettoyé";
    }[];
    totalMissing: number;
    totalBroken: number;
    totalDirty: number;
    conformite: boolean;
    tempsCheckageSeconds: number;
    doneAt: string;
    doneBy: string;
  };
  sterileDetails?: {
    autoclaveNumber: string;
    cycleNumber: string;
    cycleType: string;
    heureChargement: string;
    heureDechargement: string;
    resultat: "Réussi" | "Échoué";
    doneAt: string;
    doneBy: string;
  };
  updates: {
    status: "sale" | "propre" | "sterile" | "livree";
    time: string;
    user: string;
    details: string;
  }[];
}

export interface AutoclaveCycleRecord {
  id: string;
  cycleNumber: string;
  autoclaveNumber: string;
  cycleType: string;
  heureChargement: string;
  heureDechargement: string;
  resultat: "Réussi" | "Échoué";
  boxesLoaded: { trackingId: string; boxNumber: string; name: string }[];
  diversProducts: {
    product: string;
    quantity: number;
  }[];
  doneBy: string;
  createdAt: string;
}

export interface ConsumableDelivery {
  id: string;
  service: string; // "Reanimation" / "Urgences" / "Chirurgie" / "Gynéco" / "Bloc" / "Radiologie" / "Gastro" / ...
  product: string; // "Compresse" / "Velpeau" / "Jersey" / ...
  quantity: number;
  date: string;
  doneBy: string;
}

export interface GlobalSettings {
  cycleTypes: string[];
  services: string[];
  diversProducts: string[];
  gmailEnabled?: boolean;
  gmailRecipient?: string;
  gmailClientId?: string;
  gmailClientSecret?: string;
  gmailToken?: string;
  gmailAlertOnAnomaly?: boolean;
  gmailAlertOnCycle?: boolean;
  gmailAlertOnDelivery?: boolean;
}

export interface GmailLog {
  id: string;
  subject: string;
  recipient: string;
  date: string;
  status: "success" | "error";
  error?: string;
  bodyPreview?: string;
}

export interface MissingAlert {
  id: string;
  boxNumber: string;
  boxName: string;
  instrumentDesignation: string;
  reference: string;
  status: "Manque" | "Cassé" | "Mal nettoyé";
  reportedBy: string;
  reportedAt: string;
  severity: "low" | "medium" | "high";
  acknowledged: boolean;
}
