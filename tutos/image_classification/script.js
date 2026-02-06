// 1. Importation des classes nécessaires depuis le CDN de MediaPipe
import {
  ImageClassifier,
  FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

// Récupération des éléments du DOM
const video = document.getElementById("webcam");
const textOutput = document.getElementById("predictionResult");
const enableWebcamButton = document.getElementById("webcamButton");

let imageClassifier = undefined;
let runningMode = "VIDEO"; // Nous travaillons sur un flux vidéo, pas une image fixe

// 2. Fonction d'initialisation du modèle
const createImageClassifier = async () => {
  // Le FilesetResolver charge les fichiers WebAssembly (WASM) nécessaires au moteur
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
  );

  // Configuration et chargement du classificateur
  imageClassifier = await ImageClassifier.createFromOptions(vision, {
    baseOptions: {
      // Chemin vers le modèle que tu as téléchargé (ou une URL directe)
        modelAssetPath: "efficientnet_lite0.tflite" 
    //   modelAssetPath: "classifier_birds_V1.tflite"
    },
    runningMode: runningMode,
    maxResults: 1, // On veut juste le résultat le plus probable
    scoreThreshold: 0.5 // Afficher seulement si la certitude est > 50%
  });
  
  console.log("Modèle chargé !");
  // On débloque le bouton une fois le modèle prêt
  enableWebcamButton.disabled = false;
  enableWebcamButton.addEventListener("click", enableCam);
};

// Appel de l'initialisation au chargement de la page
createImageClassifier();


// 3. Fonction pour activer la webcam
function enableCam() {
  if (!imageClassifier) {
    console.log("Attendez que le modèle soit chargé");
    return;
  }

  // Paramètres de la caméra
  const constraints = {
    video: { width: 640, height: 480 }
  };

  // Demande d'accès à la caméra
  navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
    video.srcObject = stream;
    video.addEventListener("loadeddata", predictWebcam);
  });
  
  // On cache le bouton après activation
  enableWebcamButton.style.display = "none";
}

// 4. Boucle de prédiction en temps réel
async function predictWebcam() {
  // Si la vidéo est en cours de lecture
  if (runningMode === "IMAGE") {
    runningMode = "VIDEO";
    await imageClassifier.setOptions({ runningMode: "VIDEO" });
  }

  // Faire la prédiction sur l'instant T (video.currentTime)
  const startTimeMs = performance.now();
  
  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    
    // C'EST ICI QUE LA CLASSIFICATION SE FAIT
    const classificationResult = imageClassifier.classifyForVideo(video, startTimeMs);
    
    // Affichage du résultat
    displayVideoClassifications(classificationResult);
  }

  // Relancer la fonction à la prochaine frame
  window.requestAnimationFrame(predictWebcam);
}

let lastVideoTime = -1;

// 5. Affichage des résultats
function displayVideoClassifications(result) {
  // result.classifications[0].categories contient la liste des objets détectés
  if (result.classifications.length > 0) {
    const category = result.classifications[0].categories[0];
    
    if (category) {
      const birdName = category.categoryName;
      const score = Math.round(category.score * 100);
      textOutput.innerText = `C'est un(e) : ${birdName} (${score}%)`;
    } else {
        textOutput.innerText = "Je ne suis pas sûr...";
    }
  }
}