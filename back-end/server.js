import express from 'express';
import bodyParser from 'body-parser';
import path from 'path'; 
import { fileURLToPath } from 'url'; 
import { scrapeBusinessData } from '../back-end/scraper.js'; 
import { setTimeout } from 'node:timers/promises'; 
import cors from 'cors'; 

const app = express();
const PORT = process.env.PORT || 5500;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(bodyParser.json());
app.use(cors()); 

app.use(express.static(path.join(__dirname, '../assets')));
app.use(express.static(path.join(__dirname, '../front-end'))); // New line added

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../front-end', 'index.html'));
});

// Endpoint for scraping
app.post('/scrape', async (req, res) => {
    const { searchFor, total } = req.body;

    try {
        await setTimeout(2000); // Wait for 1 second

        const businessList = await scrapeBusinessData(searchFor, total);
        res.json({ businesses: businessList.business_list });
    } catch (error) {
        console.error('Error during scraping:', error);
        res.status(500).send('An error occurred while scraping data.');
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
