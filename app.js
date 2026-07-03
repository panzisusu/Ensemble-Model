// State Variables
let points = []; // Array of {x, y, label, weight} (x, y are 0 to 1)
let ensemble = []; // Array of estimators (trees)
let sampleWeights = []; // AdaBoost sample weights
let currentClass = 1; // 1: Red (Class A), -1: Black (Class B)
let autoTrainInterval = null;

// HTML Elements
const canvas = document.getElementById('sandbox-canvas');
const ctx = canvas.getContext('2d');
const canvasHint = document.getElementById('canvas-hint');
const methodSelect = document.getElementById('ensemble-method');
const estimatorsSlider = document.getElementById('estimator-count');
const depthSlider = document.getElementById('tree-depth');
const sampleRateSlider = document.getElementById('sample-rate');
const learningRateSlider = document.getElementById('learning-rate');

const valEstimators = document.getElementById('val-estimators');
const valDepth = document.getElementById('val-depth');
const valSampleRate = document.getElementById('val-sample-rate');
const valLearningRate = document.getElementById('val-learning-rate');

const groupSampleRate = document.getElementById('group-sample-rate');
const groupLearningRate = document.getElementById('group-learning-rate');
const btnPlayIcon = document.getElementById('btn-play-icon');
const btnPlayText = document.getElementById('btn-play-text');
const dataCounter = document.getElementById('data-counter');
const trainStatus = document.getElementById('train-status');
const estimatorList = document.getElementById('estimator-list');

// Initialize
window.addEventListener('load', () => {
    // Generate some initial random points
    generateRandomData();
    draw();
    
    // Load Markdown Documents
    loadDocuments();
});

// Setup Canvas Click Event
canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    
    if (e.button === 0) {
        // Left click: Add point
        points.push({ x, y, label: currentClass });
        canvasHint.style.display = 'none';
        resetWeights();
        retrain();
    } else if (e.button === 2) {
        // Right click: Remove closest point if near
        e.preventDefault();
        removePointNear(x, y);
    }
});

// Prevent Context Menu on Canvas
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

function setClass(label) {
    currentClass = label;
    document.getElementById('class-red-btn').classList.toggle('active', label === 1);
    document.getElementById('class-black-btn').classList.toggle('active', label === -1);
}

function onMethodChange() {
    const method = methodSelect.value;
    groupSampleRate.style.display = (method === 'bagging' || method === 'randomforest') ? 'block' : 'none';
    groupLearningRate.style.display = (method === 'boosting' || method === 'gbdt') ? 'block' : 'none';
    resetWeights();
    retrain();
}

function onParamChange() {
    valEstimators.innerText = estimatorsSlider.value;
    
    const depth = parseInt(depthSlider.value);
    valDepth.innerText = depth === 1 ? '1 (Decision Stump)' : depth;
    
    valSampleRate.innerText = sampleRateSlider.value + '%';
    valLearningRate.innerText = learningRateSlider.value;
    
    resetWeights();
    retrain();
}

// Data point management
function generateRandomData() {
    points = [];
    // Generate some clean points for demonstration
    for (let i = 0; i < 15; i++) {
        points.push({
            x: 0.15 + Math.random() * 0.4,
            y: 0.2 + Math.random() * 0.6,
            label: 1
        });
    }
    for (let i = 0; i < 15; i++) {
        points.push({
            x: 0.45 + Math.random() * 0.4,
            y: 0.2 + Math.random() * 0.6,
            label: -1
        });
    }
    
    canvasHint.style.display = 'none';
    resetWeights();
    retrain();
}

function clearData() {
    points = [];
    ensemble = [];
    resetWeights();
    canvasHint.style.display = 'flex';
    draw();
    updateEstimatorCards();
}

function removePointNear(x, y) {
    if (points.length === 0) return;
    
    let closestIndex = 0;
    let minDistance = Infinity;
    
    points.forEach((p, idx) => {
        const dist = Math.hypot(p.x - x, p.y - y);
        if (dist < minDistance) {
            minDistance = dist;
            closestIndex = idx;
        }
    });
    
    // Remove if clicked within a reasonable range (e.g. 30px)
    if (minDistance < 0.08) {
        points.splice(closestIndex, 1);
        resetWeights();
        retrain();
    }
}

function resetWeights() {
    const n = points.length;
    if (n === 0) {
        sampleWeights = [];
        return;
    }
    sampleWeights = Array(n).fill(1 / n);
}

// ----------------------------------------------------
// DECISION TREE / STUMP CLASSIFIER IMPLEMENTATION
// ----------------------------------------------------

