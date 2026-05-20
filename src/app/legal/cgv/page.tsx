import { PLANS } from "@/lib/stripe";
import { fmtEUR } from "@/lib/utils";

export default function CGV() {
  return (
    <article className="prose prose-invert max-w-none">
      <h1>Conditions Générales de Vente</h1>
      <p className="text-sm text-neutral-400">Version en vigueur au 1er janvier 2025.</p>

      <h2>1. Parties et objet</h2>
      <p>
        Les présentes Conditions Générales de Vente (CGV) régissent les relations contractuelles
        entre [NOM DE LA SOCIÉTÉ] (ci-après « le Prestataire ») et tout professionnel souscrivant
        un abonnement au service VO Radar (ci-après « le Client »).
      </p>
      <p>
        Le service VO Radar est exclusivement destiné aux <strong>professionnels</strong> au sens
        de l&rsquo;article liminaire du Code de la consommation. Toute souscription implique l&rsquo;acceptation
        des présentes CGV et des CGU.
      </p>

      <h2>2. Offres et tarifs</h2>
      <p>Les abonnements proposés au moment de la publication des présentes sont les suivants :</p>

      <div className="not-prose grid gap-4 md:grid-cols-3 my-6">
        {(Object.entries(PLANS) as [string, typeof PLANS[keyof typeof PLANS]][]).map(([key, plan]) => (
          <div key={key} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="font-semibold">{plan.name}</div>
            <div className="mt-1 text-2xl font-bold">{fmtEUR(plan.price_eur)}<span className="text-sm font-normal text-neutral-400"> HT/mois</span></div>
            <p className="mt-1 text-sm text-neutral-400">{plan.tagline}</p>
            <ul className="mt-3 space-y-1 text-sm">
              {plan.features.map((f) => <li key={f} className="text-neutral-300">· {f}</li>)}
            </ul>
          </div>
        ))}
      </div>

      <p>
        Les prix sont indiqués en euros <strong>hors taxes</strong>. La TVA applicable est celle
        en vigueur au jour de la facturation (20% pour les clients français). Les clients établis
        dans un autre État membre de l&rsquo;UE et disposant d&rsquo;un numéro de TVA valide bénéficient
        de l&rsquo;autoliquidation.
      </p>
      <p>
        Le Prestataire se réserve le droit de modifier ses tarifs à tout moment, sous réserve
        d&rsquo;un préavis de 30 jours par email. Les tarifs en vigueur sont ceux affichés au moment
        de la souscription ou du renouvellement.
      </p>

      <h2>3. Souscription et période d&rsquo;essai</h2>
      <p>
        Tout nouvel abonnement bénéficie d&rsquo;une période d&rsquo;essai gratuite de <strong>14 jours</strong>,
        sans engagement et sans nécessité de renseigner une carte bancaire. À l&rsquo;issue de cette période,
        la souscription devient payante et un moyen de paiement est requis pour continuer.
      </p>

      <h2>4. Facturation et paiement</h2>
      <p>
        La facturation est mensuelle, le premier prélèvement intervenant le jour de la souscription
        payante puis chaque mois à la même date. Le paiement est géré par <strong>Stripe</strong>
        (carte bancaire, SEPA sur demande). Les factures sont disponibles dans l&rsquo;espace client.
      </p>
      <p>
        En cas de défaut de paiement après 7 jours, l&rsquo;accès au service peut être suspendu sans
        préavis jusqu&rsquo;à régularisation. Des pénalités de retard égales à 3× le taux d&rsquo;intérêt
        légal s&rsquo;appliquent de plein droit, ainsi qu&rsquo;une indemnité forfaitaire de recouvrement
        de 40 €.
      </p>

      <h2>5. Engagement annuel</h2>
      <p>
        Une remise de <strong>20%</strong> est appliquée en cas d&rsquo;engagement annuel prépayé.
        L&rsquo;abonnement annuel n&rsquo;est pas remboursable, sauf résiliation pour faute du Prestataire.
      </p>

      <h2>6. Résiliation</h2>
      <p>
        Le Client peut résilier son abonnement mensuel à tout moment depuis son espace client
        (Paramètres → Abonnement). La résiliation prend effet à la fin de la période mensuelle
        en cours. Aucun remboursement partiel n&rsquo;est effectué.
      </p>
      <p>
        Le Prestataire peut résilier l&rsquo;abonnement en cas de violation grave des CGU,
        après mise en demeure restée sans effet pendant 15 jours calendaires.
      </p>

      <h2>7. Droit de rétractation</h2>
      <p>
        Conformément à l&rsquo;article L. 221-28 du Code de la consommation, le droit de rétractation
        ne s&rsquo;applique pas aux contrats de fourniture de contenu numérique dont l&rsquo;exécution a commencé
        avec l&rsquo;accord exprès du Client. La souscription à l&rsquo;offre d&rsquo;essai gratuit vaut accord exprès.
      </p>
      <p>
        <em>Note : les présentes CGV étant conclues entre professionnels, le droit de rétractation
        de 14 jours prévu pour les consommateurs ne s&rsquo;applique pas.</em>
      </p>

      <h2>8. Niveaux de service (SLA)</h2>
      <table>
        <thead><tr><th>Plan</th><th>Disponibilité garantie</th><th>Support</th></tr></thead>
        <tbody>
          <tr><td>Solo</td><td>99,5%</td><td>Email (réponse sous 48h ouvrées)</td></tr>
          <tr><td>Pro</td><td>99,7%</td><td>Email prioritaire (réponse sous 24h ouvrées)</td></tr>
          <tr><td>Groupe</td><td>99,9%</td><td>Account manager dédié + téléphone</td></tr>
        </tbody>
      </table>
      <p>
        En cas de non-respect du SLA sur une période mensuelle, un avoir proportionnel sera appliqué
        sur la prochaine facture, sur demande du Client dans les 30 jours.
      </p>

      <h2>9. Traitement des données (DPA)</h2>
      <p>
        Dans le cadre du traitement des données personnelles des utilisateurs du Client, le Prestataire
        agit en qualité de <strong>sous-traitant</strong> au sens du RGPD. Un Accord de Traitement des
        Données (DPA) est disponible sur demande à <strong>contact@vo-radar.fr</strong>.
      </p>

      <h2>10. Droit applicable et juridiction</h2>
      <p>
        Les présentes CGV sont soumises au droit français. Tout litige sera soumis à la compétence
        exclusive des tribunaux du ressort du siège social du Prestataire, sauf disposition légale contraire.
      </p>

      <h2>11. Contact</h2>
      <p>Pour toute question : <strong>contact@vo-radar.fr</strong></p>
    </article>
  );
}
