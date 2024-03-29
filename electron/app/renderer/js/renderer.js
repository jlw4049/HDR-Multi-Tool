// main ui
const mainPanel = document.getElementById("input-panel");
const infoArea = document.getElementById("info-area-span");
const openFileBtn = document.getElementById("open-file");
const inputTextBox = document.getElementById("open-file-text-box");
const hdr10PlusCheckBox = document.getElementById("hdr10plus-check-box");
const hdr10PlusContent = document.getElementById("hdr10-plus-content");
const hdr10PlusSkipValidation = document.getElementById(
  "hdr10-plus-skip-validation"
);
const hdr10PlusSkipReOrder = document.getElementById(
  "hdr10-plus-skip-re-order"
);
const dVContent = document.getElementById("dv-content");
const dVCheckBox = document.getElementById("dv-check-box");
const dvCropBox = document.getElementById("dv-crop-box");
const dVCropControlBox = document.getElementById("dv-crop-control-box");
const dvCropTop = document.getElementById("dv-top-crop");
const dvCropBottom = document.getElementById("dv-bottom-crop");
const dvCropLeft = document.getElementById("dv-left-crop");
const dvCropRight = document.getElementById("dv-right-crop");
const cropSelections = [dvCropTop, dvCropBottom, dvCropLeft, dvCropRight];
const fixNegativeOffsets = document.getElementById("fix-negative-offsets");
const dVRpuExtractMode = document.getElementById("rpu-extract-mode");
const dVHevcNaluCode = document.getElementById("hevc-nalu");
const outputFileBtn = document.getElementById("save-file");
const outputTextBox = document.getElementById("save-file-text-box");
const addJobButton = document.getElementById("add-job-button");

// queue panel
const queuePanelButton = document.getElementById("job-panel-button");
const queuePanel = document.getElementById("queue-panel");
const queueBox = document.getElementById("queue-listbox");
const deleteButton = document.getElementById("delete-job-button");
const startJobButton = document.getElementById("start-job-button");
const pauseJobButton = document.getElementById("pause-job-button");
const queuePanelProgressBox = document.getElementById("queue-progress-bar-box");
const queuePanelProgressBar = document.getElementById("queue-progress-bar");
const queuePanelProgressBarText = document.getElementById(
  "queue-progress-text"
);
let jobProgress = 0;
const maxJobProgress = 100;

// about ui
const aboutPanel = document.getElementById("about-panel");
const closeAboutButton = document.getElementById("close-about");

// detect and define default colors
const defaultDropColor = openFileBtn.style.backgroundColor;
const defaultInfoColor = infoArea.style.color;

// request tool paths from the main process
let doviToolPath;
let hdrToolPath;
let ffmpegToolPath;
window.api.ipcRenderer
  .invoke("get-tool-paths")
  .then((toolPaths) => {
    doviToolPath = toolPaths.doviToolPath;
    hdrToolPath = toolPaths.hdrToolPath;
    ffmpegToolPath = toolPaths.ffmpegToolPath;
  })
  .catch((error) => {
    console.error(error);
  });

let mediaInfoObject;
let fileSize;
let videoTrackFrameCount;
let dolbyVision;
let hdr10Plus;
let invalidHdrSelection = false;
let inputFileName;
let inputPathParent;
let inputPath;
let outputExt;
let outputPath;

function resetGui() {
  mediaInfoObject = undefined;
  fileSize = undefined;
  videoTrackFrameCount = undefined;
  dolbyVision = undefined;
  hdr10Plus = undefined;
  invalidHdrSelection = false;
  inputFileName = undefined;
  inputPathParent = undefined;
  inputPath = undefined;
  outputExt = undefined;
  outputPath = undefined;
  inputTextBox.value = "";
  outputTextBox.value = "";
  dVCropControlBox.classList.remove("dv-cropped-box-alt");
  cropSelections.forEach((cropSelection) => {
    cropSelection.value = 0;
  });
  dvCropBox.checked = false;

  // fully default ui
  infoArea.innerText = "Open a Dolby Vision or HDR10+ compatible file";
  hdr10PlusContent.style.display = "none";
  dVContent.style.display = "none";
  outputFileBtn.classList.add("button-out-disabled");
  outputFileBtn.classList.remove("file-buttons-hover");
}

