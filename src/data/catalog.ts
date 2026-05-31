import { MasterBox, User, GlobalSettings } from "../types";

export const SEED_USERS: User[] = [
  { id: "u_1", login: "chef_bloc", name: "Dr. Alouis Ali (Chef)", role: "admin", pin: "1234", active: true },
  { id: "u_2", login: "op_sale", name: "Amine S. (Zone Sale)", role: "sale", pin: "1111", active: true },
  { id: "u_3", login: "op_propre", name: "Yasmine K. (Zone Propre)", role: "propre", pin: "2222", active: true },
  { id: "u_4", login: "op_sterile", name: "Karim T. (Zone Stérile)", role: "sterile", pin: "3333", active: true }
];

export const DEFAULT_SETTINGS: GlobalSettings = {
  cycleTypes: [
    "Rapid 134",
    "Textile 134",
    "Instrument SD134",
    "Plastique 121",
    "Bowie Dick 134",
    "Test vide",
    "Coelio 121"
  ],
  services: [
    "Bloc",
    "Réanimation",
    "Urgences",
    "Chirurgie",
    "Gynécologie",
    "Radiologie",
    "Gastro-entérologie"
  ],
  diversProducts: [
    "Compresse stérile",
    "Bande Velpeau",
    "Jersey chirurgical",
    "Manche bistouri",
    "Tuyau aspiration",
    "Tuyau respirateur"
  ],
  gmailEnabled: false,
  gmailRecipient: "ghellabali81500@gmail.com",
  gmailClientId: "",
  gmailClientSecret: "",
  gmailToken: "",
  gmailAlertOnAnomaly: true,
  gmailAlertOnCycle: true,
  gmailAlertOnDelivery: false
};

export const SEED_BOXES: MasterBox[] = [
  {
    id: "box_1",
    number: "B-03",
    name: "Boîte Neuro 03",
    weight: 4.2, // normal weight in kg
    photo: "neuro_03", // placeholder logic for premium visual SVG style representatons
    instruments: [
      { reference: "KCH-01", designation: "Pince Kelly droite", quantity: 5 },
      { reference: "KCH-02", designation: "Pince Kelly courbe", quantity: 5 },
      { reference: "PM-01", designation: "Porte aiguille Mayo-Hegar", quantity: 2 },
      { reference: "CS-04", designation: "Ciseaux Metzenbaum", quantity: 2 },
      { reference: "PE-08", designation: "Pince Kocher droite", quantity: 4 },
      { reference: "DP-10", designation: "Dissecteur fin à griffe", quantity: 2 }
    ]
  },
  {
    id: "box_2",
    number: "B-07",
    name: "Boîte Ortho Majeure",
    weight: 6.8,
    photo: "ortho_majeure",
    instruments: [
      { reference: "CO-11", designation: "Ciseau à os Lambert", quantity: 2 },
      { reference: "RU-15", designation: "Rongeur double articulation", quantity: 2 },
      { reference: "PC-30", designation: "Pince Kocher courbe", quantity: 6 },
      { reference: "DA-02", designation: "Davier auto-centreur", quantity: 2 },
      { reference: "PM-03", designation: "Porte-aiguille Mayo grand", quantity: 2 },
      { reference: "RT-05", designation: "Écarteur Farabeuf large", quantity: 4 }
    ]
  },
  {
    id: "box_3",
    number: "B-12",
    name: "Boîte Coelioscopie Standard",
    weight: 5.5,
    photo: "coelio_std",
    instruments: [
      { reference: "TC-01", designation: "Trocart standard 10mm", quantity: 3 },
      { reference: "TC-02", designation: "Trocart de rechange 5mm", quantity: 2 },
      { reference: "PC-12", designation: "Pince à préhension fenêtrée", quantity: 4 },
      { reference: "CI-03", designation: "Ciseaux Coelio droits", quantity: 2 },
      { reference: "CP-05", designation: "Canule aspiration-lavage", quantity: 1 }
    ]
  },
  {
    id: "box_4",
    number: "B-09",
    name: "Boîte Chirurgie Plastique",
    weight: 1.8,
    photo: "plastique_fine",
    instruments: [
      { reference: "CS-01", designation: "Ciseaux micro-chirurgicaux", quantity: 2 },
      { reference: "DP-01", designation: "Pince Adson fine sans griffe", quantity: 2 },
      { reference: "DP-02", designation: "Pince Adson fine avec griffe", quantity: 2 },
      { reference: "PM-05", designation: "Micro porte-aiguille Castroviejo", quantity: 1 },
      { reference: "PC-04", designation: "Pince Halsted moustique droite", quantity: 4 }
    ]
  },
  {
    id: "box_5",
    number: "B-15",
    name: "Boîte Accouchement / Gynéco",
    weight: 3.1,
    photo: "gyneco_acc",
    instruments: [
      { reference: "PG-20", designation: "Pince de Museux droite", quantity: 2 },
      { reference: "PC-15", designation: "Clamp de Pozzi oblique", quantity: 2 },
      { reference: "PM-10", designation: "Porte aiguille Mayo robuste", quantity: 2 },
      { reference: "CS-12", designation: "Ciseaux d'épisiotomie", quantity: 1 },
      { reference: "PA-02", designation: "Pince à pansement Winter", quantity: 2 }
    ]
  }
];
