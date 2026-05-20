-- Migration 002 : index de performance pour les requêtes les plus fréquentes
-- Idempotent : CREATE INDEX IF NOT EXISTS

-- Index simples (filtres courants dans queryListings)
CREATE INDEX IF NOT EXISTS idx_listings_source    ON listings(source);
CREATE INDEX IF NOT EXISTS idx_listings_brand     ON listings(brand);
CREATE INDEX IF NOT EXISTS idx_listings_price     ON listings(price_eur);
CREATE INDEX IF NOT EXISTS idx_listings_fetched   ON listings(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_year      ON listings(year);
CREATE INDEX IF NOT EXISTS idx_listings_region    ON listings(region);
CREATE INDEX IF NOT EXISTS idx_listings_seller    ON listings(seller_kind);
CREATE INDEX IF NOT EXISTS idx_listings_fuel      ON listings(fuel);

-- Index composés pour les combinaisons fréquentes
CREATE INDEX IF NOT EXISTS idx_listings_brand_model ON listings(brand, model);

-- Index partiel : uniquement les annonces avec un score positif, triées par pertinence
CREATE INDEX IF NOT EXISTS idx_listings_active ON listings(score DESC, fetched_at DESC) WHERE score > 0;
