/* ==========================================================================
   PENDERECKI'S GARDEN: 3D WEBGL PARTICLE ENGINE (THREE.JS)
   ========================================================================== */

function createCircleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.8)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    
    return new THREE.CanvasTexture(canvas);
}

class Labyrinth3DEngine {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.renderer = null;
        this.scene = null;
        this.camera = null;
        
        // Custom Orbit Controls Variables
        this.cameraTarget = new THREE.Vector3(0, 0, 0);
        this.cameraDistance = 85;
        this.cameraTheta = Math.PI / 4;  // Horizontal orbit angle
        this.cameraPhi = Math.PI / 6;    // Vertical orbit angle
        this.isUserDragging = false;
        this.previousMousePosition = { x: 0, y: 0 };
        this.targetCameraDistance = 85;
        
        // Particles
        this.labyrinthParticles = null;
        this.sporeParticles = null;
        this.hotspots = [];
        
        // Central 3D Ring
        this.centralRing = null;
        this.diamondMaterial = null;
        
        // Hotspot 3D locations in the scene
        this.hotspotCoordinates = [
            { id: 0, x: -28, y: 0, z: -20, unlocked: false, title: "Vista Prospettica" },
            { id: 1, x: 32,  y: 0, z: -10, unlocked: false, title: "Vista dall'Alto" },
            { id: 2, x: -15, y: 0, z: 30,  unlocked: false, title: "Dettaglio Castone" },
            { id: 3, x: 25,  y: 0, z: 28,  unlocked: false, title: "Dettaglio Diamante" }
        ];
        
        this.activeHotspotIndex = -1;
        this.isFlying = false;