async function acceptInputFile(filePath) {
  // Ensure colors are reset back to defaults
  infoArea.style.color = defaultInfoColor;
  openFileBtn.style.backgroundColor = defaultDropColor;
  inputTextBox.style.backgroundColor = defaultDropColor;

  resetGui();

  try {
    const inputFileObject = await window.api.ipcRenderer.invoke(
      "get-path-object",
      filePath
    );
    const { dirName, path, baseName, ext } = inputFileObject;

    const supportedExtensions = [".mkv", ".mp4", ".hevc", ".ts"];

    if (!supportedExtensions.includes(ext)) {
      infoArea.innerText = "Input type is not supported";
      return;
    }

    const mediaInfoObjectParsed = await window.api.ipcRenderer.invoke(
      "open-file",
      filePath
    );
    mediaInfoObject = mediaInfoObjectParsed;

    const generalTrackObject = findGeneralTrack(mediaInfoObject.media.track);

    if (!generalTrackObject) {
      infoArea.innerText = "Input does not have a general track";
      infoArea.style.color = "#e1401d";
      return;
    } else {
      fileSize = generalTrackObject.FileSize;
    }

    const videoTrackObject = findVideoTrack(mediaInfoObject.media.track);

    if (!videoTrackObject) {
      infoArea.innerText = "Input does not have a video track";
      infoArea.style.color = "#e1401d";
      return;
    } else {
      const getVideoFrameCount = videoTrackObject.FrameCount;

      if (getVideoFrameCount) {
        videoTrackFrameCount = getVideoFrameCount;
      }
    }

    // Update input vars
    inputFileName = baseName;
    inputPathParent = dirName;
    inputPath = path;

    // Update text box with file's base name
    inputTextBox.value = baseName;

    const hdrString = getHdrString(videoTrackObject);

    if (!hdrString) {
      infoArea.innerText =
        "Video track does not contain HDR/Dolby Vision metadata";
      infoArea.style.color = "#e1401d";
      return;
    } else {
      infoArea.innerText = hdrString;
      infoArea.style.color = "#c0cbd3";

      const combinedHdrStrings = hdrString.toLowerCase();

      checkHdrTypes(combinedHdrStrings);

      // If input is only HDR10 and not HDR10+/Dolby Vision, let the user know
      if (!dolbyVision && !hdr10Plus) {
        infoArea.innerText = "Input is only HDR10, no parsing needed";
      }
    }

    if (dolbyVision && hdr10Plus) {
      hdr10PlusCheckBox.checked = false;
      hdr10PlusContent.style.display = "flex";
      dVContent.style.display = "flex";
      dVCheckBox.checked = true;
      outputExt = ".bin";
    } else if (dolbyVision) {
      hdr10PlusCheckBox.checked = false;
      hdr10PlusContent.style.display = "none";
      dVContent.style.display = "flex";
      dVCropControlBox.classList.add("dv-cropped-box-alt");
      dVCheckBox.checked = true;
      outputExt = ".bin";
    } else if (hdr10Plus) {
      dVCheckBox.checked = false;
      dVContent.style.display = "none";
      hdr10PlusContent.style.display = "flex";
      hdr10PlusCheckBox.checked = true;
      outputExt = ".json";
    }

    // enable output button
    outputFileBtn.classList.remove("button-out-disabled");
    outputFileBtn.classList.add("file-buttons-hover");

    enableDisableAddJob();
  } catch (error) {
    console.error(error);
  }
}

// output button
outputFileBtn.addEventListener("click", function () {
  if (outputFileBtn.classList.contains("file-buttons-hover")) {
    window.api.ipcRenderer.send("show-save-dialog", {
      defaultPath: inputPath,
      outputExtension: [outputExt.replace(".", "")],
      allFiles: false,
    });
  }
});

window.api.ipcRenderer.on("save-dialog-success", (arg) => {
  outputTextBox.value = arg.filePath.baseName;
  outputPath = arg.filePath.path;
});