// Find the best axis-aligned split (decision stump) on a weighted subset
function trainStump(data, weights, isRandomForest) {
    let bestStump = null;
    let minError = Infinity;
    const n = data.length;

    // Loop through features (0: x, 1: y)
    let featuresToTest = [0, 1];
    if (isRandomForest) {
        // Random Forest feature bagging: randomly choose only 1 feature to split at this node
        featuresToTest = [Math.floor(Math.random() * 2)];
    }

    for (let feature of featuresToTest) {
        // Evaluate splits at threshold values of each coordinate
        for (let i = 0; i < n; i++) {
            const threshold = feature === 0 ? data[i].x : data[i].y;
            
            // Try both split polarities
            for (let polarity of [1, -1]) {
                let error = 0;
                for (let j = 0; j < n; j++) {
                    const val = feature === 0 ? data[j].x : data[j].y;
                    const pred = (val >= threshold) ? polarity : -polarity;
                    if (pred !== data[j].label) {
                        error += weights[j];
                    }
                }
                
                if (error < minError) {
                    minError = error;
                    bestStump = {
                        feature,
                        threshold,
                        polarity,
                        error
                    };
                }
            }
        }
    }
    return bestStump;
}

// Predict label using a single node
function predictTreeNode(node, x, y) {
    if (node.isLeaf) return node.label;
    const val = node.feature === 0 ? x : y;
    const direction = (val >= node.threshold) ? node.polarity : -node.polarity;
    return predictTreeNode(direction === 1 ? node.left : node.right, x, y);
}

// Recursive Decision Tree training
function trainTree(data, weights, indices, depth, maxDepth, isRandomForest) {
    const nSub = indices.length;
    if (nSub === 0) return { isLeaf: true, label: 1 };
    
    // Compute current weighted distribution of classes
    let sumWRed = 0;
    let sumWBlack = 0;
    indices.forEach(idx => {
        if (data[idx].label === 1) sumWRed += weights[idx];
        else sumWBlack += weights[idx];
    });
    
    const majorityLabel = sumWRed >= sumWBlack ? 1 : -1;
    
    // Stop condition
    if (depth >= maxDepth || sumWRed === 0 || sumWBlack === 0) {
        return { isLeaf: true, label: majorityLabel };
    }
    
    // Prepare subset data & weights for stump training
    const subsetData = indices.map(idx => data[idx]);
    const subsetWeights = indices.map(idx => weights[idx]);
    
    // Normalize weights for stump training
    const sumW = subsetWeights.reduce((a, b) => a + b, 0);
    const normalizedSubsetWeights = sumW > 0 ? subsetWeights.map(w => w / sumW) : subsetWeights.map(() => 1 / nSub);
    
    const stump = trainStump(subsetData, normalizedSubsetWeights, isRandomForest);
    if (!stump || stump.error >= 0.5) {
        return { isLeaf: true, label: majorityLabel };
    }
    
    // Split the current indices
    const leftIndices = [];
    const rightIndices = [];
    indices.forEach(idx => {
        const val = stump.feature === 0 ? data[idx].x : data[idx].y;
        const direction = (val >= stump.threshold) ? stump.polarity : -stump.polarity;
        if (direction === 1) {
            leftIndices.push(idx);
        } else {
            rightIndices.push(idx);
        }
    });
    
    // If a split is redundant (doesn't split points)
    if (leftIndices.length === 0 || rightIndices.length === 0) {
        return { isLeaf: true, label: majorityLabel };
    }
    
    return {
        isLeaf: false,
        feature: stump.feature,
        threshold: stump.threshold,
        polarity: stump.polarity,
        left: trainTree(data, weights, leftIndices, depth + 1, maxDepth, isRandomForest),
        right: trainTree(data, weights, rightIndices, depth + 1, maxDepth, isRandomForest)
    };
}

// ----------------------------------------------------
// REGRESSION TREE IMPLEMENTATION (FOR GBDT)
// ----------------------------------------------------

