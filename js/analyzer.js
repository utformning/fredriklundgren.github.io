// AI Form Analyzer - TensorFlow.js Pose Detection Integration
let detector = null;
let video = null;
let canvas = null;
let ctx = null;
let isAnalyzing = false;
let poseData = [];
let keyFrames = {
    bestBalance: null,
    fullArmExtension: null,
    maxHipRotation: null,
    bestPosture: null,
    reachback: null,
    powerPocket: null,
    followThrough: null
};
let capturedFrames = [];

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

                    // Capture frame with pose overlay for analysis
                    captureKeyFrame(pose, videoElement.currentTime);
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

// Capture key frames during analysis
function captureKeyFrame(pose, timestamp) {
    // Calculate scores for this frame
    const balanceScore = calculateBalanceScore(pose.keypoints);
    const armExtensionScore = calculateArmExtensionScore(pose.keypoints);
    const hipRotationScore = pose.keypoints.length > 0 ? 50 : 0; // Simplified for now
    const postureScore = calculatePostureScore(pose.keypoints);

    // Capture canvas image with pose overlay
    const frameImage = canvas.toDataURL('image/png');

    // Store if it's a key moment
    if (!keyFrames.bestBalance || balanceScore > (keyFrames.bestBalance.score || 0)) {
        keyFrames.bestBalance = {
            image: frameImage,
            timestamp: timestamp,
            score: balanceScore,
            pose: pose
        };
    }

    if (!keyFrames.fullArmExtension || armExtensionScore > (keyFrames.fullArmExtension.score || 0)) {
        keyFrames.fullArmExtension = {
            image: frameImage,
            timestamp: timestamp,
            score: armExtensionScore,
            pose: pose
        };
    }

    if (!keyFrames.bestPosture || postureScore > (keyFrames.bestPosture.score || 0)) {
        keyFrames.bestPosture = {
            image: frameImage,
            timestamp: timestamp,
            score: postureScore,
            pose: pose
        };
    }

    // Store all frames for replay
    if (capturedFrames.length < 100) { // Limit to 100 frames for performance
        capturedFrames.push({
            image: frameImage,
            timestamp: timestamp,
            pose: pose
        });
    }
}

// Calculate balance score for a single frame
function calculateBalanceScore(keypoints) {
    const leftAnkle = getKeypoint(keypoints, 'left_ankle');
    const rightAnkle = getKeypoint(keypoints, 'right_ankle');

    if (leftAnkle.score > 0.3 && rightAnkle.score > 0.3) {
        const footDistance = Math.abs(leftAnkle.x - rightAnkle.x);
        if (footDistance > 50 && footDistance < 200) {
            return 100;
        }
        return 50;
    }
    return 0;
}

// Calculate arm extension score for a single frame
function calculateArmExtensionScore(keypoints) {
    const shoulder = getKeypoint(keypoints, 'right_shoulder');
    const wrist = getKeypoint(keypoints, 'right_wrist');

    if (shoulder.score > 0.3 && wrist.score > 0.3) {
        const armLength = Math.sqrt(
            Math.pow(wrist.x - shoulder.x, 2) +
            Math.pow(wrist.y - shoulder.y, 2)
        );
        return Math.min((armLength / 150) * 100, 100);
    }
    return 0;
}