// enable and disable opposing checkbox's
hdr10PlusCheckBox.addEventListener("change", function () {
  if (this.checked) {
    dVCheckBox.checked = false;

    if (hdr10Plus) {
      invalidHdrSelection = false;
    } else {
      invalidHdrSelection = true;
    }
  }
  outputExt = ".json";
  enableDisableAddJob();
});

dVCheckBox.addEventListener("change", function () {
  if (this.checked) {
    hdr10PlusCheckBox.checked = false;

    if (dolbyVision) {
      invalidHdrSelection = false;
    } else {
      invalidHdrSelection = true;
    }
  }
  outputExt = ".bin";
  enableDisableAddJob();
});

dvCropBox.addEventListener("change", function () {
  if (dvCropBox.checked) {
    enableCropInputs(false);
  } else {
    enableCropInputs(true);
  }
});

// enables/disables crop spin box's
function enableCropInputs(disabledStatus) {
  cropSelections.forEach((cropInput) => {
    cropInput.disabled = disabledStatus;
    if (disabledStatus) {
      cropInput.value = 0;
      fixNegativeOffsets.disabled = true;
    } else {
      fixNegativeOffsets.disabled = false;
      fixNegativeOffsets.checked = true;
    }
  });
  window.api.ipcRenderer
    .invoke("get-negative-offset-bool")
    .then((negativeOffsetBool) => {
      fixNegativeOffsets.checked = negativeOffsetBool;
    });
}

// ensure that the crop values are always at least 0
cropSelections.forEach((cropInput) => {
  cropInput.addEventListener("change", function () {
    if (!cropInput.value) {
      cropInput.value = 0;
    }
  });
});

// update fix negative offset
fixNegativeOffsets.addEventListener("change", function () {
  window.api.ipcRenderer.send(
    "update-negative-offset-bool",
    fixNegativeOffsets.checked
  );
});

async function enableDisableAddJob() {
  if (invalidHdrSelection) {
    infoArea.innerText = "Invalid HDR Selection for Input";
    infoArea.style.color = "#e1401d";
  } else {
    if (outputExt) {
      try {
        const newOutput = await window.api.ipcRenderer.invoke(
          "change-extension",
          inputPath,
          outputExt
        );
        outputTextBox.value = newOutput.baseName;
        outputPath = newOutput.path;
      } catch (error) {
        console.log(error);
      }
    }
  }

  if (
    inputPath &&
    (hdr10PlusCheckBox.checked || dVCheckBox.checked) &&
    !invalidHdrSelection &&
    outputPath
  ) {
    addJobButton.classList.add("button-out-hover");
    addJobButton.classList.remove("button-out-disabled");
  } else {
    addJobButton.classList.add("button-out-disabled");
    addJobButton.classList.remove("button-out-hover");
  }
}

function findGeneralTrack(trackArray) {
  return trackArray.find((track) => track["@type"] === "General");
}

function findVideoTrack(trackArray) {
  return trackArray.find((track) => track["@type"] === "Video");
}

function getHdrString(videoTrackObject) {
  const hdrFormat = videoTrackObject.HDR_Format;
  const hdrFormatCommercial = videoTrackObject.HDR_Format_Commercial;

  if (hdrFormat || hdrFormatCommercial) {
    const separator = hdrFormat && hdrFormatCommercial ? " / " : "";
    return `${hdrFormat}${separator}${hdrFormatCommercial}`;
  }

  return null;
}

function checkHdrTypes(hdrString) {
  if (hdrString.includes("vision")) {
    dolbyVision = true;
  }
  if (hdrString.includes("hdr10+")) {
    hdr10Plus = true;
  }
}

openFileBtn.addEventListener("click", function () {
  window.api.ipcRenderer.send("show-open-dialog");
});

window.api.ipcRenderer.on("return-open-dialog", (filePaths) => {
  if (filePaths && filePaths.length > 0) {
    const selectedFilePath = filePaths[0];
    acceptInputFile(selectedFilePath);
  }
});

