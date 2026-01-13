// Disc Golf Form Analyzer with MediaPipe Pose Detection
// Uses client-side pose estimation to analyze throwing form

class DiscGolfAnalyzer {
    constructor() {
        this.poseLandmarker = null;
        this.video = null;
        this.canvas = null;
        this.ctx = null;
        this.poses = [];
        this.isAnalyzing = false;

        this.init();
    }

    async init() {
        console.log('🚀 Initializing Disc Golf Analyzer...');

        // Get DOM elements
        this.video = document.getElementById('videoPlayer');
        this.canvas = document.getElementById('poseCanvas');
        this.ctx = this.canvas.getContext('2d');

        // Setup event listeners
        this.setupEventListeners();

        // Initialize MediaPipe (will be loaded when needed)
        console.log('✅ Analyzer ready!');
    }

    setupEventListeners() {
        const uploadBtn = document.getElementById('uploadBtn');
        const uploadArea = document.getElementById('uploadArea');
        const videoInput = document.getElementById('videoInput');
        const analyzeBtn = document.getElementById('analyzeBtn');
        const changeVideoBtn = document.getElementById('changeVideoBtn');

        // Upload button
        uploadBtn.addEventListener('click', () => videoInput.click());
        uploadArea.addEventListener('click', () => videoInput.click());

        // Video input
        videoInput.addEventListener('change', (e) => this.handleVideoUpload(e));

        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('video/')) {
                this.loadVideo(file);
            }
        });

        // Analyze button
        analyzeBtn.addEventListener('click', () => this.analyzeVideo());

        // Change video button
        changeVideoBtn.addEventListener('click', () => {
            videoInput.click();
        });

        // Video loaded event
        this.video.addEventListener('loadeddata', () => {
            this.canvas.width = this.video.videoWidth;
            this.canvas.height = this.video.videoHeight;
        });
    }

    handleVideoUpload(event) {
        const file = event.target.files[0];
        if (file) {
            this.loadVideo(file);
        }
    }

    loadVideo(file) {
        console.log('📹 Loading video:', file.name);

        const url = URL.createObjectURL(file);
        this.video.src = url;

        // Show video container, hide upload area
        document.getElementById('uploadArea').style.display = 'none';
        document.getElementById('videoContainer').style.display = 'block';
        document.getElementById('resultsContainer').style.display = 'none';

        // Reset poses
        this.poses = [];
    }

    async analyzeVideo() {
        if (this.isAnalyzing) return;

        this.isAnalyzing = true;
        const analyzeBtn = document.getElementById('analyzeBtn');
        const btnText = analyzeBtn.querySelector('.btn-text');
        const btnLoader = analyzeBtn.querySelector('.btn-loader');

        btnText.style.display = 'none';
        btnLoader.style.display = 'inline-flex';
        analyzeBtn.disabled = true;

        try {
            console.log('🔍 Starting analysis...');

            // Initialize MediaPipe if not already done
            if (!this.poseLandmarker) {
                await this.initMediaPipe();
            }

            // Process video frames
            await this.processVideoFrames();

            // Analyze poses
            const analysis = this.analyzePoses();

            // Display results
            this.displayResults(analysis);

            // Show results container
            document.getElementById('resultsContainer').style.display = 'block';
            document.getElementById('resultsContainer').scrollIntoView({ behavior: 'smooth' });

        } catch (error) {
            console.error('❌ Analysis error:', error);
            alert('Ett fel uppstod vid analysen. Försök igen eller välj en annan video.');
        } finally {
            this.isAnalyzing = false;
            btnText.style.display = 'inline';
            btnLoader.style.display = 'none';
            analyzeBtn.disabled = false;
        }
    }

    async initMediaPipe() {
        console.log('🤖 Initializing MediaPipe Pose...');

        try {
            const vision = await window.FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
            );

            this.poseLandmarker = await window.PoseLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
                    delegate: "GPU"
                },
                runningMode: "VIDEO",
                numPoses: 1,
                minPoseDetectionConfidence: 0.5,
                minPosePresenceConfidence: 0.5,
                minTrackingConfidence: 0.5
            });

            console.log('✅ MediaPipe initialized!');
        } catch (error) {
            console.error('❌ MediaPipe initialization failed:', error);
            throw new Error('Kunde inte initiera pose detection. Kontrollera din internetanslutning.');
        }
    }

    async processVideoFrames() {
        console.log('🎬 Processing video frames...');

        this.poses = [];
        const video = this.video;
        const fps = 5; // Process 5 frames per second
        const interval = 1 / fps;

        // Reset video to start
        video.currentTime = 0;
        await new Promise(resolve => {
            video.onseeked = resolve;
        });

        // Process frames
        for (let time = 0; time < video.duration; time += interval) {
            video.currentTime = time;
            await new Promise(resolve => video.onseeked = resolve);

            try {
                const result = this.poseLandmarker.detectForVideo(video, time * 1000);

                if (result.landmarks && result.landmarks.length > 0) {
                    this.poses.push({
                        time: time,
                        landmarks: result.landmarks[0],
                        worldLandmarks: result.worldLandmarks ? result.worldLandmarks[0] : null
                    });

                    // Draw pose on canvas (optional visualization)
                    this.drawPose(result.landmarks[0], time);
                }
            } catch (error) {
                console.warn(`Failed to process frame at ${time}s:`, error);
            }
        }

        console.log(`✅ Processed ${this.poses.length} frames`);
    }

    drawPose(landmarks, time) {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw connections
        const connections = [
            [11, 13], [13, 15], // Left arm
            [12, 14], [14, 16], // Right arm
            [11, 12], // Shoulders
            [11, 23], [12, 24], // Torso
            [23, 24], // Hips
            [23, 25], [25, 27], // Left leg
            [24, 26], [26, 28], // Right leg
        ];

        this.ctx.strokeStyle = '#2ecc71';
        this.ctx.lineWidth = 3;

        connections.forEach(([start, end]) => {
            const startPoint = landmarks[start];
            const endPoint = landmarks[end];

            if (startPoint && endPoint) {
                this.ctx.beginPath();
                this.ctx.moveTo(startPoint.x * this.canvas.width, startPoint.y * this.canvas.height);
                this.ctx.lineTo(endPoint.x * this.canvas.width, endPoint.y * this.canvas.height);
                this.ctx.stroke();
            }
        });

        // Draw landmarks
        this.ctx.fillStyle = '#e74c3c';
        landmarks.forEach(landmark => {
            this.ctx.beginPath();
            this.ctx.arc(
                landmark.x * this.canvas.width,
                landmark.y * this.canvas.height,
                5, 0, 2 * Math.PI
            );
            this.ctx.fill();
        });
    }

    analyzePoses() {
        console.log('📊 Analyzing poses...');

        const issues = [];
        const metrics = {};

        // Calculate hip-shoulder separation
        const separations = this.poses.map(pose => {
            return this.calculateHipShoulderSeparation(pose.landmarks);
        });

        const avgSeparation = separations.reduce((a, b) => a + b, 0) / separations.length;
        metrics.hipShoulderSeparation = Math.round(avgSeparation);

        if (avgSeparation < 15) {
            issues.push({
                type: 'hip_shoulder_separation',
                severity: 'high',
                title: 'Otillräcklig höft-axel separation',
                description: `Din genomsnittliga höft-axel separation är ${Math.round(avgSeparation)}°, vilket är under det ideala värdet. Detta begränsar din kraftgenerering.`,
                value: Math.round(avgSeparation),
                ideal: '>20°',
                drills: [
                    'Höftrotationsövning: Stå med stängd hållning och öva på att rotera höfterna först innan axlarna följer med',
            'Väggövning: Stå i sidled mot en vägg och öva på att initiera rörelsen från höfterna',
                    'Medicin-bollskast: Fokusera på att kraftigt rotera höfterna innan överkroppen följer'
                ]
            });
        }

        // Check weight transfer
        const weightTransferAnalysis = this.analyzeWeightTransfer();
        if (weightTransferAnalysis.hasIssue) {
            issues.push({
                type: 'weight_transfer',
                severity: 'medium',
                title: 'Problem med viktöverföring',
                description: weightTransferAnalysis.description,
                drills: [
                    'Stegövning: Öva X-steget långsamt och fokusera på viktöverföringen från bakre till främre fot',
                    'En-fots balans: Träna att balansera på din främre fot för att stärka stabilitet',
                    'Kaströrelse utan disc: Öva kastet utan disc för att känna viktöverföringen'
                ]
            });
        }

        // Check arm extension (rounding)
        const armExtensionAnalysis = this.analyzeArmExtension();
        metrics.armExtension = armExtensionAnalysis.avgAngle;

        if (armExtensionAnalysis.hasRounding) {
            issues.push({
                type: 'rounding',
                severity: 'high',
                title: 'Rounding - Armen inte fullt utsträckt',
                description: `Din arm är inte fullt utsträckt under reach-back, vilket minskar kastlängden och kontrollen.`,
                drills: [
                    'Reach-back övning: Öva på att sträcka ut armen helt under reach-back',
                    'Sträckövningar: Förbättra axelrörlighet med dagliga sträckningar',
                    'Slow-motion kast: Öva kastet i slow-motion för att fokusera på full armutsträckning'
                ]
            });
        }

        // Calculate release point consistency
        const releasePoints = this.calculateReleasePoints();
        metrics.releaseHeight = releasePoints.avgHeight;
        metrics.releaseVariation = releasePoints.variation;

        // Check timing
        const timingAnalysis = this.analyzeTimingSequence();
        metrics.timingScore = timingAnalysis.score;

        if (timingAnalysis.score < 70) {
            issues.push({
                type: 'timing',
                severity: 'medium',
                title: 'Timing-problem i den kinetiska kedjan',
                description: 'Din kropps rörelssekvens följer inte optimal ordning (höfter → överkropp → axlar → arm)',
                drills: [
                    'Sekvensiell övning: Öva varje del av kastet separat och bygg sedan ihop dem',
                    'Metronom-träning: Använd en metronom för att träna rätt timing',
                    'Video-analys: Filma dig själv och jämför med proffs för att se timing-skillnader'
                ]
            });
        }

        // Calculate overall score
        const score = this.calculateOverallScore(issues, metrics);

        return {
            score,
            issues: this.prioritizeIssues(issues),
            metrics,
            feedback: this.generateFeedback(score, issues)
        };
    }

    calculateHipShoulderSeparation(landmarks) {
        // Calculate angle between hip line and shoulder line
        const leftHip = landmarks[23];
        const rightHip = landmarks[24];
        const leftShoulder = landmarks[11];
        const rightShoulder = landmarks[12];

        const hipAngle = Math.atan2(rightHip.y - leftHip.y, rightHip.x - leftHip.x) * 180 / Math.PI;
        const shoulderAngle = Math.atan2(rightShoulder.y - leftShoulder.y, rightShoulder.x - leftShoulder.x) * 180 / Math.PI;

        return Math.abs(hipAngle - shoulderAngle);
    }

    analyzeWeightTransfer() {
        // Analyze ankle position changes to detect weight transfer
        const leftAnklePositions = this.poses.map(p => p.landmarks[27].x);
        const rightAnklePositions = this.poses.map(p => p.landmarks[28].x);

        // Calculate weight shift
        const avgLeftShift = Math.abs(leftAnklePositions[leftAnklePositions.length - 1] - leftAnklePositions[0]);
        const avgRightShift = Math.abs(rightAnklePositions[rightAnklePositions.length - 1] - rightAnklePositions[0]);

        const hasIssue = (avgLeftShift + avgRightShift) < 0.1;

        return {
            hasIssue,
            description: hasIssue
                ? 'Begränsad viktöverföring detekterad. Du använder inte fullt ut din underkropps kraft.'
                : 'Bra viktöverföring från bakre till främre fot.'
        };
    }

    analyzeArmExtension() {
        // Calculate elbow angles to detect rounding
        const elbowAngles = this.poses.map(pose => {
            const shoulder = pose.landmarks[12]; // Right shoulder
            const elbow = pose.landmarks[14]; // Right elbow
            const wrist = pose.landmarks[16]; // Right wrist

            return this.calculateAngle(shoulder, elbow, wrist);
        });

        const avgAngle = elbowAngles.reduce((a, b) => a + b, 0) / elbowAngles.length;
        const hasRounding = avgAngle < 140; // Less than 140 degrees indicates rounding

        return {
            hasRounding,
            avgAngle: Math.round(avgAngle)
        };
    }

    calculateAngle(point1, point2, point3) {
        const radians = Math.atan2(point3.y - point2.y, point3.x - point2.x) -
                        Math.atan2(point1.y - point2.y, point1.x - point2.x);
        let degrees = Math.abs(radians * 180.0 / Math.PI);
        if (degrees > 180.0) degrees = 360 - degrees;
        return degrees;
    }

    calculateReleasePoints() {
        // Get wrist positions at later frames (likely release)
        const releaseFrames = this.poses.slice(-5); // Last 5 frames
        const heights = releaseFrames.map(p => p.landmarks[16].y); // Right wrist

        const avgHeight = heights.reduce((a, b) => a + b, 0) / heights.length;
        const variation = Math.max(...heights) - Math.min(...heights);

        return {
            avgHeight: (1 - avgHeight) * 100, // Convert to percentage (0 = bottom, 100 = top)
            variation: variation * 100
        };
    }

    analyzeTimingSequence() {
        // Simplified timing analysis
        // In a real implementation, this would analyze the sequence of movements

        // For now, return a score based on hip-shoulder separation
        const separations = this.poses.map(p => this.calculateHipShoulderSeparation(p.landmarks));
        const maxSeparation = Math.max(...separations);

        // Good timing correlates with good hip-shoulder separation
        const score = Math.min(100, maxSeparation * 4);

        return { score: Math.round(score) };
    }

    calculateOverallScore(issues, metrics) {
        let score = 100;

        // Deduct points for issues
        issues.forEach(issue => {
            if (issue.severity === 'high') score -= 15;
            else if (issue.severity === 'medium') score -= 10;
            else score -= 5;
        });

        // Ensure score doesn't go below 0
        return Math.max(0, Math.round(score));
    }

    prioritizeIssues(issues) {
        const priority = { high: 3, medium: 2, low: 1 };
        return issues.sort((a, b) => priority[b.severity] - priority[a.severity]);
    }

    generateFeedback(score, issues) {
        if (score >= 85) {
            return 'Excellent form! Din teknik är mycket bra med endast mindre justeringar att göra.';
        } else if (score >= 70) {
            return 'God teknik med utrymme för förbättring. Fokusera på de identifierade områdena.';
        } else if (score >= 50) {
            return 'Din teknik har flera områden som behöver förbättras. Följ träningsplanen nedan.';
        } else {
            return 'Betydande tekniska problem identifierade. Rekommenderar personlig coaching för snabbare framsteg.';
        }
    }

    displayResults(analysis) {
        // Update overall score
        document.getElementById('overallScore').querySelector('.score-value').textContent = analysis.score;
        document.getElementById('overallFeedback').textContent = analysis.feedback;

        // Display issues
        const issuesList = document.getElementById('issuesList');
        issuesList.innerHTML = '';

        if (analysis.issues.length === 0) {
            issuesList.innerHTML = '<p style="color: #2ecc71; text-align: center; padding: 2rem;">🎉 Inga stora problem hittade! Din teknik ser bra ut.</p>';
        } else {
            analysis.issues.forEach(issue => {
                const issueCard = document.createElement('div');
                issueCard.className = `issue-card severity-${issue.severity}`;

                issueCard.innerHTML = `
                    <div class="issue-header">
                        <div class="issue-title">${issue.title}</div>
                        <span class="issue-severity">${issue.severity === 'high' ? 'Hög' : issue.severity === 'medium' ? 'Medel' : 'Låg'}</span>
                    </div>
                    <p class="issue-description">${issue.description}</p>
                    <div class="issue-drills">
                        <strong>Rekommenderade övningar:</strong>
                        <ul>
                            ${issue.drills.map(drill => `<li>${drill}</li>`).join('')}
                        </ul>
                    </div>
                `;

                issuesList.appendChild(issueCard);
            });
        }

        // Display metrics
        const metricsGrid = document.getElementById('metricsGrid');
        metricsGrid.innerHTML = '';

        const metricsToDisplay = [
            { label: 'Höft-Axel Separation', value: `${analysis.metrics.hipShoulderSeparation}°`, ideal: '>20°' },
            { label: 'Armsträckning', value: `${analysis.metrics.armExtension}°`, ideal: '>140°' },
            { label: 'Release-höjd', value: `${Math.round(analysis.metrics.releaseHeight)}%`, ideal: '50-70%' },
            { label: 'Timing Score', value: `${analysis.metrics.timingScore}/100`, ideal: '>70' }
        ];

        metricsToDisplay.forEach(metric => {
            const metricCard = document.createElement('div');
            metricCard.className = 'metric-card';
            metricCard.innerHTML = `
                <span class="metric-value">${metric.value}</span>
                <div class="metric-label">${metric.label}</div>
                <div class="metric-ideal">Ideal: ${metric.ideal}</div>
            `;
            metricsGrid.appendChild(metricCard);
        });

        // Generate training plan
        this.generateTrainingPlan(analysis.issues);
    }

    generateTrainingPlan(issues) {
        const trainingPlanContent = document.getElementById('trainingPlanContent');

        if (issues.length === 0) {
            trainingPlanContent.innerHTML = '<p>Din teknik är redan bra! Fortsätt träna regelbundet för att bibehålla formen.</p>';
            return;
        }

        // Create a 4-week plan focusing on top issues
        const plan = `
            <div class="training-week">
                <h5>Vecka 1-2: Grundläggande Teknik</h5>
                <ul>
                    <li>Slow-motion kast: 10-15 minuter dagligen för att känna rätt rörelse</li>
                    <li>Fokusövningar för topp-problem (se övningar ovan)</li>
                    <li>Video dig själv varje träningspass för att se framsteg</li>
                    <li>Uppvärmning och stretching: 10 minuter före träning</li>
                </ul>
            </div>
            <div class="training-week">
                <h5>Vecka 3-4: Integration & Hastighet</h5>
                <ul>
                    <li>Börja öka kaststyrkan gradvis med fokus på bibehållen teknik</li>
                    <li>Kombinationsövningar: Integrera alla förbättringar i fullt kast</li>
                    <li>Spelträning på bana: Applicera ny teknik i verkliga situationer</li>
                    <li>Fortsätt videoanalys för att säkerställa framsteg</li>
                </ul>
            </div>
            <div class="training-week">
                <h5>Vecka 5+: Underhåll & Förfining</h5>
                <ul>
                    <li>Regelbunden träning 3-4 gånger per vecka</li>
                    <li>Filma och analysera kastet månadsvis</li>
                    <li>Överväg personlig coaching för finslipning</li>
                    <li>Fortsätt arbeta med identifierade problem</li>
                </ul>
            </div>
        `;

        trainingPlanContent.innerHTML = plan;
    }
}

// Initialize analyzer when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('🥏 Disc Golf Analyzer starting...');

    // Check if MediaPipe is available
    if (typeof window.FilesetResolver === 'undefined' || typeof window.PoseLandmarker === 'undefined') {
        console.error('❌ MediaPipe not loaded. Please check your internet connection.');
        alert('MediaPipe kunde inte laddas. Kontrollera din internetanslutning och ladda om sidan.');
        return;
    }

    // Create analyzer instance
    const analyzer = new DiscGolfAnalyzer();
});

console.log('📝 Analyzer module loaded');
