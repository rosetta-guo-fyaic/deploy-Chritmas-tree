import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

// Configuration
const PARTICLE_COUNT = 3000; // Reduced count for better visibility of letters
const TREE_HEIGHT = 40;
const TREE_RADIUS = 15;
const EXPLOSION_RADIUS = 80;

// State
let mode = 'TREE'; // 'TREE' or 'EXPLODE'

// --- Three.js Setup ---
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.005); // Reduced fog density so background is visible

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 20, 50);

const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true }); // Antialias off for postprocessing usually
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.toneMapping = THREE.ReinhardToneMapping;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.autoRotate = true;
controls.autoRotateSpeed = 1.0;

// --- Post Processing (Bloom) ---
const renderScene = new RenderPass(scene, camera);

const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
bloomPass.threshold = 0.1;
bloomPass.strength = 1.2; // Glow intensity
bloomPass.radius = 0.5;

const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);

// --- Background (Knowledge Graph) ---
const bgGroup = new THREE.Group();
scene.add(bgGroup);

const bgNodeCount = 100;
const bgNodesGeometry = new THREE.BufferGeometry();
const bgNodesPositions = new Float32Array(bgNodeCount * 3);
const bgNodesVelocities = [];

// Lines geometry
const bgLinesGeometry = new THREE.BufferGeometry();
const bgLinesPositions = new Float32Array(bgNodeCount * bgNodeCount * 3); // Max possible lines (overkill but safe)
bgLinesGeometry.setAttribute('position', new THREE.BufferAttribute(bgLinesPositions, 3));

// Initialize BG Nodes
for (let i = 0; i < bgNodeCount; i++) {
    const r = 80 + Math.random() * 60; // Far background
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos((Math.random() * 2) - 1);
    
    bgNodesPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    bgNodesPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    bgNodesPositions[i * 3 + 2] = r * Math.cos(phi);

    // Random slow velocity
    bgNodesVelocities.push({
        x: (Math.random() - 0.5) * 0.05,
        y: (Math.random() - 0.5) * 0.05,
        z: (Math.random() - 0.5) * 0.05
    });
}
bgNodesGeometry.setAttribute('position', new THREE.BufferAttribute(bgNodesPositions, 3));

const bgNodesMaterial = new THREE.PointsMaterial({
    color: 0xFFD700, // Golden color
    size: 1.5, 
    transparent: true,
    opacity: 0.8 
});
const bgNodes = new THREE.Points(bgNodesGeometry, bgNodesMaterial);
bgGroup.add(bgNodes);

const bgLinesMaterial = new THREE.LineBasicMaterial({
    color: 0xFFD700, // Golden color
    transparent: true,
    opacity: 0.3, 
    blending: THREE.AdditiveBlending
});
const bgLines = new THREE.LineSegments(bgLinesGeometry, bgLinesMaterial);
bgGroup.add(bgLines);

function updateBackground() {
    const positions = bgNodes.geometry.attributes.position.array;
    
    // Update positions
    for (let i = 0; i < bgNodeCount; i++) {
        positions[i * 3] += bgNodesVelocities[i].x;
        positions[i * 3 + 1] += bgNodesVelocities[i].y;
        positions[i * 3 + 2] += bgNodesVelocities[i].z;
        
        // Wrap around logic (simple bounce)
        if (Math.abs(positions[i*3]) > 150) bgNodesVelocities[i].x *= -1;
        if (Math.abs(positions[i*3+1]) > 150) bgNodesVelocities[i].y *= -1;
        if (Math.abs(positions[i*3+2]) > 150) bgNodesVelocities[i].z *= -1;
    }
    bgNodes.geometry.attributes.position.needsUpdate = true;

    // Update lines
    let lineIndex = 0;
    const connectDistance = 30;
    const linePos = bgLines.geometry.attributes.position.array;

    for (let i = 0; i < bgNodeCount; i++) {
        for (let j = i + 1; j < bgNodeCount; j++) {
            const dx = positions[i*3] - positions[j*3];
            const dy = positions[i*3+1] - positions[j*3+1];
            const dz = positions[i*3+2] - positions[j*3+2];
            const distSq = dx*dx + dy*dy + dz*dz;

            if (distSq < connectDistance * connectDistance) {
                linePos[lineIndex++] = positions[i*3];
                linePos[lineIndex++] = positions[i*3+1];
                linePos[lineIndex++] = positions[i*3+2];
                
                linePos[lineIndex++] = positions[j*3];
                linePos[lineIndex++] = positions[j*3+1];
                linePos[lineIndex++] = positions[j*3+2];
            }
        }
    }
    bgLines.geometry.setDrawRange(0, lineIndex / 3);
    bgLines.geometry.attributes.position.needsUpdate = true;
    
    // Rotate background slowly
    bgGroup.rotation.y += 0.001;
}

