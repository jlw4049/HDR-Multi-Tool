const { app, Menu } = require("electron");
const {
  showOpenDialog,
} = require("../../app/main/ipc_handlers/ipcFileHandlers");
const createConfigStore = require("../../app/main/configUtils.js");

async function updateConfigBool(store, toggle, key) {
  store.set(key, toggle);
}

module.exports = (root) => {
  const store = createConfigStore();

  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "Open",
          accelerator: "CmdOrCtrl+O",
          click: async () => {
            const fileInput = await showOpenDialog(root);
            root.webContents.send("return-open-dialog", fileInput.filePaths);
          },
        },
        {
          type: "separator",
        },
        {
          label: "Quit",
          accelerator: "CmdOrCtrl+Q",
          click: () => {
            app.quit();
          },
        },
      ],
    },
    {
      label: "Options",
      submenu: [
        {
          label: "Auto Start Queue",
          submenu: [
            {
              label: "On",
              type: "radio",
              checked: store.get("autoStart") ? true : false,
              click: async () => {
                await updateConfigBool(store, true, "autoStart");
              },
            },
            {
              label: "Off",
              type: "radio",
              checked: store.get("autoStart") ? false : true,
              click: async () => {
                await updateConfigBool(store, false, "autoStart");
              },
            },
          ],
        },
        {
          label: "Clean Up",
          submenu: [
            {
              label: "On",
              type: "radio",
              checked: store.get("cleanUp") ? true : false,
              click: async () => {
                await updateConfigBool(store, true, "cleanUp");
              },
            },
            {
              label: "Off",
              type: "radio",
              checked: store.get("cleanUp") ? false : true,
              click: async () => {
                await updateConfigBool(store, false, "cleanUp");
              },
            },
          ],
        },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "About",
          click: async () => {
            root.webContents.send("open-about");
          },
        },
      ],
    },
    // Add more menu items and submenus as needed
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};