        // Compass reference
        this.compassArrow = document.getElementById('compass-arrow');
    }

    /**
     * Set up Three.js Renderer, Scene, Camera, and Event Listeners
     */
    init() {
        // Create WebGL Renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: true,
            powerPreference: "high-performance"
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // Create Scene
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x1A1B41, 0.008); // Midnight blue fog

        // Create Perspective Camera
        this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 1000);
        this.updateCameraPosition();

        // Add Lights for 3D materials (essential for metalness/roughness)
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        const pointLight = new THREE.PointLight(0xffffff, 1.5, 100);
        pointLight.position.set(0, 15, 0);
        this.scene.add(pointLight);

        const directionLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionLight.position.set(10, 20, 15);
        this.scene.add(directionLight);

        // Build Particle Assets
        this.generateLabyrinthPointCloud();
        this.generateAtmosphericSpores();
        this.generateHotspotPillars();
        
        // Build Central 3D Ring
        this.generateCentralRing();

        // Bind Window Resize
        window.addEventListener('resize', () => this.onWindowResize());

        // Bind Mouse/Touch Drag for Camera Orbiting
        this.setupCameraInteraction();
        
        // Start Render Loop
        this.animate();
    }

    /**
     * Build concentric particle walls representing a stylized Reims Cathedral Labyrinth
     */
    generateLabyrinthPointCloud() {
        const particleCount = 20000;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        const sizes = new Float32Array(particleCount);

        const colorTeal = new THREE.Color('#007A72');
        const colorMint = new THREE.Color('#C2E7DA');
        const colorGold = new THREE.Color('#BF9D52');
        const colorBg = new THREE.Color('#1A1B41');

        // Reims layout: concentric rings with pathways and gates
        const ringCount = 14;
        const baseRadius = 6;
        const ringSpacing = 4.2;

        for (let i = 0; i < particleCount; i++) {
            // Assign particles to random concentric rings
            const ringIndex = Math.floor(Math.random() * ringCount) + 1;
            const radius = baseRadius + ringIndex * ringSpacing;
            
            // Generate circular distribution
            let angle = Math.random() * Math.PI * 2;
            
            // Create "pathway openings/dead-ends" in rings to represent hedges
            // Omit particles in specific angular gaps on certain rings
            if (ringIndex % 2 === 0 && (angle > 0.2 && angle < 0.6)) {
                angle += 0.5; // shift particle out of path gap
            } else if (ringIndex % 3 === 0 && (angle > 3.0 && angle < 3.3)) {
                angle += 0.4;
            } else if (ringIndex % 5 === 0 && (angle > 4.5 && angle < 4.8)) {
                angle += 0.5;
            }

            // Scatter coordinates with radial noise (creating thick hedges)
            const radialNoise = (Math.random() - 0.5) * 1.5;
            const finalRadius = radius + radialNoise;
            
            const x = Math.cos(angle) * finalRadius;
            // Generate vertical hedges (y-axis heights)
            const y = (Math.random() - 0.5) * 5 + (ringIndex * 0.15) - 2;
            const z = Math.sin(angle) * finalRadius;

            positions[i * 3] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = z;

            // Mix leaf colors
            const mixFactor = Math.random();
            let finalColor;
            if (mixFactor < 0.4) {
                finalColor = colorTeal.clone().lerp(colorBg, Math.random() * 0.4);
            } else if (mixFactor < 0.75) {
                finalColor = colorMint.clone().lerp(colorTeal, Math.random() * 0.5);
            } else {
                finalColor = colorGold.clone().lerp(colorBg, Math.random() * 0.3);
            }

            colors[i * 3] = finalColor.r;
            colors[i * 3 + 1] = finalColor.g;
            colors[i * 3 + 2] = finalColor.b;

            // Random sizes for depth textures
            sizes[i] = 1.0 + Math.random() * 2.5;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        // Create Custom Shader or Particle Texture
        const material = new THREE.PointsMaterial({
            size: 0.9,
            vertexColors: true,
            transparent: true,
            opacity: 0.85,
            sizeAttenuation: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            map: createCircleTexture(),
            alphaTest: 0.005
        });

        // Points Representation
        this.labyrinthParticles = new THREE.Points(geometry, material);
        this.scene.add(this.labyrinthParticles);
    }

    /**
     * Create floating glowing spores (forest fireflies) drifting in the air
     */
    generateAtmosphericSpores() {
        const sporeCount = 1200;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(sporeCount * 3);
        const sizes = new Float32Array(sporeCount);

        for (let i = 0; i < sporeCount; i++) {
            // Spawn spores in a large bounding box surrounding the labyrinth
            positions[i * 3] = (Math.random() - 0.5) * 200;
            positions[i * 3 + 1] = Math.random() * 35 - 5;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 200;

            sizes[i] = 1.5 + Math.random() * 3.5;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        // Soft warm yellow/green spores
        const material = new THREE.PointsMaterial({
            size: 1.2,
            color: 0xBF9D52,
            transparent: true,
            opacity: 0.45,
            sizeAttenuation: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            map: createCircleTexture(),
            alphaTest: 0.005
        });

        this.sporeParticles = new THREE.Points(geometry, material);
        this.scene.add(this.sporeParticles);
    }

    /**
     * Generate 4 towering active golden pillars representing musical spots
     */
    generateHotspotPillars() {
        const particlesPerPillar = 450;
        const colorGold = new THREE.Color('#BF9D52');

        this.hotspotCoordinates.forEach((coord, idx) => {
            const geometry = new THREE.BufferGeometry();
            const positions = new Float32Array(particlesPerPillar * 3);
            const colors = new Float32Array(particlesPerPillar * 3);

            for (let i = 0; i < particlesPerPillar; i++) {
                // Generate a vertical column
                const height = Math.random() * 26; // 26 units tall
                const theta = Math.random() * Math.PI * 2;
                // Column radius spreads wider at the top like a fountain
                const radius = (Math.random() * 1.5) * (1.0 + (height * 0.05));
                
                positions[i * 3] = coord.x + Math.cos(theta) * radius;
                positions[i * 3 + 1] = coord.y + height - 2;
                positions[i * 3 + 2] = coord.z + Math.sin(theta) * radius;

                // Glowing gold gradient
                const lerpedColor = colorGold.clone().lerp(new THREE.Color('#007A72'), Math.random() * 0.35);
                colors[i * 3] = lerpedColor.r;
                colors[i * 3 + 1] = lerpedColor.g;
                colors[i * 3 + 2] = lerpedColor.b;
            }

            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

            const material = new THREE.PointsMaterial({
                size: 1.1,
                vertexColors: true,
                transparent: true,
                opacity: 0.7,
                sizeAttenuation: true,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                map: createCircleTexture(),
                alphaTest: 0.005
            });

            const pillar = new THREE.Points(geometry, material);
            this.scene.add(pillar);

            // Add rotating indicator ring around the hotspot base
            const ringGeo = new THREE.RingGeometry(2.5, 2.7, 32);
            const ringMat = new THREE.MeshBasicMaterial({
                color: 0xBF9D52,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.25,
                blending: THREE.AdditiveBlending
            });
            const ringMesh = new THREE.Mesh(ringGeo, ringMat);
            ringMesh.position.set(coord.x, coord.y - 1.9, coord.z);
            ringMesh.rotation.x = Math.PI / 2;
            this.scene.add(ringMesh);

            this.hotspots.push({
                pillar,
                ring: ringMesh,
                data: coord
            });
        });
    }

    /**
     * Map Orbit angles to actual 3D Cartesian coordinates for the camera
     */
    updateCameraPosition() {
        if (!this.camera) return;

        // Apply clamping on vertical Phi rotation to prevent flipping overhead/underground
        this.cameraPhi = Math.max(0.08, Math.min(Math.PI / 2.2, this.cameraPhi));

        const x = this.cameraTarget.x + this.cameraDistance * Math.sin(this.cameraTheta) * Math.cos(this.cameraPhi);
        const y = this.cameraTarget.y + this.cameraDistance * Math.sin(this.cameraPhi);
        const z = this.cameraTarget.z + this.cameraDistance * Math.cos(this.cameraTheta) * Math.cos(this.cameraPhi);

        this.camera.position.set(x, y, z);
        this.camera.lookAt(this.cameraTarget);

        // Rotate HUD Compass to reflect horizontal orbit Angle (Theta)
        if (this.compassArrow) {
            const deg = -this.cameraTheta * (180 / Math.PI);
            this.compassArrow.style.transform = `rotate(${deg}deg)`;
        }
    }

    /**
     * Drag-to-orbit and Scroll-to-zoom event attachments
     */
    setupCameraInteraction() {
        const handleDragStart = (x, y) => {
            if (this.isFlying) return;
            this.isUserDragging = true;
            this.previousMousePosition = { x, y };
        };

        const handleDragMove = (x, y) => {
            if (!this.isUserDragging || this.isFlying) return;

            const deltaX = x - this.previousMousePosition.x;
            const deltaY = y - this.previousMousePosition.y;

            // horizontal orbital speed
            this.cameraTheta -= deltaX * 0.005;
            // vertical orbital speed
            this.cameraPhi += deltaY * 0.005;

            this.updateCameraPosition();
            this.previousMousePosition = { x, y };
        };

        const handleDragEnd = () => {
            this.isUserDragging = false;
        };

        // Mouse Events
        this.canvas.addEventListener('mousedown', (e) => handleDragStart(e.clientX, e.clientY));
        window.addEventListener('mousemove', (e) => handleDragMove(e.clientX, e.clientY));
        window.addEventListener('mouseup', () => handleDragEnd());

        // Touch Events (Mobile)
        this.canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
            }
        });
        window.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1) {
                handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
            }
        });
        window.addEventListener('touchend', () => handleDragEnd());

        // Scroll zoom
        window.addEventListener('wheel', (e) => {
            if (this.isFlying) return;
            // Smooth zoom interpolation target
            this.targetCameraDistance += e.deltaY * 0.04;
            this.targetCameraDistance = Math.max(30, Math.min(150, this.targetCameraDistance));
        }, { passive: true });
    }

    /**
     * Fly the camera smoothly using GSAP in 3D to a designated hotspot coordinates
     */
    flyToHotspot(index) {
        if (index < 0 || index >= this.hotspotCoordinates.length) return;
        
        this.isFlying = true;
        this.activeHotspotIndex = index;
        const target = this.hotspotCoordinates[index];

        // Animate Spot HUD state badge
        const badge = document.getElementById('current-spot-status');
        if (badge) {
            badge.textContent = "TRAVERSING...";
            badge.className = "spot-status-badge locked";
        }

        // Camera flight parameters:
        // Position camera slightly offset from the target hotspot coordinate to look at it closely
        const flyDistance = 35;
        const targetTheta = this.cameraTheta + (Math.random() - 0.5) * 0.4; // Keep similar horizontal bearing
        const targetPhi = Math.PI / 10; // Low cinematic angle

        const targetCamX = target.x + flyDistance * Math.sin(targetTheta) * Math.cos(targetPhi);
        const targetCamY = target.y + 4; // Look slightly from above ground
        const targetCamZ = target.z + flyDistance * Math.cos(targetTheta) * Math.cos(targetPhi);

        // Stop dragging
        this.isUserDragging = false;

        // Sequence Animations via GSAP
        gsap.killTweensOf(this.cameraTarget);
        gsap.killTweensOf(this.camera.position);

        gsap.timeline({
            onUpdate: () => {
                // Keep looking at target during flight
                this.camera.lookAt(this.cameraTarget);
                // Compute current angles to update compass accurately during flight
                const offset = this.camera.position.clone().sub(this.cameraTarget);
                this.cameraTheta = Math.atan2(offset.x, offset.z);
                
                if (this.compassArrow) {
                    const deg = -this.cameraTheta * (180 / Math.PI);
                    this.compassArrow.style.transform = `rotate(${deg}deg)`;
                }
            },
            onComplete: () => {
                this.isFlying = false;
                this.cameraDistance = flyDistance;
                this.targetCameraDistance = flyDistance;
                this.cameraPhi = targetPhi;
                this.updateCameraPosition();
                
                // Trigger unlock checks
                window.dispatchEvent(new CustomEvent('hotspotReached', { detail: { index } }));
            }
        })
        .to(this.cameraTarget, {
            x: target.x,
            y: target.y + 2,
            z: target.z,
            duration: 2.8,
            ease: "power2.inOut"
        }, 0)
        .to(this.camera.position, {
            x: targetCamX,
            y: targetCamY,
            z: targetCamZ,
            duration: 2.8,
            ease: "power2.inOut"
        }, 0);
    }

    /**
     * Trigger global reset to fly back to full-labyrinth bird's eye view
     */
    flyToOverview() {
        this.isFlying = true;
        this.activeHotspotIndex = -1;

        gsap.killTweensOf(this.cameraTarget);
        gsap.killTweensOf(this.camera.position);

        gsap.timeline({
            onUpdate: () => {
                this.camera.lookAt(this.cameraTarget);
                const offset = this.camera.position.clone().sub(this.cameraTarget);
                this.cameraTheta = Math.atan2(offset.x, offset.z);
                
                if (this.compassArrow) {
                    const deg = -this.cameraTheta * (180 / Math.PI);
                    this.compassArrow.style.transform = `rotate(${deg}deg)`;
                }
            },
            onComplete: () => {
                this.isFlying = false;
                this.cameraDistance = 85;
                this.targetCameraDistance = 85;
                this.cameraTheta = Math.PI / 4;
                this.cameraPhi = Math.PI / 6;
                this.cameraTarget.set(0, 0, 0);
                this.updateCameraPosition();
            }
        })
        .to(this.cameraTarget, {
            x: 0,
            y: 0,
            z: 0,
            duration: 2.5,
            ease: "power2.inOut"
        }, 0)
        .to(this.camera.position, {
            x: 0 + 85 * Math.sin(Math.PI / 4) * Math.cos(Math.PI / 6),
            y: 0 + 85 * Math.sin(Math.PI / 6),
            z: 0 + 85 * Math.cos(Math.PI / 4) * Math.cos(Math.PI / 6),
            duration: 2.5,
            ease: "power2.inOut"
        }, 0);
    }

    /**
     * Generate the central 3D gold ring with a diamond gem resting on the central fog
     */
    generateCentralRing() {
        this.centralRing = new THREE.Group();
        
        // 1. Polished Gold Material for the band and setting
        const goldMat = new THREE.MeshPhongMaterial({
            color: 0xBF9D52, // Brand Gold
            specular: 0xffe8a3, // Bright metallic reflection
            shininess: 90,
            flatShading: false // Smooth polished look
        });

        // 2. Torus for the main Ring Band
        const bandGeo = new THREE.TorusGeometry(3.2, 0.45, 16, 100);
        const bandMesh = new THREE.Mesh(bandGeo, goldMat);
        bandMesh.rotation.x = 0; // Standing vertical circle
        this.centralRing.add(bandMesh);

        // 3. Tapered shoulders merging into the setting (no overlap with loop inner profile)
        const shoulderGeo = new THREE.CylinderGeometry(0.35, 0.45, 1.4, 16);
        
        const leftShoulder = new THREE.Mesh(shoulderGeo, goldMat);
        leftShoulder.position.set(-1.6, 3.1, 0);
        leftShoulder.rotation.z = -Math.PI / 5;
        this.centralRing.add(leftShoulder);

        const rightShoulder = new THREE.Mesh(shoulderGeo, goldMat);
        rightShoulder.position.set(1.6, 3.1, 0);
        rightShoulder.rotation.z = Math.PI / 5;
        this.centralRing.add(rightShoulder);

        // 4. Basket setting loops sitting on top of the vertical band
        const basketLowerGeo = new THREE.TorusGeometry(0.6, 0.08, 8, 32);
        const basketLower = new THREE.Mesh(basketLowerGeo, goldMat);
        basketLower.position.y = 3.65;
        basketLower.rotation.x = Math.PI / 2;
        this.centralRing.add(basketLower);

        const basketMidGeo = new THREE.TorusGeometry(0.85, 0.08, 8, 32);
        const basketMid = new THREE.Mesh(basketMidGeo, goldMat);
        basketMid.position.y = 4.0;
        basketMid.rotation.x = Math.PI / 2;
        this.centralRing.add(basketMid);

        const basketUpperGeo = new THREE.TorusGeometry(1.1, 0.08, 8, 32);
        const basketUpper = new THREE.Mesh(basketUpperGeo, goldMat);
        basketUpper.position.y = 4.35;
        basketUpper.rotation.x = Math.PI / 2;
        this.centralRing.add(basketUpper);

        // 5. Prongs (8 elegant vertical/flared prongs holding the diamond at vertices)
        const prongCount = 8;
        const prongRadius = 0.06;
        const prongHeight = 0.9;
        const prongGeo = new THREE.CylinderGeometry(prongRadius, prongRadius, prongHeight, 8);
        
        for (let i = 0; i < prongCount; i++) {
            const angle = (i / prongCount) * Math.PI * 2;
            const prong = new THREE.Mesh(prongGeo, goldMat);
            
            const r1 = 0.6; // bottom radius
            const r2 = 1.15; // top radius
            const px = Math.cos(angle) * ((r1 + r2) / 2);
            const pz = Math.sin(angle) * ((r1 + r2) / 2);
            prong.position.set(px, 4.0, pz);
            
            prong.rotation.z = -Math.cos(angle) * 0.25;
            prong.rotation.x = Math.sin(angle) * 0.25;
            this.centralRing.add(prong);
        }

        // 6. Faceted Diamond Gem (Crown + Girdle + Pavilion) resting in the basket
        const diamondGroup = new THREE.Group();
        diamondGroup.position.set(0, 4.5, 0);

        this.diamondMaterial = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            emissive: 0x111111,
            specular: 0xffffff,
            shininess: 100,
            transparent: true,
            opacity: 0.85,
            flatShading: true,
            side: THREE.DoubleSide
        });

        // Crown (upper part of diamond): Truncated cone
        const crownGeo = new THREE.CylinderGeometry(0.7, 1.1, 0.35, 8);
        const crownMesh = new THREE.Mesh(crownGeo, this.diamondMaterial);
        crownMesh.position.y = 0.215;
        diamondGroup.add(crownMesh);

        // Girdle (middle thin circular band)
        const girdleGeo = new THREE.CylinderGeometry(1.1, 1.1, 0.08, 8);
        const girdleMesh = new THREE.Mesh(girdleGeo, this.diamondMaterial);
        girdleMesh.position.y = 0;
        diamondGroup.add(girdleMesh);

        // Pavilion (lower part of diamond): Inverted cone pointing down
        const pavilionGeo = new THREE.ConeGeometry(1.1, 0.85, 8);
        const pavilionMesh = new THREE.Mesh(pavilionGeo, this.diamondMaterial);
        pavilionMesh.rotation.x = Math.PI; // point down
        pavilionMesh.position.y = -0.465;
        diamondGroup.add(pavilionMesh);

        this.centralRing.add(diamondGroup);

        // Set scale and initial position, then add to scene
        this.centralRing.scale.set(2.3, 2.3, 2.3);
        this.centralRing.position.set(0, 2.0, 0);
        this.scene.add(this.centralRing);

        // Add a dedicated local pointlight above the ring to illuminate it
        const ringLight = new THREE.PointLight(0xfff5e6, 2.5, 30);
        ringLight.position.set(0, 10, 0);
        this.scene.add(ringLight);
    }

    /**
     * Change the diamond emissive/diffuse color dynamically
     */
    changeDiamondColor(colorHex) {
        if (this.diamondMaterial) {
            const newColor = new THREE.Color(colorHex);
            gsap.to(this.diamondMaterial.color, {
                r: newColor.r,
                g: newColor.g,
                b: newColor.b,
                duration: 1.0
            });
            gsap.to(this.diamondMaterial.emissive, {
                r: newColor.r,
                g: newColor.g,
                b: newColor.b,
                duration: 1.0
            });
        }
    }

    /**
     * Screen resize hook
     */
    onWindowResize() {
        if (!this.camera || !this.renderer) return;
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    /**
     * Three.js Animation Loop
     */
    animate() {
        requestAnimationFrame(() => this.animate());

        const time = Date.now() * 0.0008;

        // 1. Slow persistent drift rotation of Labyrinth point cloud
        if (this.labyrinthParticles) {
            this.labyrinthParticles.rotation.y = time * 0.012;
        }

        // 2. Animate and drift Atmospheric Spores
        if (this.sporeParticles) {
            const positions = this.sporeParticles.geometry.attributes.position.array;
            const count = positions.length / 3;

            for (let i = 0; i < count; i++) {
                // Sway drift on x and z axes using sin waves
                positions[i * 3] += Math.sin(time + i) * 0.012;
                positions[i * 3 + 1] -= 0.015; // Slow downward fall
                positions[i * 3 + 2] += Math.cos(time + i) * 0.012;

                // Wrap particles bottom to top if they fall below floor
                if (positions[i * 3 + 1] < -5) {
                    positions[i * 3 + 1] = 30;
                }
            }
            this.sporeParticles.geometry.attributes.position.needsUpdate = true;
        }

        // 3. Animate Hotspots: Pulsing rings and ascending sparkles
        this.hotspots.forEach((h, idx) => {
            // Spin and swell base ring
            h.ring.rotation.z += 0.008;
            h.ring.material.opacity = 0.15 + Math.sin(time * 3 + idx) * 0.08;

            // Oscillate particle column height slightly
            const pos = h.pillar.geometry.attributes.position.array;
            const count = pos.length / 3;
            for (let i = 0; i < count; i++) {
                // Sparkles rise vertically
                pos[i * 3 + 1] += 0.04;
                // Wrap back to floor
                if (pos[i * 3 + 1] > h.data.y + 24) {
                    pos[i * 3 + 1] = h.data.y - 2;
                }
            }
            h.pillar.geometry.attributes.position.needsUpdate = true;
        });

        // 4. Smooth camera distance interpolation (Scroll easing)
        if (!this.isFlying && Math.abs(this.cameraDistance - this.targetCameraDistance) > 0.05) {
            this.cameraDistance += (this.targetCameraDistance - this.cameraDistance) * 0.1;
            this.updateCameraPosition();
        }

        // 5. Rotate and Float Central Ring
        if (this.centralRing) {
            this.centralRing.rotation.y = time * 0.4;
            this.centralRing.rotation.x = Math.sin(time * 0.5) * 0.1;
            this.centralRing.position.y = 2.0 + Math.sin(time * 1.5) * 0.25;
        }

        // Render Canvas
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }
}

// Global Export
window.Labyrinth3DEngine = Labyrinth3DEngine;
