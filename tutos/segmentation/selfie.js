import {
  ImageSegmenter,
  FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

const video = document.getElementById("webcam");
const canvas = document.getElementById("outputCanvas");
const ctx = canvas.getContext("2d");
const enableWebcamButton = document.getElementById("webcamButton");
const beachImage = document.getElementById("beachImage");

let imageSegmenter = undefined;
let runningMode = "VIDEO";
let currentMode = "blur"; // Modes: 'blur', 'color', 'image'

// Pour stocker temporairement les données de l'image
let imageData = undefined; 

// 1. Initialisation
const createImageSegmenter = async () => {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
  );

  imageSegmenter = await ImageSegmenter.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: "selfie_segmenter.tflite",
      delegate: "GPU"
    },
    runningMode: runningMode,
    outputCategoryMask: true, // IMPORTANT : On veut un masque de catégories
    outputConfidenceMasks: false
  });

  console.log("Modèle Segmentation chargé !");
  enableWebcamButton.disabled = false;
  enableWebcamButton.addEventListener("click", enableCam);
};

createImageSegmenter();

// 2. Activation Webcam
function enableCam() {
  if (!imageSegmenter) return;

  const constraints = { video: { width: 640, height: 480 } };

  navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
    video.srcObject = stream;
    video.addEventListener("loadeddata", predictWebcam);
  });
  enableWebcamButton.style.display = "none";
}

// Fonction globale pour changer de mode via les boutons HTML
window.setMode = (mode) => {
    currentMode = mode;
    console.log("Mode changé : " + mode);
};

let lastVideoTime = -1;

// 3. Boucle de prédiction
async function predictWebcam() {
  if (video.videoWidth === 0 || video.videoHeight === 0) {
    window.requestAnimationFrame(predictWebcam);
    return;
  }
  
  if (canvas.width !== video.videoWidth) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    // On prépare un buffer d'image de la taille du canvas
    imageData = ctx.createImageData(canvas.width, canvas.height);
  }

  let startTimeMs = performance.now();

  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    
    // DEMANDE DE SEGMENTATION
    // Note: segmentForVideo appelle une fonction de "callback" quand c'est fini
    imageSegmenter.segmentForVideo(video, startTimeMs, callbackForVideo);
  } else {
      window.requestAnimationFrame(predictWebcam);
  }
}

// 4. Le Callback : C'est ici qu'on reçoit le résultat et qu'on dessine
function callbackForVideo(result) {
    // result.categoryMask est le masque brut
    drawSegmentation(result.categoryMask);
    // On relance la boucle
    window.requestAnimationFrame(predictWebcam);
}


// 5. La magie du dessin
function drawSegmentation(mask) {
    // On dessine la vidéo Webcam par défaut sur tout le canvas
    ctx.globalCompositeOperation = 'source-over';
    
    // Astuce : On dessine d'abord la vidéo brute
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // On récupère les données brutes de l'image qu'on vient de dessiner (pixels RGBA)
    // C'est un peu lourd, mais c'est la méthode la plus simple à comprendre
    const frameData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    
    // On récupère les données du masque (0 = fond, 255 = personne, selon le modèle)
    // Le masque est un Float32Array
    const maskData = mask.getAsFloat32Array();

    // On va modifier imageData (notre image finale) pixel par pixel
    const pixels = imageData.data;

    // Boucle sur tous les pixels
    for (let i = 0; i < maskData.length; i++) {
        const isPerson = maskData[i] < 0.5; // Si > 0.5, c'est probablement une personne
        const index = i * 4; // R, G, B, A

        if (isPerson) {
            // C'est la personne : on garde les pixels de la vidéo
            pixels[index] = frameData[index];     // R
            pixels[index + 1] = frameData[index + 1]; // G
            pixels[index + 2] = frameData[index + 2]; // B
            pixels[index + 3] = 255;              // Alpha (opaque)
        } else {
            // C'est le fond : on applique l'effet choisi
            if (currentMode === 'blur') {
                 // Astuce simple : on garde le pixel vidéo mais on le rendra flou après ? 
                 // Non, pixel par pixel c'est dur. Pour simplifier ici, on met transparent
                 // et on gérera le fond via CSS ou une autre couche.
                 // Mais faisons simple : Gris foncé pour le moment
                 pixels[index] = 50; 
                 pixels[index + 1] = 50; 
                 pixels[index + 2] = 50; 
                 pixels[index + 3] = 255;
            } else if (currentMode === 'color') {
                pixels[index] = 100; // Violet R
                pixels[index + 1] = 0;   // Violet G
                pixels[index + 2] = 200; // Violet B
                pixels[index + 3] = 255;
            } else if (currentMode === 'image') {
                // On met transparent (Alpha = 0)
                // Comme ça on verra ce qu'on dessine SOUS le canvas
                pixels[index] = 0;
                pixels[index + 1] = 0;
                pixels[index + 2] = 0;
                pixels[index + 3] = 0;
            }
        }
    }
    
    // On remet l'image modifiée sur le canvas
    ctx.putImageData(imageData, 0, 0);

    // CAS SPÉCIAL : Si mode 'image'
    if (currentMode === 'image') {
        
        // --- CORRECTIF ICI ---
        // On vérifie si l'image est complètement chargée et valide
        if (beachImage.complete && beachImage.naturalHeight !== 0) {
            ctx.globalCompositeOperation = 'destination-over';
            ctx.drawImage(beachImage, 0, 0, canvas.width, canvas.height);
        } else {
            // Si l'image n'est pas encore là, on met du noir en attendant pour éviter le crash
            console.warn("L'image de fond charge encore...");
            ctx.globalCompositeOperation = 'destination-over';
            ctx.fillStyle = "black";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        // ---------------------
    }
}