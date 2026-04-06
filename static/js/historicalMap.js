const HistoricalMap = (() => {
    let configMap = null;   // Leaflet map on configure screen
    let viewMap = null;     // Leaflet map on view screen
    let imageUrl = null;
    let imageHeight = 0;
    let imageWidth = 0;
    let cpMarkers = [];
    let locationMarkers = [];
    let clickCallback = null;

    function loadImage(url, width, height) {
        imageUrl = url;
        imageWidth = width;
        imageHeight = height;
        initConfigMap();
    }

    function initConfigMap() {
        if (configMap) configMap.remove();

        const bounds = [[0, 0], [imageHeight, imageWidth]];
        configMap = L.map('historical-map', {
            crs: L.CRS.Simple,
            minZoom: -5,
            maxZoom: 5,
            zoomSnap: 0.25,
        });
        L.imageOverlay(imageUrl, bounds).addTo(configMap);
        configMap.fitBounds(bounds);

        configMap.on('click', (e) => {
            if (clickCallback) {
                const px = e.latlng.lng;
                const py = imageHeight - e.latlng.lat;
                clickCallback(px, py);
            }
        });
    }

    function initViewMap() {
        if (viewMap) viewMap.remove();

        const bounds = [[0, 0], [imageHeight, imageWidth]];
        viewMap = L.map('view-map', {
            crs: L.CRS.Simple,
            minZoom: -5,
            maxZoom: 5,
            zoomSnap: 0.25,
        });
        L.imageOverlay(imageUrl, bounds).addTo(viewMap);
        viewMap.fitBounds(bounds);
    }

    function onMapClick(callback) {
        clickCallback = callback;
    }

    function clearClickCallback() {
        clickCallback = null;
    }

    let pendingMarker = null;

    function addPendingMarker(px, py) {
        clearPendingMarker();
        if (!configMap) return;
        const leafletY = imageHeight - py;
        pendingMarker = L.circleMarker([leafletY, px], {
            radius: 10,
            color: '#e94560',
            fillColor: '#e94560',
            fillOpacity: 0.4,
            weight: 2,
            dashArray: '4 4',
        }).addTo(configMap);
    }

    function clearPendingMarker() {
        if (pendingMarker && configMap) {
            configMap.removeLayer(pendingMarker);
        }
        pendingMarker = null;
    }

    function addControlPointMarker(id, px, py, number) {
        if (!configMap) return;
        const leafletY = imageHeight - py;
        const marker = L.circleMarker([leafletY, px], {
            radius: 10,
            color: '#e94560',
            fillColor: '#e94560',
            fillOpacity: 0.8,
            weight: 2,
        }).addTo(configMap);

        marker.bindTooltip(String(number), {
            permanent: true,
            direction: 'center',
            className: 'cp-tooltip',
        });
        marker._cpId = id;
        cpMarkers.push(marker);
    }

    function removeControlPointMarker(id) {
        cpMarkers = cpMarkers.filter(m => {
            if (m._cpId === id) {
                if (configMap) configMap.removeLayer(m);
                return false;
            }
            return true;
        });
    }

    function clearControlPointMarkers() {
        cpMarkers.forEach(m => configMap && configMap.removeLayer(m));
        cpMarkers = [];
    }

    function plotLocations(points, displaySettings, markerStyle) {
        clearLocationMarkers();
        if (!viewMap) return;

        const mColor = (markerStyle && markerStyle.color) || '#4ecca3';
        const mRadius = (markerStyle && markerStyle.radius) || 7;

        points.forEach((pt, i) => {
            const leafletY = imageHeight - pt.py;
            const marker = L.circleMarker([leafletY, pt.px], {
                radius: mRadius,
                color: mColor,
                fillColor: mColor,
                fillOpacity: 0.9,
                weight: 1,
            }).addTo(viewMap);

            const settings = displaySettings && displaySettings[i] ? displaySettings[i] : {};
            const displayName = settings.title || pt.formatted_address || pt.address;

            // Build permanent tooltip content based on settings
            const tooltipParts = [];
            if (settings.showTooltip) {
                tooltipParts.push(displayName);
                if (settings.description) tooltipParts.push(`<em>${settings.description}</em>`);
            }
            if (settings.showCoords) tooltipParts.push(`${pt.lat.toFixed(5)}, ${pt.lng.toFixed(5)}`);

            if (tooltipParts.length > 0) {
                marker.bindTooltip(tooltipParts.join('<br>'), {
                    permanent: true,
                    direction: 'top',
                    offset: [0, -8],
                    className: 'location-tooltip',
                });
            }

            // Always have a click popup with full info
            const popupParts = [`<strong>${displayName}</strong>`];
            if (settings.description) popupParts.push(`<em>${settings.description}</em>`);
            popupParts.push(`<small>${pt.formatted_address || pt.address}</small>`);
            popupParts.push(`<small>${pt.lat.toFixed(5)}, ${pt.lng.toFixed(5)}</small>`);
            marker.bindPopup(popupParts.join('<br>'));
            locationMarkers.push(marker);
        });
    }

    function clearLocationMarkers() {
        locationMarkers.forEach(m => viewMap && viewMap.removeLayer(m));
        locationMarkers = [];
    }

    function isLoaded() {
        return imageUrl !== null;
    }

    function getImageInfo() {
        return { url: imageUrl, width: imageWidth, height: imageHeight };
    }

    function destroy() {
        if (configMap) { configMap.remove(); configMap = null; }
        if (viewMap) { viewMap.remove(); viewMap = null; }
        imageUrl = null;
        cpMarkers = [];
        locationMarkers = [];
        clickCallback = null;
        imageHeight = 0;
        imageWidth = 0;
    }

    let lastPlotData = null;

    function getLastPlotData() {
        return lastPlotData;
    }

    function setLastPlotData(points, displaySettings, markerStyle) {
        lastPlotData = { points, displaySettings, markerStyle };
    }

    /**
     * Render the map image + markers + labels to a canvas at full image resolution.
     * Returns a Promise<Canvas>.
     */
    function renderToCanvas() {
        return new Promise((resolve, reject) => {
            if (!imageUrl || !lastPlotData) {
                return reject(new Error('No map or plot data'));
            }

            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = imageWidth;
                canvas.height = imageHeight;
                const ctx = canvas.getContext('2d');

                // Draw the map image
                ctx.drawImage(img, 0, 0, imageWidth, imageHeight);

                const { points, displaySettings, markerStyle } = lastPlotData;
                const mColor = (markerStyle && markerStyle.color) || '#4ecca3';
                const mRadius = (markerStyle && markerStyle.radius) || 7;
                // Scale marker size relative to image (assume ~1000px base)
                const scale = Math.max(imageWidth, imageHeight) / 1000;
                const r = mRadius * scale;
                const fontSize = Math.max(12, Math.round(11 * scale));

                points.forEach((pt, i) => {
                    const x = pt.px;
                    const y = pt.py;

                    // Draw filled circle
                    ctx.beginPath();
                    ctx.arc(x, y, r, 0, Math.PI * 2);
                    ctx.fillStyle = mColor;
                    ctx.globalAlpha = 0.9;
                    ctx.fill();
                    ctx.globalAlpha = 1;
                    ctx.strokeStyle = mColor;
                    ctx.lineWidth = Math.max(1, scale * 0.5);
                    ctx.stroke();

                    // Draw label / coords if enabled
                    const settings = displaySettings && displaySettings[i] ? displaySettings[i] : {};
                    const parts = [];
                    const displayName = settings.title || pt.formatted_address || pt.address;
                    if (settings.showTooltip) {
                        parts.push(displayName);
                        if (settings.description) parts.push(settings.description);
                    }
                    if (settings.showCoords) parts.push(`${pt.lat.toFixed(5)}, ${pt.lng.toFixed(5)}`);

                    if (parts.length > 0) {
                        ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
                        ctx.textAlign = 'center';

                        const lineHeight = fontSize * 1.3;
                        const textY = y - r - 6 * scale;

                        // Measure max width for background
                        let maxWidth = 0;
                        parts.forEach(p => {
                            const w = ctx.measureText(p).width;
                            if (w > maxWidth) maxWidth = w;
                        });

                        const padding = 4 * scale;
                        const bgHeight = parts.length * lineHeight + padding * 2;
                        const bgY = textY - bgHeight + padding;

                        // Draw background
                        ctx.fillStyle = 'rgba(22, 33, 62, 0.9)';
                        const bgX = x - maxWidth / 2 - padding;
                        ctx.fillRect(bgX, bgY, maxWidth + padding * 2, bgHeight);
                        ctx.strokeStyle = mColor;
                        ctx.lineWidth = Math.max(1, scale * 0.5);
                        ctx.strokeRect(bgX, bgY, maxWidth + padding * 2, bgHeight);

                        // Draw text lines
                        ctx.fillStyle = '#e0e0e0';
                        parts.forEach((p, li) => {
                            const ly = bgY + padding + (li + 1) * lineHeight - fontSize * 0.2;
                            ctx.fillText(p, x, ly);
                        });
                    }
                });

                resolve(canvas);
            };
            img.onerror = () => reject(new Error('Failed to load map image'));
            img.src = imageUrl;
        });
    }

    return {
        loadImage, initViewMap, onMapClick, clearClickCallback,
        addPendingMarker, clearPendingMarker,
        addControlPointMarker, removeControlPointMarker, clearControlPointMarkers,
        plotLocations, clearLocationMarkers, isLoaded, getImageInfo,
        setLastPlotData, getLastPlotData, renderToCanvas, destroy,
    };
})();