// --- Snowfall System ---
const snowGroup = new THREE.Group();
scene.add(snowGroup);

const snowCount = 1000;
const snowGeometry = new THREE.BufferGeometry();
const snowPositions = new Float32Array(snowCount * 3);
const snowVelocities = [];

for (let i = 0; i < snowCount; i++) {
    snowPositions[i * 3] = (Math.random() - 0.5) * 200;
    snowPositions[i * 3 + 1] = (Math.random() - 0.5) * 200;
    snowPositions[i * 3 + 2] = (Math.random() - 0.5) * 200;
    
    snowVelocities.push({
        y: -0.1 - Math.random() * 0.3, // Fall down
        x: (Math.random() - 0.5) * 0.1, // Slight wind
        z: (Math.random() - 0.5) * 0.1
    });
}
snowGeometry.setAttribute('position', new THREE.BufferAttribute(snowPositions, 3));

const snowMaterial = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.8,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending
});
const snow = new THREE.Points(snowGeometry, snowMaterial);
snowGroup.add(snow);

function updateSnow() {
    const positions = snow.geometry.attributes.position.array;
    for (let i = 0; i < snowCount; i++) {
        positions[i * 3] += snowVelocities[i].x;
        positions[i * 3 + 1] += snowVelocities[i].y;
        positions[i * 3 + 2] += snowVelocities[i].z;

        // Reset if too low
        if (positions[i * 3 + 1] < -60) {
            positions[i * 3 + 1] = 100;
            positions[i * 3] = (Math.random() - 0.5) * 200;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 200;
        }
    }
    snow.geometry.attributes.position.needsUpdate = true;
    snowGroup.rotation.y += 0.002; // Rotate snow slowly
}

// --- Helper: Create Text Texture ---
function createTextTexture(text, colorStr) {
    const canvas = document.createElement('canvas');
    const size = 64; // Texture size
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    
    // Debug background (optional, keep transparent for final)
    // context.fillStyle = 'rgba(255, 255, 255, 0.1)';
    // context.fillRect(0, 0, size, size);

    context.font = 'bold 48px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = colorStr;
    context.fillText(text, size / 2, size / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
}

// --- Helper: Generate Text Positions for "FUYO" ---
function getFuyoPositions(count) {
    const canvas = document.createElement('canvas');
    const width = 200;
    const height = 100;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    // Draw "FUYO"
    ctx.fillStyle = '#000000'; // Background
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#ffffff'; // Text
    ctx.font = 'bold 60px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('FUYO', width / 2, height / 2);
    
    const imageData = ctx.getImageData(0, 0, width, height);
    const validPixels = [];
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = (y * width + x) * 4;
            if (imageData.data[index] > 128) { // If pixel is bright (part of text)
                validPixels.push({ x: x, y: y });
            }
        }
    }
    
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        if (validPixels.length === 0) break;
        
        // Randomly pick a valid pixel
        const pixel = validPixels[Math.floor(Math.random() * validPixels.length)];
        
        // Map pixel to 3D space
        // x: 0..200 -> -30..30
        // y: 0..100 -> 15..-15 (flip y)
        const scale = 0.4;
        positions[i * 3] = (pixel.x - width / 2) * scale;
        positions[i * 3 + 1] = -(pixel.y - height / 2) * scale + 20; // Lift up a bit
        positions[i * 3 + 2] = (Math.random() - 0.5) * 2; // Slight depth
    }
    return positions;
}

// --- Particle System ---
// We will create 3 separate particle systems for 'A', 'I', 'C' to allow different textures
const particleGroups = [];
const letters = ['A', 'I', 'C'];
// We use white textures so we can tint them with vertex colors, 
// OR we can just use colored textures. Let's use white textures + vertex colors for sparkle.
// Actually, using colored textures is simpler for distinct look.
const allParticleData = [];

// Pre-calculate FUYO positions for ALL particles combined
// But since we split into 3 groups, we need to distribute them.
// Easier way: Each group gets its own subset of FUYO positions?
// Or better: generate a large buffer of FUYO positions and slice it.
const totalParticles = PARTICLE_COUNT; // 3000
const fuyoAllPositions = getFuyoPositions(totalParticles); // Helper function