[openFileBtn, inputTextBox].forEach((dropArea) => {
  if (window.api.currentPlatform() != "win32") {
    return;
  }
  dropArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropArea.style.backgroundColor = "#ccc";
  });

  // Handle the file drop event
  dropArea.addEventListener("drop", (e) => {
    e.preventDefault();

    const files = e.dataTransfer.files;

    if (files.length > 0) {
      const file = files[0].path;
      acceptInputFile(file);
    }
  });
});

// start job
addJobButton.addEventListener("click", async function () {
  let pipe1 = [
    ffmpegToolPath,
    "-analyzeduration",
    "100M",
    "-probesize",
    "50M",
    "-i",
    inputPath,
    "-map",
    "0:v:0",
    "-c:v:0",
    "copy",
    "-bsf:v",
    "hevc_mp4toannexb",
    "-f",
    "hevc",
    "-",
    "-hide_banner",
    "-loglevel",
    "warning",
    "-stats",
  ];

  let pipe2 = {};
  let dvCropPipe;

  // hdr10plus
  if (hdr10PlusCheckBox.checked) {
    pipe2.command = [];
    pipe2.command.push(hdrToolPath);
    if (hdr10PlusSkipValidation.checked) {
      pipe2.command.push(hdr10PlusSkipValidation.value);
    }
    let skipReOrder;
    if (hdr10PlusSkipReOrder.checked) {
      skipReOrder = hdr10PlusSkipReOrder.value;
    }
    ["extract", skipReOrder, "-o", outputPath, "-"].forEach((element) => {
      if (element) {
        pipe2.command.push(element);
      }
    });

    // dolby vision
  } else if (dVCheckBox.checked) {
    dvCropPipe = {};
    // extract RPU unmodified
    pipe2.command = [
      doviToolPath,
      ...(dVHevcNaluCode.value ? dVHevcNaluCode.value.split(" ") : []),
      "extract-rpu",
      "-",
      "-o",
      outputPath,
    ];

    // process presets/crop/mode
    let jsonOutFile = `${outputPath}_out.json`;
    dvCropPipe.jsonOut = jsonOutFile;
    dvCropPipe.mode = dVRpuExtractMode.value;
    dvCropPipe.crops = {
      top: dvCropTop.value,
      bottom: dvCropBottom.value,
      left: dvCropLeft.value,
      right: dvCropRight.value,
      fixNegativeOffsets: fixNegativeOffsets.checked,
    };
    dvCropPipe.outputPath = outputPath;
    dvCropPipe.command = [
      doviToolPath,
      "export",
      "-i",
      outputPath,
      "-d",
      `level5=${jsonOutFile}`,
    ];
  }

  if (hdr10PlusCheckBox.checked || dVCheckBox.checked) {
    const addJob = await window.api.ipcRenderer.invoke("add-job", {
      fileName: inputFileName,
      outputPath: outputPath,
      pipe1: pipe1,
      pipe2: pipe2,
      dvCropPipe: dvCropPipe,
      frameCount: videoTrackFrameCount,
    });
    if (addJob) {
      const newJob = document.createElement("option");
      // newJob.id = `id-${addJob.currentJob} status-incomplete`;
      newJob.id = `job-id-${addJob.currentJob}`;
      newJob.value = addJob.jobName;
      newJob.textContent = addJob.jobName;
      queueBox.appendChild(newJob);

      // open queue panel if not already opened
      const currentPanelStatus = window.getComputedStyle(queuePanel);
      if (currentPanelStatus.getPropertyValue("display") === "none") {
        queuePanelButton.classList.add("job-panel-rotate");
        queuePanel.style.display = "block";
      }

      // start job if set to auto start
      const autoStartJob = await window.api.ipcRenderer.invoke(
        "auto-start-job"
      );
      if (autoStartJob) {
        startJobButton.click();
      }

      // reset main ui
      resetGui();
      addJobButton.classList.add("button-out-disabled");
      addJobButton.classList.remove("button-out-hover");
    }
  }
});

