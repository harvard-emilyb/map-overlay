const Geocoding = (() => {
    let addresses = [];

    function esc(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    function getAll() {
        return [...addresses];
    }

    function count() {
        return addresses.length;
    }

    async function geocodeSingle(address, title, description) {
        const resp = await fetch('/api/geocode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address }),
        });
        if (!resp.ok) {
            const err = await resp.json();
            throw new Error(err.detail || 'Geocoding failed');
        }
        const result = await resp.json();
        result.title = title || '';
        result.description = description || '';
        result.showTooltip = false;
        result.showCoords = false;
        addresses.push(result);
        updateUI();
        return result;
    }

    async function geocodeCSV(file) {
        const formData = new FormData();
        formData.append('file', file);
        const resp = await fetch('/api/geocode-csv', { method: 'POST', body: formData });
        if (!resp.ok) {
            const err = await resp.json();
            throw new Error(err.detail || 'CSV geocoding failed');
        }
        const result = await resp.json();
        if (result.geocoded) {
            result.geocoded.forEach(r => {
                r.title = r.title || '';
                r.description = r.description || '';
                r.showTooltip = false;
                r.showCoords = false;
            });
            addresses.push(...result.geocoded);
        }
        updateUI();
        return {
            success: result.geocoded ? result.geocoded.length : 0,
            errors: result.errors ? result.errors.length : 0,
        };
    }

    function toggleTooltip(index) {
        addresses[index].showTooltip = !addresses[index].showTooltip;
        updateUI();
    }

    function toggleCoords(index) {
        addresses[index].showCoords = !addresses[index].showCoords;
        updateUI();
    }

    function remove(index) {
        addresses.splice(index, 1);
        updateUI();
    }

    function clear() {
        addresses = [];
        updateUI();
    }

    function buildDisplaySettings() {
        return addresses.map(a => ({
            showTooltip: a.showTooltip || false,
            showCoords: a.showCoords || false,
            title: a.title || '',
            description: a.description || '',
        }));
    }

    function updateUI() {
        const list = document.getElementById('addr-list');
        const countEl = document.getElementById('addr-count');
        const actions = document.getElementById('data-actions');

        list.innerHTML = '';
        addresses.forEach((addr, i) => {
            const li = document.createElement('li');
            const displayTitle = addr.title || addr.formatted_address || addr.address;
            const subtitle = addr.title ? (addr.formatted_address || addr.address) : '';
            const desc = addr.description || '';

            li.innerHTML = `
                <span class="addr-check">\u2705</span>
                <span class="addr-info">
                    <span class="addr-text" title="${esc(displayTitle)}">${esc(displayTitle)}</span>
                    ${subtitle ? `<span class="addr-subtitle">${esc(subtitle)}</span>` : ''}
                    ${desc ? `<span class="addr-desc-text">${esc(desc)}</span>` : ''}
                </span>
                <span class="addr-coords">${addr.lat.toFixed(5)}, ${addr.lng.toFixed(5)}</span>
                <span class="addr-toggles">
                    <button class="toggle-icon ${addr.showTooltip ? 'on' : ''}" data-action="tooltip" data-idx="${i}" title="Show label on map">
                        <span class="toggle-label-text">Label</span>
                    </button>
                    <button class="toggle-icon ${addr.showCoords ? 'on' : ''}" data-action="coords" data-idx="${i}" title="Show lat/long on map">
                        <span class="toggle-label-text">Lat/Lng</span>
                    </button>
                </span>
                <button class="delete-btn" data-idx="${i}">&times;</button>
            `;
            li.querySelector('[data-action="tooltip"]').addEventListener('click', () => toggleTooltip(i));
            li.querySelector('[data-action="coords"]').addEventListener('click', () => toggleCoords(i));
            li.querySelector('.delete-btn').addEventListener('click', () => remove(i));
            list.appendChild(li);
        });

        countEl.textContent = addresses.length;
        actions.style.display = addresses.length > 0 ? 'flex' : 'none';
    }

    return { getAll, count, geocodeSingle, geocodeCSV, toggleTooltip, toggleCoords, buildDisplaySettings, remove, clear, updateUI };
})();
