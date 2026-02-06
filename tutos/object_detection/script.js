import {
  ObjectDetector,
  FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

const video = document.getElementById("webcam");
const canvas = document.getElementById("outputCanvas");
const ctx = canvas.getContext("2d");
const enableWebcamButton = document.getElementById("webcamButton");

let objectDetector = undefined;
let runningMode = "VIDEO";

// 1. Initialisation du détecteur
const initializeObjectDetector = async () => {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
  );

  objectDetector = await ObjectDetector.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: "efficientdet_lite0.tflite", // Ton fichier téléchargé
      //   delegate: "GPU" // Utilise la carte graphique si possible (plus rapide)
    },
    scoreThreshold: 0.35, // Seuil de confiance (35%)
    runningMode: runningMode
  });

  console.log("Modèle chargé !");
  enableWebcamButton.disabled = false;
  enableWebcamButton.addEventListener("click", enableCam);
};

initializeObjectDetector();

// 2. Activation Webcam
function enableCam() {
  if (!objectDetector) return;

  const constraints = { video: { width: 640, height: 480 } };

  navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
    video.srcObject = stream;
    video.addEventListener("loadeddata", predictWebcam);
  });
  
  enableWebcamButton.style.display = "none";
}

let lastVideoTime = -1;

// 3. Boucle de détection
async function predictWebcam() {
  // --- CORRECTIF ICI ---
  // Si la vidéo n'a pas encore de dimensions (width ou height = 0), on attend.
  if (video.videoWidth === 0 || video.videoHeight === 0) {
    window.requestAnimationFrame(predictWebcam);
    return;
  }
  // ---------------------

  const startTimeMs = performance.now();

  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    
    // Maintenant c'est sécurisé, on peut détecter
    const detections = objectDetector.detectForVideo(video, startTimeMs);
    displayVideoDetections(detections);
  }

  window.requestAnimationFrame(predictWebcam);
}

// 4. Fonction pour dessiner les boîtes
function displayVideoDetections(result) {
  // On nettoie le canvas de l'image précédente
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // On redimensionne le canvas pour matcher la vidéo si besoin
  if(canvas.width !== video.videoWidth) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
  }

  // Pour chaque objet détecté...
  for (const detection of result.detections) {
    // MediaPipe renvoie une boundingBox
    const { originX, originY, width, height } = detection.boundingBox;
    const category = detection.categories[0];
    
    // 1. Dessiner le rectangle
    ctx.beginPath();
    ctx.rect(originX, originY, width, height);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#00FF00"; // Vert fluo
    ctx.fillStyle = "rgba(0, 255, 0, 0.1)"; // Fond vert transparent
    ctx.stroke();
    ctx.fill();

    // 2. Écrire le texte
    ctx.fillStyle = "#00FF00";
    ctx.font = "16px Arial";
    // On écrit le nom + le score arrondi
    const label = `${category.categoryName} ${Math.round(category.score * 100)}%`;
    ctx.fillText(label, originX, originY - 5);
  }
}