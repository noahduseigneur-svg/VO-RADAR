import type { ReliabilityRating } from "./types";

// Base de fiabilité moteur — pour scoring "intransigeant" côté concession.
// Chaque profil :
//  - id stable (utilisé pour debugging / docs)
//  - patterns regex qui matchent dans la désignation moteur ou la version
//  - rating + score_adjustment qui module le score final
//  - issues : les vrais problèmes connus (sources : recalls, class actions, forums concession)
//  - inspect : ce qu'un acheteur pro doit vérifier en pré-achat
//  - fix_cost : ordre de grandeur d'une remise en état si l'issue tombe
//  - resale_risk : impact sur la revente (concession qui rachète prend le risque)
//
// Cette table est curée à la main et reflète la connaissance terrain 2024-2026.
// Elle doit être maintenue (nouveaux modèles, retours d'incidents).

export interface EngineProfile {
  id: string;
  brands: string[];                  // marques où ce moteur apparaît
  patterns: RegExp[];                // patterns sur (version + engine_designation)
  rating: ReliabilityRating;
  score_adjustment: number;          // -25..+12
  issues: string[];
  inspect: string[];
  fix_cost: "low" | "medium" | "high" | "engine-out";
  resale_risk: "low" | "medium" | "high";
  notes?: string;
}

