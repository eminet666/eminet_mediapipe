import {
  FaceLandmarker,
  FilesetResolver,
  DrawingUtils
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

const video = document.getElementById("webcam");
const canvas = document.getElementById("outputCanvas");
const ctx = canvas.getContext("2d");
const enableWebcamButton = document.getElementById("webcamButton");

let faceLandmarker = undefined;
let runningMode = "VIDEO";

// 1. Initialisation
const createFaceLandmarker = async () => {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
  );

  faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: "face_landmarker.task",
      delegate: "GPU" // Très important pour le mesh qui demande de la puissance
    },
    outputFaceBlendshapes: true, // Optionnel : permet de détecter les expressions (sourire, clin d'oeil...)
    runningMode: runningMode,
    numFaces: 1
  });

  console.log("Modèle Face Mesh chargé !");
  enableWebcamButton.disabled = false;
  enableWebcamButton.addEventListener("click", enableCam);
};

createFaceLandmarker();

// 2. Activation
function enableCam() {
  if (!faceLandmarker) return;

  const constraints = { video: { width: 640, height: 480 } };

  navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
    video.srcObject = stream;
    video.addEventListener("loadeddata", predictWebcam);
  });
  enableWebcamButton.style.display = "none";
}

let lastVideoTime = -1;
const drawingUtils = new DrawingUtils(ctx);

// 3. Boucle de prédiction
async function predictWebcam() {
  // Sécurité
  if (video.videoWidth === 0 || video.videoHeight === 0) {
    window.requestAnimationFrame(predictWebcam);
    return;
  }
  
  if (canvas.width !== video.videoWidth) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }

  let startTimeMs = performance.now();

  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    
    // DÉTECTION
    const results = faceLandmarker.detectForVideo(video, startTimeMs);

    // DESSIN
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (results.faceLandmarks) {
      for (const landmarks of results.faceLandmarks) {
        
        // A. Dessiner le maillage de la peau (Gris fin)
        drawingUtils.drawConnectors(
          landmarks,
          FaceLandmarker.FACE_LANDMARKS_TESSELATION,
          { color: "#C0C0C070", lineWidth: 1 }
        );

        // B. Dessiner les contours (Yeux, Sourcils, Bouche)
        // Oeil Droit
        drawingUtils.drawConnectors(
          landmarks,
          FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
          { color: "#FF3030" }
        );
        // Sourcil Droit
        drawingUtils.drawConnectors(
          landmarks,
          FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW,
          { color: "#FF3030" }
        );
        // Oeil Gauche
        drawingUtils.drawConnectors(
          landmarks,
          FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
          { color: "#30FF30" }
        );
        // Sourcil Gauche
        drawingUtils.drawConnectors(
          landmarks,
          FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW,
          { color: "#30FF30" }
        );
        // Bouche / Lèvres
        drawingUtils.drawConnectors(
          landmarks,
          FaceLandmarker.FACE_LANDMARKS_LIPS,
          { color: "#E0E0E0" }
        );
         // Contour du visage
         drawingUtils.drawConnectors(
          landmarks,
          FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,
          { color: "#E0E0E0" }
        );
      }
    }
  }
  window.requestAnimationFrame(predictWebcam);
}