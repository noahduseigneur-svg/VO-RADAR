# VO Radar

**SaaS de sourcing VO temps réel pour concessions automobiles.**

Agrégateur multi-sources d'annonces de véhicules d'occasion + moteur de cote + scoring de bonnes affaires + alertes paramétrables. Construit pour vous donner 24-48h d'avance sur vos concurrents.

---

## Stack

| Couche | Choix |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Langage | TypeScript strict |
| UI | Tailwind v4 + lucide-react |
| DB | SQLite (better-sqlite3) — portable Supabase/Postgres |
| Auth | Cookie session HttpOnly + scrypt password hashing |
| Paiement | Stripe Checkout + Webhooks |
| Cron | `/api/scrape` (Vercel Cron, GitHub Actions, ou autre) |

Tout local. Zéro service externe requis pour développer.

## Démarrage

```bash
nvm use 22         # Node 20.9+ requis (Next 16)
npm install
npm run dev        # http://localhost:3000
```

Au premier lancement, `.data/vo-radar.sqlite` est créée + seedée avec 120 annonces démo.

Pour activer Stripe, copier `.env.example` → `.env.local` et remplir les clés.

## Architecture

```
src/
├── app/
│   ├── page.tsx                   # Landing (public)
│   ├── login,signup/              # Auth
│   ├── (app)/                     # Pages authentifiées
│   │   ├── layout.tsx             #   ↳ garde d'auth + sidebar
│   │   ├── dashboard/page.tsx
│   │   ├── listings/page.tsx
│   │   ├── alerts/page.tsx
│   │   └── settings/page.tsx
│   └── api/
│       ├── auth/logout/
│       ├── listings/              # GET filtré
│       ├── scrape/                # POST cron-only
│       └── stripe/
│           ├── checkout/
│           └── webhook/
├── components/                    # ListingCard, ScoreBadge, SideNav
└── lib/
    ├── pricing.ts                 # Modèle de cote (par marque/modèle)
    ├── scoring.ts                 # Score 0-100 de l'annonce
    ├── seed.ts                    # Données démo déterministes
    ├── db.ts                      # SQLite + migrations + requêtes
    ├── auth.ts                    # Session cookie + scrypt
    ├── stripe.ts                  # Plans + client Stripe
    └── scrapers/                  # Framework de scrapers pluggables
        ├── types.ts
        ├── demo.ts                # Scraper démo (à remplacer)
        └── index.ts               # runAllScrapers()
```

## Le moteur de cote, en clair

`lib/pricing.ts` contient un modèle volontairement simple :
- Anchors `{marque:modèle} → {valeur neuve, dépréciation/an, pénalité €/km au-delà du km attendu}`.
- Ajusté pour carburant, boîte, puissance.

C'est **pas** un substitut à Argus/Autovista, c'est un proxy qui marche en MVP. Production : brancher l'API d'un fournisseur de cote (Autovista, Indicata, Argus Pro) et garder le score relatif comme couche au-dessus.

