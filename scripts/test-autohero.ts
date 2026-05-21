process.env.AUTOHERO_PAGES = "1";
import { autoheroScraper } from "../src/lib/scrapers/autohero";
async function main() {
  const listings = await autoheroScraper.fetch({ limit: 10 });
  console.log("Fetched:", listings.length);
  if (listings[0]) console.log("Sample:", JSON.stringify(listings[0], null, 2));
}
main().catch(console.error);