// Find the best split for a regression stump (minimizing Sum of Squared Errors)
function trainRegressionStump(data, residuals, indices) {
    let bestStump = null;
    let minSSE = Infinity;
    const n = indices.length;
    
    for (let feature = 0; feature < 2; feature++) {
        for (let i = 0; i < n; i++) {
            const threshold = feature === 0 ? data[indices[i]].x : data[indices[i]].y;
            
            for (let polarity of [1, -1]) {
                const leftIndices = [];
                const rightIndices = [];
                for (let j = 0; j < n; j++) {
                    const idx = indices[j];
                    const val = feature === 0 ? data[idx].x : data[idx].y;
                    const direction = (val >= threshold) ? polarity : -polarity;
                    if (direction === 1) {
                        leftIndices.push(idx);
                    } else {
                        rightIndices.push(idx);
                    }
                }
                
                if (leftIndices.length === 0 || rightIndices.length === 0) continue;
                
                // Calculate means
                let sumLeft = 0;
                leftIndices.forEach(idx => sumLeft += residuals[idx]);
                const meanLeft = sumLeft / leftIndices.length;
                
                let sumRight = 0;
                rightIndices.forEach(idx => sumRight += residuals[idx]);
                const meanRight = sumRight / rightIndices.length;
                
                // Calculate Sum of Squared Errors (SSE)
                let sse = 0;
                leftIndices.forEach(idx => sse += Math.pow(residuals[idx] - meanLeft, 2));
                rightIndices.forEach(idx => sse += Math.pow(residuals[idx] - meanRight, 2));
                
                if (sse < minSSE) {
                    minSSE = sse;
                    bestStump = {
                        feature,
                        threshold,
                        polarity,
                        meanLeft,
                        meanRight,
                        leftIndices,
                        rightIndices
                    };
                }
            }
        }
    }
    return bestStump;
}

// Train a recursive Regression Tree (GBDT)
function trainRegressionTree(data, residuals, indices, depth, maxDepth) {
    const n = indices.length;
    if (n === 0) return { isLeaf: true, value: 0 };
    
    let sumR = 0;
    indices.forEach(idx => sumR += residuals[idx]);
    const meanVal = sumR / n;
    
    if (depth >= maxDepth) {
        return { isLeaf: true, value: meanVal };
    }
    
    const stump = trainRegressionStump(data, residuals, indices);
    if (!stump) {
        return { isLeaf: true, value: meanVal };
    }
    
    return {
        isLeaf: false,
        feature: stump.feature,
        threshold: stump.threshold,
        polarity: stump.polarity,
        left: trainRegressionTree(data, residuals, stump.leftIndices, depth + 1, maxDepth),
        right: trainRegressionTree(data, residuals, stump.rightIndices, depth + 1, maxDepth)
    };
}

function predictRegressionTreeNode(node, x, y) {
    if (node.isLeaf) return node.value;
    const val = node.feature === 0 ? x : y;
    const direction = (val >= node.threshold) ? node.polarity : -node.polarity;
    return predictRegressionTreeNode(direction === 1 ? node.left : node.right, x, y);
}

// ----------------------------------------------------
// VOTING & STACKING BASE CLASSIFIERS
// ----------------------------------------------------

// Model 2: Simple Linear Perceptron
function trainPerceptron(data) {
    let wx = 0.5, wy = -0.5, b = 0;
    const epochs = 100;
    
    for (let epoch = 0; epoch < epochs; epoch++) {
        let misclassified = 0;
        for (let i = 0; i < data.length; i++) {
            const p = data[i];
            const score = wx * p.x + wy * p.y + b;
            const pred = score >= 0 ? 1 : -1;
            if (pred !== p.label) {
                wx += 0.1 * p.label * p.x;
                wy += 0.1 * p.label * p.y;
                b += 0.1 * p.label;
                misclassified++;
            }
        }
        if (misclassified === 0) break;
    }
    return { wx, wy, b };
}

// Model 3: Circle Classifier (inside/outside circle)
function trainCircleClassifier(data) {
    let sumX = 0, sumY = 0;
    data.forEach(p => { sumX += p.x; sumY += p.y; });
    const cx = sumX / data.length;
    const cy = sumY / data.length;
    
    let bestRadius = 0.2;
    let bestPolarity = 1;
    let minError = Infinity;
    
    for (let r = 0.05; r <= 0.6; r += 0.03) {
        for (let polarity of [1, -1]) {
            let error = 0;
            data.forEach(p => {
                const dist2 = Math.pow(p.x - cx, 2) + Math.pow(p.y - cy, 2);
                const pred = (dist2 <= r * r) ? polarity : -polarity;
                if (pred !== p.label) {
                    error++;
                }
            });
            if (error < minError) {
                minError = error;
                bestRadius = r;
                bestPolarity = polarity;
            }
        }
    }
    return { cx, cy, radius: bestRadius, polarity: bestPolarity };
}

// Stacking Meta-Classifier (Stump on 3 base predictions)
function trainMetaStump(basePreds, labels) {
    let bestMeta = null;
    let minError = Infinity;
    const n = basePreds.length;
    
    // feature: 0 (Stump), 1 (Perceptron), 2 (Circle)
    for (let feature = 0; feature < 3; feature++) {
        const threshold = 0; // threshold is 0 since values are -1 or +1
        for (let polarity of [1, -1]) {
            let error = 0;
            for (let i = 0; i < n; i++) {
                const val = basePreds[i][feature];
                const pred = (val >= threshold) ? polarity : -polarity;
                if (pred !== labels[i]) {
                    error++;
                }
            }
            if (error < minError) {
                minError = error;
                bestMeta = { feature, threshold, polarity, error };
            }
        }
    }
    return bestMeta;
}

