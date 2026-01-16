// AI Form Analyzer - MediaPipe Integration
let pose = null;
let video = null;
let canvas = null;
let ctx = null;
let isAnalyzing = false;
let poseData = [];

// DOM Elements
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const videoElement = document.getElementById('videoElement');
const videoContainer = document.getElementById('videoContainer');
const outputCanvas = document.getElementById('outputCanvas');
const controls = document.getElementById('controls');
const analyzeBtn = document.getElementById('analyzeBtn');
const resetBtn = document.getElementById('resetBtn');
const loadingSpinner = document.getElementById('loadingSpinner');
const statusArea = document.getElementById('statusArea');
const analysisResults = document.getElementById('analysisResults');

// Initialize MediaPipe
async function initMediaPipe() {
    try {
        loadingSpinner.classList.add('active');

        // Check if MediaPipe is loaded
        if (typeof Pose === 'undefined') {
            throw new Error('MediaPipe kunde inte laddas. Kontrollera din internetanslutning och ladda om sidan.');
        }

        pose = new Pose({
            locateFile: (file) => {
                return `https://unpkg.com/@mediapipe/pose/${file}`;
            }
        });

        pose.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            enableSegmentation: false,
            smoothSegmentation: false,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        pose.onResults(onPoseResults);

        loadingSpinner.classList.remove('active');
        console.log('MediaPipe initialized successfully');
        return true;
    } catch (error) {
        console.error('MediaPipe initialization error:', error);
        loadingSpinner.classList.remove('active');
        showAlert('MediaPipe kunde inte laddas. Kontrollera din internetanslutning och ladda om sidan.');
        return false;
    }
}

// Handle pose results
function onPoseResults(results) {
    if (!results.poseLandmarks) {
        return;
    }

    // Store pose data for analysis
    poseData.push({
        timestamp: videoElement.currentTime,
        landmarks: results.poseLandmarks
    });

    // Draw the pose on canvas
    if (ctx && canvas) {
        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw landmarks
        if (results.poseLandmarks) {
            drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, {
                color: '#00FF00',
                lineWidth: 4
            });
            drawLandmarks(ctx, results.poseLandmarks, {
                color: '#FF0000',
                lineWidth: 2,
                radius: 6
            });
        }

        ctx.restore();
    }
}

// Upload area interactions
uploadArea.addEventListener('click', () => {
    fileInput.click();
});

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFileSelect(files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFileSelect(e.target.files[0]);
    }
});

// Handle file selection
async function handleFileSelect(file) {
    // Validate file
    if (!file.type.startsWith('video/')) {
        showAlert('Vänligen välj en videofil');
        return;
    }

    if (file.size > 100 * 1024 * 1024) { // 100MB
        showAlert('Filen är för stor. Max 100MB');
        return;
    }

    // Initialize MediaPipe if not already done
    if (!pose) {
        const initialized = await initMediaPipe();
        if (!initialized) {
            return;
        }
    }

    // Load video
    const url = URL.createObjectURL(file);
    videoElement.src = url;

    videoElement.onloadedmetadata = () => {
        // Setup canvas
        canvas = outputCanvas;
        ctx = canvas.getContext('2d');
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;

        // Show video and controls
        uploadArea.style.display = 'none';
        videoContainer.style.display = 'block';
        controls.style.display = 'flex';

        // Update status
        const statusBadge = statusArea.querySelector('.status-badge');
        statusBadge.textContent = 'Video laddad - Redo att analysera';
        statusBadge.className = 'status-badge complete';
    };
}

// Analyze button
analyzeBtn.addEventListener('click', async () => {
    if (isAnalyzing) {
        return;
    }

    isAnalyzing = true;
    poseData = [];
    analyzeBtn.disabled = true;
    analyzeBtn.innerHTML = '<span>⏳ Analyserar...</span>';

    // Update status
    const statusBadge = statusArea.querySelector('.status-badge');
    statusBadge.textContent = 'Analyserar video...';
    statusBadge.className = 'status-badge analyzing';

    // Reset video to start
    videoElement.currentTime = 0;
    videoElement.play();

    // Process video frames
    await processVideo();
});

// Process video with MediaPipe
async function processVideo() {
    return new Promise((resolve) => {
        const processFrame = async () => {
            if (videoElement.paused || videoElement.ended) {
                // Analysis complete
                videoElement.pause();
                analyzeResults();
                resolve();
                return;
            }

            // Send frame to MediaPipe
            await pose.send({ image: videoElement });

            // Continue processing
            requestAnimationFrame(processFrame);
        };

        processFrame();

        // When video ends
        videoElement.onended = () => {
            analyzeResults();
            resolve();
        };
    });
}

