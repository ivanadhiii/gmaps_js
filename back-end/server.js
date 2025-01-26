import express from 'express';
import bodyParser from 'body-parser';
import path from 'path'; // Import path untuk mengelola path file
import { fileURLToPath } from 'url'; // Import fileURLToPath untuk mengonversi URL ke path
import { scrapeBusinessData } from '../back-end/scraper.js'; // Ganti dengan path yang sesuai
import { setTimeout } from 'node:timers/promises'; // Import setTimeout
import cors from 'cors'; // Import cors

const app = express();
const PORT = process.env.PORT || 5500;

// Dapatkan __dirname menggunakan import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(bodyParser.json());
app.use(cors()); // Enable CORS for all origins

// Middleware untuk menyajikan file statis (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, '../front-end'))); // Menyajikan file dari folder front-end

// Endpoint untuk root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../front-end', 'index.html')); // Mengarahkan ke index.html di folder front-end
});

// Endpoint untuk scraping
app.post('/scrape', async (req, res) => {
    const { searchFor, total } = req.body;

    try {
        // Tunggu 1 detik sebelum memulai scraping (jika diperlukan)
        await setTimeout(2000); // Menunggu 1 detik

        const businessList = await scrapeBusinessData(searchFor, total);
        res.json({ businesses: businessList.business_list });
    } catch (error) {
        console.error('Error during scraping:', error);
        res.status(500).send('An error occurred while scraping data.');
    }
});

export default app;
