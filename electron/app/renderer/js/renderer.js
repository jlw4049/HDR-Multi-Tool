// main ui
const infoArea = document.getElementById("info-area-span");
const openFileBtn = document.getElementById("open-file");
const hiddenOpenFileBtn = document.getElementById("hidden-open-file");
const inputTextBox = document.getElementById("open-file-text-box");
const hdr10PlusCheckBox = document.getElementById("hdr10plus-check-box");
const hdr10PlusContent = document.getElementById("hdr10-plus-content");
const dVContent = document.getElementById("dv-content");
const dVCheckBox = document.getElementById("dv-check-box");
const dVCropBox = document.getElementById("dv-crop-box");
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

// detect and define default colors
const defaultDropColor = openFileBtn.style.backgroundColor;
const defaultInfoColor = infoArea.style.color;

// request tool paths from the main process
let doviToolPath;
let hdrToolPath;
let ffmpegToolPath;
ipcRenderer.invoke("get-tool-paths").then((toolPaths) => {
  doviToolPath = toolPaths.doviToolPath;
  hdrToolPath = toolPaths.hdrToolPath;
  ffmpegToolPath = toolPaths.ffmpegToolPath;
  
  console.log(doviToolPath);
}).catch((error) => {
  console.error(error);
});

let mediaInfoObject;
let fileSize;
let videoTrackDuration;
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
  videoTrackDuration = undefined;
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
    const inputFileObject = await ipcRenderer.invoke(
      "get-path-object",
      filePath
    );
    const { dirName, path, baseName, ext } = inputFileObject;

    const supportedExtensions = [".mkv", ".mp4", ".hevc", ".ts"];

    if (!supportedExtensions.includes(ext)) {
      infoArea.innerText = "Input type is not supported";
      return;
    }

    const mediaInfoObjectParsed = await ipcRenderer.invoke(
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
      const getVideoTrackDuration = videoTrackObject.Duration;
      if (getVideoTrackDuration) {
        videoTrackDuration = parseFloat(getVideoTrackDuration);
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
      dVCheckBox.checked = true;
      outputExt = ".bin";
    } else if (hdr10Plus) {
      dVCheckBox.checked = false;
      dVContent.style.display = "none";
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
    ipcRenderer.send("show-save-dialog", {
      defaultPath: inputPath,
      outputExtension: [outputExt.replace(".", "")],
      allFiles: false,
    });
  }
});

ipcRenderer.on("save-dialog-success", (arg) => {
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

async function enableDisableAddJob() {
  if (invalidHdrSelection) {
    infoArea.innerText = "Invalid HDR Selection for Input";
    infoArea.style.color = "#e1401d";
  } else {
    if (outputExt) {
      try {
        const newOutput = await ipcRenderer.invoke(
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
  hiddenOpenFileBtn.click();
});

hiddenOpenFileBtn.addEventListener("change", async function (event) {
  var filePath = event.target.files[0]["path"];
  acceptInputFile(filePath);
});

[openFileBtn, inputTextBox].forEach((dropArea) => {
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
  let hdrBaseCommand = [
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
    "-vbsf",
    "hevc_mp4toannexb",
    "-f",
    "hevc",
    "-",
    "-hide_banner",
    "-loglevel",
    "warning",
    "-stats",
    "|",
  ];

  if (hdr10PlusCheckBox.checked) {
    // to do impliment command
  } else if (dVCheckBox.checked) {
    // TODO actually detect/map FFMPEG
    // TODO actually detect/map both HDR executables
    hdrBaseCommand.push(doviToolPath);
    dVRpuExtractMode.value.split(" ").forEach((element) => {
      if (element) {
        hdrBaseCommand.push(element);
      }
    });
    dVHevcNaluCode.value.split(" ").forEach((element) => {
      if (element) {
        hdrBaseCommand.push(element);
      }
    });
    if (dVCropBox.checked) {
      hdrBaseCommand.push(dVCropBox.value);
    }
    hdrBaseCommand.push("extract-rpu");
    hdrBaseCommand.push("-");
    hdrBaseCommand.push("-o");
    hdrBaseCommand.push(outputPath);

    // console.log(hdrBaseCommand);

    const addJob = await ipcRenderer.invoke("add-job", {
      fileName: inputFileName,
      command: hdrBaseCommand,
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
        ipcRenderer.send("remove-job-from-queue", option.id);
        queueBox.remove(option.index);
      }
    });
  } else {
    ipcRenderer.send("show-message-prompt", [
      "Information",
      "You must select a job first",
    ]);
  }
});

startJobButton.addEventListener("click", function () {
  // Check if any options are selected
  if (queueBox.options.length > 0) {
    // startJobSVG.classList.add("button-out-disabled");
    // console.log(startJobButton.nextSibling);
    ipcRenderer.send("start-queue");
  } else {
    ipcRenderer.send("show-message-prompt", [
      "Information",
      "Queue has no jobs to process",
    ]);
  }
});

ipcRenderer.on("job-update-current", (job) => {
  const selectedOption = queueBox.querySelector(
    `option[id="job-id-${job.currentJob}"]`
  );

  if (selectedOption) {
    selectedOption.disabled = true;
    selectedOption.style.color = "#2e7d32";
  }
});

ipcRenderer.on("job-complete-current", (job) => {
  const selectedOption = queueBox.querySelector(
    `option[id="job-id-${job.currentJob}"]`
  );

  if (selectedOption) {
    queueBox.remove(selectedOption);
  }
});

// TODO maybe close panel or something when the jobs are completed
ipcRenderer.on("job-complete", (arg) => {
  // outputTextBox.value = arg.filePath.baseName;
  // outputPath = arg.filePath.path;
});
