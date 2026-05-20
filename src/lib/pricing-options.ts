// Detection des options premium et finitions depuis le titre/version d'une annonce.
// Chaque option a un impact € sur la valeur estimée (en plus de la cote de base).
// Ces valeurs sont des ordres de grandeur "concession", à recalibrer avec
// les feedback réels du marché.

export interface OptionFinding {
  key: string;
  label: string;
  delta_eur: number;     // valeur ajoutée au marché de l'occasion
  pattern: RegExp;
}

const OPTIONS: OptionFinding[] = [
  // Finitions / packs premium
  { key: "trim_rs",        label: "Pack RS / Performance",   delta_eur: 2500, pattern: /\bRS\s*Line\b|\bRS\b|\bGTI\b|\bGTR\b|\bN Performance\b|\bSport Engineered\b/i },
  { key: "trim_amg",       label: "Pack AMG-Line",           delta_eur: 2000, pattern: /\bAMG[- ]?Line\b|\bAMG\b/i },
  { key: "trim_mperf",     label: "Pack M Performance / M Sport", delta_eur: 2200, pattern: /\bM[- ]?Sport\b|\bM Performance\b|\bxDrive M\b/i },
  { key: "trim_sline",     label: "Pack S-Line",             delta_eur: 1500, pattern: /\bS[- ]?Line\b|\bSline\b/i },
  { key: "trim_rline",     label: "Pack R-Line",             delta_eur: 1500, pattern: /\bR[- ]?Line\b/i },
  { key: "trim_gtline",    label: "Pack GT-Line / GT",       delta_eur: 1300, pattern: /\bGT[- ]?Line\b|\bGT\b/i },
  { key: "trim_st",        label: "Pack ST / ST-Line",       delta_eur: 1300, pattern: /\bST[- ]?Line\b|\bST\b/i },
  { key: "trim_alpine",    label: "Pack Esprit Alpine",      delta_eur: 1200, pattern: /\bEsprit Alpine\b|\bAlpine\b/i },
  { key: "trim_executive", label: "Pack Executive / Business", delta_eur: 800, pattern: /\bExecutive\b|\bBusiness\b/i },
  { key: "trim_design",    label: "Finition Design / Elegance / Allure", delta_eur: 600, pattern: /\bDesign\b|\bElegance\b|\bAllure\b/i },

  // Équipements premium
  { key: "equipment_pano", label: "Toit ouvrant panoramique", delta_eur: 1200, pattern: /\b(?:toit\s*pano|panoramique|toit\s*ouvrant|sunroof|panoramic)\b/i },
  { key: "equipment_cuir", label: "Sellerie cuir",            delta_eur: 1000, pattern: /\b(?:cuir|leather|sellerie\s*cuir|nappa|alcantara)\b/i },
  { key: "equipment_gps",  label: "GPS / Navigation",         delta_eur: 400,  pattern: /\b(?:gps|nav|navigation|caméra de recul|cam[eé]ra ar)\b/i },
  { key: "equipment_jantes", label: "Jantes alliage",         delta_eur: 350,  pattern: /\b(?:jantes\s*alu|jantes\s*alliage|alloy|18\s*pouces|19\s*pouces|20\s*pouces)\b/i },
  { key: "equipment_attelage", label: "Attelage",             delta_eur: 350,  pattern: /\b(?:attelage|hitch|crochet)\b/i },
  { key: "equipment_4x4",  label: "4x4 / AWD / Quattro / xDrive", delta_eur: 1500, pattern: /\b(?:4x4|awd|quattro|xdrive|4motion|4matic|4WD|all\s*wheel)\b/i },
  { key: "equipment_keyless", label: "Démarrage sans clé",   delta_eur: 250,  pattern: /\b(?:keyless|sans\s*cl[ée]|smartkey)\b/i },
  { key: "equipment_acc",  label: "Régulateur adaptatif",     delta_eur: 350,  pattern: /\bACC\b|\bAdaptive\b|r[ée]gulateur\s*adaptatif|cruise\s*control/i },
  { key: "equipment_led",  label: "Phares LED / Matrix",      delta_eur: 300,  pattern: /\b(?:full\s*led|matrix\s*led|laser\s*light|xenon)\b/i },
  { key: "equipment_hud",  label: "Affichage tête haute",     delta_eur: 400,  pattern: /\b(?:head[- ]?up\s*display|HUD|affichage\s*t[eê]te\s*haute)\b/i },
  { key: "equipment_park", label: "Aide au stationnement / Parking auto", delta_eur: 300, pattern: /\b(?:parking\s*assist|aide\s*au\s*stationnement|park\s*pilot|parktronic)\b/i },
  { key: "equipment_audio", label: "Système audio premium",   delta_eur: 500,  pattern: /\b(?:Harman|Bose|Bang\s*&\s*Olufsen|Burmester|Mark\s*Levinson|Meridian|Sound\s*System)\b/i },

  // Versions "Plus / Premium / Edition Spéciale"
  { key: "edition_plus",   label: "Version Plus / Premium",   delta_eur: 800,  pattern: /\b(?:Plus|Premium|Edition\s*Sp[eé]ciale|Limited\s*Edition|First\s*Edition|Anniversary)\b/i },
  { key: "edition_suréquipée", label: "Suréquipée / Toutes options", delta_eur: 1500, pattern: /\b(?:sur[eé]quip[eé]e?|toutes\s*options|full\s*options|haut\s*de\s*gamme)\b/i },
];

export interface OptionsAnalysis {
  detected: OptionFinding[];
  total_delta_eur: number;
}

export function detectOptions(args: {
  title?: string | null;
  version?: string | null;
  engine_designation?: string | null;
}): OptionsAnalysis {
  const haystack = [args.title, args.version, args.engine_designation].filter(Boolean).join(" ");
  if (!haystack) return { detected: [], total_delta_eur: 0 };

  const detected: OptionFinding[] = [];
  const seen = new Set<string>();
  for (const opt of OPTIONS) {
    if (opt.pattern.test(haystack) && !seen.has(opt.key)) {
      detected.push(opt);
      seen.add(opt.key);
    }
  }

  // Soft cap : ne pas additionner plus de 6 000 € d'options "diffuses"
  let total = detected.reduce((a, b) => a + b.delta_eur, 0);
  if (total > 6000) total = 6000 + Math.round((total - 6000) * 0.5);

  return { detected, total_delta_eur: total };
}
