document.getElementById('scrapeButton').addEventListener('click', function () {
    const searchTerm = document.getElementById('searchTerm').value.trim();
    const totalResults = parseInt(document.getElementById('totalResults').value) || 1000; // Default to 1000 if not provided

    if (!searchTerm) {
        alert('Please enter a search term.');
        return;
    }

    if (isNaN(totalResults) || totalResults <= 0) {
        alert('Please enter a valid positive number for total results.');
        return;
    }

    // Show loading message
    const loadingMessage = document.getElementById('loadingMessage');
    loadingMessage.style.display = 'block';

    // Send a POST request to the Flask backend
    fetch('/scrape', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            searchFor: searchTerm, // Updated key
            total: totalResults,
        }),
    })
    .then(response => {
        if (!response.ok) {
            return response.text().then(text => {
                console.error('Response text:', text); // Log the response text
                throw new Error('An error occurred: ' + text);
            });
        }
        return response.json();
    })
    .then((data) => {
        // Hide loading message
        loadingMessage.style.display = 'none';
        console.log('Data received from server:', data); 
        // Display scraping results
        const resultsDiv = document.getElementById('results');
        resultsDiv.innerHTML = ''; // Clear previous results

        if (!data.businesses || data.businesses.length === 0) {
            resultsDiv.innerHTML = '<p>No results found.</p>';
            return;
        }
        const businesses = [];
        data.businesses.forEach((business) => {
            const businessDiv = document.createElement('div');
            businessDiv.classList.add('business');
            businessDiv.innerHTML = `
                <h4>${business.name || 'No name available'}</h4>
                <p>Address: ${business.address || 'No address available'}</p>
                <p>Website: ${business.website || 'No website available'}</p>
                <p>Phone: ${business.phone_number || 'No phone available'}</p>
                <p>Reviews Count: ${business.reviews_count || 'No reviews count available'}</p>
                <p>Average Rating: ${business.reviews_average || 'No rating available'}</p>
                <p>Coordinates: (${business.latitude || 'N/A'}, ${business.longitude || 'N/A'})</p>
                <hr>
            `;
            resultsDiv.appendChild(businessDiv);
            businesses.push(business);
        });
        const download = document.getElementById('download');
        download.style.display = 'block';

        const reset = document.getElementById('reset');
        reset.style.display = 'block';

        reset.onclick = function () {
            // Reset the form  
            clearInput('searchTerm');
            clearInput('totalResults');
            resultsDiv.innerHTML = ''; // Clear results
            download.style.display = 'none'; // Hide download button
            reset.style.display = 'none'; // Hide reset button
            loadingMessage.style.display = 'none'; // Hide loading message
        }

        download.onclick = function () {
            downloadExcel(businesses, searchTerm);
        }

    })
    .catch((error) => {
        console.error('Error:', error);
        alert('An error occurred while scraping data: ' + error.message);
        // Hide loading message if an error occurs
        loadingMessage.style.display = 'none';
    });
});

function downloadExcel(businesses) {
    const searchTerm = document.getElementById('searchTerm').value.trim(); // Get the search term and trim whitespace

    // Create a new workbook
    const workbook = XLSX.utils.book_new();

    // Map the businesses array to the desired format
    const formattedBusinesses = businesses.map(business => ({
        name: business.name || '', // Ensure a default value if name is missing
        address: business.address || '', // Ensure a default value if address is missing
        website: business.website || '', // Optional: include other fields if needed
        phone: business.phone_number || '',
        reviewsCount: business.reviews_count || '',
        averageRating: business.reviews_average || '',
        coordinates: `(${business.latitude || ''}, ${business.longitude || ''})`
    }));

    // Convert the formatted businesses array to a worksheet
    const worksheet = XLSX.utils.json_to_sheet(formattedBusinesses);

    // Append the worksheet to the workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Businesses');

    // Define the filename for the download
    const excelFileName = `Hasil_Scraping_Google_Maps_${searchTerm}.xlsx`;

    // Trigger the download
    XLSX.writeFile(workbook, excelFileName);
}

function clearInput(id) {
    document.getElementById(id).value = '';
    toggleClearButton();
}

function toggleClearButton() {
    const searchTerm = document.getElementById('searchTerm').value.trim();
    const clear = document.getElementById('clear');

    // Show the reset button if either input is not empty
    if (searchTerm) {
        clear.style.display = 'block';
        clear.style.boxShadow = 'none';
    } else {
        clear.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', function () {
    const resultsDiv = document.getElementById('results');
    const download = document.getElementById('download');
    const reset = document.getElementById('reset');
    const loadingMessage = document.getElementById('loadingMessage');

    resultsDiv.innerHTML = ''; // Clear previous results
    download.style.display = 'none'; // Hide download button
    reset.style.display = 'none'; // Hide reset button
    loadingMessage.style.display = 'none'; // Hide loading message

    document.getElementById('searchTerm').addEventListener('input', toggleClearButton);
});
