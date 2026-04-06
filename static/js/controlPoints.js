const ControlPoints = (() => {
    let points = [];       // [{id, px, py, lat, lng, number}]
    let nextId = 1;
    let awaitingReference = false;
    let pendingPoint = null;

    function getAll() {
        return [...points];
    }

    function count() {
        return points.length;
    }

    function startListening() {
        stopListening();
        updateDots();
        updateButtons();

        if (points.length >= 3) {
            // Already have enough — don't auto-listen
            updateInstruction('done');
            return;
        }

        updateInstruction('hist');

        HistoricalMap.onMapClick((px, py) => {
            if (awaitingReference) return;

            pendingPoint = { id: nextId, px, py };
            awaitingReference = true;
            HistoricalMap.addPendingMarker(px, py);
            updateInstruction('ref');

            ReferenceMap.onMapClick((lat, lng) => {
                pendingPoint.lat = lat;
                pendingPoint.lng = lng;
                pendingPoint.number = points.length + 1;
                points.push(pendingPoint);

                HistoricalMap.clearPendingMarker();
                HistoricalMap.addControlPointMarker(pendingPoint.id, px, py, pendingPoint.number);
                ReferenceMap.addControlPointMarker(pendingPoint.id, lat, lng, pendingPoint.number);

                ReferenceMap.clearClickCallback();
                pendingPoint = null;
                awaitingReference = false;
                nextId++;

                updateDots();
                updateButtons();

                if (points.length >= 3) {
                    HistoricalMap.clearClickCallback();
                    updateInstruction('done');
                } else {
                    updateInstruction('hist');
                }
            });
        });
    }

    function stopListening() {
        HistoricalMap.clearPendingMarker();
        HistoricalMap.clearClickCallback();
        ReferenceMap.clearClickCallback();
        awaitingReference = false;
        pendingPoint = null;
        highlightPanel(null);
    }

    function addExtra() {
        // Re-enter listening for more points beyond 3
        document.getElementById('btn-add-extra').style.display = 'none';
        updateInstruction('extra');

        HistoricalMap.onMapClick((px, py) => {
            if (awaitingReference) return;

            pendingPoint = { id: nextId, px, py };
            awaitingReference = true;
            HistoricalMap.addPendingMarker(px, py);
            updateInstruction('ref-extra');

            ReferenceMap.onMapClick((lat, lng) => {
                pendingPoint.lat = lat;
                pendingPoint.lng = lng;
                pendingPoint.number = points.length + 1;
                points.push(pendingPoint);

                HistoricalMap.clearPendingMarker();
                HistoricalMap.addControlPointMarker(pendingPoint.id, px, py, pendingPoint.number);
                ReferenceMap.addControlPointMarker(pendingPoint.id, lat, lng, pendingPoint.number);

                ReferenceMap.clearClickCallback();
                pendingPoint = null;
                awaitingReference = false;
                nextId++;

                updateDots();
                updateButtons();
                updateInstruction('done');
                HistoricalMap.clearClickCallback();
            });
        });
    }

    function remove(index) {
        if (index < 0 || index >= points.length) return;
        const removed = points[index];
        points.splice(index, 1);

        // Renumber
        points.forEach((p, i) => p.number = i + 1);

        // Rebuild all markers
        HistoricalMap.clearControlPointMarkers();
        ReferenceMap.clearControlPointMarkers();
        points.forEach(p => {
            HistoricalMap.addControlPointMarker(p.id, p.px, p.py, p.number);
            ReferenceMap.addControlPointMarker(p.id, p.lat, p.lng, p.number);
        });

        // Restart wizard if below 3
        startListening();
    }

    function clear() {
        stopListening();
        points = [];
        nextId = 1;
        pendingPoint = null;
        awaitingReference = false;
        HistoricalMap.clearControlPointMarkers();
        ReferenceMap.clearControlPointMarkers();
        updateDots();
        updateButtons();
        startListening();
    }

    function updateDots() {
        const n = points.length;
        for (let i = 0; i < 3; i++) {
            const dot = document.getElementById(`cp-dot-${i + 1}`);
            const numEl = dot.querySelector('.dot-num');
            const labelEl = dot.querySelector('.dot-label');
            const removeBtn = dot.querySelector('.dot-remove');

            dot.classList.remove('active', 'done');

            if (i < n) {
                // Completed point
                dot.classList.add('done');
                numEl.textContent = '\u2713';
                labelEl.textContent = `Point ${i + 1}`;
                removeBtn.style.display = '';
                removeBtn.onclick = () => remove(i);
            } else if (i === n && n < 3) {
                // Current active step
                dot.classList.add('active');
                numEl.textContent = i + 1;
                labelEl.textContent = `Point ${i + 1}`;
                removeBtn.style.display = 'none';
                removeBtn.onclick = null;
            } else {
                // Future step
                numEl.textContent = i + 1;
                labelEl.textContent = `Point ${i + 1}`;
                removeBtn.style.display = 'none';
                removeBtn.onclick = null;
            }
        }
    }

    function updateButtons() {
        const n = points.length;
        const btnNext = document.getElementById('btn-next');
        const btnAddExtra = document.getElementById('btn-add-extra');

        btnNext.disabled = n < 3;
        btnAddExtra.style.display = n >= 3 ? '' : 'none';
    }

    function updateInstruction(phase) {
        const el = document.getElementById('cp-instruction');
        const n = points.length;

        if (phase === 'hist') {
            el.innerHTML = `<strong>Point ${n + 1} of 3:</strong> Click a recognizable landmark on the <strong>Historical Map</strong> (left).`;
            highlightPanel('hist');
        } else if (phase === 'ref') {
            el.innerHTML = `<strong>Point ${n + 1} of 3:</strong> Now click the <strong>same location</strong> on the <strong>Reference Map</strong> (right).`;
            highlightPanel('ref');
        } else if (phase === 'done') {
            el.innerHTML = `All ${n} control points set! Click <strong>Next</strong> to add addresses, or use the buttons below.`;
            highlightPanel(null);
        } else if (phase === 'extra') {
            el.innerHTML = `Click a landmark on the <strong>Historical Map</strong> to add another control point.`;
            highlightPanel('hist');
        } else if (phase === 'ref-extra') {
            el.innerHTML = `Now click the <strong>same location</strong> on the <strong>Reference Map</strong> (right).`;
            highlightPanel('ref');
        }
    }

    function highlightPanel(which) {
        const histLabel = document.getElementById('hist-panel-label');
        const refLabel = document.getElementById('ref-panel-label');
        histLabel.classList.remove('panel-highlight');
        refLabel.classList.remove('panel-highlight');
        if (which === 'hist') histLabel.classList.add('panel-highlight');
        if (which === 'ref') refLabel.classList.add('panel-highlight');
    }

    return { getAll, count, startListening, stopListening, addExtra, remove, clear, updateDots, updateButtons };
})();
