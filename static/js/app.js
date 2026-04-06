const App = (() => {
    let markerColor = '#4ecca3';
    let markerSize = 7;

    function init() {
        // --- Screen 1: Configure ---
        document.getElementById('map-upload').addEventListener('change', handleMapUpload);
        document.getElementById('btn-clear-cp').addEventListener('click', () => ControlPoints.clear());
        document.getElementById('btn-add-extra').addEventListener('click', () => ControlPoints.addExtra());
        document.getElementById('btn-next').addEventListener('click', goToDataScreen);

        // --- Screen 2: Add Data ---
        document.getElementById('btn-geocode').addEventListener('click', handleGeocodeSingle);
        document.getElementById('addr-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleGeocodeSingle();
        });
        document.getElementById('csv-upload').addEventListener('change', handleCSVUpload);
        document.getElementById('btn-csv-template').addEventListener('click', downloadCSVTemplate);
        document.getElementById('btn-clear-addr').addEventListener('click', () => Geocoding.clear());
        document.getElementById('btn-view-map').addEventListener('click', goToMapScreen);
        document.getElementById('btn-back-configure').addEventListener('click', goToConfigureScreen);

        // --- Marker style controls ---
        document.getElementById('marker-color').addEventListener('input', (e) => {
            markerColor = e.target.value;
            drawMarkerPreview();
        });
        document.getElementById('marker-size').addEventListener('input', (e) => {
            markerSize = parseInt(e.target.value);
            document.getElementById('marker-size-val').textContent = markerSize;
            drawMarkerPreview();
        });

        // --- Toggle buttons ---
        document.getElementById('btn-show-data').addEventListener('click', goToDataScreen);
        document.getElementById('btn-show-map').addEventListener('click', goToMapScreen);
        document.getElementById('btn-show-data2').addEventListener('click', goToDataScreen);
        document.getElementById('btn-show-map2').addEventListener('click', goToMapScreen);

        // --- Download & Save ---
        document.getElementById('btn-download').addEventListener('click', handleDownload);
        document.getElementById('btn-save').addEventListener('click', openSaveModal);
        document.getElementById('btn-cancel-save').addEventListener('click', closeSaveModal);
        document.getElementById('btn-confirm-save').addEventListener('click', handleSave);
        document.getElementById('btn-copy-link').addEventListener('click', copyShareLink);
        document.getElementById('btn-close-modal').addEventListener('click', closeSaveModal);
    }

    // --- Marker preview ---
    function drawMarkerPreview() {
        const canvas = document.getElementById('marker-preview');
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#222';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw the marker
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2, markerSize, 0, Math.PI * 2);
        ctx.fillStyle = markerColor;
        ctx.globalAlpha = 0.9;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = markerColor;
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    // --- Screen navigation ---
    function showScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(id).classList.add('active');
    }

    function goToConfigureScreen() {
        showScreen('screen-configure');
        setTimeout(() => {
            if (HistoricalMap.isLoaded()) {
                const info = HistoricalMap.getImageInfo();
                HistoricalMap.loadImage(info.url, info.width, info.height);
                ControlPoints.getAll().forEach(p => {
                    HistoricalMap.addControlPointMarker(p.id, p.px, p.py, p.number);
                });
                ReferenceMap.init();
                setTimeout(() => {
                    ReferenceMap.triggerResize();
                    ControlPoints.getAll().forEach(p => {
                        ReferenceMap.addControlPointMarker(p.id, p.lat, p.lng, p.number);
                    });
                    ControlPoints.updateDots();
                    ControlPoints.updateButtons();
                    ControlPoints.startListening();
                }, 100);
            }
        }, 50);
    }

    function goToDataScreen() {
        ControlPoints.stopListening();
        showScreen('screen-data');
        // Show marker style section if there are addresses
        updateMarkerStyleVisibility();
        drawMarkerPreview();
    }

    function goToMapScreen() {
        ControlPoints.stopListening();
        showScreen('screen-map');

        setTimeout(async () => {
            HistoricalMap.initViewMap();
            await plotLocations();
        }, 50);
    }

    function updateMarkerStyleVisibility() {
        const section = document.getElementById('marker-style-section');
        section.style.display = Geocoding.count() > 0 ? 'block' : 'none';
    }

    // --- Map Upload ---
    async function handleMapUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const resp = await fetch('/api/upload-map', { method: 'POST', body: formData });
            if (!resp.ok) {
                const err = await resp.json();
                throw new Error(err.detail || 'Upload failed');
            }
            const data = await resp.json();

            document.getElementById('wizard-upload').classList.add('hidden');
            document.getElementById('wizard-cp').classList.remove('hidden');
            document.getElementById('step-upload').classList.remove('active');
            document.getElementById('step-upload').classList.add('done');
            document.getElementById('step-upload').textContent = '1. Upload Map \u2713';
            document.getElementById('step-control-points').classList.add('active');

            HistoricalMap.loadImage(data.url, data.width, data.height);
            ReferenceMap.init();
            setTimeout(() => {
                ReferenceMap.triggerResize();
                ControlPoints.startListening();
            }, 200);

        } catch (err) {
            alert('Upload error: ' + err.message);
        }
        e.target.value = '';
    }

    // --- Geocoding ---
    async function handleGeocodeSingle() {
        const input = document.getElementById('addr-input');
        const titleInput = document.getElementById('addr-title');
        const descInput = document.getElementById('addr-desc');
        const address = input.value.trim();
        if (!address) return;

        const title = titleInput.value.trim();
        const description = descInput.value.trim();

        const statusEl = document.getElementById('addr-status');
        statusEl.textContent = 'Geocoding...';
        statusEl.className = 'data-status';

        try {
            await Geocoding.geocodeSingle(address, title, description);
            input.value = '';
            titleInput.value = '';
            descInput.value = '';
            statusEl.textContent = 'Address added';
            statusEl.className = 'data-status success';
            updateMarkerStyleVisibility();
        } catch (err) {
            statusEl.textContent = err.message;
            statusEl.className = 'data-status error';
        }
    }

    async function handleCSVUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const statusEl = document.getElementById('addr-status');
        statusEl.innerHTML = 'Geocoding CSV... <span class="spinner"></span>';
        statusEl.className = 'data-status';

        try {
            const result = await Geocoding.geocodeCSV(file);
            let msg = `${result.success} addresses geocoded`;
            if (result.errors > 0) msg += `, ${result.errors} failed`;
            statusEl.textContent = msg;
            statusEl.className = result.errors > 0 ? 'data-status error' : 'data-status success';
            updateMarkerStyleVisibility();
        } catch (err) {
            statusEl.textContent = err.message;
            statusEl.className = 'data-status error';
        }
        e.target.value = '';
    }

    // --- Plot ---
    async function plotLocations() {
        const cp = ControlPoints.getAll();
        const addrs = Geocoding.getAll();

        if (addrs.length === 0) return;

        try {
            const resp = await fetch('/api/transform', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    control_points: cp.map(p => ({ px: p.px, py: p.py, lat: p.lat, lng: p.lng })),
                    locations: addrs,
                }),
            });

            if (!resp.ok) {
                const err = await resp.json();
                throw new Error(err.detail || 'Transform failed');
            }

            const data = await resp.json();
            const displaySettings = Geocoding.buildDisplaySettings();
            const style = { color: markerColor, radius: markerSize };
            HistoricalMap.setLastPlotData(data.points, displaySettings, style);
            HistoricalMap.plotLocations(data.points, displaySettings, style);
        } catch (err) {
            console.error('Transform error:', err.message);
        }
    }

    // --- CSV Template ---
    function downloadCSVTemplate(e) {
        e.preventDefault();
        const csv = 'address,title,description\n"123 Main St, New York, NY","Example Title","Example description"\n';
        const blob = new Blob([csv], { type: 'text/csv' });
        const link = document.createElement('a');
        link.download = 'map-overlay-template.csv';
        link.href = URL.createObjectURL(blob);
        link.click();
        URL.revokeObjectURL(link.href);
    }

    // --- Download ---
    async function handleDownload() {
        const btn = document.getElementById('btn-download');
        btn.textContent = 'Rendering...';
        btn.disabled = true;

        try {
            const canvas = await HistoricalMap.renderToCanvas();
            const link = document.createElement('a');
            link.download = 'map-overlay.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (err) {
            alert('Download failed: ' + err.message);
        }

        btn.textContent = 'Download Image';
        btn.disabled = false;
    }

    // --- Save & Share ---
    function openSaveModal() {
        document.getElementById('share-modal').classList.remove('hidden');
        document.getElementById('save-actions').classList.remove('hidden');
        document.getElementById('share-result').classList.add('hidden');
        document.getElementById('save-title').value = '';
        document.getElementById('save-title').focus();
    }

    function closeSaveModal() {
        document.getElementById('share-modal').classList.add('hidden');
    }

    async function handleSave() {
        const btn = document.getElementById('btn-confirm-save');
        btn.textContent = 'Saving...';
        btn.disabled = true;

        const plotData = HistoricalMap.getLastPlotData();
        const cp = ControlPoints.getAll();
        const addrs = Geocoding.getAll();
        const imageInfo = HistoricalMap.getImageInfo();
        const title = document.getElementById('save-title').value.trim();

        const payload = {
            title: title,
            image: imageInfo,
            controlPoints: cp.map(p => ({ px: p.px, py: p.py, lat: p.lat, lng: p.lng })),
            addresses: addrs,
            markerStyle: { color: markerColor, radius: markerSize },
            displaySettings: Geocoding.buildDisplaySettings(),
            transformedPoints: plotData ? plotData.points : [],
        };

        try {
            const resp = await fetch('/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!resp.ok) throw new Error('Save failed');

            const data = await resp.json();
            const shareUrl = `${window.location.origin}/view/${data.id}`;

            // Show share link
            document.getElementById('save-actions').classList.add('hidden');
            document.getElementById('share-result').classList.remove('hidden');
            document.getElementById('share-url').value = shareUrl;

        } catch (err) {
            alert('Save error: ' + err.message);
        }

        btn.textContent = 'Save';
        btn.disabled = false;
    }

    function copyShareLink() {
        const input = document.getElementById('share-url');
        input.select();
        navigator.clipboard.writeText(input.value);
        document.getElementById('btn-copy-link').textContent = 'Copied!';
        setTimeout(() => {
            document.getElementById('btn-copy-link').textContent = 'Copy';
        }, 2000);
    }

    // --- Banner ---
    function showBanner(text) {
        const banner = document.getElementById('mode-banner');
        banner.textContent = text;
        banner.classList.add('visible');
    }

    function hideBanner() {
        document.getElementById('mode-banner').classList.remove('visible');
    }

    document.addEventListener('DOMContentLoaded', init);

    return { showBanner, hideBanner };
})();
