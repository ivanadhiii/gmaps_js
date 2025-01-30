import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import chromium from '@sparticuz/chromium';
import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

class Business {
    constructor(name, address, website, phone_number, reviews_count, reviews_average, latitude, longitude) {
        this.name = name || "";
        this.address = address || "";
        this.website = website || "";
        this.phone_number = phone_number || "";
        this.reviews_count = reviews_count || 0;
        this.reviews_average = reviews_average || 0;
        this.latitude = latitude || null;
        this.longitude = longitude || null;
    }
}

class BusinessList {
    constructor() {
        this.business_list = [];
        this.save_at = 'output';
    }

    saveToExcel(filename) {
        if (!fs.existsSync(this.save_at)) {
            fs.mkdirSync(this.save_at, { recursive: true });
        }

        const formattedBusinesses = this.business_list.map(b => ({
            Name: b.name,
            Address: b.address,
            Website: b.website,
            Phone: b.phone_number,
            'Reviews Count': b.reviews_count,
            'Average Rating': b.reviews_average,
            Coordinates: `(${b.latitude}, ${b.longitude})`
        }));

        const worksheet = XLSX.utils.json_to_sheet(formattedBusinesses);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Businesses');
        XLSX.writeFile(workbook, path.join(this.save_at, `${filename}.xlsx`));
    }
}

async function autoScroll(page) {
    let previousHeight = 0;
    let scrollAttempts = 0;
    const maxScrollAttempts = 10;

    while (scrollAttempts < maxScrollAttempts) {
        await page.evaluate(() => window.scrollBy(0, 1000));
        await page.waitForTimeout(2000);

        const newHeight = await page.evaluate(() => document.body.scrollHeight);

        if (newHeight === previousHeight) {
            break;
        }
        previousHeight = newHeight;
        scrollAttempts++;
    }
}

async function extractCoordinatesFromUrl(url) {
    const latLonPattern = /!3d([-+]?[0-9]*\.?[0-9]+)!4d([-+]?[0-9]*\.?[0-9]+)/;
    const match = url.match(latLonPattern);
    return match ? [parseFloat(match[1]), parseFloat(match[2])] : [null, null];
}

async function scrapeBusinessData(searchFor, total) {
    puppeteerExtra.use(StealthPlugin());

  const businessList = new BusinessList();
  console.log("Starting browser launch...");

  // Logging Chromium configurations
  console.log("Chromium Executable Path:", chromium.executablePath());
  console.log("Chromium Launch Arguments:", chromium.args);
  console.log("Headless Mode:", chromium.headless);

  const browser = await puppeteerExtra.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(), // Path otomatis dari @sparticuz/chromium
    headless: chromium.headless,
    defaultViewport: chromium.defaultViewport,
  });

    console.log(`Using executable path: ${chromium.executablePath()}`);

    if (!browser) {
        console.error("Failed to launch browser");
        return businessList;
    }

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    try {
        await page.goto(`https://www.google.com/maps/search/${searchFor.split(" ").join("+")}`, { waitUntil: 'networkidle2' });
        console.log('Navigated to Google Maps');

        await autoScroll(page); // Scroll to load more listings

        const listings = await page.$$('a[href*="https://www.google.com/maps/place"]');
        console.log(`Found ${listings.length} listings`);

        for (const listing of listings) {
            try {
                const business = new Business();

                await Promise.all([
                    page.waitForNavigation({ waitUntil: 'networkidle0' }), // Wait for navigation
                    listing.click() // Click on the listing
                ]);

                try {
                    business.name = await page.evaluate(el => el.getAttribute('aria-label') || "", listing);
                } catch {
                    business.name = "";
                }

                try {
                    business.address = await page.$eval('button[data-item-id="address"] div', el => el.innerText) || "";
                } catch {
                    business.address = "";
                }

                try {
                    business.website = await page.$eval('a[data-item-id="authority"]', el => el.innerText) || "";
                } catch {
                    business.website = "";
                }

                try {
                    business.phone_number = await page.$eval('button[data-item-id^="phone:tel:"] div', el => el.innerText) || "";
                } catch {
                    business.phone_number = "";
                }

                try {
                    business.reviews_count = await page.$eval('button[jsaction="pane.reviewChart.moreReviews"] div', el => parseInt(el.innerText.split(' ')[0].replace(',', '')) || 0);
                } catch {
                    business.reviews_count = 0;
                }

                try {
                    business.reviews_average = await page.$eval('div[jsaction="pane.reviewChart.moreReviews"] div[role="img"]', el => parseFloat(el.getAttribute('aria-label').split(' ')[0].replace(',', '.')) || 0);
                } catch {
                    business.reviews_average = 0;
                }

                try {
                    [business.latitude, business.longitude] = await extractCoordinatesFromUrl(page.url());
                } catch {
                    business.latitude = null;
                    business.longitude = null;
                }

                businessList.business_list.push(business);
                console.log(`Added business: ${business.name}`);
            } catch (error) {
                console.error(`Error extracting business data:`, error);
            }
        }
    } catch (error) {
        console.error('Error during scraping:', error);
    } finally {
        await browser.close();
    }

    return businessList;
}

export { scrapeBusinessData, BusinessList, Business };
