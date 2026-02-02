// AI Form Analyzer - TensorFlow.js Pose Detection Integration
let detector = null;
let video = null;
let canvas = null;
let ctx = null;
let isAnalyzing = false;
let showAIOverlay = true; // Toggle for showing/hiding AI pose overlay
let poseData = [];
let keyFrames = {
    // Throwing sequence moments
    xStep: null,
    reachback: null,
    powerPocket: null,
    brace: null,
    release: null,
    followThrough: null,
    // Additional analysis
    bestBalance: null,
    maxHipRotation: null,
    bestOffArm: null
};
let capturedFrames = [];
let formErrors = {
    rounding: [],
    earlyRelease: [],
    noBrace: [],
    allArm: [],
    noseUp: []
};

// DOM Elements
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const videoElement = document.getElementById('videoElement');
const videoContainer = document.getElementById('videoContainer');
const outputCanvas = document.getElementById('outputCanvas');
const controls = document.getElementById('controls');
const analyzeBtn = document.getElementById('analyzeBtn');
const resetBtn = document.getElementById('resetBtn');
const toggleOverlayBtn = document.getElementById('toggleOverlayBtn');
const loadingSpinner = document.getElementById('loadingSpinner');
const statusArea = document.getElementById('statusArea');
const analysisResults = document.getElementById('analysisResults');