// ----------------------------------------------------
// ENSEMBLE TRAINING LOGIC
// ----------------------------------------------------

function retrain() {
    if (points.length === 0) {
        ensemble = [];
        updateEstimatorCards();
        draw();
        return;
    }
    
    const method = methodSelect.value;
    const numEstimators = parseInt(estimatorsSlider.value);
    const maxDepth = parseInt(depthSlider.value);
    
    ensemble = [];
    
    if (method === 'bagging' || method === 'randomforest') {
        const sampleRate = parseInt(sampleRateSlider.value) / 100;
        const n = points.length;
        const sampleSize = Math.max(1, Math.round(n * sampleRate));
        const isRF = method === 'randomforest';
        
        for (let t = 0; t < numEstimators; t++) {
            // Bootstrap Sampling (random with replacement)
            const bootstrapIndices = [];
            for (let i = 0; i < sampleSize; i++) {
                bootstrapIndices.push(Math.floor(Math.random() * n));
            }
            
            // Train tree using bootstrap subset
            const uniformWeights = Array(n).fill(1);
            const root = trainTree(points, uniformWeights, bootstrapIndices, 0, maxDepth, isRF);
            
            ensemble.push({
                root,
                alpha: 1 / numEstimators, // Equal voting weights
                bootstrapSize: sampleSize
            });
        }
        trainStatus.innerText = isRF ? "已訓練 (Random Forest)" : "已訓練 (Bagging)";
        trainStatus.className = "badge";
    } 
    else if (method === 'boosting') {
        // Reset sample weights first
        resetWeights();
        const n = points.length;
        const learningRate = parseFloat(learningRateSlider.value);
        const allIndices = Array.from({ length: n }, (_, i) => i);
        
        for (let t = 0; t < numEstimators; t++) {
            const root = trainTree(points, sampleWeights, allIndices, 0, maxDepth, false);
            
            // Calculate weighted error
            let error = 0;
            for (let i = 0; i < n; i++) {
                const pred = predictTreeNode(root, points[i].x, points[i].y);
                if (pred !== points[i].label) {
                    error += sampleWeights[i];
                }
            }
            
            if (error >= 0.5) {
                if (t === 0) {
                    ensemble.push({ root, alpha: 1.0, error: 0.5 });
                }
                break;
            }
            if (error < 1e-6) error = 1e-6; // Clamp
            
            let alpha = 0.5 * Math.log((1 - error) / error) * learningRate;
            
            // Update weights
            for (let i = 0; i < n; i++) {
                const pred = predictTreeNode(root, points[i].x, points[i].y);
                const exponent = -alpha * points[i].label * pred;
                sampleWeights[i] *= Math.exp(exponent);
            }
            
            // Re-normalize weights
            const sumW = sampleWeights.reduce((a, b) => a + b, 0);
            if (sumW > 0) {
                sampleWeights = sampleWeights.map(w => w / sumW);
            }
            
            ensemble.push({
                root,
                alpha,
                error
            });
        }
        trainStatus.innerText = "已訓練 (AdaBoost)";
        trainStatus.className = "badge badge-accent";
    }
    else if (method === 'gbdt') {
        const n = points.length;
        const learningRate = parseFloat(learningRateSlider.value);
        const allIndices = Array.from({ length: n }, (_, i) => i);
        
        // F holds log-odds predictions
        let F = Array(n).fill(0);
        
        for (let t = 0; t < numEstimators; t++) {
            // Calculate pseudo-residuals (probability residuals)
            const residuals = [];
            for (let i = 0; i < n; i++) {
                const prob = 1 / (1 + Math.exp(-F[i]));
                const label01 = (points[i].label + 1) / 2;
                residuals.push(label01 - prob);
            }
            
            const root = trainRegressionTree(points, residuals, allIndices, 0, maxDepth);
            
            // Update F
            for (let i = 0; i < n; i++) {
                const pred = predictRegressionTreeNode(root, points[i].x, points[i].y);
                F[i] += learningRate * pred;
            }
            
            // Average absolute residual as error metric
            const meanAbsRes = residuals.reduce((sum, val) => sum + Math.abs(val), 0) / n;
            
            ensemble.push({
                root,
                alpha: learningRate,
                isRegression: true,
                error: meanAbsRes
            });
        }
        trainStatus.innerText = "已訓練 (GBDT)";
        trainStatus.className = "badge badge-accent";
    }
    else if (method === 'voting' || method === 'stacking') {
        // Enforce 3 models
        const n = points.length;
        const uniformWeights = Array(n).fill(1);
        const allIndices = Array.from({ length: n }, (_, i) => i);
        
        // Model 1: Stump (maxDepth 1 decision tree)
        const stump = trainTree(points, uniformWeights, allIndices, 0, 1, false);
        // Model 2: Linear Perceptron
        const perceptron = trainPerceptron(points);
        // Model 3: Circle Classifier
        const circle = trainCircleClassifier(points);
        
        ensemble.push({ type: 'stump', root: stump, alpha: 1 });
        ensemble.push({ type: 'perceptron', weights: perceptron, alpha: 1 });
        ensemble.push({ type: 'circle', circle: circle, alpha: 1 });
        
        if (method === 'stacking') {
            // Generate meta-dataset
            const basePreds = [];
            for (let i = 0; i < n; i++) {
                const p1 = predictTreeNode(stump, points[i].x, points[i].y);
                const scorePerc = perceptron.wx * points[i].x + perceptron.wy * points[i].y + perceptron.b;
                const p2 = scorePerc >= 0 ? 1 : -1;
                const dist2 = Math.pow(points[i].x - circle.cx, 2) + Math.pow(points[i].y - circle.cy, 2);
                const p3 = (dist2 <= circle.radius * circle.radius) ? circle.polarity : -circle.polarity;
                
                basePreds.push([p1, p2, p3]);
            }
            
            const meta = trainMetaStump(basePreds, points.map(p => p.label));
            ensemble.push({ type: 'meta', meta: meta, alpha: 1 });
            trainStatus.innerText = "已訓練 (Stacking)";
        } else {
            trainStatus.innerText = "已訓練 (Voting)";
        }
        trainStatus.className = "badge";
    }
    
    updateEstimatorCards();
    draw();
}

