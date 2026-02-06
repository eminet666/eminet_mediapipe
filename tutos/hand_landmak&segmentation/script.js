import {
  ImageSegmenter,
  HandLandmarker,
  FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

const video = document.getElementById("webcam");
const canvas = document.getElementById("outputCanvas");
const ctx = canvas.getContext("2d");
const enableWebcamButton = document.getElementById("webcamButton");
const statusText = document.getElementById("status");

let imageSegmenter = undefined;
let handLandmarker = undefined;
let runningMode = "VIDEO";
let lastVideoTime = -1;

// État magique (Activé par la main)
let isMagicActive = false;

// 1. Chargement des DEUX modèles
const loadModels = async () => {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
  );

  // A. Segmentation
  imageSegmenter = await ImageSegmenter.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: "selfie_segmenter.tflite", // Vérifie ce nom !
      delegate: "GPU"
    },
    runningMode: runningMode,
    outputCategoryMask: true,
    outputConfidenceMasks: false
  });

  // B. Mains
  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: "hand_landmarker.task", // Vérifie ce nom !
      delegate: "GPU"
    },
    runningMode: runningMode,
    numHands: 1
  });

  console.log("✅ Tout est chargé !");
  enableWebcamButton.innerText = "ACTIVER LA CAMÉRA";
  enableWebcamButton.disabled = false;
  enableWebcamButton.addEventListener("click", enableCam);
};

loadModels();

// 2. Activation Webcam
function enableCam() {
  if (!imageSegmenter || !handLandmarker) return;

  const constraints = { video: { width: 640, height: 480 } };

  navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
    video.srcObject = stream;
    video.addEventListener("loadeddata", predictWebcam);
  });
  enableWebcamButton.style.display = "none";
}

// 3. Boucle principale (Le Cerveau)
async function predictWebcam() {
  if (video.videoWidth === 0 || video.videoHeight === 0) {
    window.requestAnimationFrame(predictWebcam);
    return;
  }
  
  // Ajuster la taille du canvas si besoin
  if (canvas.width !== video.videoWidth) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }

  let startTimeMs = performance.now();

  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    
    // --- PARTIE 1 : DÉTECTION MAIN ---
    const handResults = handLandmarker.detectForVideo(video, startTimeMs);
    
    if (handResults.landmarks && handResults.landmarks.length > 0) {
        isMagicActive = true;
        statusText.innerText = "✨ MAGIE ACTIVÉE ✨";
    } else {
        isMagicActive = false;
        statusText.innerText = "En attente de main...";
    }

    // --- PARTIE 2 : SEGMENTATION ---
    // On lance la segmentation qui appellera la fonction de dessin
    imageSegmenter.segmentForVideo(video, startTimeMs, callbackForVideo);
    
  } else {
      window.requestAnimationFrame(predictWebcam);
  }
}

// 4. Callback (Réception du masque de découpage)
function callbackForVideo(result) {
    drawCombinedEffect(result.categoryMask);
    window.requestAnimationFrame(predictWebcam);
}

// 5. Dessin final
function drawCombinedEffect(mask) {
    // On dessine d'abord la vidéo brute pour avoir les données de pixels
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Récupération des pixels (Image et Masque)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    const maskData = mask.getAsFloat32Array();

    const time = Date.now() / 50; // Pour l'animation des rayures

    // Boucle sur chaque pixel
    for (let i = 0; i < maskData.length; i++) {
        
        // --- NOTE IMPORTANTE ---
        // Si l'effet est inversé chez toi (fond matrixé et toi normal),
        // change le signe '<' en '>' ci-dessous.
        const isPerson = maskData[i] < 0.5; 
        
        const index = i * 4;

        if (isPerson) {
            // C'est le corps de l'utilisateur
            
            if (isMagicActive) {
                // SI MAIN DÉTECTÉE -> EFFET MATRIX VERT
                const y = Math.floor(i / canvas.width);
                // Rayures mouvantes
                const isStripe = Math.floor(y / 4 + time) % 2 === 0;

                if (isStripe) {
                    pixels[index] = 0;       // R
                    pixels[index + 1] = 255; // G (Vert max)
                    pixels[index + 2] = 0;   // B
                    pixels[index + 3] = 200; // Alpha
                } else {
                    pixels[index] = 0;
                    pixels[index + 1] = 50;  // Vert foncé
                    pixels[index + 2] = 0;
                    pixels[index + 3] = 180;
                }
            } else {
                // SI PAS DE MAIN -> ON LAISSE LA VIDÉO NORMALE
                // On ne touche à rien, les pixels sont déjà ceux de la vidéo
                // (car on a fait ctx.drawImage au début)
            }
        } 
        // Si c'est le fond, on ne touche à rien (on voit ta chambre)
    }

    // On remet l'image modifiée sur le canvas
    ctx.putImageData(imageData, 0, 0);
}