// Custom video player controls
const videoControls = document.getElementById('videoControls');
const playPauseBtn = document.getElementById('playPauseBtn');
const playPauseIcon = document.getElementById('playPauseIcon');
const frameBackBtn = document.getElementById('frameBackBtn');
const frameForwardBtn = document.getElementById('frameForwardBtn');
const progressBar = document.getElementById('progressBar');
const progressFilled = document.getElementById('progressFilled');
const timeDisplay = document.getElementById('timeDisplay');
const speedControl = document.getElementById('speedControl');
const fullscreenBtn = document.getElementById('fullscreenBtn');

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
    // Reset form errors
    formErrors = {
        rounding: [],
        earlyRelease: [],
        noBrace: [],
        allArm: [],
        noseUp: []
    };
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
        let previousPose = null; // Track previous pose for comparison

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

                    // Capture frame with pose overlay for analysis (pass previous pose for comparison)
                    captureKeyFrame(pose, videoElement.currentTime, previousPose);

                    // Save current pose for next frame
                    previousPose = pose;
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

    // Check if overlay should be shown
    if (!showAIOverlay) return;

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
function captureKeyFrame(pose, timestamp, previousPose) {
    // Calculate scores for this frame
    const balanceScore = calculateBalanceScore(pose.keypoints);
    const armExtensionScore = calculateArmExtensionScore(pose.keypoints);
    const postureScore = calculatePostureScore(pose.keypoints);
    const reachbackScore = calculateReachbackScore(pose.keypoints);
    const powerPocketScore = calculatePowerPocketScore(pose.keypoints);
    const releaseScore = calculateReleaseScore(pose.keypoints);

    // NEW: Advanced analysis
    const previousKeypoints = previousPose ? previousPose.keypoints : null;
    const xStepData = analyzeXStep(pose.keypoints, previousKeypoints);
    const braceData = detectBrace(pose.keypoints);
    const hipRotationData = calculateHipRotation(pose.keypoints);
    const offArmData = analyzeOffArm(pose.keypoints);

    // ERROR DETECTION
    const roundingData = detectRounding(pose.keypoints);
    const noseAngleData = detectNoseAngle(pose.keypoints);
    const allArmData = detectAllArmThrow(pose.keypoints, hipRotationData);
    const earlyReleaseData = detectEarlyRelease(pose.keypoints, timestamp, videoElement.duration);
    const noBraceData = !braceData.detected && timestamp > videoElement.duration * 0.3;

    // Track errors
    if (roundingData.detected) {
        formErrors.rounding.push({ timestamp, severity: roundingData.severity });
    }
    if (earlyReleaseData.detected) {
        formErrors.earlyRelease.push({ timestamp, timing: earlyReleaseData.timing });
    }
    if (noBraceData) {
        formErrors.noBrace.push({ timestamp });
    }
    if (allArmData.detected) {
        formErrors.allArm.push({ timestamp, severity: allArmData.severity });
    }
    if (noseAngleData.noseUp) {
        formErrors.noseUp.push({ timestamp, severity: noseAngleData.severity });
    }

    // Capture canvas image with pose overlay (AI version)
    const frameImageWithAI = canvas.toDataURL('image/png');

    // Also capture clean video screenshot without AI overlay
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(videoElement, 0, 0, tempCanvas.width, tempCanvas.height);
    const frameImageClean = tempCanvas.toDataURL('image/png');

    // Store if it's a key moment
    if (!keyFrames.bestBalance || balanceScore > (keyFrames.bestBalance.score || 0)) {
        keyFrames.bestBalance = {
            imageClean: frameImageClean,
            imageWithAI: frameImageWithAI,
            timestamp: timestamp,
            score: balanceScore,
            pose: pose
        };
    }

    if (!keyFrames.fullArmExtension || armExtensionScore > (keyFrames.fullArmExtension.score || 0)) {
        keyFrames.fullArmExtension = {
            imageClean: frameImageClean,
            imageWithAI: frameImageWithAI,
            timestamp: timestamp,
            score: armExtensionScore,
            pose: pose
        };
    }

    if (!keyFrames.bestPosture || postureScore > (keyFrames.bestPosture.score || 0)) {
        keyFrames.bestPosture = {
            imageClean: frameImageClean,
            imageWithAI: frameImageWithAI,
            timestamp: timestamp,
            score: postureScore,
            pose: pose
        };
    }

    // THROWING SEQUENCE: Reachback → Power Pocket → Release → Follow Through
    // Use temporal constraints to capture correct moments in sequence

    // 1. Capture reachback moment (arm back, typically early in throw)
    if (reachbackScore > 50) { // Only capture if score is decent
        if (!keyFrames.reachback || reachbackScore > (keyFrames.reachback.score || 0)) {
            keyFrames.reachback = {
                imageClean: frameImageClean,
                imageWithAI: frameImageWithAI,
                timestamp: timestamp,
                score: reachbackScore,
                pose: pose
            };
        }
    }

    // 2. Capture power pocket moment (must be after reachback if we have one)
    if (powerPocketScore > 50) {
        const canCapturePowerPocket = !keyFrames.reachback || timestamp > keyFrames.reachback.timestamp;
        if (canCapturePowerPocket) {
            if (!keyFrames.powerPocket || powerPocketScore > (keyFrames.powerPocket.score || 0)) {
                keyFrames.powerPocket = {
                    imageClean: frameImageClean,
                    imageWithAI: frameImageWithAI,
                    timestamp: timestamp,
                    score: powerPocketScore,
                    pose: pose
                };
            }
        }
    }

    // 3. Capture release moment (must be after power pocket)
    if (releaseScore > 50) {
        const canCaptureRelease = !keyFrames.powerPocket || timestamp > keyFrames.powerPocket.timestamp;
        if (canCaptureRelease) {
            if (!keyFrames.fullArmExtension || releaseScore > (keyFrames.fullArmExtension.score || 0)) {
                keyFrames.fullArmExtension = {
                    imageClean: frameImageClean,
                    imageWithAI: frameImageWithAI,
                    timestamp: timestamp,
                    score: releaseScore,
                    pose: pose
                };
            }
        }
    }

    // 4. Capture follow-through (must be after release, arm still extended forward)
    if (armExtensionScore > 50) {
        const canCaptureFollowThrough = !keyFrames.release || timestamp > keyFrames.release.timestamp + 0.1;
        if (canCaptureFollowThrough) {
            if (!keyFrames.followThrough || armExtensionScore > (keyFrames.followThrough.score || 0)) {
                keyFrames.followThrough = {
                    imageClean: frameImageClean,
                    imageWithAI: frameImageWithAI,
                    timestamp: timestamp,
                    score: armExtensionScore,
                    pose: pose
                };
            }
        }
    }

    // NEW CRITICAL MOMENTS
    // Capture X-Step if detected
    if (xStepData.timing && xStepData.score > 60) {
        if (!keyFrames.xStep || xStepData.score > (keyFrames.xStep.score || 0)) {
            keyFrames.xStep = {
                imageClean: frameImageClean,
                imageWithAI: frameImageWithAI,
                timestamp: timestamp,
                score: xStepData.score,
                pose: pose
            };
        }
    }

    // Capture Brace moment
    if (braceData.detected && braceData.quality > 70) {
        if (!keyFrames.brace || braceData.quality > (keyFrames.brace.score || 0)) {
            keyFrames.brace = {
                imageClean: frameImageClean,
                imageWithAI: frameImageWithAI,
                timestamp: timestamp,
                score: braceData.quality,
                pose: pose
            };
        }
    }

    // Capture best hip rotation
    if (hipRotationData.rotated && hipRotationData.score > 60) {
        if (!keyFrames.maxHipRotation || hipRotationData.score > (keyFrames.maxHipRotation.score || 0)) {
            keyFrames.maxHipRotation = {
                imageClean: frameImageClean,
                imageWithAI: frameImageWithAI,
                timestamp: timestamp,
                score: hipRotationData.score,
                pose: pose,
                separation: hipRotationData.separation
            };
        }
    }

    // Capture best off-arm position
    if (offArmData.extended && offArmData.score > 60) {
        if (!keyFrames.bestOffArm || offArmData.score > (keyFrames.bestOffArm.score || 0)) {
            keyFrames.bestOffArm = {
                imageClean: frameImageClean,
                imageWithAI: frameImageWithAI,
                timestamp: timestamp,
                score: offArmData.score,
                pose: pose
            };
        }
    }

    // Update release key frame specifically
    if (releaseScore > 50) {
        const canCaptureRelease = !keyFrames.powerPocket || timestamp > keyFrames.powerPocket.timestamp;
        if (canCaptureRelease) {
            if (!keyFrames.release || releaseScore > (keyFrames.release.score || 0)) {
                keyFrames.release = {
                    imageClean: frameImageClean,
                    imageWithAI: frameImageWithAI,
                    timestamp: timestamp,
                    score: releaseScore,
                    pose: pose
                };
            }
        }
    }

    // Store all frames for replay
    if (capturedFrames.length < 100) { // Limit to 100 frames for performance
        capturedFrames.push({
            imageClean: frameImageClean,
            imageWithAI: frameImageWithAI,
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

// Calculate reachback score - arm fully extended backward, ready for the throw
// Based on disc golf biomechanics: arm extended back, torso rotated away from target
function calculateReachbackScore(keypoints) {
    const rightShoulder = getKeypoint(keypoints, 'right_shoulder');
    const leftShoulder = getKeypoint(keypoints, 'left_shoulder');
    const rightElbow = getKeypoint(keypoints, 'right_elbow');
    const rightWrist = getKeypoint(keypoints, 'right_wrist');
    const rightHip = getKeypoint(keypoints, 'right_hip');

    if (rightShoulder.score > 0.3 && rightWrist.score > 0.3 && rightElbow.score > 0.3 && rightHip.score > 0.3) {
        // TRUE REACHBACK: wrist must be behind the body's center line (hip)
        // Not just behind shoulder, but behind the entire torso
        const wristBehindHip = rightWrist.x < rightHip.x - 50;

        // Check arm extension - elbow should be relatively straight
        const shoulderToElbow = Math.sqrt(
            Math.pow(rightElbow.x - rightShoulder.x, 2) +
            Math.pow(rightElbow.y - rightShoulder.y, 2)
        );
        const elbowToWrist = Math.sqrt(
            Math.pow(rightWrist.x - rightElbow.x, 2) +
            Math.pow(rightWrist.y - rightElbow.y, 2)
        );
        const shoulderToWrist = Math.sqrt(
            Math.pow(rightWrist.x - rightShoulder.x, 2) +
            Math.pow(rightWrist.y - rightShoulder.y, 2)
        );

        // Arm is extended if the direct distance is close to sum of segments
        const armExtension = shoulderToWrist / (shoulderToElbow + elbowToWrist);
        const armIsExtended = armExtension > 0.85; // 85% = relatively straight

        // Check shoulder rotation - right shoulder should be rotated back
        const shoulderWidth = Math.abs(rightShoulder.x - leftShoulder.x);
        const shoulderRotated = shoulderWidth > 80; // Shoulders spread out means rotation

        if (wristBehindHip && armIsExtended && shoulderRotated) {
            // Score based on how far back the wrist is
            const reachbackDistance = rightHip.x - rightWrist.x;
            return Math.min((reachbackDistance / 150) * 100, 100);
        }
    }
    return 0;
}

// Calculate power pocket score - elbow bent ~90°, disc pulled in tight before release
// Based on disc golf biomechanics: most critical moment for power transfer
function calculatePowerPocketScore(keypoints) {
    const shoulder = getKeypoint(keypoints, 'right_shoulder');
    const elbow = getKeypoint(keypoints, 'right_elbow');
    const wrist = getKeypoint(keypoints, 'right_wrist');
    const hip = getKeypoint(keypoints, 'right_hip');

    if (shoulder.score > 0.3 && elbow.score > 0.3 && wrist.score > 0.3 && hip.score > 0.3) {
        // Calculate elbow angle - should be around 70-110 degrees for power pocket
        const shoulderToElbow = {
            x: elbow.x - shoulder.x,
            y: elbow.y - shoulder.y
        };
        const elbowToWrist = {
            x: wrist.x - elbow.x,
            y: wrist.y - elbow.y
        };

        // Dot product and magnitudes for angle calculation
        const dotProduct = shoulderToElbow.x * elbowToWrist.x + shoulderToElbow.y * elbowToWrist.y;
        const mag1 = Math.sqrt(shoulderToElbow.x ** 2 + shoulderToElbow.y ** 2);
        const mag2 = Math.sqrt(elbowToWrist.x ** 2 + elbowToWrist.y ** 2);
        const elbowAngle = Math.acos(dotProduct / (mag1 * mag2)) * (180 / Math.PI);

        // Power pocket: elbow bent 70-110 degrees
        const goodElbowAngle = elbowAngle >= 70 && elbowAngle <= 110;

        // Wrist should be close to hip/torso (disc pulled in)
        const wristToHip = Math.sqrt(
            Math.pow(wrist.x - hip.x, 2) +
            Math.pow(wrist.y - hip.y, 2)
        );
        const wristCloseToBody = wristToHip < 120;

        // Elbow should be forward of shoulder (pulling through)
        const elbowForward = elbow.x > shoulder.x;

        if (goodElbowAngle && wristCloseToBody && elbowForward) {
            // Perfect power pocket - score based on how optimal the angle is
            const angleOptimality = 100 - Math.abs(90 - elbowAngle);
            return Math.max(angleOptimality, 70);
        }
    }
    return 0;
}

// Calculate release score - arm fully extended forward at disc release
// Based on disc golf biomechanics: maximum arm extension forward, disc about to leave hand
function calculateReleaseScore(keypoints) {
    const shoulder = getKeypoint(keypoints, 'right_shoulder');
    const elbow = getKeypoint(keypoints, 'right_elbow');
    const wrist = getKeypoint(keypoints, 'right_wrist');
    const hip = getKeypoint(keypoints, 'right_hip');

    if (shoulder.score > 0.3 && elbow.score > 0.3 && wrist.score > 0.3 && hip.score > 0.3) {
        // Release: wrist should be FORWARD of shoulder (opposite of reachback)
        const wristForwardOfShoulder = wrist.x > shoulder.x + 30;

        // Arm should be nearly straight (extended)
        const shoulderToElbow = Math.sqrt(
            Math.pow(elbow.x - shoulder.x, 2) +
            Math.pow(elbow.y - shoulder.y, 2)
        );
        const elbowToWrist = Math.sqrt(
            Math.pow(wrist.x - elbow.x, 2) +
            Math.pow(wrist.y - elbow.y, 2)
        );
        const shoulderToWrist = Math.sqrt(
            Math.pow(wrist.x - shoulder.x, 2) +
            Math.pow(wrist.y - shoulder.y, 2)
        );

        const armExtension = shoulderToWrist / (shoulderToElbow + elbowToWrist);
        const armIsExtended = armExtension > 0.90; // 90% = very straight for release

        // Wrist should be forward of hips (body rotated through)
        const wristForwardOfHip = wrist.x > hip.x;

        if (wristForwardOfShoulder && armIsExtended && wristForwardOfHip) {
            // Score based on arm extension and forward position
            const releaseDistance = wrist.x - shoulder.x;
            return Math.min((releaseDistance / 100) * 100 + (armExtension * 50), 100);
        }
    }
    return 0;
}

// X-STEP AND FOOTWORK ANALYSIS
// Based on: https://discgolf.ultiworld.com/2022/07/26/tuesday-tips-dont-fake-your-x-step/
function analyzeXStep(keypoints, previousKeypoints) {
    if (!previousKeypoints) return { score: 0, timing: false };

    const leftAnkle = getKeypoint(keypoints, 'left_ankle');
    const rightAnkle = getKeypoint(keypoints, 'right_ankle');
    const leftHip = getKeypoint(keypoints, 'left_hip');
    const rightHip = getKeypoint(keypoints, 'right_hip');

    const prevLeftAnkle = getKeypoint(previousKeypoints, 'left_ankle');
    const prevRightAnkle = getKeypoint(previousKeypoints, 'right_ankle');

    if (leftAnkle.score > 0.3 && rightAnkle.score > 0.3 &&
        prevLeftAnkle.score > 0.3 && prevRightAnkle.score > 0.3 &&
        leftHip.score > 0.3 && rightHip.score > 0.3) {

        // Detect foot movement
        const leftFootMoved = Math.abs(leftAnkle.x - prevLeftAnkle.x) > 20;
        const rightFootMoved = Math.abs(rightAnkle.x - prevRightAnkle.x) > 20;

        // Check if hips are closed (not opened toward target)
        const hipsClosed = Math.abs(leftHip.x - rightHip.x) < 100;

        // Check foot spacing (should be shoulder-width or wider)
        const footSpacing = Math.abs(leftAnkle.x - rightAnkle.x);
        const goodSpacing = footSpacing > 80 && footSpacing < 200;

        let score = 0;
        if (leftFootMoved || rightFootMoved) score += 40;
        if (hipsClosed) score += 30;
        if (goodSpacing) score += 30;

        return {
            score: score,
            timing: (leftFootMoved || rightFootMoved) && hipsClosed
        };
    }

    return { score: 0, timing: false };
}

// BRACE DETECTION - Front foot plant
// Based on: https://blog.dynamicdiscs.com/2017/07/why-is-footwork-so-important.html
function detectBrace(keypoints) {
    const leftAnkle = getKeypoint(keypoints, 'left_ankle');
    const leftKnee = getKeypoint(keypoints, 'left_knee');
    const leftHip = getKeypoint(keypoints, 'left_hip');
    const rightHip = getKeypoint(keypoints, 'right_hip');

    if (leftAnkle.score > 0.3 && leftKnee.score > 0.3 &&
        leftHip.score > 0.3 && rightHip.score > 0.3) {

        // Front leg should be relatively straight (braced)
        const legLength = Math.sqrt(
            Math.pow(leftKnee.x - leftAnkle.x, 2) +
            Math.pow(leftKnee.y - leftAnkle.y, 2)
        );
        const hipToKnee = Math.sqrt(
            Math.pow(leftHip.x - leftKnee.x, 2) +
            Math.pow(leftHip.y - leftKnee.y, 2)
        );
        const hipToAnkle = Math.sqrt(
            Math.pow(leftHip.x - leftAnkle.x, 2) +
            Math.pow(leftHip.y - leftAnkle.y, 2)
        );

        // Leg straightness ratio
        const legStraight = hipToAnkle / (legLength + hipToKnee);
        const isBraced = legStraight > 0.85; // 85% = relatively straight

        // Weight on front foot (ankle should be under or forward of knee)
        const weightForward = leftAnkle.x >= leftKnee.x - 20;

        if (isBraced && weightForward) {
            return { detected: true, quality: legStraight * 100 };
        }
    }

    return { detected: false, quality: 0 };
}

// HIP ROTATION MEASUREMENT - Enhanced version
// Based on: https://blog.dynamicdiscs.com/2017/07/why-is-footwork-so-important.html
function calculateHipRotation(keypoints) {
    const leftHip = getKeypoint(keypoints, 'left_hip');
    const rightHip = getKeypoint(keypoints, 'right_hip');
    const leftShoulder = getKeypoint(keypoints, 'left_shoulder');
    const rightShoulder = getKeypoint(keypoints, 'right_shoulder');

    if (leftHip.score > 0.3 && rightHip.score > 0.3 &&
        leftShoulder.score > 0.3 && rightShoulder.score > 0.3) {

        // Calculate hip line angle
        const hipAngle = Math.atan2(rightHip.y - leftHip.y, rightHip.x - leftHip.x);

        // Calculate shoulder line angle
        const shoulderAngle = Math.atan2(rightShoulder.y - leftShoulder.y, rightShoulder.x - leftShoulder.x);

        // Rotation difference (separation between hips and shoulders)
        const separation = Math.abs(shoulderAngle - hipAngle) * (180 / Math.PI);

        // Hip width (indicates rotation)
        const hipWidth = Math.abs(rightHip.x - leftHip.x);

        // Good rotation: hips lead shoulders, good separation
        const score = Math.min((separation / 30) * 50 + (hipWidth / 200) * 50, 100);

        return {
            score: score,
            separation: separation,
            rotated: hipWidth > 100
        };
    }

    return { score: 0, separation: 0, rotated: false };
}

// OFF-ARM (LEFT ARM) POSITION ANALYSIS
function analyzeOffArm(keypoints) {
    const leftShoulder = getKeypoint(keypoints, 'left_shoulder');
    const leftElbow = getKeypoint(keypoints, 'left_elbow');
    const leftWrist = getKeypoint(keypoints, 'left_wrist');
    const rightShoulder = getKeypoint(keypoints, 'right_shoulder');

    if (leftShoulder.score > 0.3 && leftElbow.score > 0.3 &&
        leftWrist.score > 0.3 && rightShoulder.score > 0.3) {

        // Off-arm should be extended and balanced (not tucked in)
        const armLength = Math.sqrt(
            Math.pow(leftWrist.x - leftShoulder.x, 2) +
            Math.pow(leftWrist.y - leftShoulder.y, 2)
        );

        // Check if arm is extended outward (good for balance)
        const isExtended = armLength > 150;

        // Off-arm should help with balance - not too high, not too low
        const heightDiff = Math.abs(leftWrist.y - leftShoulder.y);
        const goodHeight = heightDiff < 100;

        let score = 0;
        if (isExtended) score += 60;
        if (goodHeight) score += 40;

        return { score: score, extended: isExtended };
    }

    return { score: 0, extended: false };
}

// ROUNDING DETECTION - Curved vs straight pull
// Based on: https://discgolf.ultiworld.com/2022/01/11/tuesday-tips-stop-rounding-or-how-to-fix-disc-golfs-most-common-flaw/
function detectRounding(keypoints) {
    const rightShoulder = getKeypoint(keypoints, 'right_shoulder');
    const rightElbow = getKeypoint(keypoints, 'right_elbow');
    const rightWrist = getKeypoint(keypoints, 'right_wrist');
    const chest = getKeypoint(keypoints, 'right_shoulder'); // Approximate chest position

    if (rightShoulder.score > 0.3 && rightElbow.score > 0.3 && rightWrist.score > 0.3) {
        // Check if disc/wrist path goes around body (rounding) vs straight line
        // In rounding, elbow stays close to body and wrist curves around

        const elbowToChest = Math.abs(rightElbow.x - chest.x);
        const wristToChest = Math.abs(rightWrist.x - chest.x);

        // Rounding: elbow is very close to chest during pull
        const elbowTooClose = elbowToChest < 50;

        // Check if wrist makes a curve (y-displacement while x barely changes)
        const wristBehindBody = rightWrist.x < rightShoulder.x;
        const elbowBehindShoulder = rightElbow.x < rightShoulder.x + 30;

        const isRounding = elbowTooClose && wristBehindBody && elbowBehindShoulder;

        return {
            detected: isRounding,
            severity: isRounding ? (100 - elbowToChest) : 0
        };
    }

    return { detected: false, severity: 0 };
}

// NOSE ANGLE DETECTION (disc pointing up or down at release)
// Based on: https://www.dgcoursereview.com/threads/how-to-fix-nose-angle.181082/
function detectNoseAngle(keypoints) {
    const rightWrist = getKeypoint(keypoints, 'right_wrist');
    const rightElbow = getKeypoint(keypoints, 'right_elbow');
    const rightShoulder = getKeypoint(keypoints, 'right_shoulder');

    if (rightWrist.score > 0.3 && rightElbow.score > 0.3 && rightShoulder.score > 0.3) {
        // Wrist position relative to elbow indicates nose angle
        // If wrist is above elbow at release = nose up (bad)
        // If wrist is level or below elbow = nose down or neutral (good)

        const wristHeight = rightWrist.y;
        const elbowHeight = rightElbow.y;
        const shoulderHeight = rightShoulder.y;

        // Calculate angle - wrist should be at or below elbow level
        const heightDiff = wristHeight - elbowHeight;

        // Nose up if wrist is significantly above elbow
        const noseUp = heightDiff < -30; // Negative Y is up in canvas coords

        // Calculate severity (0-100, higher = worse)
        const severity = noseUp ? Math.min(Math.abs(heightDiff) / 2, 100) : 0;

        return {
            noseUp: noseUp,
            severity: severity,
            angle: heightDiff
        };
    }

    return { noseUp: false, severity: 0, angle: 0 };
}

// ALL-ARM THROW DETECTION (not using hips/legs)
// Based on: https://www.innovadiscs.com/tips/common-throwing-errors-holding-back-your-game/
function detectAllArmThrow(keypoints, hipRotationData) {
    const rightShoulder = getKeypoint(keypoints, 'right_shoulder');
    const rightWrist = getKeypoint(keypoints, 'right_wrist');
    const leftHip = getKeypoint(keypoints, 'left_hip');
    const rightHip = getKeypoint(keypoints, 'right_hip');

    if (rightShoulder.score > 0.3 && rightWrist.score > 0.3 &&
        leftHip.score > 0.3 && rightHip.score > 0.3) {

        // Check if hips barely moved/rotated
        const poorHipRotation = hipRotationData.score < 40;

        // Check if arm is moving but hips aren't
        const armInMotion = Math.abs(rightWrist.x - rightShoulder.x) > 100;
        const hipsStatic = Math.abs(leftHip.x - rightHip.x) < 80;

        const isAllArm = poorHipRotation && armInMotion && hipsStatic;

        return {
            detected: isAllArm,
            severity: isAllArm ? (100 - hipRotationData.score) : 0
        };
    }

    return { detected: false, severity: 0 };
}

// EARLY RELEASE DETECTION
function detectEarlyRelease(keypoints, timestamp, videoDuration) {
    const rightWrist = getKeypoint(keypoints, 'right_wrist');
    const rightShoulder = getKeypoint(keypoints, 'right_shoulder');
    const rightElbow = getKeypoint(keypoints, 'right_elbow');

    if (rightWrist.score > 0.3 && rightShoulder.score > 0.3 && rightElbow.score > 0.3) {
        // Early release: arm is extended but we're still early in the throw motion
        const armExtended = rightWrist.x > rightShoulder.x + 50;

        // Check if we're in the early/middle part of video (not at end where release should be)
        const videoProgress = timestamp / videoDuration;
        const tooEarly = videoProgress < 0.4; // Release shouldn't happen in first 40%

        // Elbow should still be bent in power pocket, not extended yet
        const elbowExtendedTooEarly = rightElbow.x > rightShoulder.x + 40 && videoProgress < 0.5;

        const isEarlyRelease = (armExtended && tooEarly) || elbowExtendedTooEarly;

        return {
            detected: isEarlyRelease,
            timing: videoProgress
        };
    }

    return { detected: false, timing: 0 };
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

    // Display form errors
    displayFormErrors();

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
    console.log('Form errors detected:', formErrors);
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

// Display key frames gallery - Discgolf throwing sequence
function displayKeyFramesGallery() {
    // Check if gallery already exists
    let gallerySection = document.getElementById('keyFramesGallery');

    if (!gallerySection) {
        // Create gallery section
        gallerySection = document.createElement('div');
        gallerySection.id = 'keyFramesGallery';
        gallerySection.style.cssText = `
            margin-top: 2rem;
            padding: 2rem;
            background: var(--bg-tertiary);
            border-radius: 12px;
            border: 1px solid var(--border-color);
        `;
        analysisResults.appendChild(gallerySection);
    }

    gallerySection.innerHTML = `
        <h3 style="color: var(--primary-color); margin-bottom: 0.5rem; font-size: 1.5rem;">
            📸 Nyckelmoment från din analys
        </h3>
        <p style="color: var(--text-secondary); margin-bottom: 1.5rem; font-size: 0.95rem;">
            De viktigaste ögonblicken från ditt kast - klicka "👁️ AI" för att växla mellan video och AI-overlay:
        </p>

        <h4 style="color: var(--text-primary); margin: 1.5rem 0 1rem 0; font-size: 1.1rem;">🦶 Fotarbete & Setup</h4>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.25rem; margin-bottom: 2rem;">
            ${createKeyFrameCard('xStep', '🚶 X-Step', 'Fotarbete och timing')}
            ${createKeyFrameCard('brace', '🛡️ Brace', 'Främre fot planterad, redo för kraftöverföring')}
        </div>

        <h4 style="color: var(--text-primary); margin: 1.5rem 0 1rem 0; font-size: 1.1rem;">💪 Kastteknik</h4>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.25rem; margin-bottom: 2rem;">
            ${createKeyFrameCard('reachback', '↩️ Reachback', 'Armen maximalt bakåt')}
            ${createKeyFrameCard('powerPocket', '⚡ Power Pocket', 'Armbågen böjd ~90°, kraft laddas')}
            ${createKeyFrameCard('release', '💪 Release', 'Discen släpps, arm utsträckt')}
            ${createKeyFrameCard('followThrough', '🎬 Follow Through', 'Uppföljning efter release')}
        </div>

        <h4 style="color: var(--text-primary); margin: 1.5rem 0 1rem 0; font-size: 1.1rem;">🎯 Kroppsposition</h4>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.25rem;">
            ${createKeyFrameCard('maxHipRotation', '🔄 Höftrotation', 'Maximal separation mellan höfter och axlar')}
            ${createKeyFrameCard('bestOffArm', '🤚 Off-Arm', 'Vänster arm för balans')}
        </div>
    `;
}

// Display form errors section
function displayFormErrors() {
    // Check if errors section already exists
    let errorsSection = document.getElementById('formErrorsSection');

    if (!errorsSection) {
        // Create errors section
        errorsSection = document.createElement('div');
        errorsSection.id = 'formErrorsSection';
        errorsSection.style.cssText = `
            margin-top: 2rem;
            padding: 2rem;
            background: var(--bg-tertiary);
            border-radius: 12px;
            border: 1px solid var(--border-color);
        `;
        analysisResults.appendChild(errorsSection);
    }

    // Check if we have any errors
    const hasErrors = formErrors.rounding.length > 0 ||
                      formErrors.earlyRelease.length > 0 ||
                      formErrors.noBrace.length > 0 ||
                      formErrors.allArm.length > 0 ||
                      formErrors.noseUp.length > 0;

    if (!hasErrors) {
        errorsSection.innerHTML = `
            <h3 style="color: #3fb950; margin-bottom: 0.5rem; font-size: 1.5rem;">
                ✅ Inga stora formfel hittades!
            </h3>
            <p style="color: var(--text-secondary); font-size: 0.95rem;">
                Din teknik ser bra ut! Fortsätt träna för att perfektionera detaljerna.
            </p>
        `;
        return;
    }

    // Build error cards HTML
    let errorCardsHTML = '';

    // Rounding error
    if (formErrors.rounding.length > 0) {
        const avgSeverity = formErrors.rounding.reduce((sum, e) => sum + e.severity, 0) / formErrors.rounding.length;
        errorCardsHTML += createErrorCard(
            '🔴 Rounding',
            'Du kastar med en rundad bana (disc går runt kroppen istället för rakt)',
            `Upptäckt ${formErrors.rounding.length} gånger`,
            avgSeverity,
            '💡 <strong>Lösning:</strong> Dra armbågen rakt tillbaka längs en rak linje. Tänk "dra starthylsan på en gräsklippare" - rak rörelse, inte rund.'
        );
    }

    // Nose angle error
    if (formErrors.noseUp.length > 0) {
        const avgSeverity = formErrors.noseUp.reduce((sum, e) => sum + e.severity, 0) / formErrors.noseUp.length;
        errorCardsHTML += createErrorCard(
            '📐 Nose Up',
            'Discens nos pekar uppåt vid release (orsakar höga kaströrelser och dålig glidflykt)',
            `Upptäckt ${formErrors.noseUp.length} gånger`,
            avgSeverity,
            '💡 <strong>Lösning:</strong> Håll handleden jämn eller lätt nedåt vid release. Tryck ner med pekfingret för att få nosen nedåt.'
        );
    }

    // All-arm throw
    if (formErrors.allArm.length > 0) {
        const avgSeverity = formErrors.allArm.reduce((sum, e) => sum + e.severity, 0) / formErrors.allArm.length;
        errorCardsHTML += createErrorCard(
            '💪 All-Arm Throw',
            'Du kastar mest med armen - höfterna rör sig inte tillräckligt',
            `Upptäckt ${formErrors.allArm.length} gånger`,
            avgSeverity,
            '💡 <strong>Lösning:</strong> Kraften kommer från höfterna och benen! Tänk på att rotera höfterna INNAN armen svingar fram. Som en golfswing.'
        );
    }

    // No brace
    if (formErrors.noBrace.length > 0) {
        errorCardsHTML += createErrorCard(
            '🛑 No Brace',
            'Främre benet bråkar inte ordentligt - energi går förlorad',
            `Upptäckt ${formErrors.noBrace.length} gånger`,
            70,
            '💡 <strong>Lösning:</strong> Plantera främre foten stadigt och håll benet relativt rakt. Detta stoppar din framåtrörelse och omvandlar den till rotationsenergi.'
        );
    }

    // Early release
    if (formErrors.earlyRelease.length > 0) {
        errorCardsHTML += createErrorCard(
            '⏱️ Early Release',
            'Discen släpps för tidigt i kaströrelsen',
            `Upptäckt ${formErrors.earlyRelease.length} gånger`,
            60,
            '💡 <strong>Lösning:</strong> Håll discen längre i power pocket-fasen. Släpp inte förrän armen är nästan helt utsträckt framåt.'
        );
    }

    errorsSection.innerHTML = `
        <h3 style="color: #f85149; margin-bottom: 0.5rem; font-size: 1.5rem;">
            ⚠️ Upptäckta formfel
        </h3>
        <p style="color: var(--text-secondary); margin-bottom: 1.5rem; font-size: 0.95rem;">
            Dessa vanliga fel upptäcktes i din teknik. Åtgärda dessa för snabbare förbättring:
        </p>
        <div style="display: grid; grid-template-columns: 1fr; gap: 1rem;">
            ${errorCardsHTML}
        </div>
    `;
}

// Create individual error card
function createErrorCard(title, description, frequency, severity, solution) {
    const severityColor = severity > 70 ? '#f85149' : severity > 40 ? '#d29922' : '#3fb950';
    const severityLabel = severity > 70 ? 'Allvarligt' : severity > 40 ? 'Måttligt' : 'Lätt';

    return `
        <div style="background: var(--bg-secondary); padding: 1.5rem; border-radius: 10px; border-left: 4px solid ${severityColor};">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.75rem;">
                <h4 style="color: var(--text-primary); margin: 0; font-size: 1.1rem;">${title}</h4>
                <div style="background: ${severityColor}; color: white; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.8rem; font-weight: 600;">
                    ${severityLabel}
                </div>
            </div>
            <p style="color: var(--text-secondary); margin: 0 0 0.5rem 0; font-size: 0.95rem;">${description}</p>
            <p style="color: var(--text-muted); margin: 0 0 1rem 0; font-size: 0.85rem; font-style: italic;">${frequency}</p>
            <div style="background: var(--bg-primary); padding: 1rem; border-radius: 6px; border-left: 3px solid var(--primary-color);">
                <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem; line-height: 1.6;">
                    ${solution}
                </p>
            </div>
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

    const cardId = `keyframe-${frameKey}`;
    const imgId = `img-${frameKey}`;
    const toggleBtnId = `toggle-${frameKey}`;

    return `
        <div id="${cardId}" style="background: var(--bg-secondary); padding: 1.5rem; border-radius: 10px; border: 1px solid var(--border-color); transition: all 0.3s;"
             onmouseover="this.style.borderColor='var(--primary-color)'; this.style.transform='translateY(-5px)'"
             onmouseout="this.style.borderColor='var(--border-color)'; this.style.transform='translateY(0)'">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <h4 style="color: var(--primary-color); margin: 0;">${title}</h4>
                <button id="${toggleBtnId}"
                        onclick="toggleKeyFrameAI('${frameKey}')"
                        style="background: var(--primary-color); color: white; border: none; padding: 0.4rem 0.8rem; border-radius: 5px; cursor: pointer; font-size: 0.75rem; transition: all 0.2s;"
                        onmouseover="this.style.transform='scale(1.05)'"
                        onmouseout="this.style.transform='scale(1)'">
                    👁️ AI
                </button>
            </div>
            <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1rem;">${description}</p>
            <img id="${imgId}"
                 src="${frame.imageWithAI}"
                 data-clean="${frame.imageClean}"
                 data-ai="${frame.imageWithAI}"
                 data-showing-ai="true"
                 style="width: 100%; border-radius: 8px; border: 2px solid var(--border-color);"
                 alt="${title}">
            <div style="margin-top: 1rem; padding: 0.75rem; background: var(--bg-primary); border-radius: 6px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: var(--text-secondary); font-size: 0.85rem;">⏱️ Tidsstämpel</span>
                    <span style="color: var(--text-primary); font-weight: 600;">${frame.timestamp.toFixed(2)}s</span>
                </div>
            </div>
        </div>
    `;
}

// Toggle between clean video screenshot and AI overlay on key frame images
function toggleKeyFrameAI(frameKey) {
    const imgId = `img-${frameKey}`;
    const toggleBtnId = `toggle-${frameKey}`;
    const img = document.getElementById(imgId);
    const toggleBtn = document.getElementById(toggleBtnId);

    if (!img || !toggleBtn) return;

    const isShowingAI = img.getAttribute('data-showing-ai') === 'true';

    if (isShowingAI) {
        // Switch to clean version
        img.src = img.getAttribute('data-clean');
        img.setAttribute('data-showing-ai', 'false');
        toggleBtn.textContent = '🤖 Visa AI';
        toggleBtn.style.background = 'var(--text-light)';
    } else {
        // Switch to AI version
        img.src = img.getAttribute('data-ai');
        img.setAttribute('data-showing-ai', 'true');
        toggleBtn.textContent = '👁️ AI';
        toggleBtn.style.background = 'var(--primary-color)';
    }
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
        xStep: null,
        reachback: null,
        powerPocket: null,
        brace: null,
        release: null,
        followThrough: null,
        bestBalance: null,
        maxHipRotation: null,
        bestOffArm: null
    };
    formErrors = {
        rounding: [],
        earlyRelease: [],
        noBrace: [],
        allArm: [],
        noseUp: []
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

// Toggle AI overlay button
toggleOverlayBtn.addEventListener('click', () => {
    showAIOverlay = !showAIOverlay;

    // Update button text and style
    if (showAIOverlay) {
        toggleOverlayBtn.innerHTML = '<span>👁️ Dölj AI-punkter</span>';
        toggleOverlayBtn.style.background = 'var(--primary-color)';
    } else {
        toggleOverlayBtn.innerHTML = '<span>👁️‍🗨️ Visa AI-punkter</span>';
        toggleOverlayBtn.style.background = 'var(--text-light)';
    }

    // Redraw current frame with or without overlay
    if (poseData.length > 0 && videoElement.currentTime > 0) {
        const currentTime = videoElement.currentTime;
        const closestPose = poseData.find(p => Math.abs(p.timestamp - currentTime) < 0.1);
        if (closestPose) {
            const pose = {
                keypoints: closestPose.keypoints,
                score: closestPose.score
            };
            drawPose(pose);
        }
    }
});

// Custom Video Player Controls

// Play/Pause button
playPauseBtn.addEventListener('click', () => {
    if (videoElement.paused) {
        videoElement.play();
        playPauseIcon.textContent = '⏸️';
    } else {
        videoElement.pause();
        playPauseIcon.textContent = '▶️';
    }
});

// Update play/pause icon when video state changes
videoElement.addEventListener('play', () => {
    playPauseIcon.textContent = '⏸️';
});

videoElement.addEventListener('pause', () => {
    playPauseIcon.textContent = '▶️';
});

// Frame navigation
frameBackBtn.addEventListener('click', () => {
    videoElement.currentTime = Math.max(0, videoElement.currentTime - (1/30)); // Go back 1 frame (assuming 30fps)
});

frameForwardBtn.addEventListener('click', () => {
    videoElement.currentTime = Math.min(videoElement.duration, videoElement.currentTime + (1/30)); // Go forward 1 frame
});

// Progress bar
progressBar.addEventListener('click', (e) => {
    const rect = progressBar.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    videoElement.currentTime = pos * videoElement.duration;
});

// Update progress bar as video plays
videoElement.addEventListener('timeupdate', () => {
    const percent = (videoElement.currentTime / videoElement.duration) * 100;
    progressFilled.style.width = percent + '%';

    // Update time display
    const currentMinutes = Math.floor(videoElement.currentTime / 60);
    const currentSeconds = Math.floor(videoElement.currentTime % 60);
    const durationMinutes = Math.floor(videoElement.duration / 60);
    const durationSeconds = Math.floor(videoElement.duration % 60);

    timeDisplay.textContent = `${currentMinutes}:${currentSeconds.toString().padStart(2, '0')} / ${durationMinutes}:${durationSeconds.toString().padStart(2, '0')}`;
});

// Speed control
speedControl.addEventListener('change', (e) => {
    videoElement.playbackRate = parseFloat(e.target.value);
});

// Fullscreen button
fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
        videoContainer.requestFullscreen().catch(err => {
            console.error('Fullscreen error:', err);
        });
    } else {
        document.exitFullscreen();
    }
});

// Update AI overlay when video is seeked
videoElement.addEventListener('seeked', () => {
    updateAIOverlayForCurrentTime();
});

// Function to update AI overlay based on current video time
function updateAIOverlayForCurrentTime() {
    if (poseData.length === 0 || !showAIOverlay) return;

    const currentTime = videoElement.currentTime;

    // Find the closest pose data for current time
    let closestPose = null;
    let minTimeDiff = Infinity;

    for (const data of poseData) {
        const timeDiff = Math.abs(data.timestamp - currentTime);
        if (timeDiff < minTimeDiff) {
            minTimeDiff = timeDiff;
            closestPose = data;
        }
        // If we've passed the current time, we found the closest
        if (data.timestamp > currentTime) break;
    }

    // Draw the pose if we found one close enough (within 0.2 seconds)
    if (closestPose && minTimeDiff < 0.2) {
        const pose = {
            keypoints: closestPose.keypoints,
            score: closestPose.score
        };
        drawPose(pose);
    } else {
        // Clear canvas if no pose data available for this time
        if (ctx && canvas) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }
}

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
