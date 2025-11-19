// SmartFit Camera Implementation - Complete & Fixed
let stream = null;
let detector = null;
let isDetecting = false;
let animationFrameId = null;
let capturedImage = null;
let lastDetectedPose = null; // Store last detected pose for measurements

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
});

function initializeApp() {
  // DOM elements
  const video = document.getElementById('camera-video');
  const canvas = document.getElementById('overlay-canvas');
  const ctx = canvas.getContext('2d');
  const openCameraBtn = document.getElementById('open-camera-btn');
  const captureBtn = document.getElementById('capture-btn');
  const closeCameraBtn = document.getElementById('close-camera-btn');
  const captureStatus = document.getElementById('capture-status');
  const scanOutput = document.getElementById('scan-output');
  const measurementsList = document.getElementById('measurements-list');
  const exportJsonBtn = document.getElementById('export-json');
  const retakeBtn = document.getElementById('retake');
  const uploadBtn = document.getElementById('upload-btn');
  const resetBtn = document.getElementById('reset-btn');
  const userFile = document.getElementById('user-file');
  const garmentFile = document.getElementById('garment-file');
  const userPreview = document.getElementById('user-preview-inner');
  const garmentPreview = document.getElementById('garment-preview-inner');
  const resultImg = document.getElementById('result-img');
  const resultPlaceholder = document.getElementById('result-placeholder');
  const downloadResult = document.getElementById('download-result');
  const openResult = document.getElementById('open-result');
  const guide = document.getElementById('guide');
  const cameraHint = document.getElementById('camera-hint');

  // Initialize canvas size
  function resizeCanvas() {
    if (video.videoWidth && video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    } else {
      // Fallback to video element size
      const rect = video.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    }
  }

  // Update canvas when video dimensions change
  function updateCanvasSize() {
    if (video.videoWidth && video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
  }

  // Open camera
  async function openCamera() {
    try {
      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not supported in this browser');
      }

      // Request camera access
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user', // Front camera
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      // Set video source
      video.srcObject = stream;
      
      // Wait for video to be ready
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.error('Error playing video:', error);
        });
      }

      // Update canvas when video metadata loads
      video.addEventListener('loadedmetadata', () => {
        updateCanvasSize();
        
        // Show guide outline
        if (guide) {
          guide.classList.add('active');
        }
        
        // Update UI
        openCameraBtn.style.display = 'none';
        captureBtn.disabled = false;
        closeCameraBtn.style.display = 'inline-block';
        captureStatus.textContent = 'Camera ready';
        captureStatus.style.color = '#2c5282';
        
        // Initialize pose detector (optional)
        initPoseDetector();
      }, { once: true });

      // Handle video playing
      video.addEventListener('playing', () => {
        updateCanvasSize();
      });
      
    } catch (error) {
      console.error('Error accessing camera:', error);
      captureStatus.textContent = 'Camera access denied. Please allow camera permissions.';
      captureStatus.style.color = '#ff6b6b';
      
      // Show helpful error message
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        alert('Camera permission denied. Please allow camera access in your browser settings and reload the page.');
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        alert('No camera found. Please connect a camera device.');
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        alert('Camera is already in use by another application.');
      } else {
        alert('Error accessing camera: ' + error.message);
      }
    }
  }

  // Initialize pose detector (optional feature)
  async function initPoseDetector() {
    try {
      // Check if TensorFlow and pose detection are available
      if (typeof poseDetection !== 'undefined' && typeof tf !== 'undefined') {
        const model = poseDetection.SupportedModels.MoveNet;
        const detectorConfig = {
          modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
          enableSmoothing: true,
        };
        detector = await poseDetection.createDetector(model, detectorConfig);
        startPoseDetection();
      }
    } catch (error) {
      console.warn('Pose detection not available:', error);
      // Continue without pose detection
    }
  }

  // Start pose detection loop
  async function startPoseDetection() {
    if (!detector || isDetecting) return;
    
    isDetecting = true;
    
    async function detectPose() {
      if (!isDetecting || !detector || video.readyState !== video.HAVE_ENOUGH_DATA) {
        if (isDetecting) {
          animationFrameId = requestAnimationFrame(detectPose);
        }
        return;
      }
      
    try {
      const poses = await detector.estimatePoses(video);
      // Store the latest pose for measurement calculation
      if (poses && poses.length > 0) {
        lastDetectedPose = poses[0];
      }
      drawPose(poses);
    } catch (error) {
      console.warn('Pose detection error:', error);
    }
      
      if (isDetecting) {
        animationFrameId = requestAnimationFrame(detectPose);
      }
    }
    
    detectPose();
  }

  // Check if pose fits within guide outline
  function checkPoseFit(keypoints) {
    if (!keypoints || keypoints.length === 0 || !guide) return false;
    
    // Get guide bounds (center 75% width of canvas)
    const guideWidth = canvas.width * 0.75;
    const guideHeight = canvas.height * 0.85; // Approximate guide height
    const guideLeft = (canvas.width - guideWidth) / 2;
    const guideRight = guideLeft + guideWidth;
    const guideTop = (canvas.height - guideHeight) / 2;
    const guideBottom = guideTop + guideHeight;
    
    // Check key body points
    const importantPoints = [
      'nose', 'left_shoulder', 'right_shoulder', 
      'left_hip', 'right_hip', 'left_ankle', 'right_ankle'
    ];
    
    let pointsInBounds = 0;
    let totalPoints = 0;
    
    importantPoints.forEach(pointName => {
      const kp = keypoints.find(kp => kp && kp.name === pointName);
      if (kp && kp.score > 0.3) {
        totalPoints++;
        // Check if point is within guide bounds (with some margin)
        const margin = guideWidth * 0.1;
        if (kp.x >= guideLeft - margin && kp.x <= guideRight + margin &&
            kp.y >= guideTop - margin && kp.y <= guideBottom + margin) {
          pointsInBounds++;
        }
      }
    });
    
    // Consider fit if at least 70% of detected points are within bounds
    return totalPoints > 0 && (pointsInBounds / totalPoints) >= 0.7;
  }

  // Draw pose skeleton on canvas
  function drawPose(poses) {
    if (!poses || poses.length === 0) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Reset guide state if no pose detected
      if (guide) {
        guide.classList.remove('fit', 'out-of-bounds');
      }
      if (cameraHint) {
        cameraHint.textContent = 'Center your body within the guide';
      }
      return;
    }
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const pose = poses[0];
    const keypoints = pose.keypoints;
    
    if (!keypoints || keypoints.length === 0) return;
    
    // Check if pose fits within guide
    const fitsInGuide = checkPoseFit(keypoints);
    
    // Update guide visual feedback
    if (guide) {
      guide.classList.remove('fit', 'out-of-bounds');
      if (fitsInGuide) {
        guide.classList.add('fit');
        if (cameraHint) {
          cameraHint.textContent = '✓ Perfect position!';
          cameraHint.style.color = '#2c5282';
        }
      } else {
        guide.classList.add('out-of-bounds');
        if (cameraHint) {
          cameraHint.textContent = 'Move to center within the guide';
          cameraHint.style.color = '#ff6b6b';
        }
      }
    }
    
    // Draw keypoints
    ctx.fillStyle = fitsInGuide ? '#2c5282' : '#1e3a5f';
    keypoints.forEach(kp => {
      if (kp && kp.score > 0.3) {
        ctx.beginPath();
        ctx.arc(kp.x, kp.y, 4, 0, 2 * Math.PI);
        ctx.fill();
      }
    });
    
    // Draw skeleton connections
    const connections = [
      ['left_shoulder', 'right_shoulder'],
      ['left_shoulder', 'left_elbow'],
      ['left_elbow', 'left_wrist'],
      ['right_shoulder', 'right_elbow'],
      ['right_elbow', 'right_wrist'],
      ['left_shoulder', 'left_hip'],
      ['right_shoulder', 'right_hip'],
      ['left_hip', 'right_hip'],
      ['left_hip', 'left_knee'],
      ['left_knee', 'left_ankle'],
      ['right_hip', 'right_knee'],
      ['right_knee', 'right_ankle'],
    ];
    
    ctx.strokeStyle = fitsInGuide ? 'rgba(44, 82, 130, 0.6)' : 'rgba(30, 58, 95, 0.6)';
    ctx.lineWidth = 2;
    
    connections.forEach(([start, end]) => {
      const startKp = keypoints.find(kp => kp && kp.name === start);
      const endKp = keypoints.find(kp => kp && kp.name === end);
      
      if (startKp && endKp && startKp.score > 0.3 && endKp.score > 0.3) {
        ctx.beginPath();
        ctx.moveTo(startKp.x, startKp.y);
        ctx.lineTo(endKp.x, endKp.y);
        ctx.stroke();
      }
    });
  }

  // Capture photo and estimate measurements
  async function capturePhoto() {
    if (!stream || video.readyState !== video.HAVE_ENOUGH_DATA) {
      captureStatus.textContent = 'Camera not ready';
      captureStatus.style.color = '#ff6b6b';
      return;
    }
    
    try {
      // Create a temporary canvas to capture the frame
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = video.videoWidth || canvas.width;
      tempCanvas.height = video.videoHeight || canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
      
      // Store captured image
      capturedImage = tempCanvas.toDataURL('image/png');
      
      // Stop pose detection
      isDetecting = false;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Hide guide during capture
      if (guide) {
        guide.classList.remove('active', 'fit', 'out-of-bounds');
      }
      
      // Get final pose detection for accurate measurements
      let finalPose = null;
      if (detector) {
        try {
          const poses = await detector.estimatePoses(video);
          if (poses && poses.length > 0) {
            finalPose = poses[0];
          }
        } catch (error) {
          console.warn('Final pose detection error:', error);
          // Fallback to last detected pose
          finalPose = lastDetectedPose;
        }
      }
      
      // Estimate measurements using pose detection
      const measurements = estimateMeasurements(tempCanvas, finalPose);
      
      // Display measurements
      displayMeasurements(measurements);
      scanOutput.style.display = 'block';
      
      captureStatus.textContent = 'Capture successful!';
      captureStatus.style.color = '#2c5282';
      
    } catch (error) {
      console.error('Capture error:', error);
      captureStatus.textContent = 'Capture failed: ' + error.message;
      captureStatus.style.color = '#ff6b6b';
    }
  }

  // Calculate distance between two keypoints in pixels
  function calculateDistance(kp1, kp2) {
    if (!kp1 || !kp2 || kp1.score < 0.3 || kp2.score < 0.3) return null;
    const dx = kp2.x - kp1.x;
    const dy = kp2.y - kp1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Get keypoint by name
  function getKeypoint(keypoints, name) {
    return keypoints.find(kp => kp && kp.name === name && kp.score > 0.3);
  }

  // Estimate measurements from captured image using pose detection
  function estimateMeasurements(canvas, pose) {
    const measurements = {};
    
    // If no pose detected, return estimated values based on image
    if (!pose || !pose.keypoints || pose.keypoints.length === 0) {
      const height = canvas.height;
      const width = canvas.width;
      return {
        'Height': `${Math.round(height * 0.01)} cm (estimated)`,
        'Shoulder Width': `${Math.round(width * 0.18)} cm (estimated)`,
        'Chest': `${Math.round(width * 0.15)} cm (estimated)`,
        'Waist': `${Math.round(width * 0.12)} cm (estimated)`,
        'Hips': `${Math.round(width * 0.14)} cm (estimated)`,
        'Arm Length': `${Math.round(height * 0.25)} cm (estimated)`,
        'Leg Length': `${Math.round(height * 0.35)} cm (estimated)`,
      };
    }

    const keypoints = pose.keypoints;
    
    // Get key body points
    const nose = getKeypoint(keypoints, 'nose');
    const leftShoulder = getKeypoint(keypoints, 'left_shoulder');
    const rightShoulder = getKeypoint(keypoints, 'right_shoulder');
    const leftElbow = getKeypoint(keypoints, 'left_elbow');
    const rightElbow = getKeypoint(keypoints, 'right_elbow');
    const leftWrist = getKeypoint(keypoints, 'left_wrist');
    const rightWrist = getKeypoint(keypoints, 'right_wrist');
    const leftHip = getKeypoint(keypoints, 'left_hip');
    const rightHip = getKeypoint(keypoints, 'right_hip');
    const leftKnee = getKeypoint(keypoints, 'left_knee');
    const rightKnee = getKeypoint(keypoints, 'right_knee');
    const leftAnkle = getKeypoint(keypoints, 'left_ankle');
    const rightAnkle = getKeypoint(keypoints, 'right_ankle');

    // Calculate pixel-to-cm conversion factor
    // Use average human proportions: typical height is ~170cm, and we estimate from image
    // We'll use the detected body height as reference
    let pixelToCm = 0.1; // Default fallback
    
    // Calculate full body height in pixels (from top of head to bottom of feet)
    const topPoint = nose || (leftShoulder && rightShoulder ? 
      { y: Math.min(leftShoulder.y, rightShoulder.y) - 20 } : null);
    const bottomPoint = (leftAnkle && rightAnkle) ? 
      { y: Math.max(leftAnkle.y, rightAnkle.y) } : 
      (leftKnee && rightKnee ? { y: Math.max(leftKnee.y, rightKnee.y) + 50 } : null);
    
    if (topPoint && bottomPoint) {
      const bodyHeightPixels = bottomPoint.y - topPoint.y;
      
      // Calibration: Use detected body proportions to estimate scale
      // For better accuracy, we can use anthropometric averages
      // Average human head-to-body ratio is approximately 1:7.5 to 1:8
      // We'll use a dynamic calibration based on detected keypoints
      
      // Try to get a more accurate scale using known body proportions
      // Average shoulder-to-hip distance helps calibrate
      let calibrationFactor = 0.12; // Default pixel-to-cm ratio
      
      if (leftShoulder && leftHip) {
        const shoulderToHipPixels = Math.abs(leftHip.y - leftShoulder.y);
        // Average shoulder-to-hip distance is approximately 40-50cm
        const avgShoulderToHip = 45; // cm
        const calculatedFactor = avgShoulderToHip / shoulderToHipPixels;
        if (calculatedFactor > 0.05 && calculatedFactor < 0.3) {
          calibrationFactor = calculatedFactor;
        }
      }
      
      // Use the more accurate calibration
      pixelToCm = calibrationFactor;
      
      // Calculate actual height using calibrated factor
      const heightCm = bodyHeightPixels * pixelToCm;
      measurements['Height'] = `${Math.round(heightCm)} cm`;
    } else {
      measurements['Height'] = `${Math.round(canvas.height * 0.01)} cm (estimated)`;
    }

    // Shoulder Width
    if (leftShoulder && rightShoulder) {
      const shoulderWidthPixels = calculateDistance(leftShoulder, rightShoulder);
      if (shoulderWidthPixels) {
        const shoulderWidthCm = shoulderWidthPixels * pixelToCm;
        measurements['Shoulder Width'] = `${Math.round(shoulderWidthCm)} cm`;
      }
    } else {
      measurements['Shoulder Width'] = `${Math.round(canvas.width * 0.18)} cm (estimated)`;
    }

    // Chest (approximate - between shoulders and hips, at nipple level)
    if (leftShoulder && rightShoulder && leftHip && rightHip) {
      const chestY = leftShoulder.y + (leftHip.y - leftShoulder.y) * 0.4;
      // Estimate chest width as slightly wider than shoulder width
      const chestWidthPixels = calculateDistance(leftShoulder, rightShoulder) * 1.15;
      if (chestWidthPixels) {
        const chestCm = chestWidthPixels * pixelToCm;
        measurements['Chest'] = `${Math.round(chestCm)} cm`;
      }
    } else {
      measurements['Chest'] = `${Math.round(canvas.width * 0.15)} cm (estimated)`;
    }

    // Waist (at hip level, typically narrower than chest)
    if (leftHip && rightHip) {
      const waistWidthPixels = calculateDistance(leftHip, rightHip) * 0.85;
      if (waistWidthPixels) {
        const waistCm = waistWidthPixels * pixelToCm;
        measurements['Waist'] = `${Math.round(waistCm)} cm`;
      }
    } else {
      measurements['Waist'] = `${Math.round(canvas.width * 0.12)} cm (estimated)`;
    }

    // Hips (at hip level, typically wider than waist)
    if (leftHip && rightHip) {
      const hipsWidthPixels = calculateDistance(leftHip, rightHip) * 1.1;
      if (hipsWidthPixels) {
        const hipsCm = hipsWidthPixels * pixelToCm;
        measurements['Hips'] = `${Math.round(hipsCm)} cm`;
      }
    } else {
      measurements['Hips'] = `${Math.round(canvas.width * 0.14)} cm (estimated)`;
    }

    // Arm Length (shoulder to wrist)
    let armLengths = [];
    if (leftShoulder && leftWrist) {
      const leftArmPixels = calculateDistance(leftShoulder, leftWrist);
      if (leftArmPixels) armLengths.push(leftArmPixels);
    }
    if (rightShoulder && rightWrist) {
      const rightArmPixels = calculateDistance(rightShoulder, rightWrist);
      if (rightArmPixels) armLengths.push(rightArmPixels);
    }
    
    if (armLengths.length > 0) {
      const avgArmPixels = armLengths.reduce((a, b) => a + b, 0) / armLengths.length;
      const armCm = avgArmPixels * pixelToCm;
      measurements['Arm Length'] = `${Math.round(armCm)} cm`;
    } else {
      measurements['Arm Length'] = `${Math.round(canvas.height * 0.25)} cm (estimated)`;
    }

    // Leg Length (hip to ankle)
    let legLengths = [];
    if (leftHip && leftAnkle) {
      const leftLegPixels = calculateDistance(leftHip, leftAnkle);
      if (leftLegPixels) legLengths.push(leftLegPixels);
    }
    if (rightHip && rightAnkle) {
      const rightLegPixels = calculateDistance(rightHip, rightAnkle);
      if (rightLegPixels) legLengths.push(rightLegPixels);
    }
    
    if (legLengths.length > 0) {
      const avgLegPixels = legLengths.reduce((a, b) => a + b, 0) / legLengths.length;
      const legCm = avgLegPixels * pixelToCm;
      measurements['Leg Length'] = `${Math.round(legCm)} cm`;
    } else {
      measurements['Leg Length'] = `${Math.round(canvas.height * 0.35)} cm (estimated)`;
    }

    return measurements;
  }

  // Display measurements in the UI
  function displayMeasurements(measurements) {
    measurementsList.innerHTML = '';
    
    Object.entries(measurements).forEach(([name, value]) => {
      const card = document.createElement('div');
      card.className = 'measurement-card';
      card.innerHTML = `
        <div class="measurement-name">${name}</div>
        <div class="measurement-value">${value}</div>
      `;
      measurementsList.appendChild(card);
    });
  }

  // Close camera
  function closeCamera() {
    // Stop all tracks
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    
    // Clear video
    video.srcObject = null;
    
    // Stop pose detection
    isDetecting = false;
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Hide guide outline
    if (guide) {
      guide.classList.remove('active', 'fit', 'out-of-bounds');
    }
    if (cameraHint) {
      cameraHint.textContent = 'Center your body within the guide';
      cameraHint.style.color = '';
    }
    
    // Reset UI
    openCameraBtn.style.display = 'inline-block';
    captureBtn.disabled = true;
    closeCameraBtn.style.display = 'none';
    captureStatus.textContent = '';
    scanOutput.style.display = 'none';
  }

  // Export measurements as JSON
  function exportMeasurements() {
    const measurements = {};
    const cards = measurementsList.querySelectorAll('.measurement-card');
    
    if (cards.length === 0) {
      alert('No measurements to export');
      return;
    }
    
    cards.forEach(card => {
      const nameEl = card.querySelector('.measurement-name');
      const valueEl = card.querySelector('.measurement-value');
      if (nameEl && valueEl) {
        measurements[nameEl.textContent] = valueEl.textContent;
      }
    });
    
    const json = JSON.stringify(measurements, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'smartfit-measurements.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Retake photo
  function retakePhoto() {
    scanOutput.style.display = 'none';
    capturedImage = null;
    if (stream) {
      // Show guide again
      if (guide) {
        guide.classList.add('active');
      }
      // Resume pose detection if camera is still open
      if (detector && !isDetecting) {
        startPoseDetection();
      }
      captureStatus.textContent = 'Camera ready';
      captureStatus.style.color = '#2c5282';
    } else {
      openCamera();
    }
  }

  // Handle file uploads
  function handleUserFile(e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        userPreview.innerHTML = `<img src="${event.target.result}" style="width:100%;height:100%;object-fit:cover;" />`;
        userPreview.classList.remove('preview-empty');
      };
      reader.readAsDataURL(file);
    }
  }

  function handleGarmentFile(e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        garmentPreview.innerHTML = `<img src="${event.target.result}" style="width:100%;height:100%;object-fit:cover;" />`;
        garmentPreview.classList.remove('preview-empty');
      };
      reader.readAsDataURL(file);
    }
  }

  // Upload and process
  async function handleUpload() {
    const userFileInput = userFile.files[0];
    const garmentFileInput = garmentFile.files[0];
    
    if (!userFileInput && !capturedImage) {
      alert('Please capture a photo or upload a user image first');
      return;
    }
    
    if (!garmentFileInput) {
      alert('Please upload a garment image');
      return;
    }
    
    // Show loading state
    resultPlaceholder.textContent = 'Processing...';
    resultPlaceholder.style.display = 'block';
    resultImg.style.display = 'none';
    downloadResult.style.display = 'none';
    openResult.style.display = 'none';
    
    try {
      // Mock API call - in real app, this would call your backend
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // For demo, just show the user image
      const imageToShow = capturedImage || (userFileInput ? await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(userFileInput);
      }) : null);
      
      if (imageToShow) {
        resultImg.src = imageToShow;
        resultImg.style.display = 'block';
        resultPlaceholder.style.display = 'none';
        downloadResult.href = imageToShow;
        downloadResult.download = 'smartfit-result.png';
        downloadResult.style.display = 'inline-block';
        openResult.style.display = 'inline-block';
      }
    } catch (error) {
      console.error('Upload error:', error);
      resultPlaceholder.textContent = 'Processing failed. Please try again.';
      alert('Error processing images: ' + error.message);
    }
  }

  // Reset all
  function handleReset() {
    // Reset file inputs
    userFile.value = '';
    garmentFile.value = '';
    userPreview.innerHTML = 'User';
    userPreview.classList.add('preview-empty');
    garmentPreview.innerHTML = 'Garment';
    garmentPreview.classList.add('preview-empty');
    
    // Reset result
    resultImg.src = '';
    resultImg.style.display = 'none';
    resultPlaceholder.textContent = 'No result';
    resultPlaceholder.style.display = 'block';
    downloadResult.style.display = 'none';
    openResult.style.display = 'none';
    
    // Reset captured image
    capturedImage = null;
    
    // Close camera if open
    if (stream) {
      closeCamera();
    }
  }

  // Open result in new window
  function handleOpenResult() {
    if (resultImg.src) {
      window.open(resultImg.src, '_blank');
    }
  }

  // Event listeners
  openCameraBtn.addEventListener('click', openCamera);
  captureBtn.addEventListener('click', capturePhoto);
  closeCameraBtn.addEventListener('click', closeCamera);
  exportJsonBtn.addEventListener('click', exportMeasurements);
  retakeBtn.addEventListener('click', retakePhoto);
  userFile.addEventListener('change', handleUserFile);
  garmentFile.addEventListener('change', handleGarmentFile);
  uploadBtn.addEventListener('click', handleUpload);
  resetBtn.addEventListener('click', handleReset);
  openResult.addEventListener('click', handleOpenResult);

  // Handle page unload
  window.addEventListener('beforeunload', () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
  });

  // Initialize canvas on load
  resizeCanvas();
  
  // Handle window resize
  window.addEventListener('resize', () => {
    if (video.videoWidth && video.videoHeight) {
      updateCanvasSize();
    }
  });
}