// Manual training step
function triggerStep() {
    if (points.length === 0) return;
    
    const numEstimators = parseInt(estimatorsSlider.value);
    if (numEstimators < 15) {
        estimatorsSlider.value = numEstimators + 1;
        onParamChange();
    }
}

// Auto-run animation
function toggleAutoTrain() {
    if (autoTrainInterval) {
        clearInterval(autoTrainInterval);
        autoTrainInterval = null;
        btnPlayIcon.className = "fa-solid fa-play";
        btnPlayText.innerText = "自動演示";
    } else {
        estimatorsSlider.value = 1;
        onParamChange();
        
        autoTrainInterval = setInterval(() => {
            const val = parseInt(estimatorsSlider.value);
            if (val < 15) {
                estimatorsSlider.value = val + 1;
                onParamChange();
            } else {
                toggleAutoTrain(); // Stop at max
            }
        }, 1200);
        
        btnPlayIcon.className = "fa-solid fa-pause";
        btnPlayText.innerText = "暫停演示";
    }
}

// ----------------------------------------------------
// UI RENDERING & DRAWING
// ----------------------------------------------------

// Make a prediction at a given coordinate coordinate
function predictEnsemble(x, y) {
    if (ensemble.length === 0) return 0;
    
    const method = methodSelect.value;
    
    if (method === 'voting') {
        // Simple majority vote sum of the 3 base models
        const p1 = predictTreeNode(ensemble[0].root, x, y);
        
        const perc = ensemble[1].weights;
        const p2 = (perc.wx * x + perc.wy * y + perc.b >= 0) ? 1 : -1;
        
        const circ = ensemble[2].circle;
        const dist2 = Math.pow(x - circ.cx, 2) + Math.pow(y - circ.cy, 2);
        const p3 = (dist2 <= circ.radius * circ.radius) ? circ.polarity : -circ.polarity;
        
        return p1 + p2 + p3;
    }
    
    if (method === 'stacking') {
        const p1 = predictTreeNode(ensemble[0].root, x, y);
        
        const perc = ensemble[1].weights;
        const p2 = (perc.wx * x + perc.wy * y + perc.b >= 0) ? 1 : -1;
        
        const circ = ensemble[2].circle;
        const dist2 = Math.pow(x - circ.cx, 2) + Math.pow(y - circ.cy, 2);
        const p3 = (dist2 <= circ.radius * circ.radius) ? circ.polarity : -circ.polarity;
        
        const meta = ensemble[3].meta;
        const baseVals = [p1, p2, p3];
        const val = baseVals[meta.feature];
        return (val >= meta.threshold) ? meta.polarity : -meta.polarity;
    }
    
    if (method === 'gbdt') {
        let sum = 0;
        ensemble.forEach(est => {
            sum += est.alpha * predictRegressionTreeNode(est.root, x, y);
        });
        return sum; // Returns raw log-odds score
    }
    
    // Default (Bagging, Random Forest, AdaBoost)
    let sum = 0;
    ensemble.forEach(est => {
        const pred = predictTreeNode(est.root, x, y);
        sum += est.alpha * pred;
    });
    return sum;
}

