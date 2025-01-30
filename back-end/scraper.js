import puppeteer from 'puppeteer-core'; 
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

async function scrapeBusinessData(searchFor) {
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

        await autoScroll(page); // Scroll to load more listings

        const listings = await page.$$('a[href*="https://www.google.com/maps/place"]');
        console.log(`Found ${listings.length} listings`);

        for (const listing of listings) {
            try {
                const business = new Business();

                // Click on the listing to open details
                await listing.click();
                await setTimeout(1500); // Allow time for the pane to load

                // Extract business data
                try {
                    const name = await page.evaluate(el => el.getAttribute('aria-label'), listing);
                    business.name = name || "";
                                } catch (error) {
                    console.error('Error extracting name:', error);
                    business.name = "";
                }

                try {
                    const address = await page.$eval('button[data-item-id="address"] div', el => el.innerText);
                    business.address = address || "";
                } catch (error) {
                    console.error('Error extracting address:', error);
                    business.address = "";
                }

                try {
                    const website = await page.$eval('a[data-item-id="authority"]', el => el.innerText);
                    business.website = website || "";
                } catch (error) {
                    console.error('Error extracting website:', error);
                    business.website = "";
                }

                try {
                    const phone_number = await page.$eval('button[data-item-id^="phone:tel:"] div', el => el.innerText);
                    business.phone_number = phone_number || "";
                } catch (error) {
                    console.error('Error extracting phone number:', error);
                    business.phone_number = "";
                }

                try {
                    const reviews_count = await page.$eval(
                        'button[jsaction="pane.reviewChart.moreReviews"] div', 
                        el => parseInt(el.innerText.split(' ')[0].replace(',', '')) || 0
                    );
                    business.reviews_count = reviews_count;
                } catch (error) {
                    console.error('Error extracting reviews count:', error);
                    business.reviews_count = 0;
                }

                try {
                    const reviews_average = await page.$eval(
                        'div[jsaction="pane.reviewChart.moreReviews"] div[role="img"]', 
                        el => parseFloat(el.getAttribute('aria-label').split(' ')[0].replace(',', '.')) || 0
                    );
                    business.reviews_average = reviews_average;
                } catch (error) {
                    console.error('Error extracting reviews average:', error);
                    business.reviews_average = 0;
                }

                // Extract coordinates from URL
                try {
                    [business.latitude, business.longitude] = await extractCoordinatesFromUrl(page.url());
                } catch (error) {
                    console.error('Error extracting coordinates:', error);
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
