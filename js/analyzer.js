// AI Form Analyzer - TensorFlow.js Pose Detection Integration
let detector = null;
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

// Initialize TensorFlow.js Pose Detection
async function initPoseDetection() {
    try {
        loadingSpinner.classList.add('active');

        // Check if TensorFlow is loaded
        if (typeof poseDetection === 'undefined') {
            throw new Error('TensorFlow kunde inte laddas. Kontrollera din internetanslutning och ladda om sidan.');
        }

        // Create detector
        const model = poseDetection.SupportedModels.MoveNet;
        detector = await poseDetection.createDetector(model, {
            modelType: poseDetection.movenet.modelType.SINGLEPOSE_THUNDER
        });

        loadingSpinner.classList.remove('active');
        console.log('TensorFlow Pose Detection initialized successfully');
        return true;
    } catch (error) {
        console.error('Pose detection initialization error:', error);
        loadingSpinner.classList.remove('active');
        showAlert('Pose detection kunde inte laddas. Kontrollera din internetanslutning och ladda om sidan.');
        return false;
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

    // Initialize detector if not already done
    if (!detector) {
        const initialized = await initPoseDetection();
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

// Process video with TensorFlow
async function processVideo() {
    return new Promise((resolve) => {
        let frameCount = 0;
        const maxFrames = 300; // Limit frames for performance

        const processFrame = async () => {
            if (videoElement.paused || videoElement.ended || frameCount >= maxFrames) {
                // Analysis complete
                videoElement.pause();
                analyzeResults();
                resolve();
                return;
            }

            try {
                // Detect pose
                const poses = await detector.estimatePoses(videoElement);

                if (poses.length > 0) {
                    const pose = poses[0];

                    // Store pose data
                    poseData.push({
                        timestamp: videoElement.currentTime,
                        keypoints: pose.keypoints,
                        score: pose.score
                    });

                    // Draw pose on canvas
                    drawPose(pose);
                }

                frameCount++;
            } catch (error) {
                console.error('Error processing frame:', error);
            }

            // Continue processing (sample every 5 frames for performance)
            if (frameCount % 5 === 0) {
                setTimeout(() => requestAnimationFrame(processFrame), 50);
            } else {
                requestAnimationFrame(processFrame);
            }
        };

        processFrame();

        // When video ends
        videoElement.onended = () => {
            analyzeResults();
            resolve();
        };
    });
}

// Draw pose on canvas
function drawPose(pose) {
    if (!ctx || !canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw keypoints
    pose.keypoints.forEach(keypoint => {
        if (keypoint.score > 0.3) {
            ctx.beginPath();
            ctx.arc(keypoint.x, keypoint.y, 5, 0, 2 * Math.PI);
            ctx.fillStyle = '#FF0000';
            ctx.fill();
        }
    });

    // Draw skeleton connections
    const connections = [
        [5, 6], [5, 7], [7, 9], [6, 8], [8, 10], // Arms
        [5, 11], [6, 12], [11, 12], // Torso
        [11, 13], [13, 15], [12, 14], [14, 16] // Legs
    ];

    ctx.strokeStyle = '#00FF00';
    ctx.lineWidth = 2;

    connections.forEach(([i, j]) => {
        const kp1 = pose.keypoints[i];
        const kp2 = pose.keypoints[j];

        if (kp1.score > 0.3 && kp2.score > 0.3) {
            ctx.beginPath();
            ctx.moveTo(kp1.x, kp1.y);
            ctx.lineTo(kp2.x, kp2.y);
            ctx.stroke();
        }
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

// Get keypoint by name
function getKeypoint(keypoints, name) {
    const keypointMap = {
        'left_shoulder': 5,
        'right_shoulder': 6,
        'left_elbow': 7,
        'right_elbow': 8,
        'left_wrist': 9,
        'right_wrist': 10,
        'left_hip': 11,
        'right_hip': 12,
        'left_knee': 13,
        'right_knee': 14,
        'left_ankle': 15,
        'right_ankle': 16
    };

    const index = keypointMap[name];
    return keypoints[index];
}

// Analyze posture
function analyzePosture(data) {
    let goodFrames = 0;

    data.forEach(frame => {
        const leftShoulder = getKeypoint(frame.keypoints, 'left_shoulder');
        const leftHip = getKeypoint(frame.keypoints, 'left_hip');

        if (leftShoulder.score > 0.3 && leftHip.score > 0.3) {
            const angle = Math.abs(leftShoulder.x - leftHip.x);
            if (angle < 50) { // Relatively aligned
                goodFrames++;
            }
        }
    });

    const score = (goodFrames / data.length) * 100;

    if (score > 70) {
        return { score, rating: 'good', text: 'Utmärkt upprätt hållning' };
    } else if (score > 50) {
        return { score, rating: 'warning', text: 'Bra hållning, kan förbättras' };
    } else {
        return { score, rating: 'error', text: 'Försök hålla ryggen rakare' };
    }
}

// Analyze balance
function analyzeBalance(data) {
    let stableFrames = 0;

    data.forEach(frame => {
        const leftAnkle = getKeypoint(frame.keypoints, 'left_ankle');
        const rightAnkle = getKeypoint(frame.keypoints, 'right_ankle');

        if (leftAnkle.score > 0.3 && rightAnkle.score > 0.3) {
            const footDistance = Math.abs(leftAnkle.x - rightAnkle.x);
            if (footDistance > 50 && footDistance < 200) {
                stableFrames++;
            }
        }
    });

    const score = (stableFrames / data.length) * 100;

    if (score > 70) {
        return { score, rating: 'good', text: 'Stabil balans genom kastet' };
    } else if (score > 50) {
        return { score, rating: 'warning', text: 'Balansen kunde vara bättre' };
    } else {
        return { score, rating: 'error', text: 'Arbeta med fotplacering för bättre balans' };
    }
}

// Analyze hip rotation
function analyzeHipRotation(data) {
    let maxRotation = 0;

    for (let i = 1; i < data.length; i++) {
        const prev = data[i - 1].keypoints;
        const curr = data[i].keypoints;

        const prevLeftHip = getKeypoint(prev, 'left_hip');
        const prevRightHip = getKeypoint(prev, 'right_hip');
        const currLeftHip = getKeypoint(curr, 'left_hip');
        const currRightHip = getKeypoint(curr, 'right_hip');

        if (prevLeftHip.score > 0.3 && prevRightHip.score > 0.3 &&
            currLeftHip.score > 0.3 && currRightHip.score > 0.3) {

            const prevAngle = Math.atan2(prevLeftHip.y - prevRightHip.y, prevLeftHip.x - prevRightHip.x);
            const currAngle = Math.atan2(currLeftHip.y - currRightHip.y, currLeftHip.x - currRightHip.x);

            const rotation = Math.abs(currAngle - prevAngle);
            maxRotation = Math.max(maxRotation, rotation);
        }
    }

    const score = Math.min((maxRotation / 1.0) * 100, 100);

    if (score > 60) {
        return { score, rating: 'good', text: 'Bra höftrotation för kraft' };
    } else if (score > 40) {
        return { score, rating: 'warning', text: 'Öka höftrotationen för mer kraft' };
    } else {
        return { score, rating: 'error', text: 'Fokusera på att rotera höfterna mer' };
    }
}

// Analyze arm movement
function analyzeArmMovement(data) {
    let goodFrames = 0;

    data.forEach(frame => {
        const shoulder = getKeypoint(frame.keypoints, 'right_shoulder');
        const wrist = getKeypoint(frame.keypoints, 'right_wrist');

        if (shoulder.score > 0.3 && wrist.score > 0.3) {
            const armLength = Math.sqrt(
                Math.pow(wrist.x - shoulder.x, 2) +
                Math.pow(wrist.y - shoulder.y, 2)
            );

            if (armLength > 100) {
                goodFrames++;
            }
        }
    });

    const score = (goodFrames / data.length) * 100;

    if (score > 60) {
        return { score, rating: 'good', text: 'Bra armsträckning' };
    } else if (score > 40) {
        return { score, rating: 'warning', text: 'Sträck ut armen mer' };
    } else {
        return { score, rating: 'error', text: 'Armen behöver sträckas ut mer för maximal kraft' };
    }
}

// Analyze follow through
function analyzeFollowThrough(data) {
    if (data.length < 10) {
        return { score: 50, rating: 'warning', text: 'Video för kort för att analysera' };
    }

    const lastQuarter = data.slice(Math.floor(data.length * 0.75));
    let followThroughFrames = 0;

    lastQuarter.forEach(frame => {
        const shoulder = getKeypoint(frame.keypoints, 'right_shoulder');
        const wrist = getKeypoint(frame.keypoints, 'right_wrist');

        if (shoulder.score > 0.3 && wrist.score > 0.3) {
            if (wrist.x > shoulder.x) {
                followThroughFrames++;
            }
        }
    });

    const score = (followThroughFrames / lastQuarter.length) * 100;

    if (score > 50) {
        return { score, rating: 'good', text: 'Bra uppföljning av kastet' };
    } else if (score > 30) {
        return { score, rating: 'warning', text: 'Följ igenom kastet mer' };
    } else {
        return { score, rating: 'error', text: 'Viktigt att följa igenom kastet helt' };
    }
}

// Capture frame from video
function captureFrame(timestamp) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = videoElement.videoWidth;
    tempCanvas.height = videoElement.videoHeight;
    const tempCtx = tempCanvas.getContext('2d');

    // Set video to specific time
    videoElement.currentTime = timestamp;

    return new Promise((resolve) => {
        videoElement.onseeked = () => {
            tempCtx.drawImage(videoElement, 0, 0);
            resolve(tempCanvas.toDataURL('image/jpeg', 0.8));
        };
    });
}

// Display results with detailed analysis
async function displayResults(metrics) {
    if (!metrics) {
        return;
    }

    // Find key frames for examples
    const startFrame = poseData[0].timestamp;
    const midFrame = poseData[Math.floor(poseData.length / 2)].timestamp;
    const endFrame = poseData[poseData.length - 1].timestamp;

    // Capture example frames
    const startFrameImg = await captureFrame(startFrame);
    const midFrameImg = await captureFrame(midFrame);
    const endFrameImg = await captureFrame(endFrame);

    // Update posture with detailed analysis
    const postureMetric = document.getElementById('postureResult').parentElement;
    postureMetric.className = `metric metric-${metrics.posture.rating}`;
    document.getElementById('postureResult').innerHTML = `
        <strong>${metrics.posture.text}</strong>
        <div class="metric-details">
            <p>${getDetailedPostureAnalysis(metrics.posture)}</p>
            <div class="metric-frames">
                <div class="metric-frame">
                    <img src="${startFrameImg}" alt="Start position">
                    <div class="metric-frame-label">Start</div>
                </div>
                <div class="metric-frame">
                    <img src="${midFrameImg}" alt="Mid throw">
                    <div class="metric-frame-label">Mitt i kastet</div>
                </div>
            </div>
            ${metrics.posture.rating !== 'good' ? getPostureReference() : ''}
        </div>
    `;

    // Update balance with detailed analysis
    const balanceMetric = document.getElementById('balanceResult').parentElement;
    balanceMetric.className = `metric metric-${metrics.balance.rating}`;
    document.getElementById('balanceResult').innerHTML = `
        <strong>${metrics.balance.text}</strong>
        <div class="metric-details">
            <p>${getDetailedBalanceAnalysis(metrics.balance)}</p>
            <div class="metric-frames">
                <div class="metric-frame">
                    <img src="${startFrameImg}" alt="Stance">
                    <div class="metric-frame-label">Din ställning</div>
                </div>
            </div>
            ${metrics.balance.rating !== 'good' ? getBalanceReference() : ''}
        </div>
    `;

    // Update hip rotation with detailed analysis
    const hipMetric = document.getElementById('hipRotationResult').parentElement;
    hipMetric.className = `metric metric-${metrics.hipRotation.rating}`;
    document.getElementById('hipRotationResult').innerHTML = `
        <strong>${metrics.hipRotation.text}</strong>
        <div class="metric-details">
            <p>${getDetailedHipAnalysis(metrics.hipRotation)}</p>
            <div class="metric-frames">
                <div class="metric-frame">
                    <img src="${startFrameImg}" alt="Start rotation">
                    <div class="metric-frame-label">Början</div>
                </div>
                <div class="metric-frame">
                    <img src="${midFrameImg}" alt="Max rotation">
                    <div class="metric-frame-label">Max rotation</div>
                </div>
            </div>
            ${metrics.hipRotation.rating !== 'good' ? getHipRotationReference() : ''}
        </div>
    `;

    // Update arm movement with detailed analysis
    const armMetric = document.getElementById('armMovementResult').parentElement;
    armMetric.className = `metric metric-${metrics.arm.rating}`;
    document.getElementById('armMovementResult').innerHTML = `
        <strong>${metrics.arm.text}</strong>
        <div class="metric-details">
            <p>${getDetailedArmAnalysis(metrics.arm)}</p>
            <div class="metric-frames">
                <div class="metric-frame">
                    <img src="${midFrameImg}" alt="Arm extension">
                    <div class="metric-frame-label">Armsträckning</div>
                </div>
            </div>
            ${metrics.arm.rating !== 'good' ? getArmMovementReference() : ''}
        </div>
    `;

    // Update follow through with detailed analysis
    const followMetric = document.getElementById('followThroughResult').parentElement;
    followMetric.className = `metric metric-${metrics.followThrough.rating}`;
    document.getElementById('followThroughResult').innerHTML = `
        <strong>${metrics.followThrough.text}</strong>
        <div class="metric-details">
            <p>${getDetailedFollowThroughAnalysis(metrics.followThrough)}</p>
            <div class="metric-frames">
                <div class="metric-frame">
                    <img src="${endFrameImg}" alt="Follow through">
                    <div class="metric-frame-label">Uppföljning</div>
                </div>
            </div>
            ${metrics.followThrough.rating !== 'good' ? getFollowThroughReference() : ''}
        </div>
    `;

    // Add training plan
    addTrainingPlan(metrics);
}

// Detailed analysis functions
function getDetailedPostureAnalysis(posture) {
    if (posture.rating === 'good') {
        return 'Din kroppshållning är utmärkt! Du håller ryggen rak och axlarna är balanserade genom hela kastet. Detta ger dig maximal kraftöverföring och minskar risken för skador.';
    } else if (posture.rating === 'warning') {
        return 'Din kroppshållning är relativt bra men kan förbättras. Du lutar dig ibland lite för mycket framåt eller bakåt under kastet. Fokusera på att hålla överkroppen upprätt och stabil.';
    } else {
        return 'Din kroppshållning behöver förbättras. Du böjer dig för mycket framåt eller vrider kroppen fel under kastet. Detta minskar din kraft och kan orsaka ryggproblem. Träna på att hålla ryggen rak och kroppen balanserad.';
    }
}

function getDetailedBalanceAnalysis(balance) {
    if (balance.rating === 'good') {
        return 'Utmärkt balans! Du har ett stabilt steg och håller vikten jämnt fördelad. Din fotplacering är optimal för kraftgenerering.';
    } else if (balance.rating === 'warning') {
        return 'Din balans är acceptabel men kan förbättras. Dina fötter är ibland för nära varandra eller för långt ifrån varandra. Träna på en konsekvent ställning där fötterna är axelbrett isär.';
    } else {
        return 'Din balans behöver arbete. Dina fötter är instabila under kastet vilket minskar din kraft. Fokusera på fotplacering: fötterna ska vara cirka axelbrett isär för maximal stabilitet.';
    }
}

function getDetailedHipAnalysis(hipRotation) {
    if (hipRotation.rating === 'good') {
        return 'Fantastisk höftrotation! Du använder höfterna effektivt för att generera kraft. Din rotation är smidig och kraftfull - detta är grunden för långa kast.';
    } else if (hipRotation.rating === 'warning') {
        return 'Din höftrotation är okej men du får inte ut full kraft. Du roterar inte höfterna tillräckligt eller så sker rotationen för tidigt/sent. Öva på att initiera kastet med höfterna och rotera dem kraftfullt.';
    } else {
        return 'Din höftrotation behöver mycket arbete. Du kastar mest med armen istället för att använda höfterna. Kom ihåg: kraften kommer från höfterna, inte armen! Träna specifikt på höftrotation utan disc först.';
    }
}

function getDetailedArmAnalysis(arm) {
    if (arm.rating === 'good') {
        return 'Perfekt armsträckning! Du håller armen relativt rak under kastet vilket maximerar räckvidden och kraften. Din arm följer en optimal bana.';
    } else if (arm.rating === 'warning') {
        return 'Din armsträckning kan förbättras. Du böjer armen lite för mycket under kastet. Tänk på att armen ska vara ett slagträ - relativt rak för maximal hävstångseffekt.';
    } else {
        return 'Din arm är för böjd under kastet. Detta förkortar din räckvidd och minskar kraftöverföringen dramatiskt. Öva på att hålla armen mer utsträckt, men inte spänd. Tänk "lös men rak".';
    }
}

function getDetailedFollowThroughAnalysis(followThrough) {
    if (followThrough.rating === 'good') {
        return 'Excellent uppföljning! Du följer igenom kastet helt vilket visar att du släpper all kraft genom discen. Din arm fortsätter naturligt runt kroppen.';
    } else if (followThrough.rating === 'warning') {
        return 'Din uppföljning är okej men du kan följa igenom mer. Du stannar ibland kastet lite för tidigt. Låt armen svepa helt runt kroppen för maximal kraftöverföring.';
    } else {
        return 'Du stoppar kastet för tidigt! Detta innebär att du inte överför all kraft till discen. Tänk på att "släppa loss" och låta kastet fortsätta naturligt även efter release. Din arm ska svepa runt kroppen.';
    }
}

// Reference image functions (using SVG or external links)
function getPostureReference() {
    return `
        <div class="reference-image">
            <img src="https://www.innovadiscs.com/wp-content/uploads/2019/10/disc-golf-throwing-form-posture.jpg"
                 alt="Correct posture"
                 onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzNhM2EzYSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmaWxsPSIjYjBiMGIwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIHRleHQtYW5jaG9yPSJtaWRkbGUiPktvbW1lciHDpHI6IFJlZmVyZW5zYmlsZDwvdGV4dD48L3N2Zz4='">
            <div class="reference-caption">✓ Så här ska din kroppshållning se ut</div>
        </div>
    `;
}

function getBalanceReference() {
    return `
        <div class="reference-image">
            <img src="https://www.innovadiscs.com/wp-content/uploads/2019/10/disc-golf-balance-stance.jpg"
                 alt="Correct stance"
                 onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzNhM2EzYSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmaWxsPSIjYjBiMGIwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIHRleHQtYW5jaG9yPSJtaWRkbGUiPktvcnJla3Qgc3TDpGxsbmluZzwvdGV4dD48L3N2Zz4='">
            <div class="reference-caption">✓ Optimal fotplacering för balans</div>
        </div>
    `;
}

function getHipRotationReference() {
    return `
        <div class="reference-image">
            <img src="https://www.innovadiscs.com/wp-content/uploads/2019/10/disc-golf-hip-rotation.jpg"
                 alt="Hip rotation"
                 onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzNhM2EzYSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmaWxsPSIjYjBiMGIwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIHRleHQtYW5jaG9yPSJtaWRkbGUiPktyYWZ0ZnVsbCBow7ZmdHJvdGF0aW9uPC90ZXh0Pjwvc3ZnPg=='">
            <div class="reference-caption">✓ Så ska höfterna rotera för maximal kraft</div>
        </div>
    `;
}

function getArmMovementReference() {
    return `
        <div class="reference-image">
            <img src="https://www.innovadiscs.com/wp-content/uploads/2019/10/disc-golf-arm-extension.jpg"
                 alt="Arm extension"
                 onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzNhM2EzYSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmaWxsPSIjYjBiMGIwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIHRleHQtYW5jaG9yPSJtaWRkbGUiPktyb3JyZWt0IGFybXN0csOkY2tuaW5nPC90ZXh0Pjwvc3ZnPg=='">
            <div class="reference-caption">✓ Optimal armsträckning under kastet</div>
        </div>
    `;
}

function getFollowThroughReference() {
    return `
        <div class="reference-image">
            <img src="https://www.innovadiscs.com/wp-content/uploads/2019/10/disc-golf-follow-through.jpg"
                 alt="Follow through"
                 onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzNhM2EzYSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmaWxsPSIjYjBiMGIwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIHRleHQtYW5jaG9yPSJtaWRkbGUiPktvbXBsZXR0IHVwcGbDtmxqbmluZzwvdGV4dD48L3N2Zz4='">
            <div class="reference-caption">✓ Komplett uppföljning för maximal kraft</div>
        </div>
    `;
}

// Training plan
function addTrainingPlan(metrics) {
    const trainingPlanHTML = `
        <div class="metric" style="background: var(--bg-secondary); border-left-color: var(--accent-secondary);">
            <div class="metric-label">💪 Din Personliga Träningsplan</div>
            <div class="metric-value">Baserat på din analys, här är vad du bör fokusera på:</div>
            <div class="metric-details">
                ${generateTrainingSteps(metrics)}
            </div>
        </div>
    `;

    // Insert after last metric
    const lastMetric = document.getElementById('followThroughResult').parentElement;
    lastMetric.insertAdjacentHTML('afterend', trainingPlanHTML);
}

function generateTrainingSteps(metrics) {
    const steps = [];
    let priority = 1;

    // Prioritize based on worst scores
    const issues = [
        { name: 'höftrotation', metric: metrics.hipRotation, exercises: getHipRotationExercises() },
        { name: 'kroppshållning', metric: metrics.posture, exercises: getPostureExercises() },
        { name: 'balans', metric: metrics.balance, exercises: getBalanceExercises() },
        { name: 'armsträckning', metric: metrics.arm, exercises: getArmExercises() },
        { name: 'uppföljning', metric: metrics.followThrough, exercises: getFollowThroughExercises() }
    ].sort((a, b) => {
        const scoreA = a.metric.score || 0;
        const scoreB = b.metric.score || 0;
        return scoreA - scoreB;
    });

    issues.forEach(issue => {
        if (issue.metric.rating !== 'good') {
            steps.push(`
                <div style="margin-bottom: 1.5rem; padding: 1rem; background: var(--bg-tertiary); border-radius: 8px; border-left: 3px solid ${issue.metric.rating === 'error' ? '#e74c3c' : '#f39c12'};">
                    <h4 style="color: var(--text-primary); margin-bottom: 0.5rem;">
                        ${priority}. Förbättra ${issue.name} ${issue.metric.rating === 'error' ? '⚠️ PRIORITET' : '⚡'}
                    </h4>
                    <p style="color: var(--text-secondary); margin-bottom: 1rem;">${issue.metric.text}</p>
                    <div style="background: var(--bg-primary); padding: 1rem; border-radius: 6px;">
                        <strong style="color: var(--accent-primary);">Övningar:</strong>
                        ${issue.exercises}
                    </div>
                </div>
            `);
            priority++;
        }
    });

    if (steps.length === 0) {
        return `
            <div style="padding: 2rem; text-align: center; background: var(--bg-tertiary); border-radius: 8px;">
                <h3 style="color: var(--accent-primary); margin-bottom: 1rem;">🎉 Utmärkt teknik!</h3>
                <p style="color: var(--text-secondary);">
                    Din kastteknik är mycket bra! Fortsätt träna regelbundet för att bibehålla och förfina din form.
                    Fokusera på att göra varje kast konsekvent och experimentera med olika discar.
                </p>
            </div>
        `;
    }

    return steps.join('');
}

function getHipRotationExercises() {
    return `
        <ul style="color: var(--text-secondary); margin: 0.5rem 0; padding-left: 1.5rem;">
            <li>Stå med fötter axelbrett isär, rotera höfterna 90° åt sidan utan disc (10x3 set)</li>
            <li>Öva "disc golf walk" - gå framåt medan du roterar höfterna vid varje steg</li>
            <li>Kasta med fokus BARA på höfterna, låt armen följa med passivt</li>
            <li>Se på slow-motion videos av proffs och analysera deras höftrotation</li>
        </ul>
    `;
}

function getPostureExercises() {
    return `
        <ul style="color: var(--text-secondary); margin: 0.5rem 0; padding-left: 1.5rem;">
            <li>Kärnstyrkeövningar: plankan 3x30 sekunder dagligen</li>
            <li>Öva framför spegel - kontrollera att ryggen är rak</li>
            <li>Slow-motion kast utan disc, fokusera på att hålla överkroppen upprätt</li>
            <li>Be någon filma dig från sidan för att se din hållning</li>
        </ul>
    `;
}

function getBalanceExercises() {
    return `
        <ul style="color: var(--text-secondary); margin: 0.5rem 0; padding-left: 1.5rem;">
            <li>Stå på ett ben i 30 sekunder, byt ben (3x varje)</li>
            <li>Öva din stance framför spegel - fötter axelbrett isär</li>
            <li>Kasta från stående position först, lägg till steg när balansen är stabil</li>
            <li>Yoga tree pose för balansträning (1 minut varje ben)</li>
        </ul>
    `;
}

function getArmExercises() {
    return `
        <ul style="color: var(--text-secondary); margin: 0.5rem 0; padding-left: 1.5rem;">
            <li>Öva "reach back" - sträck armen bakåt långt, håll utsträckt</li>
            <li>Kasta med fokus på att hålla armen som ett "slagträ"</li>
            <li>Resistance band övningar för armsträckning</li>
            <li>Filma dig själv och kontrollera armvinkeln genom kastet</li>
        </ul>
    `;
}

function getFollowThroughExercises() {
    return `
        <ul style="color: var(--text-secondary); margin: 0.5rem 0; padding-left: 1.5rem;">
            <li>Öva att "släppa loss" - låt armen svepa helt runt kroppen</li>
            <li>Kasta utan att oroa dig för precision, fokusera bara på komplett uppföljning</li>
            <li>Tänk "kasta GENOM målet, inte TILL målet"</li>
            <li>Se på slow-motion av dina kast - armen ska rotera minst 180° efter release</li>
        </ul>
    `;
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
    console.log('AI Form Analyzer loaded with TensorFlow.js');
});