// queue panel
queuePanelButton.addEventListener("click", function () {
  const computedStyle = window.getComputedStyle(queuePanel);
  if (computedStyle.getPropertyValue("display") === "none") {
    queuePanelButton.classList.add("job-panel-rotate");
    queuePanel.style.display = "block";
  } else {
    queuePanelButton.classList.remove("job-panel-rotate");
    queuePanel.style.display = "none";
  }
});

deleteButton.addEventListener("click", function () {
  // Get an array of selected options
  const selectedOptions = Array.from(queueBox.selectedOptions);

  // Check if any options are selected
  if (selectedOptions.length > 0) {
    // Remove each selected option
    selectedOptions.forEach((option) => {
      if (!option.disabled) {
        window.api.ipcRenderer.send("remove-job-from-queue", option.id);
        queueBox.remove(option.index);
      }
    });
  } else {
    window.api.ipcRenderer.send("show-message-prompt", [
      "Information",
      "You must select a job first",
    ]);
  }
});

startJobButton.addEventListener("click", function () {
  if (queueBox.options.length > 0) {
    window.api.ipcRenderer.send("start-queue");
    startJobButton.style.display = "none";
    pauseJobButton.style.display = "flex";
  } else {
    window.api.ipcRenderer.send("show-message-prompt", [
      "Information",
      "Queue has no jobs to process",
    ]);
  }
});

pauseJobButton.addEventListener("click", function () {
  window.api.ipcRenderer.send("pause-queue");
  startJobButton.style.display = "flex";
  pauseJobButton.style.display = "none";
});

window.api.ipcRenderer.on("job-update-current", (job) => {
  const selectedOption = queueBox.querySelector(
    `option[id="job-id-${job.currentJob}"]`
  );

  if (selectedOption) {
    selectedOption.disabled = true;
    selectedOption.style.color = "#2e7d32";
  }
});

window.api.ipcRenderer.on("job-complete-current", (job) => {
  const selectedOption = queueBox.querySelector(
    `option[id="job-id-${job.currentJob}"]`
  );

  if (selectedOption) {
    queueBox.remove(selectedOption);
  }
});

window.api.ipcRenderer.on("hide-progress-bar", () => {
  queuePanelProgressBox.style.display = "none";
});

window.api.ipcRenderer.on("job-complete", () => {
  queuePanelProgressBox.style.display = "none";
  queuePanel.style.display = "none";
  pauseJobButton.style.display = "none";
  startJobButton.style.display = "flex";
});

window.api.ipcRenderer.on("invalid-output", (filePath) => {
  window.api.ipcRenderer.send("show-message-prompt", [
    "Error",
    `There was an error parsing metadata, input likely has invalid HDR metadata.\n\nInvalid output:\n${filePath}`,
  ]);
});

window.api.ipcRenderer.on("update-job-progress", (progress) => {
  const computedStyle = window.getComputedStyle(queuePanelProgressBox);
  if (computedStyle.getPropertyValue("display") !== "flex") {
    queuePanelProgressBox.style.display = "flex";
  }

  jobProgress = String(progress);
  let cssProgress;

  if (jobProgress.includes(".")) {
    cssProgress = jobProgress.split(".")[0] + "%";
  } else {
    cssProgress = jobProgress;
  }

  queuePanelProgressBar.style.width = cssProgress;
  queuePanelProgressBarText.innerText = jobProgress + "%";
});

window.api.ipcRenderer.on("reset-job-progress", () => {
  jobProgress = 0;
  queuePanelProgressBar.style.width = 0;
  queuePanelProgressBarText.innerText = "";
});

window.api.ipcRenderer.on("safe-to-close-app", () => {
  const computedStyle = window.getComputedStyle(queuePanelProgressBox);
  let currentStatus = true;
  if (computedStyle.getPropertyValue("display") === "flex") {
    currentStatus = false;
  }
  window.api.ipcRenderer.send("respond:safe-to-close-app", currentStatus);
});

// about panel control
window.api.ipcRenderer.on("open-about", () => {
  mainPanel.style.display = "none";
  aboutPanel.style.display = "flex";
});

closeAboutButton.addEventListener("click", function () {
  mainPanel.style.display = "flex";
  aboutPanel.style.display = "none";
});