`lib/scoring.ts` combine :
- delta prix vs cote (±60 points)
- bonus particulier vs pro (+12 — c'est le levier différenciant pour un concessionnaire)
- bonus fraîcheur (-15 sur 48h)
- pénalités annonce pauvre (peu de photos, km>200k, âge>12 ans)

## Scraping — à lire avant de mettre en prod

Le scraper `demo` génère de la donnée synthétique. **Ne scrappez pas directement LeBonCoin, La Centrale ou AutoScout24** : leurs ToS l'interdisent et ils bloquent agressivement les bots (vos IPs et celles de vos clients).

Sources légitimes pour atteindre 20k€ MRR :
1. **Concessions partenaires (data swap)** — vos premiers clients vous donnent leur flux interne en échange d'un tarif réduit. Construit votre base.
2. **Mandataires & ventes B2B** — Aramis, Autosphere Pro, BCAuto, Sopara : flux licenciés, API ou EDI possibles.
3. **Sites avec flux RSS/exports publics** — moins dense mais légal.
4. **Partenariat data (Autovista, Spoticar Pro, etc.)** — payant mais sérieux.

Le framework `lib/scrapers/` est conçu pour brancher chaque source comme un module isolé.

## Cron de scraping

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://votre-domaine/api/scrape
```

Sur Vercel, ajouter `vercel.json` :
```json
{ "crons": [{ "path": "/api/scrape", "schedule": "*/10 * * * *" }] }
```

## Migration vers Supabase (production)

Les schémas SQL dans `lib/db.ts` sont compatibles Postgres (changer `INTEGER` boolean → `boolean`, `datetime('now')` → `now()`). Pour passer à Supabase :
1. Créer le projet + exécuter le SQL dans `lib/db.ts:migrate()`
2. Remplacer `db.ts` par un client `@supabase/supabase-js`
3. Migrer `auth.ts` vers Supabase Auth (ou garder la version cookie)

## Déploiement Vercel

```bash
npm install -g vercel
vercel
```

Variables à ajouter dans Vercel :
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_SOLO|PRO|GROUPE`
- `CRON_SECRET`

Note : SQLite ne survit pas aux déploiements Vercel (filesystem éphémère). Pour la prod, migrer vers Postgres avant le go-live.

---

## Plan business — viser 20k€ MRR

Si l'objectif est 20k€ MRR avec un prix moyen ~300€/mois (mix Solo/Pro), il faut **~65 concessions clientes**. C'est atteignable mais pas par magie. Plan en 4 phases.

### Phase 1 — 0 → 5 clients (semaine 1-8)
- Liste de 30 concessions que **tu connais déjà** dans ta région.
- Email + appel direct : "Je suis sourceur VO en concession, j'ai construit l'outil que j'aurais voulu avoir. Tu testes 1 mois gratuit ?"
- Onboard à la main, va sur place s'il le faut. Récupère le feedback brut.
- Tu vises **5 concessions payantes** à 199€/mois → 1k€ MRR.

### Phase 2 — 5 → 20 clients (mois 3-6)
- 5 témoignages vidéo de tes premiers clients (chiffrer : "J'ai acheté X VO grâce à VO Radar, marge moyenne +Y €").
- Cold outreach LinkedIn ciblé sur les "Responsable VO" et "Acheteur VO" en concession.
- Présence sur les salons pros (Indaba, Equip Auto), même petit stand.
- Outbound : 50 emails / semaine bien personnalisés > 500 emails de masse.
- Cible : **20 clients à 299€/mois moyen** → 6k€ MRR.

### Phase 3 — 20 → 50 clients (mois 6-12)
- Inbound : un blog sérieux sur le sourcing VO (3 articles/mois, SEO sur "comment trouver des VO", "cote argus vs marché réel", etc.).
- Partenariat avec 1-2 groupes de concessions (vente "groupe" à 799€).
- Programme de parrainage : 2 mois offerts pour chaque concession amenée.
- Cible : **50 clients** → 15k€ MRR.

### Phase 4 — 50 → 65+ clients (mois 12-18)
- À ce stade : embaucher 1 SDR/commercial (junior, commissions).
- Élargir aux pays voisins (Belgique, Suisse, Luxembourg — même problème, moins de concurrence outils).
- Lancer le plan Groupe (multi-sites) à 799€+ pour atteindre les 20k€ plus vite.

### Métriques à suivre dès J1
| Métrique | Bench |
|---|---|
| MRR | objectif 20k€ |
| Churn mensuel | < 3% (concessions = clients sticky si l'outil leur fait gagner du temps) |
| CAC | < 500€ (récupéré en 2 mois) |
| LTV | > 5k€ (cycle 18+ mois) |
| Activation | 80% des trials lancent ≥ 1 alerte la 1re semaine |

### Risques honnêtes
- **Scraping légal** : si tu te fais détecter à pomper LeBonCoin, tu prends du IP-ban à grande échelle. Construire des partenariats data dès le début.
- **Cote** : la qualité du score dépend de la qualité du modèle de cote. Investir tôt dans Autovista ou Indicata.
- **Concurrence** : Spoticar Pro, Indaba, eVA Group sont les players français installés. Ton différenciant : rapidité (alertes < 2 min après publication), UX moderne, prix accessible aux indépendants.

---

## TODO court terme

- [ ] Webhook Stripe + endpoint customer portal (annulation self-service)
- [ ] Notifications email (Resend/Postmark) sur match d'alerte
- [ ] Notifications SMS (Twilio) pour le plan Pro
- [ ] Export CSV des annonces filtrées
- [ ] Historique de prix par annonce (sparkline)
- [ ] Adapter scraper (1 source légale réelle)
- [ ] Migrer DB vers Postgres pour la prod

Bon courage. 🏁
