import {initializeBlock, useBase, useRecords, useCustomProperties} from '@airtable/blocks/interface/ui';
import React, {useEffect, useRef} from 'react';
import './style.css';
import mapboxgl from 'mapbox-gl';;
import 'mapbox-gl/dist/mapbox-gl.css';


// Coordinate conversion functions
function webMercatorToLatLng(x, y) {
    const lon = (x / 20037508.34) * 180;
    let lat = (y / 20037508.34) * 180;
    lat = 180 / Math.PI * (2 * Math.atan(Math.exp(lat * Math.PI / 180)) - Math.PI / 2);
    return [lon, lat];
}

function normalizeCoordinates(coords, minLat, maxLat, minLng, maxLng) {
    const [x, y] = coords;
    const normalizedX = (x - minLng) / (maxLng - minLng);
    const normalizedY = (y - minLat) / (maxLat - minLat);
    return [normalizedX, normalizedY];
}

function mapToDCRange(normalizedCoords) {
    const [x, y] = normalizedCoords;
    const dcMinLat = 38.8;
    const dcMaxLat = 39.0;
    const dcMinLng = -77.2;
    const dcMaxLng = -76.9;
    
    const lat = dcMinLat + (dcMaxLat - dcMinLat) * y;
    const lng = dcMinLng + (dcMaxLng - dcMinLng) * x;
    return [lng, lat];
}

// Create custom marker element
function createMarkerElement(isNew) {
    const el = document.createElement('div');
    el.style.width = '40px';
    el.style.height = '40px';
    el.style.borderRadius = '50%';
    el.style.border = '3px solid';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
    el.style.fontSize = '20px';
    
    if (isNew) {
        el.style.backgroundColor = '#e6f3ff';
        el.style.borderColor = '#0066cc';
        el.style.color = '#0066cc';
        el.textContent = '🆕';
    } else {
        el.style.backgroundColor = '#f5f5f5';
        el.style.borderColor = '#999999';
        el.style.color = '#666666';
        el.textContent = '🛒';
    }
    
    return el;
}

// Define custom properties
const getCustomProperties = () => {
    return [
        {
            key: 'mapboxToken',
            label: 'Mapbox Access Token',
            type: 'string',
            defaultValue: ''
        }
    ];
};

function GroceryStoreMap() {
    const mapContainer = useRef(null);
    const map = useRef(null);
    const markers = useRef([]);
    
    const base = useBase();
    const table = base.tables[0];
    const records = useRecords(table);

    // Use custom properties to get the Mapbox token
    const {customPropertyValueByKey, errorState} = useCustomProperties(getCustomProperties);
    const mapboxToken = customPropertyValueByKey && customPropertyValueByKey.mapboxToken;

    // Initialize map
    useEffect(() => {
        if (!mapContainer.current || !mapboxToken) return;

        // Set the Mapbox access token
        mapboxgl.accessToken = mapboxToken;

        map.current = new mapboxgl.Map({
            container: mapContainer.current,
            style: 'mapbox://styles/mapbox/streets-v11',
            center: [-77.0369, 38.9072], // DC coordinates
            zoom: 12
        });

        // Add navigation controls
        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

        return () => {
            map.current.remove();
        };
    }, [mapboxToken]);

    // Update markers when records change
    useEffect(() => {
        if (!map.current || !records) return;

        // Clear existing markers
        markers.current.forEach(marker => marker.remove());
        markers.current = [];

        // Process records and create markers
        records.forEach(record => {
            const name = record.getCellValue('Store Name');
            const x = record.getCellValue('X');
            const y = record.getCellValue('Y');
            const isNew = record.getCellValue('New Store');

            if (name && x !== undefined && y !== undefined) {
                // Convert coordinates
                const [lng, lat] = webMercatorToLatLng(x, y);
                const normalized = normalizeCoordinates([lng, lat], 38.8, 39.0, -77.2, -76.9);
                const [finalLng, finalLat] = mapToDCRange(normalized);

                // Create popup
                const popup = new mapboxgl.Popup({
                    closeButton: true,
                    closeOnClick: true,
                    offset: 25
                }).setHTML(`<h3>${name}</h3>`);

                // Create custom marker
                const el = createMarkerElement(isNew);
                
                // Create marker with popup
                const marker = new mapboxgl.Marker(el)
                    .setLngLat([finalLng, finalLat])
                    .setPopup(popup)
                    .addTo(map.current);

                markers.current.push(marker);
            }
        });
    }, [records]);

    // Show configuration message if token is not set
    if (!mapboxToken) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                padding: '20px',
                textAlign: 'center',
                backgroundColor: '#f5f5f5'
            }}>
                <h2 style={{marginBottom: '10px'}}>Configure Mapbox Token</h2>
                <p style={{marginBottom: '20px', color: '#666'}}>
                    Please configure the Mapbox Access Token in the Interface Extension settings to display the map.
                </p>
                <p style={{fontSize: '14px', color: '#999'}}>
                    You can get a free token from <a href="https://www.mapbox.com" target="_blank" rel="noopener noreferrer">mapbox.com</a>
                </p>
            </div>
        );
    }

     // Show error if there's an issue with custom properties
    if (errorState) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                color: 'red'
            }}>
                Error loading custom properties: {errorState.message}
            </div>
        );
    }

    return (
        <div style={{width: '100%', height: '100vh'}}>
            <div ref={mapContainer} style={{width: '100%', height: '100%'}} />
        </div>
    );
}

GroceryStoreMap.displayName = 'GroceryStoreMap';

initializeBlock({interface: () => <GroceryStoreMap />});