// Analyze results
function analyzeResults() {
    if (poseData.length === 0) {
        showAlert('Kunde inte detektera kroppen i videon. Försök med en tydligare video.');
        resetAnalysis();
        return;
    }

    // Calculate metrics
    const metrics = calculateMetrics(poseData);

    // Display results
    displayResults(metrics);

    // Update status
    const statusBadge = statusArea.querySelector('.status-badge');
    statusBadge.textContent = 'Analys klar!';
    statusBadge.className = 'status-badge complete';

    // Show results section
    analysisResults.classList.add('active');

    // Reset analyze button
    analyzeBtn.disabled = false;
    analyzeBtn.innerHTML = '<span>🔍 Analysera igen</span>';
    isAnalyzing = false;

    console.log('Analysis complete:', metrics);
}

// Calculate metrics from pose data
function calculateMetrics(data) {
    if (data.length === 0) {
        return null;
    }

    // Analyze posture
    const postureScore = analyzePosture(data);

    // Analyze balance
    const balanceScore = analyzeBalance(data);

    // Analyze hip rotation
    const hipRotationScore = analyzeHipRotation(data);

    // Analyze arm movement
    const armScore = analyzeArmMovement(data);

    // Analyze follow through
    const followThroughScore = analyzeFollowThrough(data);

    return {
        posture: postureScore,
        balance: balanceScore,
        hipRotation: hipRotationScore,
        arm: armScore,
        followThrough: followThroughScore
    };
}

// Analyze posture
function analyzePosture(data) {
    // Simple analysis: check if spine is relatively straight
    let goodFrames = 0;

    data.forEach(frame => {
        const landmarks = frame.landmarks;
        const shoulder = landmarks[12]; // Left shoulder
        const hip = landmarks[24]; // Left hip

        const angle = Math.abs(shoulder.x - hip.x);
        if (angle < 0.1) { // Relatively aligned
            goodFrames++;
        }
    });

    const score = (goodFrames / data.length) * 100;

    if (score > 80) {
        return { score, rating: 'good', text: 'Utmärkt upprätt hållning' };
    } else if (score > 60) {
        return { score, rating: 'warning', text: 'Bra hållning, kan förbättras' };
    } else {
        return { score, rating: 'error', text: 'Försök hålla ryggen rakare' };
    }
}

// Analyze balance
function analyzeBalance(data) {
    // Check foot positioning stability
    let stableFrames = 0;

    data.forEach(frame => {
        const landmarks = frame.landmarks;
        const leftAnkle = landmarks[27];
        const rightAnkle = landmarks[28];

        const footDistance = Math.abs(leftAnkle.x - rightAnkle.x);
        if (footDistance > 0.1 && footDistance < 0.4) { // Good stance width
            stableFrames++;
        }
    });

    const score = (stableFrames / data.length) * 100;

    if (score > 75) {
        return { score, rating: 'good', text: 'Stabil balans genom kastet' };
    } else if (score > 50) {
        return { score, rating: 'warning', text: 'Balansen kunde vara bättre' };
    } else {
        return { score, rating: 'error', text: 'Arbeta med fotplacering för bättre balans' };
    }
}

// Analyze hip rotation
function analyzeHipRotation(data) {
    // Measure hip rotation range
    let maxRotation = 0;

    for (let i = 1; i < data.length; i++) {
        const prev = data[i - 1].landmarks;
        const curr = data[i].landmarks;

        const prevHipAngle = Math.atan2(prev[24].y - prev[23].y, prev[24].x - prev[23].x);
        const currHipAngle = Math.atan2(curr[24].y - curr[23].y, curr[24].x - curr[23].x);

        const rotation = Math.abs(currHipAngle - prevHipAngle);
        maxRotation = Math.max(maxRotation, rotation);
    }

    const score = Math.min((maxRotation / 1.5) * 100, 100);

    if (score > 70) {
        return { score, rating: 'good', text: 'Bra höftrotation för kraft' };
    } else if (score > 50) {
        return { score, rating: 'warning', text: 'Öka höftrotationen för mer kraft' };
    } else {
        return { score, rating: 'error', text: 'Fokusera på att rotera höfterna mer' };
    }
}

