import {
  HandLandmarker,
  FilesetResolver,
  DrawingUtils // <--- Nouvel outil pour dessiner facilement
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

const video = document.getElementById("webcam");
const canvas = document.getElementById("outputCanvas");
const ctx = canvas.getContext("2d");
const enableWebcamButton = document.getElementById("webcamButton");

let handLandmarker = undefined;
let runningMode = "VIDEO";

// 1. Initialisation
const createHandLandmarker = async () => {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
  );

  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: "hand_landmarker.task",
      delegate: "GPU"
    },
    runningMode: runningMode,
    numHands: 2 // On veut détecter jusqu'à 2 mains
  });

  console.log("Modèle Mains chargé !");
  enableWebcamButton.disabled = false;
  enableWebcamButton.addEventListener("click", enableCam);
};

createHandLandmarker();

// 2. Activation Webcam
function enableCam() {
  if (!handLandmarker) return;

  const constraints = { video: { width: 640, height: 480 } };

  navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
    video.srcObject = stream;
    video.addEventListener("loadeddata", predictWebcam);
  });
  
  enableWebcamButton.style.display = "none";
}

let lastVideoTime = -1;
// On prépare les outils de dessin
const drawingUtils = new DrawingUtils(ctx);

// 3. Boucle de détection
async function predictWebcam() {
  // --- SÉCURITÉ (le fameux fix du divide by zero) ---
  if (video.videoWidth === 0 || video.videoHeight === 0) {
    window.requestAnimationFrame(predictWebcam);
    return;
  }
  
  // Ajuster la taille du canvas à la vidéo si besoin
  if (canvas.width !== video.videoWidth) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }

  let startTimeMs = performance.now();

  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    
    // DÉTECTION
    const results = handLandmarker.detectForVideo(video, startTimeMs);

    // DESSIN
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (results.landmarks) {
      // Pour chaque main détectée...
      for (const landmarks of results.landmarks) {
        
        // A. Dessiner les liaisons (les os)
        drawingUtils.drawConnectors(
          landmarks,
          HandLandmarker.HAND_CONNECTIONS,
          { color: "#00FF00", lineWidth: 3 }
        );

        // B. Dessiner les points (les articulations)
        drawingUtils.drawLandmarks(landmarks, { 
          color: "#FF0000", 
          lineWidth: 1, 
          radius: 3 
        });
      }
    }
  }

  window.requestAnimationFrame(predictWebcam);
}