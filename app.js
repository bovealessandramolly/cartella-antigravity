/* ==========================================================================
   PENDERECKI'S GARDEN: MAIN APP COORDINATOR & STATE MACHINE
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize core system objects
    const audio = new PendereckiAudioEngine();
    const threeD = new Labyrinth3DEngine('canvas-3d');
    
    // Core State Variables
    let activeSpotIndex = -1;
    let unlockedSpots = [false, false, false, false];
    let allSpotsUnlocked = false;
    let activeTreeRustle = null;
    
    // Fade in intro splash screen content beautifully using GSAP
    gsap.timeline()
        .to('.splash-subtitle', { opacity: 1, y: 0, duration: 1.2, ease: 'power3.out', delay: 0.3 })
        .to('.splash-title', { opacity: 1, y: 0, duration: 1.2, ease: 'power3.out' }, '-=0.9')
        .to('.splash-separator', { opacity: 1, duration: 1.0 }, '-=0.9')
        .to('.splash-desc', { opacity: 0.7, y: 0, duration: 1.2, ease: 'power3.out' }, '-=0.9')
        .to('.enter-btn', { opacity: 1, y: 0, duration: 1.2, ease: 'power3.out' }, '-=0.9');

    // Preloader Animation Simulation
    simulatePreloader();
    
    // Initialize 3D WebGL Scene immediately in background
    threeD.init();

    // 2. Mock Asset Preloader & Audio Context Unlocker
    function simulatePreloader() {
        const progressEl = document.getElementById('loader-progress');
        const enterBtn = document.getElementById('enter-garden-btn');
        let progress = 0;
        
        const interval = setInterval(() => {
            progress += Math.floor(Math.random() * 8) + 3;
            if (progress >= 100) {
                progress = 100;
                clearInterval(interval);
                
                // Enable Enter Button
                enterBtn.classList.remove('disabled');
                enterBtn.disabled = false;
                enterBtn.querySelector('span').textContent = "ENTRA NEL LABIRINTO";
            }
            progressEl.style.width = `${progress}%`;
        }, 80);

        enterBtn.addEventListener('click', async () => {
            // Initialize Audio Engine inside user gesture safely
            await audio.init();
            
            // Setup Visualizer Canvas Hook
            const vCanvas = document.getElementById('visualizer-canvas');
            audio.setupVisualizer(vCanvas);
            
            // Fade out splash loader screen
            const splash = document.getElementById('intro-splash');
            splash.classList.add('fade-out');
            setTimeout(() => splash.remove(), 1000);
            
            // Reveal the Buy Ring button
            const buyBtn = document.getElementById('buy-ring-btn');
            if (buyBtn) buyBtn.classList.remove('hidden');

            // Initial subtle toast notification
            showToastNotification("Esplora le colonne dorate per sbloccare musica e cambiare colore al diamante.");
        });
    }

    // 3. UI Navigation & Chevron Handlers
    const prevBtn = document.getElementById('nav-prev-btn');
    const nextBtn = document.getElementById('nav-next-btn');

    prevBtn.addEventListener('click', () => {
        if (threeD.isFlying) return;
        let idx = activeSpotIndex - 1;
        if (idx < 0) idx = 3; // Wrap to last
        navigateToSpot(idx);
    });

    nextBtn.addEventListener('click', () => {
        if (threeD.isFlying) return;
        let idx = activeSpotIndex + 1;
        if (idx > 3) idx = 0; // Wrap to first
        navigateToSpot(idx);
    });

    // Node bullet indicator clicks at bottom center
    for (let i = 0; i < 4; i++) {
        const node = document.getElementById(`node-${i}`);
        node.addEventListener('click', () => {
            if (threeD.isFlying || activeSpotIndex === i) return;
            navigateToSpot(i);
        });
    }

    /**
     * Coordinate navigation transitions between spots
     */
    function navigateToSpot(index) {
        activeSpotIndex = index;
        
        // 1. Fly WebGL Camera to coordinate
        threeD.flyToHotspot(index);

        // 1b. Update Diamond Color based on Hotspot
        const diamondColors = ['#007A72', '#BF9D52', '#C2E7DA', '#F1FFE7'];
        if (threeD.changeDiamondColor) {
            threeD.changeDiamondColor(diamondColors[index]);
        }
        
        // 2. Update Progress Bar active node class
        for (let i = 0; i < 4; i++) {
            const node = document.getElementById(`node-${i}`);
            if (i === index) {
                node.classList.add('active');
            } else {
                node.classList.remove('active');
            }
        }
        
        // 3. Update HUD Display Text Metadata
        const numText = document.getElementById('current-spot-num');
        const titleText = document.getElementById('current-spot-title');
        
        numText.textContent = String(index + 1).padStart(2, '0');
        titleText.textContent = audio.tracks[index].title;
    }

    // 4. Hotspot Arrival Unlock Logic
    window.addEventListener('hotspotReached', (e) => {
        const idx = e.detail.index;
        
        // Activate Synth Track Playback
        audio.playTrack(idx);
        
        // Update Bottom Widget play icon
        togglePlayPauseIcon(true);
        
        // Unlock Spot in State
        if (!unlockedSpots[idx]) {
            unlockedSpots[idx] = true;
            audio.unlockTrack(idx);
            
            // Mark Node as unlocked (checkmark bullet)
            const node = document.getElementById(`node-${idx}`);
            node.classList.add('unlocked');
            
            // Mark spot on minimap compass
            const mapSpot = document.getElementById(`map-spot-${idx}`);
            if (mapSpot) mapSpot.classList.add('unlocked');
            
            // Update Spot HUD status badge
            const badge = document.getElementById('current-spot-status');
            badge.textContent = "UNLOCKED";
            badge.className = "spot-status-badge unlocked";
            
            showToastNotification(`Discovered piece: ${audio.tracks[idx].title}`);
            
            // Check if all spots are unlocked
            checkAllSpotsUnlocked();
        } else {
            // Already unlocked
            const badge = document.getElementById('current-spot-status');
            badge.textContent = "UNLOCKED";
            badge.className = "spot-status-badge unlocked";
        }
    });

    /**
     * Check if all 4 spots have been explored to unlock final drawer
     */
    function checkAllSpotsUnlocked() {
        const completedCount = unlockedSpots.filter(Boolean).length;
        document.getElementById('unlocked-count-val').textContent = completedCount;

        if (completedCount === 4 && !allSpotsUnlocked) {
            allSpotsUnlocked = true;
            
            // Celebrate with confetti!
            triggerConfettiCelebration();
            
            // Fade in the center Bravo completion card
            setTimeout(() => {
                const bravo = document.getElementById('bravo-panel');
                bravo.classList.remove('hidden');
            }, 1500);
        }
    }

    function triggerConfettiCelebration() {
        if (typeof confetti === 'function') {
            const duration = 3 * 1000;
            const end = Date.now() + duration;

            (function frame() {
                confetti({
                    particleCount: 3,
                    angle: 60,
                    spread: 55,
                    origin: { x: 0 },
                    colors: ['#E2C783', '#9CB897', '#C5DAC1']
                });
                confetti({
                    particleCount: 3,
                    angle: 120,
                    spread: 55,
                    origin: { x: 1 },
                    colors: ['#E2C783', '#9CB897', '#C5DAC1']
                });

                if (Date.now() < end) {
                    requestAnimationFrame(frame);
                }
            }());
        }
    }

    // 5. HUD Audio Play/Pause Button Hooks
    const audioBtn = document.getElementById('audio-play-pause-btn');
    audioBtn.addEventListener('click', () => {
        const isPlaying = audio.togglePlayPause();
        togglePlayPauseIcon(isPlaying);
    });

    function togglePlayPauseIcon(isPlaying) {
        const playSvg = document.getElementById('svg-play');
        const pauseSvg = document.getElementById('svg-pause');
        if (isPlaying) {
            playSvg.classList.add('hidden');
            pauseSvg.classList.remove('hidden');
        } else {
            playSvg.classList.remove('hidden');
            pauseSvg.classList.add('hidden');
        }
    }

    // 6. Floating Playlist Panel Card Toggle
    const playlistToggle = document.getElementById('playlist-toggle-btn');
    const playlistPanel = document.getElementById('audio-playlist-panel');
    const caretIcon = playlistToggle.querySelector('.caret-icon');

    playlistToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const hidden = playlistPanel.classList.toggle('hidden');
        caretIcon.classList.toggle('rotate', !hidden);
    });

    // Close playlist card if clicking outside
    document.addEventListener('click', () => {
        playlistPanel.classList.add('hidden');
        caretIcon.classList.remove('rotate');
    });

    playlistPanel.addEventListener('click', (e) => e.stopPropagation());

    // Playlist item clicks to fly directly to spots (if unlocked)
    const plItems = document.querySelectorAll('.playlist-item');
    plItems.forEach((item) => {
        item.addEventListener('click', () => {
            const trackIdx = parseInt(item.getAttribute('data-track'));
            
            // Check if unlocked or user has permission to click it
            // Let them teleport directly to it, triggering the unlock flight!
            playlistPanel.classList.add('hidden');
            caretIcon.classList.remove('rotate');
            
            navigateToSpot(trackIdx);
            
            // Update active list classes
            plItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
        });
    });

    // Custom track unlock callback to update active playlist cards
    window.addEventListener('trackUnlocked', (e) => {
        const idx = e.detail.index;
        const plItem = plItems[idx];
        if (plItem) plItem.classList.add('unlocked-list-item');
    });

    // 7. Full Hamburger Menu toggling
    const menuBtn = document.getElementById('menu-toggle-btn');
    const menuOverlay = document.getElementById('hamburger-menu-overlay');

    menuBtn.addEventListener('click', () => {
        const isOpen = menuOverlay.classList.toggle('hidden');
        document.body.classList.toggle('menu-open', !isOpen);
    });

    // Navigation links in full menu
    const menuLinks = document.querySelectorAll('.menu-link');
    menuLinks.forEach((link) => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Close menu overlay
            menuOverlay.classList.add('hidden');
            document.body.classList.remove('menu-open');
            
            const targetId = link.getAttribute('data-target');
            if (targetId === 'canvas-3d') {
                // Return camera to labyrinth bird's eye view
                threeD.flyToOverview();
                
                // Reset diamond color to default gold
                if (threeD.changeDiamondColor) {
                    threeD.changeDiamondColor('#BF9D52');
                }
                
                // Reset Spot progress active status
                activeSpotIndex = -1;
                for (let i = 0; i < 4; i++) {
                    document.getElementById(`node-${i}`).classList.remove('active');
                }
                const numText = document.getElementById('current-spot-num');
                const titleText = document.getElementById('current-spot-title');
                numText.textContent = "00";
                titleText.textContent = "Exploring the Labyrinth...";
                
                audio.playTrack(-1); // play background drone
                togglePlayPauseIcon(true);
            }
        });
    });

    // Bind Menu modal link triggers
    const estateMapLink = document.getElementById('menu-link-estate-map');
    if (estateMapLink) {
        estateMapLink.addEventListener('click', (e) => {
            e.preventDefault();
            menuOverlay.classList.add('hidden');
            document.body.classList.remove('menu-open');
            openMacroMapModal();
        });
    }

    const historyLink = document.getElementById('menu-link-history');
    if (historyLink) {
        historyLink.addEventListener('click', (e) => {
            e.preventDefault();
            menuOverlay.classList.add('hidden');
            document.body.classList.remove('menu-open');
            openHistoryDrawer();
        });
    }

    const aboutLink = document.getElementById('menu-link-about');
    if (aboutLink) {
        aboutLink.addEventListener('click', (e) => {
            e.preventDefault();
            menuOverlay.classList.add('hidden');
            document.body.classList.remove('menu-open');
            openHistoryDrawer(); // About content lives inside the drawer too!
        });
    }

    // 8. Editorial Slide-out History Drawer Panel
    const readMoreBtn = document.getElementById('read-more-btn');
    const historyDrawer = document.getElementById('history-drawer');
    const closeDrawerBtn = document.getElementById('close-drawer-btn');

    readMoreBtn.addEventListener('click', () => openHistoryDrawer());
    closeDrawerBtn.addEventListener('click', () => closeHistoryDrawer());

    function openHistoryDrawer() {
        historyDrawer.classList.add('open');
        document.body.classList.add('drawer-open');
    }

    function closeHistoryDrawer() {
        historyDrawer.classList.remove('open');
        document.body.classList.remove('drawer-open');
        
        // Stop any active foliage rustling audio context
        if (activeTreeRustle) {
            activeTreeRustle.stop();
            activeTreeRustle = null;
            document.getElementById('play-tree-rustle-btn').classList.remove('playing');
            document.getElementById('play-tree-rustle-btn').querySelector('span').textContent = "Listen to foliage rustle";
        }
    }

    // Interactive Tree catalog inside the history panel
    const treeCards = document.querySelectorAll('.tree-card');
    const treeProfileName = document.getElementById('tree-profile-name');
    const treeProfileDesc = document.getElementById('tree-profile-desc');
    const treeRustleBtn = document.getElementById('play-tree-rustle-btn');
    let selectedTreeKey = 'yew';

    const treeData = {
        yew: {
            name: "English Yew (Taxus baccata)",
            desc: "The backbone of the labyrinth hedges. Yew is legendary for its long life, carrying mythological links to eternity, rebirth, and silence. Its dense, deep dark evergreen needles form the impenetrable green walls of the labyrinth, absorbing noise and providing the perfect acoustic canvas."
        },
        beech: {
            name: "Copper Beech (Fagus sylvatica)",
            desc: "A stately foliage contrasting with the dark yews. Copper Beech is famous for its vibrant bronze and deep-red metallic leaves that rustle dryly like paper under gentle winds. Penderecki loved the textural noise of Beech leaves, describing them as nature's woodwinds."
        },
        hornbeam: {
            name: "European Hornbeam (Carpinus betulus)",
            desc: "Planted in corridors to shape strict geometric tunnels. Hornbeam is extremely hardy, responding beautifully to shearing. It creates rigid green hallways that guide walkers through the labyrinth paths. Its broad light-green leaves generate a soft, sighing acoustic whistle when wind passes."
        }
    };

    treeCards.forEach((card) => {
        card.addEventListener('click', () => {
            treeCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            
            selectedTreeKey = card.getAttribute('data-tree');
            const data = treeData[selectedTreeKey];
            
            // Apply text swap
            treeProfileName.textContent = data.name;
            treeProfileDesc.textContent = data.desc;

            // If a sound is currently playing, stop it and start new tree sound
            if (activeTreeRustle) {
                activeTreeRustle.stop();
                activeTreeRustle = null;
                treeRustleBtn.classList.remove('playing');
                treeRustleBtn.querySelector('span').textContent = "Listen to foliage rustle";
            }
        });
    });

    // Play/Pause Foliage Rustle using Web Audio Synth
    treeRustleBtn.addEventListener('click', () => {
        if (activeTreeRustle) {
            // Stop sound
            activeTreeRustle.stop();
            activeTreeRustle = null;
            treeRustleBtn.classList.remove('playing');
            treeRustleBtn.querySelector('span').textContent = "Listen to foliage rustle";
        } else {
            // Play sound
            activeTreeRustle = audio.playTreeRustle(selectedTreeKey);
            if (activeTreeRustle) {
                treeRustleBtn.classList.add('playing');
                treeRustleBtn.querySelector('span').textContent = "Mute rustling sound";
            }
        }
    });

    // 9. Circular Compass Minimap expands to Full Estate Map modal
    const compassWidget = document.getElementById('compass-widget');
    const mapModal = document.getElementById('macro-map-modal');
    const closeMapBtn = document.getElementById('close-map-btn');

    compassWidget.addEventListener('click', () => openMacroMapModal());
    closeMapBtn.addEventListener('click', () => closeMacroMapModal());

    function openMacroMapModal() {
        mapModal.classList.remove('hidden');
        initializeEstateMapPointCloud();
    }

    function closeMacroMapModal() {
        mapModal.classList.add('hidden');
    }

    // Modal sidebar Details mapping
    const estateSectionData = [
        {
            num: ".01",
            name: "The Manor House",
            desc: "The historic focal point of Krzysztof Penderecki's 18th-century country estate. Painstakingly restored by the composer starting in 1976, it represents a hub of classic Polish cultural architecture and served as his primary workspace.",
            species: ["Quercus robur (Pedunculate Oak)", "Tilia cordata (Small-leaved Lime)"]
        },
        {
            num: ".02",
            name: "Italian Garden",
            desc: "Designed in classic Renaissance layout with strict geometrical grids, topiary cones, and low box hedges. It represents mathematical proportion, order, and human reason standing in contrast to wild organic forests.",
            species: ["Buxus sempervirens (Common Box)", "Cupressus sempervirens (Italian Cypress)"]
        },
        {
            num: ".03",
            name: "Japanese Pond",
            desc: "An asymmetrical zen water feature planted with rare weeping foliage and water flora, surrounded by large granite boulders. Designed to represent asymmetrical natural beauty, reflection, and quiet flow.",
            species: ["Acer palmatum (Japanese Maple)", "Salix babylonica (Weeping Willow)"]
        },
        {
            num: ".04",
            name: "The Labyrinth (.05)",
            desc: "A living representation of mathematical and spiritual geometry, cultivated from Chartres and Reims Cathedral layouts. Inside this hedge maze, Krzysztof Penderecki placed four secret sonorous spaces containing acoustic recordings representing his artistic peaks.",
            species: ["Taxus baccata (English Yew)", "Carpinus betulus (European Hornbeam)"]
        },
        {
            num: ".05",
            name: "Copper Beech Avenue",
            desc: "A dramatic corridor of mature, dark burgundy-colored Copper Beeches. Their deep, metallic leaves form a high structural roof, casting elegant red shadows along the walking gravel paths.",
            species: ["Fagus sylvatica 'Purpurea' (Copper Beech)"]
        }
    ];

    const modalHotspots = document.querySelectorAll('.estate-hotspot');
    const detailNum = document.getElementById('estate-sec-num');
    const detailName = document.getElementById('estate-sec-name');
    const detailDesc = document.getElementById('estate-sec-desc');
    const detailSpecies = document.getElementById('estate-sec-species');
    const teleportBtn = document.getElementById('teleport-estate-btn');
    let currentSelectedEstateIdx = 3; // Default to Labyrinth

    modalHotspots.forEach((pin) => {
        pin.addEventListener('click', () => {
            modalHotspots.forEach(p => p.classList.remove('active'));
            pin.classList.add('active');
            
            const idx = parseInt(pin.getAttribute('data-section'));
            currentSelectedEstateIdx = idx;
            const data = estateSectionData[idx];
            
            // Update Right card UI
            detailNum.textContent = data.num;
            detailName.textContent = data.name;
            detailDesc.textContent = data.desc;
            
            // Clear and populate species list
            detailSpecies.innerHTML = '';
            data.species.forEach(sp => {
                const li = document.createElement('li');
                li.textContent = sp;
                detailSpecies.appendChild(li);
            });

            // Adjust button content
            if (idx === 3) {
                teleportBtn.querySelector('span').textContent = "ENTER THIS SECTION";
            } else {
                teleportBtn.querySelector('span').textContent = "TELEPORT TO THIS GARDEN";
            }
        });
    });

    teleportBtn.addEventListener('click', () => {
        closeMacroMapModal();
        if (currentSelectedEstateIdx === 3) {
            // Labyrinth selected: fly camera back to overview or first spot
            threeD.flyToOverview();
            showToastNotification("Returned to Labyrinth view.");
        } else {
            // Trigger a beautiful cinematic camera flight over the 3D canvas
            // simulating teleporting to another abstract point cloud space!
            threeD.flyToOverview();
            showToastNotification(`Teleported to ${estateSectionData[currentSelectedEstateIdx].name}. Rendering particle cloud...`);
        }
    });

    /**
     * Draw abstract point cloud representation of the estate layout on canvas
     */
    function initializeEstateMapPointCloud() {
        const canvas = document.getElementById('macro-map-canvas');
        const ctx = canvas.getContext('2d');
        
        // Match canvas dimensions to layout container
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;

        let points = [];
        const numPoints = 800;
        
        // Generate abstract points clustered around geographical features
        for (let i = 0; i < numPoints; i++) {
            // Mix clusters representing manor house, paths, ponds, labyrinths
            let x, y, size, color;
            const cluster = Math.floor(Math.random() * 5);
            
            if (cluster === 0) {
                // Manor House (rigid rectangle point cluster)
                x = canvas.width * 0.35 + (Math.random() - 0.5) * 60;
                y = canvas.height * 0.25 + (Math.random() - 0.5) * 40;
                color = 'rgba(255, 255, 255, 0.4)';
            } else if (cluster === 1) {
                // Italian Garden grid points
                x = canvas.width * 0.65 + (Math.floor(Math.random() * 6) * 12) - 36;
                y = canvas.height * 0.40 + (Math.floor(Math.random() * 5) * 12) - 30;
                color = 'rgba(156, 184, 151, 0.5)';
            } else if (cluster === 2) {
                // Japanese Pond (circular cluster)
                const radius = Math.random() * 40;
                const theta = Math.random() * Math.PI * 2;
                x = canvas.width * 0.20 + Math.cos(theta) * radius;
                y = canvas.height * 0.75 + Math.sin(theta) * radius;
                color = 'rgba(47, 62, 61, 0.75)';
            } else if (cluster === 3) {
                // Labyrinth concentric circles
                const ring = Math.floor(Math.random() * 5) + 1;
                const radius = ring * 10 + (Math.random() - 0.5) * 2;
                const theta = Math.random() * Math.PI * 2;
                x = canvas.width * 0.45 + Math.cos(theta) * radius;
                y = canvas.height * 0.55 + Math.sin(theta) * radius;
                color = 'rgba(197, 218, 193, 0.6)';
            } else {
                // Scattered forest background dots
                x = Math.random() * canvas.width;
                y = Math.random() * canvas.height;
                color = 'rgba(255, 255, 255, 0.06)';
            }
            
            size = 1.0 + Math.random() * 2.0;
            points.push({ x, y, size, color, origX: x, origY: y, phase: Math.random() * Math.PI * 2 });
        }

        // Animated draw loop for estate minimap
        let animId;
        const tick = () => {
            if (mapModal.classList.contains('hidden')) {
                cancelAnimationFrame(animId);
                return;
            }
            
            animId = requestAnimationFrame(tick);
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const time = Date.now() * 0.002;
            
            // Draw points with delicate slow floating sway
            points.forEach((p, idx) => {
                p.x = p.origX + Math.sin(time + p.phase) * 1.5;
                p.y = p.origY + Math.cos(time + p.phase) * 1.5;
                
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            });

            // Draw abstract lines connecting some points to outline paths
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            for (let i = 0; i < 40; i++) {
                const p1 = points[Math.floor(i * 12) % points.length];
                const p2 = points[Math.floor(i * 18 + 7) % points.length];
                // Only connect if somewhat close
                const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
                if (dist < 70) {
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                }
            }
            ctx.stroke();
        };

        tick();
    }

    // 10. Accessibility Features Panel Handlers
    let highContrastActive = false;
    let largeTextActive = false;

    const contrastBtn = document.getElementById('access-contrast-btn');
    const textBtn = document.getElementById('access-text-btn');

    contrastBtn.addEventListener('click', () => {
        highContrastActive = !highContrastActive;
        document.body.classList.toggle('high-contrast', highContrastActive);
        contrastBtn.textContent = highContrastActive ? "Disable High Contrast" : "Toggle High Contrast";
        showToastNotification(highContrastActive ? "High Contrast Mode enabled" : "High Contrast Mode disabled");
    });

    textBtn.addEventListener('click', () => {
        largeTextActive = !largeTextActive;
        document.body.classList.toggle('large-text', largeTextActive);
        textBtn.textContent = largeTextActive ? "Normal Text Size" : "Increase Text Size";
        showToastNotification(largeTextActive ? "Text Size increased" : "Normal Text Size restored");
    });

    // 11. Toast Notifications Utility
    function showToastNotification(message) {
        const toast = document.createElement('div');
        toast.className = 'hud-toast';
        toast.textContent = message;
        
        // CSS properties inject dynamically
        Object.assign(toast.style, {
            position: 'fixed',
            bottom: '120px',
            left: '50%',
            transform: 'translateX(-50%) translateY(20px)',
            backgroundColor: 'rgba(23, 19, 23, 0.9)',
            border: '1px solid rgba(226, 199, 131, 0.3)',
            borderRadius: '20px',
            padding: '10px 24px',
            fontFamily: 'var(--font-sans)',
            fontSize: '0.75rem',
            color: 'var(--accent-gold)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            zIndex: 9999,
            opacity: 0,
            transition: 'all 0.5s cubic-bezier(0.25, 1, 0.5, 1)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap'
        });
        
        document.body.appendChild(toast);
        
        // Trigger reflow
        toast.offsetHeight;
        
        // Fade in
        toast.style.transform = 'translateX(-50%) translateY(0)';
        toast.style.opacity = 1;
        
        // Fade out and remove
        setTimeout(() => {
            toast.style.transform = 'translateX(-50%) translateY(-20px)';
            toast.style.opacity = 0;
            setTimeout(() => toast.remove(), 500);
        }, 4000);
    }

    // --- E-Commerce and Product Modal Logic ---
    const buyBtn = document.getElementById('buy-ring-btn');
    const productModal = document.getElementById('product-modal');
    const closeProductBtn = document.getElementById('close-product-btn');
    const backdrop = productModal ? productModal.querySelector('.product-modal-backdrop') : null;
    
    // Open product modal
    if (buyBtn && productModal) {
        buyBtn.addEventListener('click', () => {
            productModal.classList.remove('hidden');
        });
    }

    // Close product modal
    const closeProductModal = () => {
        if (productModal) {
            productModal.classList.add('hidden');
        }
    };
    if (closeProductBtn) closeProductBtn.addEventListener('click', closeProductModal);
    if (backdrop) backdrop.addEventListener('click', closeProductModal);

    // Gallery switching
    const thumbs = document.querySelectorAll('.gallery-thumb');
    const mainImg = document.getElementById('main-product-img');
    thumbs.forEach(thumb => {
        thumb.addEventListener('click', () => {
            thumbs.forEach(t => t.classList.remove('active'));
            thumb.classList.add('active');
            if (mainImg) mainImg.src = thumb.getAttribute('data-src');
        });
    });

    // Size selector pills
    const sizePills = document.querySelectorAll('.size-pill');
    let selectedSize = null;
    sizePills.forEach(pill => {
        pill.addEventListener('click', () => {
            sizePills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            selectedSize = pill.getAttribute('data-size');
        });
    });

    // Add to cart click
    const addToCartBtn = document.getElementById('add-to-cart-btn');
    if (addToCartBtn) {
        addToCartBtn.addEventListener('click', () => {
            if (!selectedSize) {
                showToastNotification("Seleziona una misura per il tuo anello.");
                return;
            }
            
            // Show success animation!
            if (typeof confetti === 'function') {
                confetti({
                    particleCount: 80,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: ['#BF9D52', '#007A72', '#C2E7DA']
                });
            }
            
            showToastNotification(`Anello Labyrinth (Misura ${selectedSize}) aggiunto al carrello!`);
            closeProductModal();
        });
    }
});
