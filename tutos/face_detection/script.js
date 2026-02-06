import {
  FaceDetector,
  FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

const video = document.getElementById("webcam");
const canvas = document.getElementById("outputCanvas");
const ctx = canvas.getContext("2d");
const enableWebcamButton = document.getElementById("webcamButton");

let faceDetector = undefined;
let runningMode = "VIDEO";

// 1. Initialisation
const initializefaceDetector = async () => {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
  );

  faceDetector = await FaceDetector.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: "blaze_face_short_range.tflite",
      delegate: "GPU"
    },
    runningMode: runningMode,
    minDetectionConfidence: 0.5 // Il faut être sûr à 50% que c'est un visage
  });

  console.log("Modèle Visage chargé !");
  enableWebcamButton.disabled = false;
  enableWebcamButton.addEventListener("click", enableCam);
};

initializefaceDetector();

// 2. Activation Webcam
function enableCam() {
  if (!faceDetector) return;

  const constraints = { video: { width: 640, height: 480 } };

  navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
    video.srcObject = stream;
    video.addEventListener("loadeddata", predictWebcam);
  });
  
  enableWebcamButton.style.display = "none";
}

let lastVideoTime = -1;

// 3. Boucle de prédiction
async function predictWebcam() {
  // Sécurité anti-crash
  if (video.videoWidth === 0 || video.videoHeight === 0) {
    window.requestAnimationFrame(predictWebcam);
    return;
  }
  
  // Redimensionnement dynamique du canvas
  if (canvas.width !== video.videoWidth) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }

  const startTimeMs = performance.now();

  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    
    // DÉTECTION
    const detections = faceDetector.detectForVideo(video, startTimeMs);

    // DESSIN
    // detections.detections est un tableau (s'il y a plusieurs visages)
    displayVideoDetections(detections.detections);
  }

  window.requestAnimationFrame(predictWebcam);
}

// 4. Fonction de dessin
function displayVideoDetections(detections) {
  // On efface tout
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const detection of detections) {
    // A. Le Cadre (Bounding Box)
    const { originX, originY, width, height } = detection.boundingBox;
    
    ctx.beginPath();
    ctx.rect(originX, originY, width, height);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#FF0000"; // Rouge
    ctx.stroke();

    // B. Les 6 Points Clés (Yeux, Nez, Bouche, Oreilles)
    // detection.keypoints contient 6 points précis
    ctx.fillStyle = "#00FF00"; // Vert
    
    for (const keypoint of detection.keypoints) {
        ctx.beginPath();
        // On dessine un petit cercle pour chaque point
        ctx.arc(keypoint.x * canvas.width, keypoint.y * canvas.height, 4, 0, 2 * Math.PI);
        ctx.fill();
    }
  }
}