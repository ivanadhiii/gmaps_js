import puppeteer from 'puppeteer'; 
import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx'; // Ensure you have xlsx installed
import { setTimeout } from 'node:timers/promises'; // Import setTimeout

class Business {
    constructor(name, address, website, phone_number, reviews_count, reviews_average, latitude, longitude) {
        this.name = name || null;
        this.address = address || null;
        this.website = website || null;
        this.phone_number = phone_number || null;
        this.reviews_count = reviews_count || null;
        this.reviews_average = reviews_average || null;
        this.latitude = latitude || null;
        this.longitude = longitude || null;
    }
}

class BusinessList {
    constructor() {
        this.business_list = [];
        this.save_at = 'output';
    }

    saveToCSV(filename) {
        const csvData = this.business_list.map(b => `${b.name},${b.address},${b.website},${b.phone_number},${b.reviews_count},${b.reviews_average},${b.latitude},${b.longitude}`).join('\n');
        fs.writeFileSync(path.join(this.save_at, `${filename}.csv`), csvData);
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

async function extractCoordinatesFromUrl(url) {
    const latLonPattern = /!3d([-+]?[0-9]*\.?[0-9]+)!4d([-+]?[0-9]*\.?[0-9]+)/;
    const match = url.match(latLonPattern);
    if (match) {
        return [parseFloat(match[1]), parseFloat(match[2])];
    }
    return [null, null];
}

async function autoScroll(page) {
    await page.evaluate(async () => {
        const wrapper = document.querySelector('div[role="feed"]');
        await new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 1000;
            const scrollDelay = 3000;

            const timer = setInterval(() => {
                const scrollHeightBefore = wrapper.scrollHeight;
                wrapper.scrollBy(0, distance);
                totalHeight += distance;

                if (totalHeight >= scrollHeightBefore) {
                    totalHeight = 0;
                    setTimeout(() => {
                        const scrollHeightAfter = wrapper.scrollHeight;
                        if (scrollHeightAfter > scrollHeightBefore) {
                            return; // More content loaded, keep scrolling
                        } else {
                            clearInterval(timer);
                            resolve(); // No more content loaded, stop scrolling
                        }
                    }, scrollDelay);
                }
            }, 200);
        });
    });
}

async function scrapeBusinessData(searchFor, total) {
    const businessList = new BusinessList();
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 }); // Set to full HD resolution

    try {
        await page.goto(`https://www.google.com/maps/search/${searchFor.split(" ").join("+")}`, { waitUntil: 'networkidle2' });
        console.log('Navigated to Google Maps');

        await autoScroll(page, total); // Scroll to load more listings

        const listings = await page.$$('a[href*="https://www.google.com/maps/place"]');
        console.log(`Found ${listings.length} listings`);

        for (const listing of listings) {
            try {
                const business = new Business();
                
                // Wait for the listing to be visible before clicking
                await page.waitForSelector('a[href*="https://www.google.com/maps/place"]', { visible: true });
                await listing.click();
                
                await setTimeout(1500); // Allow time for the pane to load

                // Use direct strings instead of variables
                const nameAttribute = 'aria-label';
                const addressSelector = 'button[data-item-id="address"] div.fontBodyMedium';
                const websiteSelector = 'a[data-item-id="authority"]';

                const phoneNumberSelector = 'button[data-item-id^="phone:tel:"] div.fontBodyMedium';
                const reviewCountSelector = 'button[jsaction="pane.reviewChart.moreReviews"] div';

                const reviewsAverageSelector = 'div[jsaction="pane.reviewChart.moreReviews"] div[role="img"]';

                // Extract data with error handling
                try {
                    const name = await listing.evaluate(el => el.getAttribute('aria-label'));
                    business.name = name ? name : "";
                } catch (error) {
                    console.error('Error extracting name:', error);
                    business.name = "";
                }

                try {
                    const address = await page.$eval(addressSelector, el => el.innerText);
                    business.address = address ? address : "";
                } catch (error) {
                    console.error('Error extracting address:', error);
                    business.address = "";
                }

                try {
                    const website = await page.$eval(websiteSelector, el => el.innerText);
                    business.website = website ? website : "";
                } catch (error) {
                    console.error('Error extracting website:', error);
                    business.website = "";
                }

                try {
                    const phone_number = await page.$eval(phoneNumberSelector, el => el.innerText);
                    business.phone_number = phone_number ? phone_number : "";
                } catch (error) {
                    console.error('Error extracting phone number:', error);
                    business.phone_number = "";
                }

                try {
                    const reviews_count = await page.$eval(reviewCountSelector, el => {
                        return parseInt(el.innerText.split(' ')[0].replace(',', '')) || 0;
                    });
                    business.reviews_count = reviews_count;
                } catch (error) {
                    console.error('Error extracting reviews count:', error);
                    business.reviews_count = 0;
                }

                try {
                    const reviews_average = await page.$eval(reviewsAverageSelector, el => {
                        return parseFloat(el.getAttribute('aria-label').split(' ')[0].replace(',', '.')) || 0;
                    });
                    business.reviews_average = reviews_average;
                } catch (error) {
                    console.error('Error extracting reviews average:', error);
                    business.reviews_average = 0;
                }

                [business.latitude, business.longitude] = await extractCoordinatesFromUrl(page.url());
                businessList.business_list.push(business);
                console.log(`Added business: ${business.name}`);  // Debugging statement
            } catch (error) {
                console.error(`Error occurred while scraping listing: ${error}`);
            }
        }

    } catch (error) {
        console.error('Error during scraping:', error);
    } finally {
        await browser.close(); // Ensure the browser is closed in case of an error
    }
    
    return businessList; // Return the businessList object
}

export { scrapeBusinessData, BusinessList, Business };