// Calculate posture score for a single frame
function calculatePostureScore(keypoints) {
    const leftShoulder = getKeypoint(keypoints, 'left_shoulder');
    const leftHip = getKeypoint(keypoints, 'left_hip');

    if (leftShoulder.score > 0.3 && leftHip.score > 0.3) {
        const angle = Math.abs(leftShoulder.x - leftHip.x);
        if (angle < 50) {
            return 100;
        }
        return 50;
    }
    return 0;
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

    // Display key frames gallery
    displayKeyFramesGallery();

    // Add replay functionality
    addReplayButton();

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

// Display results with scoring
function displayResults(metrics) {
    if (!metrics) {
        return;
    }

    // Calculate overall score
    const overallScore = Math.round(
        (metrics.posture.score +
         metrics.balance.score +
         metrics.hipRotation.score +
         metrics.arm.score +
         metrics.followThrough.score) / 5
    );

    // Display overall score
    displayOverallScore(overallScore);

    // Update posture
    updateMetricDisplay('postureResult', metrics.posture, 'Kroppshållning');

    // Update balance
    updateMetricDisplay('balanceResult', metrics.balance, 'Balans');

    // Update hip rotation
    updateMetricDisplay('hipRotationResult', metrics.hipRotation, 'Höftrotation');

    // Update arm movement
    updateMetricDisplay('armMovementResult', metrics.arm, 'Armsträckning');

    // Update follow through
    updateMetricDisplay('followThroughResult', metrics.followThrough, 'Uppföljning');
}

// Update individual metric display with score
function updateMetricDisplay(elementId, metricData, title) {
    const metricElement = document.getElementById(elementId);
    if (!metricElement) return;

    const metricParent = metricElement.parentElement;
    metricParent.className = `metric metric-${metricData.rating}`;

    // Create score badge
    const scorePercentage = Math.round(metricData.score);
    const scoreColor = metricData.rating === 'good' ? '#3fb950' :
                       metricData.rating === 'warning' ? '#d29922' : '#f85149';

    metricElement.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <strong style="color: var(--text-primary);">${title}</strong>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <div style="background: ${scoreColor}; color: white; padding: 0.25rem 0.75rem; border-radius: 12px; font-weight: 700; font-size: 0.9rem;">
                    ${scorePercentage}/100
                </div>
            </div>
        </div>
        <p style="color: var(--text-secondary); margin: 0;">${metricData.text}</p>
        ${getDetailedExplanation(title, metricData)}
    `;
}

// Get detailed explanation for each metric
function getDetailedExplanation(title, metricData) {
    const explanations = {
        'Kroppshållning': {
            good: '✓ Din kroppshållning är utmärkt! Ryggen är rak och axlarna är balanserade genom hela kastet.',
            warning: '⚠️ Håll ryggen rakare. Försök att inte luta dig för mycket framåt eller bakåt under kastet.',
            error: '✗ Fokusera på att hålla en upprätt position. Använd din core-styrka för att stabilisera överkroppen.'
        },
        'Balans': {
            good: '✓ Utmärkt balans! Dina fötter är väl placerade och du har stabil grund genom kastet.',
            warning: '⚠️ Arbeta med fotplaceringen. Testa att ha bredare ställning för bättre stabilitet.',
            error: '✗ Din balans behöver förbättras. Öva stående på ett ben och arbeta med core-styrkan.'
        },
        'Höftrotation': {
            good: '✓ Perfekt höftrotation! Du genererar bra kraft genom att använda hela kroppen.',
            warning: '⚠️ Öka höftrotationen för mer kraft. Tänk på att "leda med höften" innan armen kommer med.',
            error: '✗ För lite höftrotation. Tänk på golf-swing - höfterna ska rotera före armen.'
        },
        'Armsträckning': {
            good: '✓ Bra armsträckning! Du får ut maximal räckvidd och kraft.',
            warning: '⚠️ Sträck ut armen mer. En längre räckvidd ger mer kraft och kontroll.',
            error: '✗ Armen är för böjd. Öva på att kasta med utsträckt arm för bättre avstånd.'
        },
        'Uppföljning': {
            good: '✓ Excellent follow-through! Du följer igenom kastet helt vilket ger precision.',
            warning: '⚠️ Följ igenom kastet mer. Låt kroppen fortsätta rörelsen efter release.',
            error: '✗ Bristande uppföljning. Tänk på att kroppen ska fortsätta rörelsen även efter du släppt discen.'
        }
    };

    const explanation = explanations[title]?.[metricData.rating] || '';

    return `
        <div style="margin-top: 0.75rem; padding: 0.75rem; background: var(--bg-tertiary); border-radius: 6px; border-left: 3px solid ${
            metricData.rating === 'good' ? '#3fb950' :
            metricData.rating === 'warning' ? '#d29922' : '#f85149'
        };">
            <p style="margin: 0; color: var(--text-secondary); font-size: 0.9rem; line-height: 1.6;">
                ${explanation}
            </p>
        </div>
    `;
}

// Display overall score
function displayOverallScore(score) {
    // Check if overall score element exists, if not create it
    let overallScoreElement = document.getElementById('overallScore');

    if (!overallScoreElement) {
        // Insert at the beginning of analysis results
        const analysisResults = document.getElementById('analysisResults');
        const firstChild = analysisResults.firstChild;

        overallScoreElement = document.createElement('div');
        overallScoreElement.id = 'overallScore';
        analysisResults.insertBefore(overallScoreElement, firstChild);
    }

    const scoreColor = score >= 70 ? '#3fb950' : score >= 50 ? '#d29922' : '#f85149';
    const scoreRating = score >= 70 ? 'Utmärkt!' : score >= 50 ? 'Bra!' : 'Behöver träning';
    const scoreEmoji = score >= 70 ? '🌟' : score >= 50 ? '👍' : '💪';

    overallScoreElement.innerHTML = `
        <div style="background: linear-gradient(135deg, var(--primary-color), var(--secondary-color)); padding: 2rem; border-radius: 12px; margin-bottom: 2rem; text-align: center; box-shadow: var(--shadow-glow);">
            <h3 style="color: white; margin-bottom: 1rem; font-size: 1.3rem;">Totalt Betyg ${scoreEmoji}</h3>
            <div style="font-size: 4rem; font-weight: 800; color: white; margin: 1rem 0;">
                ${score}<span style="font-size: 2rem; opacity: 0.8;">/100</span>
            </div>
            <div style="background: rgba(255, 255, 255, 0.2); padding: 0.75rem 2rem; border-radius: 20px; display: inline-block; backdrop-filter: blur(10px);">
                <span style="color: white; font-weight: 600; font-size: 1.1rem;">${scoreRating}</span>
            </div>
            <p style="color: rgba(255, 255, 255, 0.9); margin-top: 1rem; font-size: 0.95rem;">
                ${getOverallFeedback(score)}
            </p>
        </div>
    `;
}

// Get overall feedback based on score
function getOverallFeedback(score) {
    if (score >= 80) {
        return 'Fantastisk teknik! Du har en mycket solid grund. Fortsätt träna för att finslipa detaljerna.';
    } else if (score >= 70) {
        return 'Bra jobbat! Din teknik är god men det finns utrymme för förbättring på vissa områden.';
    } else if (score >= 60) {
        return 'Du är på rätt väg! Fokusera på de områden som fick lägre poäng för snabba framsteg.';
    } else if (score >= 50) {
        return 'Grunden finns där! Med träning på de svagare områdena kommer du snabbt bli bättre.';
    } else {
        return 'Fortsätt träna! Var inte avskräckt - alla kan förbättra sin teknik med rätt övningar.';
    }
}

// Display key frames gallery
function displayKeyFramesGallery() {
    // Check if gallery already exists
    let gallerySection = document.getElementById('keyFramesGallery');

    if (!gallerySection) {
        // Create gallery section
        gallerySection = document.createElement('div');
        gallerySection.id = 'keyFramesGallery';
        gallerySection.style.cssText = `
            margin-top: 3rem;
            padding: 2rem;
            background: var(--bg-tertiary);
            border-radius: 12px;
            border: 1px solid var(--border-color);
        `;
        analysisResults.appendChild(gallerySection);
    }

    gallerySection.innerHTML = `
        <h3 style="color: var(--primary-color); margin-bottom: 1.5rem; font-size: 1.5rem;">
            📸 Nyckelmoment från din analys
        </h3>
        <p style="color: var(--text-secondary); margin-bottom: 2rem;">
            Här är de viktigaste ögonblicken från ditt kast med AI pose detection markerad:
        </p>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem;">
            ${createKeyFrameCard('bestBalance', '⚖️ Bästa Balans', 'Detta är momentet när din balans var som bäst')}
            ${createKeyFrameCard('fullArmExtension', '💪 Maximal Armsträckning', 'Här är armen fullt utsträckt för maximal kraft')}
            ${createKeyFrameCard('bestPosture', '🎯 Bästa Hållning', 'Din kroppshållning är optimal i detta ögonblick')}
        </div>
    `;
}

// Create individual key frame card
function createKeyFrameCard(frameKey, title, description) {
    const frame = keyFrames[frameKey];

    if (!frame) {
        return `
            <div style="background: var(--bg-secondary); padding: 1.5rem; border-radius: 10px; border: 1px solid var(--border-color);">
                <h4 style="color: var(--text-secondary); margin-bottom: 1rem;">${title}</h4>
                <div style="aspect-ratio: 16/9; background: var(--bg-primary); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--text-muted);">
                    Inget nyckelmoment hittat
                </div>
            </div>
        `;
    }

    return `
        <div style="background: var(--bg-secondary); padding: 1.5rem; border-radius: 10px; border: 1px solid var(--border-color); transition: all 0.3s; cursor: pointer;"
             onmouseover="this.style.borderColor='var(--primary-color)'; this.style.transform='translateY(-5px)'"
             onmouseout="this.style.borderColor='var(--border-color)'; this.style.transform='translateY(0)'">
            <h4 style="color: var(--primary-color); margin-bottom: 0.5rem;">${title}</h4>
            <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1rem;">${description}</p>
            <img src="${frame.image}" style="width: 100%; border-radius: 8px; border: 2px solid var(--border-color);" alt="${title}">
            <div style="margin-top: 1rem; padding: 0.75rem; background: var(--bg-primary); border-radius: 6px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: var(--text-secondary); font-size: 0.85rem;">⏱️ Tidsstämpel</span>
                    <span style="color: var(--text-primary); font-weight: 600;">${frame.timestamp.toFixed(2)}s</span>
                </div>
            </div>
        </div>
    `;
}

// Add replay button
function addReplayButton() {
    // Check if replay section already exists
    let replaySection = document.getElementById('replaySection');

    if (!replaySection) {
        replaySection = document.createElement('div');
        replaySection.id = 'replaySection';
        replaySection.style.cssText = `
            margin-top: 3rem;
            padding: 2rem;
            background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
            border-radius: 12px;
            text-align: center;
        `;
        analysisResults.appendChild(replaySection);
    }

    replaySection.innerHTML = `
        <h3 style="color: white; margin-bottom: 1rem; font-size: 1.5rem;">
            🔁 Se hela analysen igen
        </h3>
        <p style="color: rgba(255, 255, 255, 0.9); margin-bottom: 1.5rem;">
            Spela upp din video igen med alla AI-punkter synliga för att få en fullständig översikt av din teknik
        </p>
        <button id="replayVideoBtn" style="
            background: white;
            color: var(--primary-color);
            border: none;
            padding: 1rem 2.5rem;
            border-radius: 8px;
            font-size: 1.1rem;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.3s;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
            ▶️ Spela Replay med AI-Punkter
        </button>
    `;

    // Add click event to replay button
    document.getElementById('replayVideoBtn').addEventListener('click', replayVideoWithPose);
}

// Replay video with pose overlay
async function replayVideoWithPose() {
    // Reset video to start
    videoElement.currentTime = 0;
    videoElement.play();

    // Show overlay message
    const replayMsg = document.createElement('div');
    replayMsg.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: var(--success);
        color: white;
        padding: 1rem 2rem;
        border-radius: 8px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        animation: slideInRight 0.3s ease;
    `;
    replayMsg.textContent = '▶️ Replay startar med AI-punkter...';
    document.body.appendChild(replayMsg);

    setTimeout(() => replayMsg.remove(), 3000);

    // Process frames for replay
    let replayFrameIndex = 0;

    const replayInterval = setInterval(async () => {
        if (videoElement.paused || videoElement.ended || replayFrameIndex >= poseData.length) {
            clearInterval(replayInterval);
            return;
        }

        // Get pose data for current time
        const currentPose = poseData[replayFrameIndex];
        if (currentPose && Math.abs(currentPose.timestamp - videoElement.currentTime) < 0.1) {
            // Recreate the pose object
            const pose = {
                keypoints: currentPose.keypoints,
                score: currentPose.score
            };
            drawPose(pose);
            replayFrameIndex++;
        }
    }, 50);
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
    capturedFrames = [];
    keyFrames = {
        bestBalance: null,
        fullArmExtension: null,
        maxHipRotation: null,
        bestPosture: null,
        followThrough: null
    };

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
