import { load } from "cheerio"; // Use named import for cheerio
import fetch from "node-fetch";
import fs from "fs";
import path from "path";

// Define the GET method
export async function GET(req, res) {
  const baseUrl = "https://www.wikiart.org/en/artists-by-nation";
  console.log("Starting the scraping process...");

  try {
    const response = await fetch(baseUrl);
    const html = await response.text();
    const $ = load(html); // Load HTML with named import
    const artists = [];

    // Collect artist links
    console.log("Collecting artist links...");
    $('a[href*="/en/"]').each((i, element) => {
      const artistUrl = $(element).attr('href');
      if (artistUrl && artistUrl.includes('artists')) {
        artists.push(`https://www.wikiart.org${artistUrl}`);
      }
    });
    console.log(`Found ${artists.length} artist links.`);

    // Collect data from each artist page
    for (const artist of artists) {
      console.log(`Fetching data for artist: ${artist}`);
      const artistResponse = await fetch(artist);
      const artistHtml = await artistResponse.text();
      const $$ = load(artistHtml); // Load artist page HTML with named import
      const artistName = $$('h1').text().trim();  // Get artist name
      const images = [];

      // Collect image URLs
      console.log(`Collecting images for artist: ${artistName}`);
      $$('img').each((i, img) => {
        const imgUrl = $$(img).attr('src');
        if (imgUrl && (imgUrl.endsWith('.jpg') || imgUrl.endsWith('.png'))) {
          images.push(imgUrl);
        }
      });
      console.log(`Found ${images.length} images for artist: ${artistName}`);

      // Create a directory for the artist's images
      const artistFolder = path.join(process.cwd(), 'public', 'artworks', artistName.replace(/[^a-zA-Z0-9]/g, '_'));
      if (!fs.existsSync(artistFolder)) {
        console.log(`Creating directory for artist: ${artistName}`);
        fs.mkdirSync(artistFolder, { recursive: true });
      }

      // Download images
      // for (const imgUrl of images) {
      //   const imageName = path.basename(imgUrl);
      //   console.log(`Downloading image: ${imageName} from ${imgUrl}`);
      //   const imgResponse = await fetch(imgUrl);
      //   const buffer = await imgResponse.buffer();
      //   fs.writeFileSync(path.join(artistFolder, imageName), buffer);
      //   console.log(`Saved image: ${imageName} to ${artistFolder}`);
      // }
    }

    console.log("Scraping complete!");
    res.status(200).json({ message: "Scraping complete!" });
  } catch (error) {
    console.error("Scraping error:", error);
    res.status(500).json({ error: "Scraping failed." });
  }
}
