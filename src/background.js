import "babel-polyfill";
import { load } from "@teachablemachine/image";
import {
  TMMODEL_URL,
  CAM_ACCESS,
  CANVAS_WIDTH,
  PAGE_LOADED,
  WELCOME_PAGE,
  CANVAS_HEIGHT,
  PREDICTION,
  MODEL_EXT,
  METADATA_EXT,
} from "./constants";

let model;
let video = document.createElement("video");
let canvas = document.createElement("canvas");
let doLoop = false;

chrome.storage.local.get(CAM_ACCESS, async (items) => {
  if (!!items[CAM_ACCESS]) {
    console.log("cam access already exists");
    await loadModel();
  }
});

chrome.storage.onChanged.addListener(async (changes, namespace) => {
  if (CAM_ACCESS in changes) {
    console.log("cam access granted");
    await loadModel();
  }
});

// Do first-time setup to gain access to webcam, if necessary.
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason.search(/install/g) === -1) {
    return;
  }
  chrome.tabs.create({
    url: chrome.extension.getURL(WELCOME_PAGE),
    active: true,
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.message === PAGE_LOADED) {
    doLoop = true;
    setupCam();
  } else {
    doLoop = false;
    destroyCam();
  }
});

async function setupCam() {
  navigator.mediaDevices
    .getUserMedia({
      video: true,
    })
    .then((mediaStream) => {
      video.setAttribute("playsinline", "");
      video.setAttribute("autoplay", "");
      video.srcObject = mediaStream;
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      console.log("src assigned");
    })
    .catch((error) => {
      console.warn(error);
    });
  if (doLoop) {
    setTimeout(async () => await loop(), 1000);
  }
}

async function loop() {
  const prediction = await predict(video);
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs.length < 1) {
      return;
    }
    chrome.tabs.sendMessage(
      tabs[0].id,
      { action: PREDICTION, prediction },
      function (response) {}
    );
  });
  if (doLoop) {
    setTimeout(async () => await loop(), 250);
  }
}

async function destroyCam() {
  video.srcObject.getTracks().forEach(function (track) {
    track.stop();
  });
}

async function loadModel() {
  console.log("Loading model...");
  const modelURL = TMMODEL_URL + MODEL_EXT;
  const metadataURL = TMMODEL_URL + METADATA_EXT;
  try {
    model = await load(modelURL, metadataURL);
    let maxPredictions = model.getTotalClasses();
    console.log(`Max predictions:${maxPredictions}`);
  } catch (err) {
    console.error(
      `Unable to load model from URL: ${TMMODEL_URL}. Error: ${JSON.stringify(
        err
      )}`
    );
  }
}

async function predict() {
  console.log("Predicting...");
  canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
  const prediction = await model.predict(canvas);
  return prediction;
}
