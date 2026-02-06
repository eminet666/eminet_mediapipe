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
  // 1. On nettoie le canvas (pour enlever le flou de la frame précédente)
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const detection of detections) {
    const { originX, originY, width, height } = detection.boundingBox;

    // --- DÉBUT DU FLOUTAGE ---
    
    // On sauvegarde l'état "normal" du canvas avant de faire des modifs bizarres
    ctx.save();

    // 2. On définit la zone de découpe (le "masque")
    ctx.beginPath();
    // On dessine le rectangle du visage
    ctx.rect(originX, originY, width, height);
    // Cette commande dit : "Tout ce que je dessine après ça ne s'affichera QU'À L'INTÉRIEUR de ce rectangle"
    ctx.clip();

    // 3. On applique le filtre de flou
    ctx.filter = "blur(15px)"; // Tu peux augmenter à 20px ou 30px pour plus d'anonymat

    // 4. On dessine l'image de la vidéo PAR-DESSUS elle-même
    // Grâce au .clip(), seule la partie visage sera dessinée (et floutée)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // 5. On restaure l'état normal (pour le prochain visage de la boucle)
    ctx.restore();
    
    // --- FIN DU FLOUTAGE ---


    // (Optionnel) : On peut garder le cadre rouge pour bien voir la zone détectée
    // Si tu veux un effet "Censuré" propre, tu peux supprimer ces 3 lignes
    ctx.beginPath();
    ctx.rect(originX, originY, width, height);
    ctx.strokeStyle = "rgba(255, 0, 0, 0.5)"; // Rouge semi-transparent
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}