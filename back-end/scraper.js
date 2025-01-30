import puppeteer from 'puppeteer'; 
import chromium from '@sparticuz/chromium'; 
import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import { setTimeout } from 'node:timers/promises';

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
    await page.evaluate(async () => {
        const wrapper = document.querySelector('div[role="feed"]');
        if (!wrapper) return;
        
        await new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 1000;
            const scrollDelay = 2000;

            const timer = setInterval(() => {
                let scrollHeightBefore = wrapper.scrollHeight;
                wrapper.scrollBy(0, distance);
                totalHeight += distance;

                setTimeout(() => {
                    let scrollHeightAfter = wrapper.scrollHeight;
                    if (scrollHeightAfter === scrollHeightBefore) {
                        clearInterval(timer);
                        resolve();
                    }
                }, scrollDelay);
            }, 500);
        });
    });
}


async function extractCoordinatesFromUrl(url) {
    const latLonPattern = /!3d([-+]?[0-9]*\.?[0-9]+)!4d([-+]?[0-9]*\.?[0-9]+)/;
    const match = url.match(latLonPattern);
    return match ? [parseFloat(match[1]), parseFloat(match[2])] : [null, null];
}

async function scrapeBusinessData(searchFor, total) {
    const businessList = new BusinessList();
    
    const browser = await puppeteer.launch({
        args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
        executablePath: await chromium.executablePath,
        headless: true
    });
    
    if (!browser) {
        console.error("Failed to launch browser");
        return businessList;
    }
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    try {
        await page.goto(`https://www.google.com/maps/search/${searchFor.split(" ").join("+")}`, { waitUntil: 'networkidle2' });
        console.log('Navigated to Google Maps');

        await autoScroll(page); // Scroll ke bawah untuk memuat lebih banyak listing

        const listings = await page.$$('a[href*="https://www.google.com/maps/place"]');
        console.log(`Found ${listings.length} listings`);

        for (const listing of listings) {
            try {
                const business = new Business();

                // Klik pada listing untuk membuka detail
                await listing.click();
                await setTimeout(1500);


                // Ekstrak data bisnis
                try {
                    business.name = await page.evaluate(el => el.getAttribute('aria-label') || "", listing);
                } catch {
                    business.name = "";
                }

                try {
                    business.address = await page.$eval('button[data-item-id="address"] div', el => el.innerText, "");
                } catch {
                    business.address = "";
                }

                try {
                    business.website = await page.$eval('a[data-item-id="authority"]', el => el.innerText, "");
                } catch {
                    business.website = "";
                }

                try {
                    business.phone_number = await page.$eval('button[data-item-id^="phone:tel:"] div', el => el.innerText, "");
                } catch {
                    business.phone_number = "";
                }

                try {
                    business.reviews_count = await page.$eval(
                        'button[jsaction="pane.reviewChart.moreReviews"] div', 
                        el => parseInt(el.innerText.split(' ')[0].replace(',', '')) || 0, 
                        0
                    );
                } catch {
                    business.reviews_count = 0;
                }

                try {
                    business.reviews_average = await page.$eval(
                        'div[jsaction="pane.reviewChart.moreReviews"] div[role="img"]', 
                        el => parseFloat(el.getAttribute('aria-label').split(' ')[0].replace(',', '.')) || 0, 
                        0
                    );
                } catch {
                    business.reviews_average = 0;
                }

                // Ekstrak koordinat dari URL
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