// Analyze arm movement
function analyzeArmMovement(data) {
    // Check arm extension
    let goodFrames = 0;

    data.forEach(frame => {
        const landmarks = frame.landmarks;
        const shoulder = landmarks[12];
        const elbow = landmarks[14];
        const wrist = landmarks[16];

        const armLength = Math.sqrt(
            Math.pow(wrist.x - shoulder.x, 2) +
            Math.pow(wrist.y - shoulder.y, 2)
        );

        if (armLength > 0.3) { // Good extension
            goodFrames++;
        }
    });

    const score = (goodFrames / data.length) * 100;

    if (score > 70) {
        return { score, rating: 'good', text: 'Bra armsträckning' };
    } else if (score > 50) {
        return { score, rating: 'warning', text: 'Sträck ut armen mer' };
    } else {
        return { score, rating: 'error', text: 'Armen behöver sträckas ut mer för maximal kraft' };
    }
}

// Analyze follow through
function analyzeFollowThrough(data) {
    // Check if arm continues motion after release point
    if (data.length < 10) {
        return { score: 50, rating: 'warning', text: 'Video för kort för att analysera' };
    }

    const lastQuarter = data.slice(Math.floor(data.length * 0.75));
    let followThroughFrames = 0;

    lastQuarter.forEach(frame => {
        const landmarks = frame.landmarks;
        const shoulder = landmarks[12];
        const wrist = landmarks[16];

        if (wrist.x > shoulder.x) { // Arm extended forward
            followThroughFrames++;
        }
    });

    const score = (followThroughFrames / lastQuarter.length) * 100;

    if (score > 60) {
        return { score, rating: 'good', text: 'Bra uppföljning av kastet' };
    } else if (score > 40) {
        return { score, rating: 'warning', text: 'Följ igenom kastet mer' };
    } else {
        return { score, rating: 'error', text: 'Viktigt att följa igenom kastet helt' };
    }
}

// Display results
function displayResults(metrics) {
    if (!metrics) {
        return;
    }

    // Update posture
    const postureMetric = document.getElementById('postureResult').parentElement;
    postureMetric.className = `metric metric-${metrics.posture.rating}`;
    document.getElementById('postureResult').textContent = metrics.posture.text;

    // Update balance
    const balanceMetric = document.getElementById('balanceResult').parentElement;
    balanceMetric.className = `metric metric-${metrics.balance.rating}`;
    document.getElementById('balanceResult').textContent = metrics.balance.text;

    // Update hip rotation
    const hipMetric = document.getElementById('hipRotationResult').parentElement;
    hipMetric.className = `metric metric-${metrics.hipRotation.rating}`;
    document.getElementById('hipRotationResult').textContent = metrics.hipRotation.text;

    // Update arm movement
    const armMetric = document.getElementById('armMovementResult').parentElement;
    armMetric.className = `metric metric-${metrics.arm.rating}`;
    document.getElementById('armMovementResult').textContent = metrics.arm.text;

    // Update follow through
    const followMetric = document.getElementById('followThroughResult').parentElement;
    followMetric.className = `metric metric-${metrics.followThrough.rating}`;
    document.getElementById('followThroughResult').textContent = metrics.followThrough.text;
}

// Reset analysis
function resetAnalysis() {
    analyzeBtn.disabled = false;
    analyzeBtn.innerHTML = '<span>🔍 Analysera</span>';
    isAnalyzing = false;
}

// Reset button
resetBtn.addEventListener('click', () => {
    // Reset everything
    videoElement.pause();
    videoElement.src = '';
    poseData = [];

    // Hide video and results
    videoContainer.style.display = 'none';
    controls.style.display = 'none';
    analysisResults.classList.remove('active');
    uploadArea.style.display = 'block';

    // Clear canvas
    if (ctx && canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    // Reset status
    const statusBadge = statusArea.querySelector('.status-badge');
    statusBadge.textContent = 'Väntar på video';
    statusBadge.className = 'status-badge pending';

    resetAnalysis();
});

// Show alert
function showAlert(message) {
    // Create alert dialog
    const alertDiv = document.createElement('div');
    alertDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 2rem;
        border-radius: 15px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        max-width: 400px;
        text-align: center;
    `;

    alertDiv.innerHTML = `
        <h3 style="margin-bottom: 1rem; color: #d63031;">Från utformning.github.io:</h3>
        <p style="margin-bottom: 1.5rem; color: #666;">${message}</p>
        <button id="alertOkBtn" class="btn btn-primary">OK</button>
    `;

    // Create overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 9999;
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(alertDiv);

    // Close on button click
    document.getElementById('alertOkBtn').addEventListener('click', () => {
        document.body.removeChild(alertDiv);
        document.body.removeChild(overlay);
    });
}

// Initialize on page load
window.addEventListener('load', () => {
    console.log('AI Form Analyzer loaded');

    // Pre-load MediaPipe (optional)
    // initMediaPipe();
});
