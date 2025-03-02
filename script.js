// Global variables for video and detection
let prevFrame = null;
let streaming = false;
let lastMotionTime = 0; // Timestamp to throttle Telegram alerts

// DOM elements
const video = document.getElementById('videoElement');
const canvas = document.getElementById('canvasOutput');
const sensitivitySlider = document.getElementById('sensitivityRange');
const toggleDetection = document.getElementById('toggleDetection');
const telegramTokenInput = document.getElementById('telegramToken');
const telegramChatIdInput = document.getElementById('telegramChatId');
const statusMessage = document.getElementById('statusMessage');

// Start capturing video from the webcam
function startCamera() {
  navigator.mediaDevices.getUserMedia({ video: true, audio: false })
    .then(function(stream) {
      video.srcObject = stream;
      video.play();
    })
    .catch(function(err) {
      console.error("An error occurred: " + err);
    });
}

// Once the video element is ready, set the canvas size and start processing
video.addEventListener('canplay', function() {
  if (!streaming) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    streaming = true;
    startProcessing();
  }
}, false);

// Main processing function: uses OpenCV.js for motion detection
function startProcessing() {
  // Create OpenCV Mats to hold frame data
  let src = new cv.Mat(video.videoHeight, video.videoWidth, cv.CV_8UC4);
  let gray = new cv.Mat();
  let diff = new cv.Mat();
  let cap = new cv.VideoCapture(video);
  
  const FPS = 10; // Process 10 frames per second

  function processVideo() {
    if (!streaming) {
      // Cleanup if streaming stops
      src.delete(); gray.delete(); diff.delete();
      return;
    }
    
    // Capture current frame from the video element
    cap.read(src);
    // Convert frame to grayscale
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    
    // If no previous frame exists, clone the current frame
    if (prevFrame === null) {
      prevFrame = gray.clone();
    }
    
    // Compute the absolute difference between the current and previous frames
    cv.absdiff(gray, prevFrame, diff);
    // Apply threshold based on the sensitivity slider value
    cv.threshold(diff, diff, Number(sensitivitySlider.value), 255, cv.THRESH_BINARY);
    
    // Count the number of non-zero pixels (i.e. motion pixels)
    let nonZero = cv.countNonZero(diff);
    let totalPixels = diff.rows * diff.cols;
    let motionPercentage = (nonZero / totalPixels) * 100;
    
    // Update status message with current motion percentage
    statusMessage.innerHTML = `Motion: ${motionPercentage.toFixed(2)}%`;
    
    // If motion detection is enabled and motion exceeds a threshold, send an alert
    if (toggleDetection.checked && motionPercentage > 5) {
      let now = Date.now();
      // Limit alerts to one every 10 seconds
      if (now - lastMotionTime > 10000) {
        lastMotionTime = now;
        sendTelegramAlert(motionPercentage);
      }
    }
    
    // (Optional) Uncomment the next line to display the processed (difference) frame on the canvas for debugging
    // cv.imshow('canvasOutput', diff);
    
    // Update the previous frame for the next iteration
    prevFrame.delete();
    prevFrame = gray.clone();
    
    // Schedule the next frame processing
    setTimeout(processVideo, 1000 / FPS);
  }
  
  processVideo();
}

// Function to send a motion alert to Telegram using the Bot API
function sendTelegramAlert(motionPercentage) {
  const token = telegramTokenInput.value.trim();
  const chatId = telegramChatIdInput.value.trim();
  
  if (!token || !chatId) {
    console.log("Telegram token or chat ID not set.");
    return;
  }
  
  const message = `Motion detected: ${motionPercentage.toFixed(2)}%`;
  const url = `https://api.telegram.org/bot${token}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(message)}`;
  
  fetch(url)
    .then(response => response.json())
    .then(data => {
      console.log("Telegram alert sent:", data);
    })
    .catch(error => {
      console.error("Error sending Telegram alert:", error);
    });
}

// Login functionality: simple password check before showing the motion detection interface
document.getElementById('loginBtn').addEventListener('click', function() {
  const password = document.getElementById('passwordInput').value;
  if (password === 'admin123') {  // Replace with your desired password
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('motionSection').style.display = 'block';
    
    // Wait for OpenCV.js to initialize before starting the camera
    if (cv.getBuildInformation) {
      startCamera();
    } else {
      cv['onRuntimeInitialized'] = () => {
        startCamera();
      }
    }
  } else {
    document.getElementById('loginError').innerHTML = 'Incorrect password!';
  }
});

// Optional: Update settings button to notify the user that settings have been updated
document.getElementById('updateSettings').addEventListener('click', function() {
  statusMessage.innerHTML = 'Settings updated. Motion detection running...';
});