// Render decision stumps splits recursively (helper to draw weak boundaries)
function drawSplitLines(node, x1, x2, y1, y2) {
    if (node.isLeaf) return;
    
    ctx.save();
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(140, 107, 18, 0.4)'; // Weak gold border dashed line
    
    if (node.feature === 0) { // vertical split at threshold x
        const cx = node.threshold * canvas.width;
        ctx.beginPath();
        ctx.moveTo(cx, y1 * canvas.height);
        ctx.lineTo(cx, y2 * canvas.height);
        ctx.stroke();
        
        // Draw children lines if any
        drawSplitLines(node.left, node.threshold, x2, y1, y2);
        drawSplitLines(node.right, x1, node.threshold, y1, y2);
    } else { // horizontal split at threshold y
        const cy = node.threshold * canvas.height;
        ctx.beginPath();
        ctx.moveTo(x1 * canvas.width, cy);
        ctx.lineTo(x2 * canvas.width, cy);
        ctx.stroke();
        
        // Draw children lines if any
        drawSplitLines(node.left, x1, x2, node.threshold, y2);
        drawSplitLines(node.right, x1, x2, y1, node.threshold);
    }
    ctx.restore();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 1. Draw Decision Boundaries (Grid Scan)
    const gridSize = 5; // Resolution
    const w = canvas.width;
    const h = canvas.height;
    
    const gridRows = Math.ceil(h / gridSize);
    const gridCols = Math.ceil(w / gridSize);
    const method = methodSelect.value;
    
    // Matrix to store scores for border extraction
    const scores = Array(gridRows).fill(0).map(() => Array(gridCols).fill(0));
    
    if (ensemble.length > 0) {
        for (let r = 0; r < gridRows; r++) {
            const py = (r * gridSize + gridSize / 2) / h;
            for (let c = 0; c < gridCols; c++) {
                const px = (c * gridSize + gridSize / 2) / w;
                const score = predictEnsemble(px, py);
                scores[r][c] = score;
                
                // Color regions with light ink-wash transparency
                if (score > 0) {
                    ctx.fillStyle = 'rgba(158, 42, 43, 0.08)'; // Light vermilion wash
                } else if (score < 0) {
                    ctx.fillStyle = 'rgba(43, 38, 33, 0.08)';  // Light charcoal wash
                } else {
                    ctx.fillStyle = 'transparent';
                }
                ctx.fillRect(c * gridSize, r * gridSize, gridSize, gridSize);
            }
        }
        
        // 2. Draw Aggregated Boundary Lines (Interpolation)
        ctx.save();
        ctx.strokeStyle = '#8c6b12'; // Antique Gold
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        for (let r = 0; r < gridRows; r++) {
            for (let c = 0; c < gridCols; c++) {
                const currentScore = scores[r][c];
                
                // Check right boundary
                if (c + 1 < gridCols && (currentScore > 0 !== scores[r][c + 1] > 0)) {
                    ctx.moveTo((c + 1) * gridSize, r * gridSize);
                    ctx.lineTo((c + 1) * gridSize, (r + 1) * gridSize);
                }
                // Check bottom boundary
                if (r + 1 < gridRows && (currentScore > 0 !== scores[r + 1][c] > 0)) {
                    ctx.moveTo(c * gridSize, (r + 1) * gridSize);
                    ctx.lineTo((c + 1) * gridSize, (r + 1) * gridSize);
                }
            }
        }
        ctx.stroke();
        ctx.restore();
        
        // 3. Draw weak split lines for each estimator
        if (method === 'voting' || method === 'stacking') {
            if (ensemble.length >= 3) {
                // Draw Stump split
                drawSplitLines(ensemble[0].root, 0, 1, 0, 1);
                
                // Draw Perceptron linear divider
                ctx.save();
                ctx.lineWidth = 1;
                ctx.setLineDash([4, 4]);
                ctx.strokeStyle = 'rgba(140, 107, 18, 0.4)';
                const perc = ensemble[1].weights;
                ctx.beginPath();
                if (Math.abs(perc.wy) > 1e-4) {
                    const y0 = -(perc.wx * 0 + perc.b) / perc.wy;
                    const y1 = -(perc.wx * 1 + perc.b) / perc.wy;
                    ctx.moveTo(0, y0 * canvas.height);
                    ctx.lineTo(canvas.width, y1 * canvas.height);
                } else {
                    const x0 = -perc.b / perc.wx;
                    ctx.moveTo(x0 * canvas.width, 0);
                    ctx.lineTo(x0 * canvas.width, canvas.height);
                }
                ctx.stroke();
                ctx.restore();
                
                // Draw Circle boundary
                ctx.save();
                ctx.lineWidth = 1;
                ctx.setLineDash([4, 4]);
                ctx.strokeStyle = 'rgba(140, 107, 18, 0.4)';
                const circ = ensemble[2].circle;
                ctx.beginPath();
                ctx.arc(circ.cx * canvas.width, circ.cy * canvas.height, circ.radius * canvas.width, 0, 2 * Math.PI);
                ctx.stroke();
                ctx.restore();
            }
        } else {
            ensemble.forEach(est => {
                if (est.root) {
                    drawSplitLines(est.root, 0, 1, 0, 1);
                }
            });
        }
    }
    
    // 4. Draw Data Points (Ink drops)
    points.forEach((p, idx) => {
        const cx = p.x * w;
        const cy = p.y * h;
        
        let radius = 6;
        if (methodSelect.value === 'boosting' && sampleWeights.length === points.length) {
            const normalWeight = 1 / points.length;
            radius = 6 * Math.sqrt(sampleWeights[idx] / normalWeight);
            radius = Math.max(3, Math.min(22, radius));
        }
        
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
        
        if (p.label === 1) { // Red Class
            ctx.fillStyle = '#9e2a2b'; // Vermilion
            ctx.strokeStyle = '#8b0000'; // Dark red border
            ctx.lineWidth = 1.5;
            ctx.fill();
            ctx.stroke();
            
            // Inner shine
            ctx.beginPath();
            ctx.arc(cx - radius * 0.3, cy - radius * 0.3, radius * 0.2, 0, 2 * Math.PI);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.fill();
        } else { // Black Class
            ctx.fillStyle = '#2b2621'; // Charcoal
            ctx.strokeStyle = '#0f172a'; // Black border
            ctx.lineWidth = 1.5;
            ctx.fill();
            ctx.stroke();
            
            // Inner shine
            ctx.beginPath();
            ctx.arc(cx - radius * 0.3, cy - radius * 0.3, radius * 0.2, 0, 2 * Math.PI);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.fill();
        }
        ctx.restore();
    });
    
    dataCounter.innerText = `${points.length} 筆印記`;
}

