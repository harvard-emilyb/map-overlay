const ReferenceMap = (() => {
    let map = null;
    let markers = [];
    let clickCallback = null;
    let initialized = false;

    let searchMarker = null;

    function init() {
        if (initialized) return;
        map = new google.maps.Map(document.getElementById('reference-map'), {
            center: { lat: 40, lng: -30 },
            zoom: 3,
            mapTypeId: 'hybrid',
            gestureHandling: 'greedy',
        });

        map.addListener('click', (e) => {
            if (clickCallback) {
                clickCallback(e.latLng.lat(), e.latLng.lng());
            }
        });

        // Places SearchBox
        const input = document.getElementById('ref-map-search');
        const searchBox = new google.maps.places.SearchBox(input);

        // Bias results to current map viewport
        map.addListener('bounds_changed', () => {
            searchBox.setBounds(map.getBounds());
        });

        searchBox.addListener('places_changed', () => {
            const places = searchBox.getPlaces();
            if (!places || places.length === 0) return;

            // Clear previous search marker
            if (searchMarker) { searchMarker.setMap(null); searchMarker = null; }

            const place = places[0];
            if (!place.geometry || !place.geometry.location) return;

            // Zoom to the place
            if (place.geometry.viewport) {
                map.fitBounds(place.geometry.viewport);
            } else {
                map.setCenter(place.geometry.location);
                map.setZoom(15);
            }

            // Drop a temporary marker
            searchMarker = new google.maps.Marker({
                position: place.geometry.location,
                map: map,
                icon: {
                    path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
                    scale: 6,
                    fillColor: '#f0a500',
                    fillOpacity: 1,
                    strokeColor: '#fff',
                    strokeWeight: 2,
                },
                title: place.name,
            });
        });

        initialized = true;
    }

    function onMapClick(callback) {
        clickCallback = callback;
    }

    function clearClickCallback() {
        clickCallback = null;
    }

    function addControlPointMarker(id, lat, lng, number) {
        const marker = new google.maps.Marker({
            position: { lat, lng },
            map: map,
            label: {
                text: String(number),
                color: '#fff',
                fontWeight: 'bold',
                fontSize: '11px',
            },
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 12,
                fillColor: '#e94560',
                fillOpacity: 0.9,
                strokeColor: '#fff',
                strokeWeight: 2,
            },
        });
        marker._cpId = id;
        markers.push(marker);
    }

    function removeControlPointMarker(id) {
        markers = markers.filter(m => {
            if (m._cpId === id) {
                m.setMap(null);
                return false;
            }
            return true;
        });
    }

    function clearControlPointMarkers() {
        markers.forEach(m => m.setMap(null));
        markers = [];
    }

    function triggerResize() {
        if (map) google.maps.event.trigger(map, 'resize');
    }

    return {
        init, onMapClick, clearClickCallback, addControlPointMarker,
        removeControlPointMarker, clearControlPointMarkers, triggerResize,
    };
})();