letters.forEach((letter, index) => {
    const count = Math.floor(PARTICLE_COUNT / 3);
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    
    const pData = {
        positions: positions,
        targetPositions: new Float32Array(count * 3),
        randomPositions: new Float32Array(count * 3),
        spherePositions: new Float32Array(count * 3),
        fuyoPositions: new Float32Array(count * 3), // Add FUYO positions
        geometry: geometry
    };

    const color1 = new THREE.Color(0x00ff00); // Green
    const color2 = new THREE.Color(0xffd700); // Gold
    const color3 = new THREE.Color(0xff0000); // Red

    for (let i = 0; i < count; i++) {
        // Shared index across the whole tree concept (to keep spiral consistent)
        // We offset 't' by the group index to interleave them
        const totalIndex = i * 3 + index; 
        const t = totalIndex / PARTICLE_COUNT;
        
        // 1. Generate Tree Shape
        const angle = t * Math.PI * 40; 
        const radius = (1 - t) * TREE_RADIUS; 
        const r = radius + (Math.random() - 0.5) * 2;
        
        const x = Math.cos(angle) * r;
        const y = t * TREE_HEIGHT - (TREE_HEIGHT / 2); 
        const z = Math.sin(angle) * r;

        pData.targetPositions[i * 3] = x;
        pData.targetPositions[i * 3 + 1] = y;
        pData.targetPositions[i * 3 + 2] = z;

        pData.positions[i * 3] = x;
        pData.positions[i * 3 + 1] = y;
        pData.positions[i * 3 + 2] = z;

        // 2. Generate Random Exploded Positions
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos((Math.random() * 2) - 1);
        const rad = Math.random() * EXPLOSION_RADIUS;
        
        pData.randomPositions[i * 3] = rad * Math.sin(phi) * Math.cos(theta);
        pData.randomPositions[i * 3 + 1] = rad * Math.sin(phi) * Math.sin(theta);
        pData.randomPositions[i * 3 + 2] = rad * Math.cos(phi);

        // 3. Generate Sphere Positions (Victory Mode)
        const sR = 25;
        const sTheta = Math.random() * Math.PI * 2;
        const sPhi = Math.acos((Math.random() * 2) - 1);
        
        pData.spherePositions[i * 3] = sR * Math.sin(sPhi) * Math.cos(sTheta);
        pData.spherePositions[i * 3 + 1] = sR * Math.sin(sPhi) * Math.sin(sTheta);
        pData.spherePositions[i * 3 + 2] = sR * Math.cos(sPhi);

        // 4. Assign FUYO Positions
        // We take the slice corresponding to this particle from the global buffer
        pData.fuyoPositions[i * 3] = fuyoAllPositions[totalIndex * 3];
        pData.fuyoPositions[i * 3 + 1] = fuyoAllPositions[totalIndex * 3 + 1];
        pData.fuyoPositions[i * 3 + 2] = fuyoAllPositions[totalIndex * 3 + 2];

        // 5. Colors
        // Randomly assign Green, Gold, Red regardless of letter
        let c = color1;
        if (Math.random() > 0.70) c = color2;
        if (Math.random() > 0.90) c = color3;
        
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Create Material with Letter Texture
    // We create a WHITE letter texture so we can tint it with vertex colors
    const texture = createTextTexture(letter, '#ffffff');
    
    const material = new THREE.PointsMaterial({
        size: 2.0, // Bigger size for letters
        map: texture,
        vertexColors: true,
        alphaTest: 0.5, // Crisp edges
        transparent: true,
        opacity: 1.0,
        sizeAttenuation: true
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);
    particleGroups.push(points);
    allParticleData.push(pData);
});

// --- MediaPipe Setup ---
let handLandmarker = undefined;
let webcamRunning = false;
const video = document.getElementById('webcam');
const loading = document.getElementById('loading');
const statusDiv = document.getElementById('status');

async function createHandLandmarker() {
    const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm"
    );
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 2
    });
    loading.style.display = 'none';
    startWebcam();
}

function startWebcam() {
    if (!handLandmarker) return;

    const constraints = { video: true };
    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
        video.srcObject = stream;
        video.addEventListener("loadeddata", predictWebcam);
        webcamRunning = true;
    });
}

let lastVideoTime = -1;
async function predictWebcam() {
    if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        const startTimeMs = performance.now();
        
        if (handLandmarker) {
            const result = handLandmarker.detectForVideo(video, startTimeMs);
            handleGestures(result);
        }
    }
    if (webcamRunning) {
        requestAnimationFrame(predictWebcam);
    }
}

