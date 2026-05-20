export default function Privacy() {
  return (
    <article className="prose prose-invert max-w-none">
      <h1>Politique de confidentialité</h1>
      <p className="text-sm text-neutral-400">
        Dernière mise à jour : 1er janvier 2025. Conformément au Règlement (UE) 2016/679 (RGPD)
        et à la loi n° 78-17 du 6 janvier 1978 modifiée (loi Informatique et Libertés).
      </p>

      <h2>1. Responsable du traitement</h2>
      <p>
        [NOM DE LA SOCIÉTÉ], [ADRESSE], [EMAIL]<br />
        Contact DPO : <strong>privacy@vo-radar.fr</strong>
      </p>

      <h2>2. Données collectées et finalités</h2>
      <table>
        <thead>
          <tr><th>Catégorie</th><th>Données</th><th>Finalité</th><th>Base légale</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>Compte</td>
            <td>Nom, email, mot de passe (hashé)</td>
            <td>Authentification, gestion du compte</td>
            <td>Exécution du contrat</td>
          </tr>
          <tr>
            <td>Abonnement</td>
            <td>Données de paiement (gérées par Stripe), historique de facturation</td>
            <td>Facturation, prévention de la fraude</td>
            <td>Exécution du contrat, obligation légale</td>
          </tr>
          <tr>
            <td>Usage</td>
            <td>Annonces consultées, alertes configurées, filtres utilisés</td>
            <td>Fourniture du service, personnalisation</td>
            <td>Exécution du contrat</td>
          </tr>
          <tr>
            <td>Technique</td>
            <td>Adresse IP, logs de connexion, user-agent</td>
            <td>Sécurité, détection de fraude, débogage</td>
            <td>Intérêt légitime</td>
          </tr>
          <tr>
            <td>Communications</td>
            <td>Email</td>
            <td>Alertes, digest, notifications de service</td>
            <td>Exécution du contrat</td>
          </tr>
        </tbody>
      </table>

      <h2>3. Cookies</h2>
      <p>VO Radar utilise les cookies suivants :</p>
      <table>
        <thead><tr><th>Cookie</th><th>Type</th><th>Durée</th><th>Finalité</th></tr></thead>
        <tbody>
          <tr><td><code>vo_session</code></td><td>Nécessaire</td><td>Session</td><td>Authentification</td></tr>
          <tr><td><code>vo_prefs</code></td><td>Nécessaire</td><td>1 an</td><td>Préférences interface</td></tr>
          <tr><td><code>vo_cookie_consent</code></td><td>Nécessaire</td><td>1 an</td><td>Mémorisation du consentement</td></tr>
          <tr><td><code>_analytics</code></td><td>Analytique</td><td>13 mois</td><td>Statistiques d&rsquo;usage anonymisées</td></tr>
        </tbody>
      </table>
      <p>
        Les cookies analytiques ne sont déposés qu&rsquo;après votre consentement explicite.
        Vous pouvez modifier vos préférences à tout moment via le lien en bas de page.
      </p>

      <h2>4. Destinataires des données</h2>
      <p>Vos données peuvent être transmises aux sous-traitants suivants, encadrés par un DPA :</p>
      <ul>
        <li><strong>Stripe</strong> (San Francisco, USA) — paiement. Privacy Shield / clauses contractuelles types.</li>
        <li><strong>Resend</strong> — envoi d&rsquo;emails transactionnels.</li>
        <li><strong>[HÉBERGEUR]</strong> — hébergement des données, localisation UE.</li>
      </ul>
      <p>Aucune donnée n&rsquo;est vendue à des tiers ni utilisée à des fins publicitaires.</p>

      <h2>5. Durée de conservation</h2>
      <table>
        <thead><tr><th>Données</th><th>Durée</th></tr></thead>
        <tbody>
          <tr><td>Données de compte actif</td><td>Durée de l&rsquo;abonnement + 3 ans</td></tr>
          <tr><td>Données de facturation</td><td>10 ans (obligation légale)</td></tr>
          <tr><td>Logs techniques</td><td>12 mois</td></tr>
          <tr><td>Données de compte résilié</td><td>3 ans après résiliation, puis suppression</td></tr>
        </tbody>
      </table>

      <h2>6. Vos droits</h2>
      <p>Conformément au RGPD, vous disposez des droits suivants :</p>
      <ul>
        <li><strong>Accès</strong> — obtenir une copie de vos données ;</li>
        <li><strong>Rectification</strong> — corriger des données inexactes ;</li>
        <li><strong>Effacement</strong> — demander la suppression de votre compte et données ;</li>
        <li><strong>Portabilité</strong> — recevoir vos données dans un format structuré (JSON/CSV) ;</li>
        <li><strong>Opposition</strong> — vous opposer à certains traitements fondés sur l&rsquo;intérêt légitime ;</li>
        <li><strong>Limitation</strong> — suspendre un traitement en cas de contestation.</li>
      </ul>
      <p>
        Pour exercer ces droits : <strong>privacy@vo-radar.fr</strong>.<br />
        Réponse sous 30 jours. En cas de réponse insatisfaisante, vous pouvez saisir la{" "}
        <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">CNIL</a>.
      </p>

      <h2>7. Sécurité</h2>
      <p>
        Nous appliquons les mesures suivantes pour protéger vos données :
        chiffrement TLS en transit, hachage des mots de passe (bcrypt), accès aux données limité
        au personnel autorisé, sauvegardes chiffrées. En cas de violation de données susceptible
        d&rsquo;engendrer un risque pour vos droits et libertés, vous serez notifié dans les 72 heures.
      </p>

      <h2>8. Modifications</h2>
      <p>
        Toute modification substantielle de la présente politique fera l&rsquo;objet d&rsquo;une notification
        par email avec un préavis de 30 jours.
      </p>
    </article>
  );
}