function updateEstimatorCards() {
    estimatorList.innerHTML = '';
    
    if (ensemble.length === 0) {
        estimatorList.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-folder-open"></i>
                <p>請點擊「單步更新」或新增數據點以觀察弱學習器的組成。</p>
            </div>`;
        return;
    }
    
    const method = methodSelect.value;
    
    if (method === 'voting' || method === 'stacking') {
        const names = ['基底模型 #1: Stump', '基底模型 #2: Linear', '基底模型 #3: Circle'];
        const desc = ['軸向決策單元', '對角感知機分類', '範圍內外圓形分類'];
        for (let i = 0; i < 3; i++) {
            const card = document.createElement('div');
            card.className = 'estimator-card';
            card.innerHTML = `
                <div class="estimator-title">${names[i]}</div>
                <span style="color: var(--text-secondary); margin-bottom: 2px;">${desc[i]}</span>
                <span class="estimator-metric">權重: <strong>1.00</strong></span>
            `;
            estimatorList.appendChild(card);
        }
        if (method === 'stacking' && ensemble.length > 3) {
            const card = document.createElement('div');
            card.className = 'estimator-card';
            card.style.borderColor = 'var(--vermilion)';
            const meta = ensemble[3].meta;
            const featName = ['Stump', 'Linear', 'Circle'][meta.feature];
            card.innerHTML = `
                <div class="estimator-title" style="color: var(--vermilion);">元分類器 (Meta-Stump)</div>
                <span style="color: var(--text-secondary); margin-bottom: 2px;">Meta on predictions</span>
                <span class="estimator-metric">分裂決策: <strong>${featName}</strong></span>
            `;
            estimatorList.appendChild(card);
        }
        return;
    }
    
    ensemble.forEach((est, idx) => {
        const card = document.createElement('div');
        card.className = 'estimator-card';
        
        let metricHTML = '';
        if (method === 'bagging' || method === 'randomforest') {
            metricHTML = `<span class="estimator-metric">樣本: <strong>${est.bootstrapSize}</strong> 點</span>`;
        } else if (method === 'gbdt') {
            metricHTML = `
                <span class="estimator-metric">平均殘差: <strong>${est.error.toFixed(3)}</strong></span>
                <span class="estimator-metric">學習率: <strong>${est.alpha.toFixed(2)}</strong></span>`;
        } else {
            const errorPercent = (est.error * 100).toFixed(1) + '%';
            metricHTML = `
                <span class="estimator-metric">誤差: <strong>${errorPercent}</strong></span>
                <span class="estimator-metric">權重 &alpha;: <strong>${est.alpha.toFixed(2)}</strong></span>`;
        }
        
        let featureText = '葉節點 (Leaf)';
        if (!est.root.isLeaf) {
            featureText = est.root.feature === 0 ? '垂直切割 (X)' : '水平切割 (Y)';
        }
        
        card.innerHTML = `
            <div class="estimator-title">學習器 #${idx + 1}</div>
            <span style="color: var(--text-secondary); margin-bottom: 2px;">${featureText}</span>
            ${metricHTML}
        `;
        estimatorList.appendChild(card);
    });
}

// ----------------------------------------------------
// TAB NAVIGATION LOGIC
// ----------------------------------------------------

function switchTab(tabId) {
    // Remove active class from all tabs & buttons
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    // Add active class to targets
    document.getElementById(tabId + '-tab').classList.add('active');
    
    // Highlight the tab button
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => {
        if (btn.getAttribute('onclick').includes(tabId)) {
            btn.classList.add('active');
        }
    });
    
    // Stop auto demonstration if tab switched away
    if (tabId !== 'playground' && autoTrainInterval) {
        toggleAutoTrain();
    }
    
    // Trigger canvas redraw if going to playground
    if (tabId === 'playground') {
        draw();
    }
}

// ----------------------------------------------------
// DYNAMIC MARKDOWN DOCUMENTS LOADER
// ----------------------------------------------------

function loadDocuments() {
    const readmeContainer = document.getElementById('readme-container');
    const historyContainer = document.getElementById('history-container');
    
    // Helper to render static fallback in case fetch fails (like local file:///)
    const showFallbackMessage = (container, fileName, localLink) => {
        container.innerHTML = `
            <div style="padding: 20px; border: 1px dashed var(--gold-primary); border-radius: 6px; background: rgba(140, 107, 18, 0.05); margin-top: 15px;">
                <h4 style="margin: 0 0 10px 0; color: var(--text-gold);"><i class="fa-solid fa-triangle-exclamation"></i> 本機瀏覽限制說明</h4>
                <p style="margin: 0; font-size: 12.5px; line-height: 1.5; color: var(--text-secondary);">
                    目前偵測到您是直接以本機瀏覽方式 (file:///) 開啟網頁。受限於瀏覽器的安全性限制 (CORS)，網頁無法直接載入外部 Markdown 檔案。
                    <br><br>
                    <strong>解決方案：</strong>
                    <br>
                    1. 點擊此處直接在本機開啟：<a href="${localLink}" target="_blank" style="font-weight: 600;">在瀏覽器讀取 ${fileName}</a>
                    <br>
                    2. 將專案部署/發布到 GitHub Pages 後，網頁即可動態載入並在此渲染。
                </p>
            </div>
        `;
    };

    // Try to fetch README.md
    fetch('./README.md')
        .then(res => {
            if (!res.ok) throw new Error('CORS or file not found');
            return res.text();
        })
        .then(text => {
            readmeContainer.innerHTML = parseSimpleMarkdown(text);
        })
        .catch(err => {
            showFallbackMessage(readmeContainer, 'README.md', './README.md');
        });

    // Try to fetch Ens-his.md
    fetch('./Ens-his.md')
        .then(res => {
            if (!res.ok) throw new Error('CORS or file not found');
            return res.text();
        })
        .then(text => {
            historyContainer.innerHTML = parseSimpleMarkdown(text);
        })
        .catch(err => {
            showFallbackMessage(historyContainer, 'Ens-his.md', './Ens-his.md');
        });
}

// Super simple lightweight Markdown parser for displaying text in container
function parseSimpleMarkdown(md) {
    if (!md) return '';
    let html = md;
    
    // Escape HTML special characters briefly
    html = html
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
        
    // Replace headings
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    
    // Replace blockquotes
    html = html.replace(/^\&gt;\s?(.*$)/gim, '<blockquote>$1</blockquote>');
    
    // Replace bold text
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Replace code blocks
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Replace markdown links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    
    // Replace bullet points (basic)
    html = html.replace(/^\s*\-\s(.*$)/gim, '<li>$1</li>');
    
    // Replace double newlines with paragraph breaks
    html = html.split('\n\n').map(p => {
        if (p.trim().startsWith('<h') || p.trim().startsWith('<li') || p.trim().startsWith('<pre') || p.trim().startsWith('<block')) {
            return p;
        }
        return `<p>${p.replace(/\n/g, '<br>')}</p>`;
    }).join('\n');
    
    return html;
}
