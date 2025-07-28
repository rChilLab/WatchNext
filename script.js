document.addEventListener('DOMContentLoaded', () => {
    // --- Alle DOM-Elemente und JavaScript-Funktionen sind hier unverändert ---
    const body = document.body;
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    const randomMovieBtn = document.getElementById('random-movie-btn');
    const randomSeriesBtn = document.getElementById('random-series-btn');
    const upcomingMovieBtn = document.getElementById('upcoming-movie-btn');
    const watchlistBtn = document.getElementById('watchlist-btn');
    const resultDiv = document.getElementById('result-div');
    const genreListDiv = document.getElementById('genre-list');
    const clearFilterBtn = document.getElementById('clear-filter-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const settingsOverlay = document.getElementById('settings-overlay');
    const detailOverlay = document.getElementById('detail-overlay');
    const detailPanel = document.getElementById('detail-panel');
    const detailContentDiv = document.getElementById('detail-content');
    const trailerOverlay = document.getElementById('trailer-overlay');
    const youtubeIframe = document.getElementById('youtube-trailer-iframe');
    const apiKeyInput = document.getElementById('api-key-input');
    const saveApiKeyBtn = document.getElementById('save-api-key-btn');
    const languageSelect = document.getElementById('language-select');
    const providerSelectionContainer = document.getElementById('provider-selection-container');
    const providerSearchInput = document.getElementById('provider-search');
    const themeToggle = document.getElementById('theme-toggle');

    let tmdbApiKey = localStorage.getItem('tmdbApiKey');
    let selectedLanguage = localStorage.getItem('selectedLanguage') || 'DE';
    let selectedProviders = JSON.parse(localStorage.getItem('selectedProviders')) || [];
    let watchlist = JSON.parse(localStorage.getItem('movieFinderWatchlist')) || [];
    let currentTheme = localStorage.getItem('theme') || 'light';
    let allGenres = [];

    const renderResults = (results, type) => {
    resultDiv.innerHTML = ''; // Leert vorherige Ergebnisse
    if (results.length === 0) {
        resultDiv.innerHTML = '<div class="info-message"><p>Keine Ergebnisse gefunden.</p></div>';
        return;
    }

    results.forEach(item => {
        // Überspringe Einträge ohne Poster
        if (!item.poster_path) return;

        const card = document.createElement('div');
        card.className = 'content-card';
        card.dataset.id = item.id;
        card.dataset.type = item.media_type || type;

        const title = item.title || item.name;
        const releaseDate = item.release_date || item.first_air_date;
        const year = releaseDate ? new Date(releaseDate).getFullYear() : 'N/A';

        // --- NEU: Logik für das Bewertungs-Badge ---
        let ratingBadgeHTML = '';
        // Badge nur anzeigen, wenn eine Bewertung vorhanden und die Stimmenanzahl relevant ist
        if (typeof item.vote_average === 'number' && item.vote_average > 0) {
            const rating = item.vote_average.toFixed(1); // Auf eine Nachkommastelle runden
            ratingBadgeHTML = `<div class="rating-badge">${rating}</div>`;
        }
        // --- Ende der neuen Logik ---

        // HTML für die Karte, jetzt inklusive des (optionalen) Badges
        card.innerHTML = `
            ${ratingBadgeHTML}
            <img src="https://image.tmdb.org/t/p/w342${item.poster_path}" alt="${title}" loading="lazy">
            <div class="card-info">
                <h4>${title}</h4>
                <p>${year}</p>
            </div>
        `;
        resultDiv.appendChild(card);
    });
};


    const apiRequest = async (endpoint, params = '') => {
        if (!tmdbApiKey) { throw new Error("API Key ist nicht gesetzt."); }
        const region = selectedLanguage;
        const langCode = selectedLanguage === 'DE' ? 'de-DE' : 'en-US';
        const url = `https://api.themoviedb.org/3/${endpoint}?language=${langCode}&region=${region}${params}`;
        const options = { method: 'GET', headers: { accept: 'application/json', Authorization: `Bearer ${tmdbApiKey}` } };
        const response = await fetch(url, options);
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.status_message || 'API request failed');
        }
        return response.json();
    };

    const renderContent = (contentList) => {
        if (!contentList || contentList.length === 0) {
            resultDiv.innerHTML = '<div class="info-message"><p>Keine Ergebnisse gefunden.</p></div>';
            return;
        }
        resultDiv.innerHTML = contentList.map(item => {
            const title = item.title || item.name;
            const releaseDate = item.release_date || item.first_air_date;
            const year = releaseDate ? new Date(releaseDate).getFullYear() : 'N/A';
            const posterPath = item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : 'https://via.placeholder.com/342x513.png?text=Kein+Bild';

            let ratingBadgeHTML = '';
            if (typeof item.vote_average === 'number' && item.vote_average > 0) {
                const rating = item.vote_average.toFixed(1);
                ratingBadgeHTML = `<div class="rating-badge">${rating}</div>`;
            }

            return `
                <div class="content-card" data-id="${item.id}" data-type="${item.media_type || (item.title ? 'movie' : 'tv')}">
                    ${ratingBadgeHTML}
                    <img src="${posterPath}" alt="${title}" loading="lazy">
                    <div class="card-info">
                        <h4>${title}</h4>
                        <p>${year}</p>
                    </div>
                </div>
            `;
        }).join('');
    };

    const showLoading = () => { resultDiv.innerHTML = '<div class="loading"><p>Lade...</p></div>'; };

    const handleSearch = async (event) => {
        event.preventDefault();
        const query = searchInput.value.trim();
        if (!query) return;
        clearActiveFilter();
        showLoading();
        try {
            const searchData = await apiRequest('search/multi', `&query=${encodeURIComponent(query)}`);
            const filteredResults = searchData.results.filter(item => (item.media_type === 'movie' || item.media_type === 'tv') && item.poster_path);
            renderContent(filteredResults);
        } catch (error) { resultDiv.innerHTML = `<div class="error">${error.message}</div>`; }
    };

    const handleRandomContent = async (type) => {
        if (detailOverlay.classList.contains('hidden')) {
            clearActiveFilter();
            showLoading();
        } else {
             detailContentDiv.innerHTML = '<div class="loading" style="color:white;"><p>Lade nächsten Vorschlag...</p></div>';
        }

        let allResults = [];
        try {
            const providersParam = selectedProviders.length > 0 ? `&with_watch_providers=${selectedProviders.join('|')}&watch_region=${selectedLanguage}` : '';
            const promises = Array.from({length: 10}, (_, i) => i + 1).map(page =>
                apiRequest(`discover/${type}`, `&sort_by=popularity.desc&page=${page}${providersParam}`)
            );
            const results = await Promise.all(promises);
            results.forEach(pageData => { allResults.push(...pageData.results.filter(item => item.poster_path && item.backdrop_path && item.overview)); });

            if (allResults.length > 0) {
                const randomItem = allResults[Math.floor(Math.random() * allResults.length)];
                await showDetailView(randomItem.id, type, true);
            } else {
                 if (detailOverlay.classList.contains('hidden')) {
                    resultDiv.innerHTML = '<div class="info-message"><p>Kein passender Inhalt für einen Zufallsvorschlag gefunden.</p></div>';
                 } else {
                     detailContentDiv.innerHTML = `<div class="error" style="color:white;">Kein weiterer Vorschlag gefunden.</div>`
                 }
            }
        } catch (error) { resultDiv.innerHTML = `<div class="error">Zufallsvorschlag fehlgeschlagen: ${error.message}</div>`; }
    };

    const showDetailView = async (id, type, fromRandom = false) => {
        if (detailOverlay.classList.contains('hidden')) {
            detailContentDiv.innerHTML = '<div class="loading" style="color:white;"><p>Lade Details...</p></div>';
            openOverlay(detailOverlay);
        }
        detailPanel.style.backgroundImage = 'none';

        try {
            const details = await apiRequest(`${type}/${id}`, '&append_to_response=videos,credits,watch/providers');

            const imagePath = details.backdrop_path ? `https://image.tmdb.org/t/p/w1280${details.backdrop_path}` : details.poster_path ? `https://image.tmdb.org/t/p/w780${details.poster_path}` : '';
            detailPanel.style.backgroundImage = imagePath ? `url('${imagePath}')` : 'none';
            detailPanel.style.backgroundColor = imagePath ? 'transparent' : 'var(--bg-dark)';

            const title = details.title || details.name;
            const releaseDate = details.release_date || details.first_air_date;
            const year = releaseDate ? new Date(releaseDate).getFullYear() : 'N/A';
            const director = details.credits?.crew.find(p => p.job === 'Director')?.name;
            const cast = details.credits?.cast.slice(0, 5).map(p => p.name).join(', ');
            const providers = details['watch/providers']?.results?.[selectedLanguage]?.flatrate || [];

            const videos = details.videos?.results || [];
            const trailers = videos.filter(v => v.site === 'YouTube' && v.type === 'Trailer');
            const langShort = selectedLanguage.toLowerCase();
            const bestTrailer = trailers.find(t => t.iso_639_1.toLowerCase() === langShort) || trailers.find(t => t.iso_639_1.toLowerCase() === 'en') || trailers[0];

            const isOnWatchlist = watchlist.some(item => item.id === details.id);
            const watchlistBtnText = isOnWatchlist ? 'Von Watchlist entfernen' : 'Zur Watchlist hinzufügen';
            const watchlistBtnClass = isOnWatchlist ? 'btn-danger' : 'btn-primary';

            const nextArrowSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/></svg>`;

            let collectionHTML = '';
            if (details.belongs_to_collection && details.belongs_to_collection.poster_path) {
                const collection = details.belongs_to_collection;
                collectionHTML = `
                    <div class="collection-info" data-action="show-collection" data-id="${collection.id}" title="Zeige die '${collection.name}'-Collection">
                       <img src="https://image.tmdb.org/t/p/w185${collection.poster_path}" alt="${collection.name}">
                       <div>
                            <h4>Teil der ${collection.name}</h4>
                            <p>Klicken, um alle Filme anzuzeigen</p>
                       </div>
                    </div>
                `;
            }

            detailContentDiv.innerHTML = `
                <div id="detail-info">
                    <h2>${title} (${year})</h2>
                    <p><strong>Genres:</strong> ${details.genres.map(g => g.name).join(', ')}</p>
                    ${director ? `<p><strong>Regie:</strong> ${director}</p>` : ''}
                    <p><strong>Besetzung:</strong> ${cast || 'N/A'}</p>
                    <p>${details.overview || 'Keine Beschreibung verfügbar.'}</p>
                </div>

                <div>
                    ${collectionHTML}
                    <div class="streaming-providers">
                        <h4>Verfügbar auf:</h4>
                        <div class="provider-list">
                            ${providers.length > 0 ? providers.map(p => `<div class="provider-logo" title="${p.provider_name}"><img src="https://image.tmdb.org/t/p/w92${p.logo_path}" alt="${p.provider_name}"></div>`).join('') : '<p>Auf keinem deiner Dienste verfügbar.</p>'}
                        </div>
                    </div>
                    <div id="detail-actions-container">
                        <div id="main-actions">
                             ${bestTrailer ? `<button class="btn" data-action="trailer" data-key="${bestTrailer.key}">Trailer ansehen</button>` : ''}
                             <button class="btn ${watchlistBtnClass}" data-action="watchlist" data-id="${details.id}" data-type="${type}" data-title="${title}" data-poster="${details.poster_path}" data-year="${year}">${watchlistBtnText}</button>
                             <a class="btn" href="https://www.themoviedb.org/${type}/${details.id}" target="_blank" rel="noopener noreferrer">Auf TMDb öffnen</a>
                        </div>
                        ${fromRandom ? `
                            <button class="btn" id="next-suggestion-btn" data-action="next-random" data-type="${type}" title="Nächster Vorschlag">${nextArrowSVG}</button>
                        ` : ''}
                    </div>
                </div>
            `;
        } catch (error) {
            detailPanel.style.backgroundImage = 'none';
            detailContentDiv.innerHTML = `<div class="error" style="color:white; background:rgba(0,0,0,0.5); padding:20px; border-radius:var(--radius);">Details konnten nicht geladen werden: ${error.message}</div>`;
        }
    };

    const handleDetailClick = (event) => { const card = event.target.closest('.content-card'); if (card) { const { id, type } = card.dataset; if (id && type) { showDetailView(parseInt(id), type); } } };
    const handleShowCollection = async (collectionId) => { closeOverlay(detailOverlay); showLoading(); clearActiveFilter(); searchInput.value = ''; try { const collectionData = await apiRequest(`collection/${collectionId}`); if (collectionData.parts && collectionData.parts.length > 0) { const moviesWithMediaType = collectionData.parts.filter(p => p.poster_path).map(p => ({ ...p, media_type: 'movie' })); renderContent(moviesWithMediaType); } else { resultDiv.innerHTML = '<div class="info-message"><p>Diese Collection enthält keine weiteren Filme.</p></div>'; } } catch (error) { resultDiv.innerHTML = `<div class="error">Collection konnte nicht geladen werden: ${error.message}</div>`; } };
    const handleDetailActions = (event) => {
        const watchlistBtn = event.target.closest('[data-action="watchlist"]');
        const trailerBtn = event.target.closest('[data-action="trailer"]');
        const nextRandomBtn = event.target.closest('[data-action="next-random"]');
        const collectionBtn = event.target.closest('[data-action="show-collection"]');
        if (watchlistBtn) {
            const id = parseInt(watchlistBtn.dataset.id);
            const index = watchlist.findIndex(item => item.id === id);
            if (index > -1) { watchlist.splice(index, 1); watchlistBtn.textContent = 'Zur Watchlist hinzufügen'; watchlistBtn.classList.replace('btn-danger', 'btn-primary'); } else { watchlist.push({ id: id, type: watchlistBtn.dataset.type, title: watchlistBtn.dataset.title, poster_path: watchlistBtn.dataset.poster, year: watchlistBtn.dataset.year, media_type: watchlistBtn.dataset.type }); watchlistBtn.textContent = 'Von Watchlist entfernen'; watchlistBtn.classList.replace('btn-primary', 'btn-danger'); }
            localStorage.setItem('movieFinderWatchlist', JSON.stringify(watchlist));
        }
        if (trailerBtn) { const key = trailerBtn.dataset.key; youtubeIframe.src = `https://www.youtube.com/embed/${key}?autoplay=1&hl=${selectedLanguage}`; openOverlay(trailerOverlay); }
        if (nextRandomBtn) { const type = nextRandomBtn.dataset.type; handleRandomContent(type); }
        if (collectionBtn) { const collectionId = collectionBtn.dataset.id; handleShowCollection(collectionId); }
    };
    const closeTrailer = () => { youtubeIframe.src = ''; closeOverlay(trailerOverlay); };
    const handleShowWatchlist = () => { clearActiveFilter(); searchInput.value = ''; if (watchlist.length > 0) { const watchlistWithYears = watchlist.map(item => ({ ...item, release_date: `${item.year}-01-01` })); renderContent(watchlistWithYears); } else { resultDiv.innerHTML = '<div class="info-message"><h3>Deine Watchlist ist leer.</h3></div>'; } };
    const handleUpcomingMovies = async () => {
        clearActiveFilter();
        searchInput.value = '';
        showLoading();
        try {
            let allResults = [];
            for (let page = 1; page <= 3; page++) {
                const data = await apiRequest('movie/upcoming', `&page=${page}`);
                allResults = allResults.concat(data.results);
            }
            const filtered = allResults.filter(item => item.poster_path);
            renderContent(filtered);
        } catch (error) {
            resultDiv.innerHTML = `<div class="error">${error.message}</div>`;
        }
    };

    const openOverlay = (overlay) => { overlay.classList.remove('hidden'); body.classList.add('body-no-scroll'); };
    const closeOverlay = (overlay) => { overlay.classList.add('hidden'); body.classList.remove('body-no-scroll'); };
    const renderUnifiedGenres = () => { genreListDiv.innerHTML = allGenres.map(genre => `<button class="genre-btn" data-id="${genre.id}" data-name="${genre.name}">${genre.name}</button>`).join(''); };
    const handleGenreClick = async (event) => { const btn = event.target.closest('.genre-btn'); if (!btn) return; const genreId = btn.dataset.id; clearActiveFilter(true); btn.classList.add('active'); clearFilterBtn.classList.remove('hidden'); searchInput.value = ''; showLoading(); try { const providersParam = selectedProviders.length > 0 ? `&with_watch_providers=${selectedProviders.join('|')}&watch_region=${selectedLanguage}` : ''; const [movieData, tvData] = await Promise.all([apiRequest('discover/movie', `&with_genres=${genreId}${providersParam}`), apiRequest('discover/tv', `&with_genres=${genreId}${providersParam}`)]); const combined = [...movieData.results, ...tvData.results].filter(item => item.poster_path).sort((a,b) => b.popularity - a.popularity).map(item => ({ ...item, media_type: item.title ? 'movie' : 'tv' })); renderContent(combined); } catch(error) { resultDiv.innerHTML = `<div class="error">${error.message}</div>`; } };
    const clearActiveFilter = (keepButton = false) => { document.querySelectorAll('.genre-btn.active').forEach(b => b.classList.remove('active')); if (!keepButton) { clearFilterBtn.classList.add('hidden'); } };
    const applyTheme = (theme) => { currentTheme = theme; body.className = theme === 'dark' ? 'dark-mode' : ''; themeToggle.textContent = theme === 'dark' ? 'Helles Theme' : 'Dunkles Theme'; localStorage.setItem('theme', theme); };
    const populateLanguageOptions = async () => { const languages = { "DE": "Deutschland", "US": "United States", "GB": "United Kingdom", "FR": "France", "ES": "Spain", "IT": "Italy" }; languageSelect.innerHTML = Object.entries(languages).map(([code, name]) => `<option value="${code}" ${code === selectedLanguage ? 'selected' : ''}>${name}</option>`).join(''); };
    const renderProvidersForSelection = async () => { providerSelectionContainer.innerHTML = '<p>Lade Anbieter...</p>'; try { const region = selectedLanguage; const [movieProviders, tvProviders] = await Promise.all([apiRequest('watch/providers/movie', `&watch_region=${region}`), apiRequest('watch/providers/tv', `&watch_region=${region}`)]); const allProviders = new Map(); [...movieProviders.results, ...tvProviders.results].forEach(p => { if (!allProviders.has(p.provider_id)) { allProviders.set(p.provider_id, p); } }); const sortedProviders = [...allProviders.values()].sort((a,b) => a.provider_name.localeCompare(b.provider_name)); providerSelectionContainer.innerHTML = sortedProviders.map(p => `<label class="provider-choice" data-name="${p.provider_name.toLowerCase()}"><input type="checkbox" value="${p.provider_id}" ${selectedProviders.includes(p.provider_id) ? 'checked' : ''}><img src="https://image.tmdb.org/t/p/w92${p.logo_path}" title="${p.provider_name}" alt="${p.provider_name}"></label>`).join(''); } catch (error) { providerSelectionContainer.innerHTML = `<p class="error">Anbieter konnten nicht geladen werden: ${error.message}</p>`; } };
    const handleSaveApiKey = () => { const newKey = apiKeyInput.value.trim(); if (newKey) { tmdbApiKey = newKey; localStorage.setItem('tmdbApiKey', newKey); closeOverlay(settingsOverlay); initializeApp(); } };
    const handleLanguageChange = async (event) => { selectedLanguage = event.target.value; localStorage.setItem('selectedLanguage', selectedLanguage); selectedProviders = []; localStorage.setItem('selectedProviders', JSON.stringify([])); await renderProvidersForSelection(); };
    const handleProviderFilter = (event) => { const query = event.target.value.toLowerCase(); document.querySelectorAll('.provider-choice').forEach(choice => { const name = choice.dataset.name; choice.classList.toggle('hidden', !name.includes(query)); }); };
    const handleSaveProviders = (event) => { if (event.target.type === 'checkbox') { const providerId = parseInt(event.target.value); if (event.target.checked) { if (!selectedProviders.includes(providerId)) selectedProviders.push(providerId); } else { selectedProviders = selectedProviders.filter(id => id !== providerId); } localStorage.setItem('selectedProviders', JSON.stringify(selectedProviders)); } };
    const initializeApp = async () => { applyTheme(currentTheme); apiKeyInput.value = tmdbApiKey || ''; await populateLanguageOptions(); if (tmdbApiKey) { try { const [movieGenreData, tvGenreData] = await Promise.all([apiRequest('genre/movie/list'), apiRequest('genre/tv/list')]); const genreMap = new Map(); [...movieGenreData.genres, ...tvGenreData.genres].forEach(genre => { if (!genreMap.has(genre.name)) { genreMap.set(genre.name, genre); } }); allGenres = Array.from(genreMap.values()).sort((a,b) => a.name.localeCompare(b.name)); renderUnifiedGenres(); await renderProvidersForSelection(); } catch (error) { resultDiv.innerHTML = `<div class="error">Initialisierung fehlgeschlagen: ${error.message}<br>Prüfe deinen API Key.</div>`; } } else { resultDiv.innerHTML = '<div class="placeholder"><h2>Willkommen!</h2><p>Öffne die Einstellungen, um deinen API-Key einzugeben.</p></div>'; } };

    searchForm.addEventListener('submit', handleSearch);
    randomMovieBtn.addEventListener('click', () => handleRandomContent('movie'));
    randomSeriesBtn.addEventListener('click', () => handleRandomContent('tv'));
    upcomingMovieBtn.addEventListener("click", handleUpcomingMovies);
    watchlistBtn.addEventListener('click', handleShowWatchlist);
    genreListDiv.addEventListener('click', handleGenreClick);
    clearFilterBtn.addEventListener('click', () => { clearActiveFilter(); searchInput.value = ''; resultDiv.innerHTML = '<div class="placeholder"><p>Suche nach etwas oder wähle ein Genre.</p></div>'; });
    resultDiv.addEventListener('click', handleDetailClick);
    detailContentDiv.addEventListener('click', handleDetailActions);
    settingsBtn.addEventListener('click', () => openOverlay(settingsOverlay));
    saveApiKeyBtn.addEventListener('click', handleSaveApiKey);
    languageSelect.addEventListener('change', handleLanguageChange);
    providerSearchInput.addEventListener('input', handleProviderFilter);
    providerSelectionContainer.addEventListener('change', handleSaveProviders);
    themeToggle.addEventListener('click', () => applyTheme(currentTheme === 'light' ? 'dark' : 'light'));
    document.querySelectorAll('.panel-close-btn').forEach(btn => {
        if (btn.closest('#trailer-overlay')) {
            btn.addEventListener('click', closeTrailer);
        } else {
            btn.addEventListener('click', () => closeOverlay(btn.closest('.overlay')));
        }
    });

    initializeApp();
});
