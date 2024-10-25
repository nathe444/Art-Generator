import puppeteer from 'puppeteer';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import https from 'https';

export async function GET(req) {
  const baseUrl = "https://www.wikiart.org/en/artists-by-nation";
  const downloadFolder = './downloads';
  const metadataFolder = './metadata';
  const stateFilePath = './scrapeState.json'; // State file to track progress

  // Create directories if they don't exist
  if (!fs.existsSync(downloadFolder)) {
    fs.mkdirSync(downloadFolder , { recursive: true });
  }
  if (!fs.existsSync(metadataFolder)) {
    fs.mkdirSync(metadataFolder , { recursive: true });
  }

  console.log("Starting the scraping process with Puppeteer...");

  let scrapeState = {};
  if (fs.existsSync(stateFilePath)) {
    scrapeState = JSON.parse(fs.readFileSync(stateFilePath));
  }

  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(baseUrl, { waitUntil: 'networkidle0' });

    const artistNationLinks = await page.$$eval('a[href*="/en/artists-by-nation/"]', anchors =>
      anchors.map(a => a.href)
    );

    console.log("Found artist nation links:", artistNationLinks);

    for (const nationLink of artistNationLinks) {
      const nationName = nationLink.split('/').pop(); // Extract nation name from URL

      // Check if we have already scraped this nation
      if (scrapeState[nationName]) {
        console.log(`Resuming from nation: ${nationName}`);
      } else {
        scrapeState[nationName] = {};
      }

      const artistLinks = await scrapeArtistLinks(nationLink, page);

      for (const artistLink of artistLinks) {
        const artistName = artistLink.split('/').pop(); // Extract artist name from URL

        // Check if we have already scraped this artist
        if (scrapeState[nationName][artistName]) {
          console.log(`Skipping already scraped artist: ${artistName}`);
          continue;
        }

        const artistImages = await scrapeArtistImages(artistLink, page);
        const allWorksImages = await scrapeArtistAllWorks(artistLink, page);

        const artistDir = path.join(downloadFolder, nationName, artistName);
        const artistMetadataPath = path.join(metadataFolder, `${artistName}.json`);

        // Create directory for artist
        if (!fs.existsSync(artistDir)) {
          fs.mkdirSync(artistDir , { recursive: true });
        }

        // Save artist metadata to JSON
        fs.writeFileSync(artistMetadataPath, JSON.stringify([...artistImages, ...allWorksImages], null, 2), 'utf-8');
        console.log(`Metadata saved for artist: ${artistName}`);

        // Download images
      // Download images
// for (const image of [...artistImages, ...allWorksImages]) {
//   await downloadImage(image.url, artistDir, sanitizeFileName(image.artworkName || 'artwork'));
// }

   await downloadImagesInParallel([...artistImages, ...allWorksImages], artistDir, 10); // Batch size of 10


        // Save the HTML page for the artist
        const artistHtmlPath = path.join(artistDir, 'artist.html');
        const artistHtmlContent = await page.content();
        fs.writeFileSync(artistHtmlPath, artistHtmlContent, 'utf-8');
        console.log(`HTML saved for artist: ${artistName}`);

        // Mark this artist as scraped
        scrapeState[nationName][artistName] = true;
        fs.writeFileSync(stateFilePath, JSON.stringify(scrapeState, null, 2), 'utf-8'); // Save state
      }
    }

    await browser.close();
    return NextResponse.json({ message: "Scraping completed." });

  } catch (error) {
    console.error("Scraping error:", error);
    return NextResponse.json({ error: "Scraping failed." }, { status: 500 });
  }
}

async function scrapeArtistLinks(nationUrl, page) {
  try {
    await page.goto(nationUrl, { waitUntil: 'networkidle0' });
    const artistLinks = await page.$$eval('div.artist-name a', anchors =>
      anchors.map(a => a.href)
    );
    return artistLinks;
  } catch (error) {
    console.error(`Error scraping artist links from ${nationUrl}:`, error);
    return [];
  }
}

async function scrapeArtistImages(artistUrl, page) {
  try {
    await page.goto(artistUrl, { waitUntil: 'networkidle0' });

    // Wait for the masonry container to load
    await page.waitForSelector('.wiki-masonry-container', { timeout: 20000 });

    // Extract images from the masonry container
    const artistImages = await page.$$eval('.wiki-masonry-container li img', images =>
      images.map(img => ({
        url: img.src, // Keep the original image URL
        title: img.getAttribute('title') || '',
        alt: img.getAttribute('alt') || '',
        year: img.closest('li')?.querySelector('.artwork-year')?.textContent || '',
        artistName: img.closest('li')?.querySelector('.artist-name')?.textContent.split('•')[0].trim() || '',
        artworkName: img.closest('li')?.querySelector('.artwork-name')?.textContent.trim() || '',
      }))
    );

    // Filter out invalid URLs and duplicates
    const uniqueImages = artistImages
      .filter(img => img.url && (img.url.endsWith('.jpg') || img.url.endsWith('.png'))) // Handle .jpg and .png
      .filter((img, index, self) =>
        index === self.findIndex(t => t.url === img.url)
      );

    console.log(`Collected ${uniqueImages.length} images from: ${artistUrl}`);
    return uniqueImages;
  } catch (error) {
    console.error(`Error scraping images from ${artistUrl}:`, error);
    return [];
  }
}