const ENGINES: EngineProfile[] = [
  // ============================================================
  // STELLANTIS / PSA — ÉVITER absolument
  // ============================================================
  {
    id: "psa-puretech-eb2-belt-in-oil",
    brands: ["peugeot", "citroen", "ds", "opel"],
    // 1.2 PureTech 75/82/100/110/130 PRE-2023 (courroie humide)
    patterns: [/1\.?2\s*PureTech/i, /\bPureTech\s*(?:75|82|100|110|130)\b/i, /EB2(?:DT[S]?)?(?:F|H)?\b/i],
    rating: "avoid",
    score_adjustment: -22,
    issues: [
      "Courroie de distribution baignant dans l'huile (« courroie humide ») qui se désagrège",
      "Débris de courroie qui obstruent la crépine et tuent la lubrification → moteur cassé",
      "Casse moteur fréquente entre 80 000 et 150 000 km",
      "Recall Stellantis 2023 + action collective en cours (Que Choisir)",
    ],
    inspect: [
      "Demander la date du dernier remplacement courroie (idéalement < 60 000 km depuis)",
      "Vérifier les factures : si pas de remplacement préventif, FUIR (sauf moteur < 30 000 km)",
      "Brancher OBD, lire historique défauts injection/distribution",
      "Vérifier consommation d'huile (jauge entre vidanges)",
    ],
    fix_cost: "engine-out",
    resale_risk: "high",
    notes: "À partir de fin 2023, Stellantis a remplacé par une chaîne. Vérifier le code moteur exact.",
  },
  {
    id: "renault-1.2-tce-h5ft",
    brands: ["renault", "dacia", "nissan"],
    // H5Ft : Clio IV, Captur I, Megane III/IV, Kadjar, Scenic IV, Qashqai II
    patterns: [/1\.?2\s*TCe/i, /\bTCe\s*(?:115|120|125|130)\b/i, /H5Ft/i],
    rating: "avoid",
    score_adjustment: -18,
    issues: [
      "Chaîne de distribution qui s'étire prématurément (60-130 000 km)",
      "Consommation d'huile excessive (jusqu'à 1 L / 1 000 km)",
      "Turbocompresseur fragile sur les versions 130 ch",
      "Calage moteur si la chaîne saute → soupapes cassées",
    ],
    inspect: [
      "Écouter le moteur à froid (cliquetis de chaîne caractéristique)",
      "Vérifier niveau d'huile + couleur (boue = sous-entretien)",
      "Lire la consommation d'huile dans le carnet ou demander un test",
      "OBD : check codes P0011/P0014 (calage variable)",
    ],
    fix_cost: "high",
    resale_risk: "high",
    notes: "TCe 90 (H4Bt) est OK, TCe 100/115/130 du H5Ft est à risque.",
  },
  // ============================================================
  // VOLKSWAGEN GROUP — Surveiller les EA111
  // ============================================================
  {
    id: "vag-ea111-1.4-tsi-twincharger",
    brands: ["volkswagen", "audi", "seat", "skoda"],
    // 1.4 TSI twincharger CAVA/CAVC/CAVD/CAVE (2009-2014)
    // Pattern stricte sur la cylindrée pour ne pas matcher 1.5 TSI / 2.0 TSI
    patterns: [/\b1[.,]4\s*TSI\b/i, /\bCAV[A-Z]\b/, /Twincharger/i],
    rating: "risky",
    score_adjustment: -15,
    issues: [
      "Chaîne de distribution qui s'étire (< 100 000 km sur EA111)",
      "Tendeur de chaîne défaillant",
      "Pistons fragiles sur les premiers blocs (jusqu'en 2010)",
      "Injecteurs encrassés (encrassement injection directe)",
    ],
    inspect: [
      "Bruit moteur à froid (cliquetis = chaîne)",
      "Demander preuve du remplacement tendeur si > 80 000 km",
      "Décarbonage des soupapes admission recommandé tous les 60 000 km",
      "Vérifier consommation d'huile",
    ],
    fix_cost: "high",
    resale_risk: "medium",
    notes: "Le 1.4 TSI EA211 (post-2012) est nettement meilleur. Vérifier code moteur.",
  },
  {
    id: "vag-ea111-1.2-tsi",
    brands: ["volkswagen", "audi", "seat", "skoda"],
    patterns: [/1\.?2\s*TSI/i, /CBZ[A-Z]?\b/i],
    rating: "risky",
    score_adjustment: -12,
    issues: [
      "Chaîne de distribution prématurée (EA111, avant 2014)",
      "Bobines d'allumage et capteurs fragiles",
    ],
    inspect: [
      "Vérifier le bloc moteur : EA111 (CBZ*) à risque, EA211 (CJZ*) OK",
      "Bruit à froid",
    ],
    fix_cost: "high",
    resale_risk: "medium",
  },
  // ============================================================
  // BMW — N47 problématique
  // ============================================================
  {
    id: "bmw-n47-diesel",
    brands: ["bmw"],
    // N47 : 116d/118d/120d/318d/320d/520d 2007-2014
    patterns: [/\bN47\b/i, /11[68]d|31[68]d|32[01]d|52[05]d/i],
    rating: "risky",
    score_adjustment: -16,
    issues: [
      "Chaîne de distribution montée côté boîte (volant moteur)",
      "Démontage moteur + boîte pour le remplacement → 2500-4000 €",
      "Étirement vers 100-150 000 km, parfois moins",
    ],
    inspect: [
      "Démarrage à froid : tout bruit métallique = fuir",
      "OBD : codes P0016/P0017",
      "Demander historique de l'entretien strict",
    ],
    fix_cost: "engine-out",
    resale_risk: "high",
    notes: "B47 (post-2014) a corrigé le problème.",
  },
  // ============================================================
  // FORD — 1.0 EcoBoost
  // ============================================================
  {
    id: "ford-1.0-ecoboost",
    brands: ["ford"],
    patterns: [/1\.?0\s*EcoBoost/i, /EcoBoost\s*(?:100|125|140|155)\b/i],
    rating: "risky",
    score_adjustment: -14,
    issues: [
      "Durite de retour d'eau qui éclate (fuite de liquide de refroidissement)",
      "Joint de culasse fragile sur les pré-2018",
      "Surchauffe = casse moteur",
    ],
    inspect: [
      "Vase d'expansion : niveau correct, pas de traces d'huile dans l'eau",
      "Bouchon d'huile : pas de mayonnaise",
      "OBD : check codes refroidissement",
    ],
    fix_cost: "high",
    resale_risk: "medium",
  },
  // ============================================================
  // MOTEURS FIABLES À FAVORISER
  // ============================================================
  {
    id: "toyota-hybrid-thsii",
    brands: ["toyota", "lexus"],
    patterns: [/Hybrid/i, /HSD/i, /\bH4\b/i, /\b(?:THS|THSII)\b/i, /Hybride/i],
    rating: "excellent",
    score_adjustment: +10,
    issues: [],
    inspect: [
      "Batterie hybride : test santé chez concessionnaire (gratuit)",
      "Liquide de refroidissement inverter (vidange tous les 150 000 km)",
    ],
    fix_cost: "low",
    resale_risk: "low",
    notes: "Système Toyota Hybrid Synergy Drive : 25+ ans de fiabilité prouvée. Best in class.",
  },
  {
    id: "stellantis-hybrid-e-dcs6-eat8",
    brands: ["peugeot", "citroen", "ds", "opel"],
    // Hybride 48V mild ou full : e-DCS6 (mild), e-EAT8 (PHEV)
    patterns: [/e-?DCS6/i, /e-?EAT8/i, /Hybrid\s*\d{2,3}/i, /Hybride\s*\d{2,3}/i],
    rating: "good",
    score_adjustment: +5,
    issues: [
      "Batterie 48V à surveiller au-delà de 150 000 km",
      "Câblage haute tension : contrôle obligatoire",
    ],
    inspect: [
      "Test santé batterie HT en concession Stellantis",
      "Pas de codes défaut sur le système hybride (lecture OBD2 obligatoire)",
      "Historique de mise à jour logicielle",
    ],
    fix_cost: "medium",
    resale_risk: "low",
    notes: "Bonne fiabilité globale en 2024-2026, mais peu de recul sur les premiers blocs.",
  },
  {
    id: "renault-etech-hybrid",
    brands: ["renault", "dacia", "alpine", "nissan"],
    patterns: [/E-?Tech/i, /Hybrid\s*(?:140|145|160|200|220|280|300)/i],
    rating: "good",
    score_adjustment: +6,
    issues: [
      "Boîte multi-mode (sans embrayage) : surveillance des codes défauts",
    ],
    inspect: [
      "Test transition électrique <-> thermique fluide",
      "Pas de bruit anormal de la boîte multi-mode",
      "Niveau d'huile boîte selon préco constructeur",
    ],
    fix_cost: "medium",
    resale_risk: "low",
    notes: "Système E-Tech (issu de la F1) : techno mature post-2020.",
  },
  {
    id: "tesla-electric-base",
    brands: ["tesla"],
    // Pattern Tesla générique (toutes les Model X) — bonification car électrique full
    patterns: [/Model\s*[3SXY]/i],
    rating: "good",
    score_adjustment: +4,
    issues: [],
    inspect: [
      "Capacité batterie (% SoH) — demander rapport diagnostic",
      "Pas de signal d'alerte batterie HT",
    ],
    fix_cost: "medium",
    resale_risk: "low",
  },
  {
    id: "renault-k9k-blueDci",
    brands: ["renault", "dacia", "nissan", "mercedes"],
    // K9K post-2011 : 1.5 dCi 75/85/90/95/110 + Blue dCi
    patterns: [/1\.?5\s*(?:Blue\s*)?dCi/i, /K9K/i, /Blue\s*dCi\s*(?:95|115)/i],
    rating: "good",
    score_adjustment: +5,
    issues: [
      "EGR/FAP encrassés sur usage urbain exclusif (typique petits diesels)",
    ],
    inspect: [
      "Historique entretien (vidange tous les 20 000 km strict)",
      "Demander date dernier remplacement FAP",
      "Usage : éviter VH conduits exclusivement en ville",
    ],
    fix_cost: "low",
    resale_risk: "low",
    notes: "Workhorse de l'Alliance. Plus de 20 millions vendus. Fiable si entretenu.",
  },
  {
    id: "psa-bluehdi-dv6-modern",
    brands: ["peugeot", "citroen", "ds", "opel"],
    // 1.6 BlueHDi 100/120, 2.0 BlueHDi 150/180
    patterns: [/1\.?6\s*BlueHDi/i, /2\.?0\s*BlueHDi/i, /BlueHDi\s*(?:100|120|150|180)/i, /\bDV6\b/i],
    rating: "good",
    score_adjustment: +4,
    issues: [
      "SCR/AdBlue : capteur NOx peut tomber (~600 €)",
      "Vanne EGR encrassée sur usage urbain",
    ],
    inspect: [
      "Niveau AdBlue + témoin éteint",
      "Pas de fuite SCR sous le véhicule",
      "Régénération FAP : vérifier qu'elle a lieu (sortie autoroute)",
    ],
    fix_cost: "medium",
    resale_risk: "low",
  },
  {
    id: "vag-ea288-2.0-tdi",
    brands: ["volkswagen", "audi", "seat", "skoda"],
    // 2.0 TDI EA288 post-2014, post-Dieselgate fix
    patterns: [/2\.?0\s*TDI/i, /TDI\s*(?:150|184|190|200)\b/i, /EA288/i],
    rating: "good",
    score_adjustment: +5,
    issues: [
      "Vanne EGR ; injecteurs sur très haut km",
    ],
    inspect: [
      "Mise à jour Dieselgate effectuée (rappel)",
      "Capteurs DPF/AdBlue OK",
      "Pas de fumée bleue à l'accélération",
    ],
    fix_cost: "medium",
    resale_risk: "low",
  },
  {
    id: "vag-ea211-1.5-tsi-etsi",
    brands: ["volkswagen", "audi", "seat", "skoda", "cupra"],
    patterns: [/1\.?5\s*(?:e)?TSI/i, /eTSI\s*(?:130|150)/i, /EA211/i],
    rating: "good",
    score_adjustment: +6,
    issues: [
      "ACT (cylinder deactivation) peut causer vibrations à régime constant",
    ],
    inspect: [
      "Démarrage à froid : pas de cliquetis",
      "Sur boîte DSG7 (DQ200) : check des fuites de mécatronique",
    ],
    fix_cost: "low",
    resale_risk: "low",
  },
  {
    id: "vag-ea211-1.0-tsi",
    brands: ["volkswagen", "audi", "seat", "skoda"],
    patterns: [/1\.?0\s*TSI/i, /TSI\s*(?:90|95|110|115)/i, /CHZ[A-Z]?\b|DKL[A-Z]?|DKR[A-Z]?/i],
    rating: "good",
    score_adjustment: +4,
    issues: ["3 cylindres : vibrations à bas régime"],
    inspect: ["Chaîne (post-2018 = chaîne renforcée)", "Bobines d'allumage"],
    fix_cost: "low",
    resale_risk: "low",
  },
  {
    id: "renault-tce-90-h4bt",
    brands: ["renault", "dacia"],
    patterns: [/TCe\s*90\b/i, /H4Bt/i, /SCe\s*(?:65|75)/i],
    rating: "good",
    score_adjustment: +3,
    issues: ["Bougies à changer régulièrement", "Bobines fragiles"],
    inspect: ["Bruit moteur normal", "Témoin moteur éteint"],
    fix_cost: "low",
    resale_risk: "low",
  },
  {
    id: "bmw-b48-b58",
    brands: ["bmw", "mini"],
    patterns: [/\bB(?:38|46|47|48|58)\b/i, /SDrive|XDrive/i],
    rating: "good",
    score_adjustment: +5,
    issues: ["Filtre à particules essence (post-2018)", "Sondes lambda"],
    inspect: ["Niveau d'huile (BMW ne signale qu'à mi-jauge)"],
    fix_cost: "medium",
    resale_risk: "low",
    notes: "Nouvelle génération BMW : nette amélioration vs N20/N47.",
  },
  {
    id: "tesla-drive-units",
    brands: ["tesla"],
    patterns: [/Performance|Long\s*Range|Standard\s*Range|SR\+|Dual\s*Motor/i],
    rating: "good",
    score_adjustment: +4,
    issues: [
      "Drive unit avant (Model S/X pré-2020) : grincements",
      "Batterie : dégradation 1-2 %/an normale",
      "MCU1 (eMMC) Model S pré-2018 : remplacement ~2000 €",
    ],
    inspect: [
      "Demander rapport batterie (% SoH via app ou diagnostic)",
      "Vérifier kilométrage et nombre de supercharges (impact dégradation)",
      "MCU/écran : pas de bug visible, version logicielle récente",
    ],
    fix_cost: "medium",
    resale_risk: "low",
    notes: "Batterie sous garantie 8 ans / 200 000 km. Capacité minimum 70 %.",
  },
  {
    id: "mercedes-om651",
    brands: ["mercedes"],
    patterns: [/180\s*d|200\s*d|220\s*d|250\s*d|OM651/i],
    rating: "good",
    score_adjustment: +4,
    issues: ["Injecteurs Delphi sur les premiers (avant 2014)"],
    inspect: ["Pas de fumée bleue", "Pas de jeu pédale d'embrayage"],
    fix_cost: "medium",
    resale_risk: "low",
  },
];

export interface EngineMatch {
  profile: EngineProfile | null;
  rating: ReliabilityRating;
  score_adjustment: number;
}

const NO_MATCH: EngineMatch = { profile: null, rating: "unknown", score_adjustment: 0 };

export function identifyEngine(brand: string, model: string, version: string | null, engineDesignation: string | null): EngineMatch {
  const brandSlug = brand.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const haystack = [version ?? "", engineDesignation ?? "", model].join(" ").trim();
  if (!haystack) return NO_MATCH;

  for (const profile of ENGINES) {
    if (profile.brands.length && !profile.brands.includes(brandSlug)) continue;
    for (const re of profile.patterns) {
      if (re.test(haystack)) {
        return { profile, rating: profile.rating, score_adjustment: profile.score_adjustment };
      }
    }
  }
  return NO_MATCH;
}

export function getEngineProfileById(id: string): EngineProfile | null {
  return ENGINES.find((e) => e.id === id) ?? null;
}

export const ENGINE_DB_VERSION = "2026-05-18";
