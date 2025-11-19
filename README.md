Demo Virtual try on

SmartFit is a browser-based virtual try-on and measurement tool that uses AI pose detection (MoveNet) and computer vision to estimate body measurements and preview clothing digitally.
Built entirely with HTML, CSS, and JavaScript, SmartFit works with any backend (FastAPI, YOLOv8-seg, OpenCV) once integrated.


.AI Body Measurement

.Real-time webcam detection

.Live skeleton tracking (MoveNet)

.Inner outline guide for precise detection

.Automatic measurement extraction:

.Shoulder width

.Torso length

.Arm length

.Leg length



.Virtual Try-On Interface

.Upload user photo

.Upload garment PNG

.Sends data to backend (/upload, /tryon)

.Displays final AI-generated try-on result

.Mock mode for testing without backend


.Modern Aesthetic UI

.Glassmorphism design

.Teal/neon accent theme

.Animated logo + UI transitions

.Clean, responsive layout

.Measurement cards with visual structure


smartfit-frontend
│── index.html
│── styles.css
│── app.js
│── README.md
│── assets/        (optional images/icons)


.Method 1 — VS Code (Recommended)

.Open the folder in VS Code

.Install extension Live Server

.Right-click index.html → Open with Live Server

.Allow camera access when prompted

.SmartFit is now fully functional


.Method 1 — VS Code (Recommended)

.Open the folder in VS Code

.Install extension Live Server

.Right-click index.html → Open with Live Server

.Allow camera access when prompted

.SmartFit is now fully functional


.Backend Integration (FastAPI Template)

.SmartFit expects two endpoints:

.POST /upload

.Uploads user photo + garment PNG.



.Camera Measurement Guide

.For best accuracy:

.Stand inside the inner guide outline

.Keep full body in camera view

.Maintain neutral standing posture

.Use bright, even lighting

.Keep camera at chest height and stable

.SmartFit uses:

.TensorFlow.js

.MoveNet SinglePose

.Custom region-of-interest (ROI) crop

.Skeleton-to-measurement mapping



.Tech Stack

.HTML5

.CSS3 (Glassmorphism, responsive UI)

.JavaScript (Vanilla)

.TensorFlow.js (MoveNet Pose Detection)

.Mock API Support

.Backend-ready (FastAPI + YOLOv8-seg + OpenCV)



.Contributing

.Pull requests are welcome!
.You may contribute:

.UI/UX improvements

.Measurement accuracy enhancements

.Backend integration modules

.Additional garment preview features