async function scrapeArtistAllWorks(artistUrl, page) {
  try {
    // Construct the all works URL
    const artistId = artistUrl.split('/').pop(); // Extract the artist's ID from the URL
    const allWorksUrl = `https://www.wikiart.org/en/${artistId}/all-works#!#filterName:all-paintings-chronologically,resultType:masonry`;

    await page.goto(allWorksUrl, { waitUntil: 'networkidle0' });

    // Wait for the masonry container to load
    await page.waitForSelector('.wiki-masonry-container', { timeout: 30000 }); // Increased timeout to 30s for slower loading

    // Scroll down and click "Load More" until no more images can be loaded
    let loadMoreAvailable = true;
    while (loadMoreAvailable) {
      // Scroll the page with longer distance and pauses
      await autoScroll(page, 1000); // Adjust the auto-scroll for more extensive scrolling

      // Check if the load more button is available
      const loadMoreButton = await page.$('.masonry-load-more-button');
      if (loadMoreButton) {
        console.log("Clicking the load more button...");
        await loadMoreButton.click();

        // Increased delay to 5 seconds after clicking "Load More"
        await new Promise(resolve => setTimeout(resolve, 5000));
      } else {
        loadMoreAvailable = false; // No more button found, stop loop
      }

      // Check if the button is still visible for the next iteration
      loadMoreAvailable = await page.$eval('.masonry-load-more-button', button => button.offsetHeight > 0);
    }

    // Extract images from the masonry container
    const allWorksImages = await page.$$eval('.wiki-masonry-container li img', images =>
      images.map(img => ({
        url: img.src, // Keep the original image URL
        title: img.getAttribute('title') || '',
        alt: img.getAttribute('alt') || '',
        year: img.closest('li')?.querySelector('.artwork-year')?.textContent || '',
        artistName: img.closest('li')?.querySelector('.artist-name')?.textContent.split('•')[0].trim() || '',
        artworkName: img.closest('li')?.querySelector('.artwork-name')?.textContent.trim() || '',
      }))
    );

    // Filter out invalid URLs and duplicates
    const uniqueImages = allWorksImages
      .filter(img => img.url && (img.url.endsWith('.jpg') || img.url.endsWith('.png'))) // Handle .jpg and .png
      .filter((img, index, self) =>
        index === self.findIndex(t => t.url === img.url)
      );

    console.log(`Collected ${uniqueImages.length} images from: ${allWorksUrl}`);
    return uniqueImages;
  } catch (error) {
    console.error(`Error scraping images from all works URL ${artistUrl}:`, error);
    return [];
  }
}

// Function to auto-scroll the page
async function autoScroll(page, scrollDelay = 500) {
  await page.evaluate(async (scrollDelay) => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 300; // Increased scroll distance for faster scrolling
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight - window.innerHeight) {
          clearInterval(timer);
          resolve();
        }
      }, scrollDelay);
    });
  }, scrollDelay);
}

function downloadImage(url, folderPath, fileName) {
  return new Promise((resolve, reject) => {
    // Create the directory if it doesn't exist
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true }); // Create directory recursively
    }

    // Sanitize the filename to remove invalid characters
    const sanitizedFileName = fileName.replace(/[<>:"/\\|?*]/g, '');
    const filePath = path.join(folderPath, `${sanitizedFileName}.jpg`);
    const file = fs.createWriteStream(filePath);

    https.get(url, response => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve); // Close the file and resolve the promise
      });
    }).on('error', err => {
      fs.unlink(filePath, () => reject(err)); // Delete the file on error
    });
  });
}

// Batch download images in parallel
async function downloadImagesInParallel(images, folderPath, batchSize = 10) {
  for (let i = 0; i < images.length; i += batchSize) {
    const batch = images.slice(i, i + batchSize).map(image => 
      downloadImage(image.url, folderPath, sanitizeFileName(image.artworkName || 'artwork'))
    );
    await Promise.all(batch);  // Wait for all images in the batch to finish downloading
  }
}

function sanitizeFileName(name) {
  return name.replace(/[<>:"/\\|?*]/g, ''); // Remove invalid characters
}