// --- Interaction Logic ---
function handleGestures(result) {
    if (result.landmarks && result.landmarks.length > 0) {
        const landmarks = result.landmarks[0]; // Get first hand
        
        const wrist = landmarks[0];
        const tips = [8, 12, 16, 20]; 
        const bases = [5, 9, 13, 17];
        
        let openFingers = 0;
        
        for (let i = 0; i < tips.length; i++) {
            const tip = landmarks[tips[i]];
            const base = landmarks[bases[i]];
            
            // Calculate distance to wrist
            const tipDist = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
            const baseDist = Math.hypot(base.x - wrist.x, base.y - wrist.y);
            
            if (tipDist > baseDist * 1.2) { 
                openFingers++;
            }
        }

        // Detect States
        if (openFingers >= 3) {
            mode = 'EXPLODE';
            statusDiv.innerText = "Status: Hand OPEN -> Explode!";
            statusDiv.style.color = "#ff0000";
        } else {
            // Check for OK Sign (Thumb and Index touching)
            const thumbTip = landmarks[4];
            const indexTip = landmarks[8];
            const thumbIndexDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
            
            // Check for Victory (Index & Middle Open, Ring & Pinky Closed)
            const indexBase = landmarks[5];
            const middleTip = landmarks[12];
            const middleBase = landmarks[9];
            
            const isIndexOpen = Math.hypot(indexTip.x - wrist.x, indexTip.y - wrist.y) > Math.hypot(indexBase.x - wrist.x, indexBase.y - wrist.y) * 1.1;
            const isMiddleOpen = Math.hypot(middleTip.x - wrist.x, middleTip.y - wrist.y) > Math.hypot(middleBase.x - wrist.x, middleBase.y - wrist.y) * 1.1;
            
            // Logic for Modes
            if (thumbIndexDist < 0.05) { // OK Gesture (Thumb + Index touching)
                mode = 'SPHERE';
                statusDiv.innerText = "Status: OK Sign (👌) -> Sphere Mode!";
                statusDiv.style.color = "#00ffff";
            } else if (openFingers === 2 && isIndexOpen && isMiddleOpen) { // Victory Gesture
                mode = 'FUYO';
                statusDiv.innerText = "Status: Victory (✌️) -> FUYO Mode!";
                statusDiv.style.color = "#ffff00";
            } else {
                mode = 'TREE';
                statusDiv.innerText = "Status: Hand CLOSED -> Assemble Tree";
                statusDiv.style.color = "#00ff00";
            }
        }

        // Map Hand X position to rotation speed
        const handX = landmarks[9].x; 
        const rotationSpeed = (handX - 0.5) * 5; 
        controls.autoRotateSpeed = rotationSpeed;

    } else {
        // No hand detected
        mode = 'TREE';
        statusDiv.innerText = "Status: No hand detected (Auto Tree)";
        statusDiv.style.color = "#fff";
        controls.autoRotateSpeed = 1.0;
    }
}


// --- Animation Loop ---
function animate() {
    requestAnimationFrame(animate);
    
    // Iterate over all particle groups (A, I, C)
    const lerpSpeed = 0.05;

    allParticleData.forEach((data, groupIndex) => {
        const currentPositions = data.positions;
        const count = currentPositions.length / 3;

        for (let i = 0; i < count; i++) {
            const ix = i * 3;
            const iy = i * 3 + 1;
            const iz = i * 3 + 2;

            let tx, ty, tz;

            if (mode === 'TREE') {
                tx = data.targetPositions[ix];
                ty = data.targetPositions[iy];
                tz = data.targetPositions[iz];
            } else if (mode === 'SPHERE') {
                tx = data.spherePositions[ix];
                ty = data.spherePositions[iy];
                tz = data.spherePositions[iz];
            } else if (mode === 'FUYO') {
                tx = data.fuyoPositions[ix];
                ty = data.fuyoPositions[iy];
                tz = data.fuyoPositions[iz];
            } else {
                tx = data.randomPositions[ix];
                ty = data.randomPositions[iy];
                tz = data.randomPositions[iz];
            }

            // Interpolate
            currentPositions[ix] += (tx - currentPositions[ix]) * lerpSpeed;
            currentPositions[iy] += (ty - currentPositions[iy]) * lerpSpeed;
            currentPositions[iz] += (tz - currentPositions[iz]) * lerpSpeed;
        }
        
        // Notify Three.js that positions have changed
        data.geometry.attributes.position.needsUpdate = true;
    });

    updateBackground();
    updateSnow();
    controls.update();
    // renderer.render(scene, camera); // Replaced by composer
    composer.render();
}

// Handle Window Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start
createHandLandmarker();
animate();