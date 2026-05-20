import type { BodyType } from "./types";

// Détection du type de carrosserie depuis (modèle, titre, version).
// Plus tendance marché 2026 — utilisée pour ajuster le scoring.

const BODY_RULES: { type: BodyType; patterns: RegExp[] }[] = [
  { type: "suv", patterns: [
    /\b(?:duster|captur|kadjar|austral|arkana|rafale|2008|3008|5008|c3\s*aircross|c4\s*aircross|c5\s*aircross|tiguan|t-roc|t-cross|touareg|tucson|kona|santa\s*fe|sportage|stonic|sorento|niro|xc40|xc60|xc90|qashqai|juke|x-trail|murano|model\s*y|model\s*x|tonale|stelvio|q2|q3|q5|q7|q8|x1|x2|x3|x4|x5|x6|x7|gla|glb|glc|gle|gls|mokka|grandland|crossland|ateca|tarraco|formentor|kamiq|karoq|kodiaq|enyaq|tucson|tipo\s*cross|kuga|puma|edge|ecosport|countryman|rav4|c-hr|chr|bz4x|highlander|land\s*cruiser|prado)\b/i
  ]},
  { type: "citadine", patterns: [
    /\b(?:clio|twingo|zoe|aygo|yaris|108|208|c1|c3|polo|fabia|ibiza|fiesta|ka|micra|i10|i20|picanto|rio|stonic|500|panda|mii|up!?|spring|sandero|leaf|corsa|adam|swift|jazz|fit|colt|107|2008)\b/i
  ]},
  { type: "berline", patterns: [
    /\b(?:megane|talisman|308|408|508|c4|c5|c6|c-elysee|golf|jetta|passat|arteon|a1|a3|a4|a5|a6|a7|a8|serie\s*[12345]|classe\s*[abce]|cla|astra|insignia|leon|toledo|elysee|focus|mondeo|fusion|tipo|giulietta|giulia|model\s*3|model\s*s|i3|prius|corolla|camry|civic|accord|mazda\s*[2-6]|optima|cerato|impreza|legacy|wrx|altima|sentra|maxima|elantra|sonata|ioniq|fluence|laguna|safrane|laguna|vel\s*satis|c-class|e-class|s-class)\b/i
  ]},
  { type: "break", patterns: [
    /\bbreak\b|\bestate\b|\btouring\b|\bavant\b|\bsw\b|\bsporttour\b|\bsportback\b|\bvariant\b/i,
    /\b(?:passat\s*variant|a4\s*avant|a6\s*avant|3\s*touring|5\s*touring|c\s*break|laguna\s*estate|megane\s*estate|308\s*sw|508\s*sw|c5\s*tourer|kombi)\b/i
  ]},
  { type: "monospace", patterns: [
    /\b(?:scenic|grand\s*scenic|espace|kangoo|berlingo|partner|rifter|combo|caddy|sharan|alhambra|touran|verso|prius\s*\+|odyssey|sienna|stream|fr-v|jumpy|expert|traveller|peugeot\s*807|c8|807|grand\s*c4)\b/i
  ]},
  { type: "cabriolet", patterns: [
    /\bcabrio(?:let)?\b|\broadster\b|\bspeedster\b|\bspider\b|\bconvertible\b|\beclipse\b|\btarga\b|\bz4\b|\bsl[ck]?\b|\bboxster\b|\bmx-?5\b|\bmiata\b/i
  ]},
  { type: "coupe", patterns: [
    /\bcoup[eé]\b|\b(?:gran\s*coup[eé]|grand\s*coup[eé]|gt|gts|gtr|r8|tt|cayman|911|718|gtc|gran\s*turismo|fastback)\b/i
  ]},
  { type: "utilitaire", patterns: [
    /\b(?:kangoo\s*express|berlingo\s*van|partner\s*van|jumpy|expert|trafic|vivaro|transporter|caddy\s*van|crafter|transit|sprinter|master|movano|boxer|jumper|ducato)\b/i
  ]},
];

export function detectBodyType(model: string, title: string, version: string | null): BodyType {
  const hay = `${model} ${title} ${version ?? ""}`.toLowerCase();
  for (const rule of BODY_RULES) {
    for (const p of rule.patterns) {
      if (p.test(hay)) return rule.type;
    }
  }
  return "inconnu";
}

// Tendance marché 2026 : impact sur la rotation côté concession.
// SUV + hybride se vendent vite, citadines diesel restent en stock.
export interface BodyTrend {
  body: BodyType;
  velocity: "fast" | "normal" | "slow";
  score_adjustment: number;
  note: string;
}

export function bodyTrend(body: BodyType, fuel: string): BodyTrend {
  if (body === "suv") {
    if (fuel === "hybride" || fuel === "electrique") {
      return { body, velocity: "fast", score_adjustment: +5, note: "SUV hybride/électrique : rotation rapide, valeur stable" };
    }
    if (fuel === "diesel") {
      return { body, velocity: "normal", score_adjustment: 0, note: "SUV diesel : encore demandé mais surveillance ZFE" };
    }
    return { body, velocity: "fast", score_adjustment: +4, note: "SUV : segment porteur" };
  }
  if (body === "cabriolet") {
    const month = new Date().getMonth() + 1;
    if (month >= 4 && month <= 8) {
      return { body, velocity: "fast", score_adjustment: +3, note: "Cabriolet en saison : rotation rapide" };
    }
    return { body, velocity: "slow", score_adjustment: -3, note: "Cabriolet hors saison : à stocker jusqu'au printemps" };
  }
  if (body === "monospace") {
    return { body, velocity: "slow", score_adjustment: -3, note: "Monospace : segment en déclin face aux SUV 7 places" };
  }
  if (body === "break") {
    return { body, velocity: "normal", score_adjustment: -1, note: "Break : segment stable mais peu spectaculaire" };
  }
  if (body === "citadine") {
    if (fuel === "electrique") {
      return { body, velocity: "fast", score_adjustment: +3, note: "Citadine électrique : forte demande urbaine" };
    }
    return { body, velocity: "normal", score_adjustment: 0, note: "Citadine : demande stable" };
  }
  if (body === "coupe") {
    return { body, velocity: "slow", score_adjustment: -2, note: "Coupé : segment niche" };
  }
  return { body, velocity: "normal", score_adjustment: 0, note: "" };
}
