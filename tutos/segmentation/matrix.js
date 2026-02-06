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
    // ... À l'intérieur de drawSegmentation ...
    // On récupère le temps actuel pour créer une animation (optionnel)
    const time = Date.now() / 100; 

    for (let i = 0; i < maskData.length; i++) {
        // --- 1. TA CONDITION (Garde celle qui marche chez toi !) ---
        // Si c'était < 0.5 avant, garde < 0.5.
        const isPerson = maskData[i] < 0.5; 
        
        const index = i * 4; // Position dans le tableau RGBA

        if (isPerson) {
            // --- 2. C'EST TOI -> ON CRÉE UN EFFET "HOLOGRAMME" ---
            
            // On calcule la position X et Y du pixel actuel
            // (Utile pour faire des motifs géométriques)
            const y = Math.floor(i / canvas.width);
            
            // Effet "Matrix" / Lignes de balayage
            // On fait des rayures vertes qui bougent
            const isStripe = Math.floor(y / 5 + time) % 2 === 0;

            if (isStripe) {
                pixels[index] = 0;       // Rouge
                pixels[index + 1] = 255; // Vert (Flashy)
                pixels[index + 2] = 0;   // Bleu
                pixels[index + 3] = 200; // Alpha (Un peu transparent)
            } else {
                pixels[index] = 0;       
                pixels[index + 1] = 50;  // Vert foncé
                pixels[index + 2] = 0;   
                pixels[index + 3] = 150; 
            }

        } else {
            // --- 3. C'EST LE FOND -> ON MONTRE LA VRAIE WEBCAM ---
            // C'est ici l'inversion : le fond devient "le réel"
            pixels[index] = frameData[index];
            pixels[index + 1] = frameData[index + 1];
            pixels[index + 2] = frameData[index + 2];
            pixels[index + 3] = 255;
        }
    }
    
    // ... La suite (putImageData) ne change pas ...
    
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