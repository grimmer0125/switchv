import {
  dialog,
  app,
  BrowserWindow,
  ipcMain,
  globalShortcut,
  screen,
} from 'electron';

import settings from 'electron-settings';

import { exec } from 'child_process';
import { existsSync, readdirSync } from 'fs';
// const fs = require('fs');

import { TrayGenerator, isMAS } from './TrayGenerator';
import { DBManager, isUnPackaged } from './DBManager';

import { isDebug } from './utility';
import { bootstrap } from './server/server';

/** TODO: use Node.js path.join() instead of manual concat */

// This allows TypeScript to pick up the magic constants that's auto-generated by Forge's Webpack
// plugin that tells the Electron app where to look for the Webpack-bundled app code (depending on
// whether you're running in development or production).
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

// if (!isDebug) {
//   const { Menu, MenuItem } = require('electron');
//   const menu = new Menu();

//   menu.append(
//     new MenuItem({
//       label: 'Quit',
//       accelerator: 'CmdOrCtrl+Q',
//       click: () => {
//         console.log('Cmd + Q is pressed');
//       },
//     }),
//   );
//   /** this will make devtool not working */
//   Menu.setApplicationMenu(menu);
// }

// default: http://localhost:3000/main_window
// console.log("MAIN_WINDOW_WEBPACK_ENTRY:", MAIN_WINDOW_WEBPACK_ENTRY)
// default: undefind. Its value is from package.json entryPoints/preload/js value
// console.log("MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY:", MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY)

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  // eslint-disable-line global-require
  app.quit();
}

let tray: TrayGenerator = null;
let mainWindow: BrowserWindow = null;
let serverProcess: any;

const WIN_WIDTH = 800;
const WIN_HEIGHT = 600;

const getWindowPosition = () => {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  const x = Math.round(width / 2 - WIN_WIDTH / 2);
  const y = Math.round(height / 2 - WIN_HEIGHT / 2);

  return { x, y };
};

// ref: https://blog.logrocket.com/building-a-menu-bar-application-with-electron-and-react/
// NOTE: setVisibleOnAllWorkspaces is needed ?
const showWindow = () => {
  const position = getWindowPosition();
  mainWindow.setPosition(position.x, position.y, false);
  mainWindow.show();
  // mainWindow.setVisibleOnAllWorkspaces(true);
  mainWindow.focus();
  // mainWindow.setVisibleOnAllWorkspaces(false);
};

const hideWindow = () => {
  mainWindow.hide();
};

const onBlur = (event: any) => {
  hideWindow();
};

const onFocus = (event: any) => {
  mainWindow.webContents.send('window-focus');
};

const createWindow = (): BrowserWindow => {
  // Create the browser window.
  const window = new BrowserWindow({
    // maximizable: false,
    // minimizable: false, // ux not good
    height: 600,
    width: 800,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      devTools: false, //isDebug,
    },

    // hide window by default
    show: false,
    frame: false,
    fullscreenable: false,
    resizable: false,
  });

  // and load the index.html of the app.
  window.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  // if (true){ //isDebug){//!app.isPackaged) {
  // window.webContents.openDevTools();
  // }

  if (tray) {
    // TODO: change to use some Tray method & not set tray here
    tray.mainWindow = window;
  }

  window.on('blur', onBlur);
  window.on('focus', onFocus);

  // mainWindow.on('close', function (event) {
  //   console.log("mainWindow close");
  //   // if below is setup, app.window-all-closed will not be fired
  //   // if(!application.isQuiting){
  //   // event.preventDefault();
  //   // mainWindow.hide();
  //   // // }
  //   // return false;
  // });

  window.on('move', () => {
    const bounds = mainWindow.getBounds();
    const currentDisplay = screen.getDisplayNearestPoint({
      x: bounds.x,
      y: bounds.y,
    });

    // Perform your actions here..
    // currentDisplay: {
    //   id: 3,
    //   bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    //   workArea: { x: 0, y: 25, width: 1920, height: 1002 },
    //   accelerometerSupport: 'unknown',
    //   monochrome: false,
    //   colorDepth: 24,
    //   colorSpace: '{primaries_d50_referred: [[0.6632, 0.3329],  [0.3195, 0.6290],  [0.1546, 0.0438]], transfer:0.0777*x + 0.0000 if x < 0.0450 else (0.9495*x + 0.0495)**2.3955 + 0.0003, matrix:RGB, range:FULL}',
    //   depthPerComponent: 8,
    //   size: { width: 1920, height: 1080 },
    //   displayFrequency: 59,
    //   workAreaSize: { width: 1920, height: 1002 },
    //   scaleFactor: 2,
    //   rotation: 0,
    //   internal: false,
    //   touchSupport: 'unknown'
    // }
    // console.log({currentDisplay});

    showWindow();
  });

  return window;
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  if (isDebug) {
    console.log('on ready');
  }
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (isDebug) {
    console.log('window-all-closed');
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/** not triggered yet */
app.on('activate', () => {
  if (isDebug) {
    console.log('activate');
  }
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

/** https://www.electronjs.org/docs/latest/tutorial/ipc */
ipcMain.on('invoke-vscode', (event, path, option) => {
  if (isDebug) {
    console.log('invoke', { /*event,*/ path });
    tray.tray.setTitle(`XWin(${path ? path[path.length - 1] : 'n'})`);
  }

  if (!existsSync(path)) {
    if (isDebug) {
      console.log('file not exist');
    }
    // send message to Electron, not really use now, just in case
    mainWindow.webContents.send('xwin-not-found');

    dialog.showMessageBox(mainWindow, {
      message: 'Path is not a folder, neither workspace',
      buttons: ['OK'],
      defaultId: 0, // bound to buttons array
      cancelId: 1, // bound to buttons array
    });

    return;
  }

  // FIXME: win/linux has difference path
  // ref:
  // 1. https://stackoverflow.com/questions/44405523/spawn-child-node-process-from-electron
  // 2. https://stackoverflow.com/questions/62885809/nodejs-child-process-npm-command-not-found
  // 3. https://github.com/electron/fiddle/issues/365#issuecomment-616630874
  // const fullCmd = `code ${command}`
  //const child = spawn('open', ['-b', 'com.microsoft.VSCode', '--args', argv], options);
  // https://github.com/microsoft/vscode/issues/102975#issuecomment-661647219
  //const fullCmd = `open -b com.microsoft.VSCode --args -r ${path}`

  let fullCmd = '';
  const newPath = path.replace(/ /g, '\\ ');
  if (option) {
    // reuse
    // https://stackoverflow.com/a/47473271/7354486
    // https://code.visualstudio.com/docs/editor/command-line#_opening-vs-code-with-urls
    fullCmd = `open vscode://file/${newPath}`;
  } else {
    // NOTE: VSCode insider needs to use "com.microsoft.VSCodeInsiders" instead
    fullCmd = `open -b com.microsoft.VSCode ${newPath}`;
  }

  if (isDebug) {
    console.log({ fullCmd });
  }
  exec(fullCmd, (error, stdout, stderr) => {
    if (isDebug) {
      console.log(stdout);
    }
  });

  hideWindow();
});

ipcMain.on('pop-alert', (event, alert: string) => {
  // console.log({ event, path, option });
  dialog.showMessageBox(mainWindow, {
    message: alert,
    buttons: ['OK'],
    defaultId: 0, // bound to buttons array
    cancelId: 1, // bound to buttons array
  });
});

ipcMain.on('search-working-folder', (event, path: string) => {
  if (!path) {
    return;
  }
  // console.log({ search: path });
  /** TODO: searach this folder */

  console.time('readdir');

  // 100 item ~0.2ms
  // 0.27ms ~ 2item
  // 0.4ms for git folder, ~200
  /** TODO: use async way to improve performance */
  const directoriesInDIrectory = readdirSync(path, {
    withFileTypes: true,
  });
  // console.log('folder count:', directoriesInDIrectory.length);

  /** readdir-all subfolder: 96.554ms */
  const returnPathlist = [];
  // const subListCount = 0; // 3785
  for (const item of directoriesInDIrectory) {
    if (item.name.startsWith('.')) {
      continue;
    }

    const itemPath = path + '/' + item.name;
    if (!item.isDirectory()) {
      if (item.name.endsWith('.code-workspace')) {
        // console.log('bing0:', itemPath);
        returnPathlist.push(itemPath);
      }
      continue;
    }
    returnPathlist.push(itemPath);

    // fs.readdir(dirpath, function(err, files) {
    //   const txtFiles = files.filter(el => path.extname(el) === '.txt')
    //   // do something with your files, by the way they are just filenames...
    // })

    // const subDir = path + '/' + item.name;
    // const directoriesInSubDIrectory = readdirSync(subDir, {
    //   withFileTypes: true,
    // });

    // TODO: this is macOs path style. use Node.js path.join()
    const targetSpacePath = itemPath + '/' + item.name + '.code-workspace';
    if (existsSync(targetSpacePath)) {
      // console.log('bingo,', targetSpacePath);

      returnPathlist.push(targetSpacePath);
      // if (targetSpacePath.endsWith('.code-workspace')) {
      //   console.log('bingo2,', targetSpacePath);
      // }
    }
    // subListCount += directoriesInSubDIrectory.length;
    // console.log({ subDir, directoriesInSubDIrectory });
    // break;
  }

  //.filter((item) => item.isFile());

  // Dirent { name: 'k8s-staging', [Symbol(type)]: 2 },
  // .map((item) => item.name);

  //  Dirent { name: '.DS_Store', [Symbol(type)]: 1 },

  // .filter((item) => item.isDirectory())
  // .map((item) => item.name);

  console.timeEnd('readdir');

  console.log({ returnPathlist: returnPathlist.length });

  mainWindow.webContents.send('working-folder-iterated', returnPathlist);
});

ipcMain.on('hide-app', (event) => {
  hideWindow();
});

ipcMain.on('close-app-click', async (event) => {
  app.quit();
});

ipcMain.on('open-folder-selector', async (event) => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    securityScopedBookmarks: true,
    // properties: ['openFile', 'multiSelections'],
  });
  /** https://gist.github.com/ngehlert/74d5a26990811eed59c635e49134d669 */
  const { canceled, filePaths, bookmarks } = result;
  if (canceled || filePaths.length === 0) {
    return;
  }
  if (bookmarks && bookmarks.length) {
    // store the bookmark key
    if (isMAS()) {
      await settings.set('security-scoped-bookmark', bookmarks[0]);
    }
  }

  const folderPath = filePaths[0];
  // result: { canceled: false, filePaths: [ '/Users/grimmer/git' ] }

  mainWindow.webContents.send('folder-selected', folderPath);
});

const trayToggleEvtHandler = () => {
  if (isDebug) {
    console.log('tray toggle callback');
  }

  if (BrowserWindow.getAllWindows().length === 0) {
    if (isDebug) {
      console.log('no window, create one');
    }
    mainWindow = createWindow();
    showWindow();
  } else if (mainWindow.isVisible()) {
    if (isDebug) {
      console.log('is visible, to hide');
    }
    hideWindow();
  } else {
    if (isDebug) {
      console.log('is not visible, to show');
    }
    showWindow();
  }
};

/**
 * what is the difference between whenReady & .on('ready)???
 */
// app.whenReady().then(() => {
// })
(async () => {
  await app.whenReady();

  mainWindow = createWindow();
  if (isDebug) {
    console.log('when ready');
  }
  DBManager.initPath();
  // console.log({
  //   embed: process.env.EMBEDSERVER,
  //   node: process?.env?.NODE_ENV,
  //   DEBUG_PROD: process.env.DEBUG_PROD,
  //   isUnPackaged: isUnPackaged,
  // });
  const needVer = await DBManager.checkNeedMigration();
  if (needVer) {
    if (process.env.EMBEDSERVER || !isUnPackaged) {
      // console.log('either embedded server or package, do doMigrationToVersion');
      await DBManager.doMigrationToVersion(needVer);
    }
  }
  if (isDebug) {
    console.log('check db done. USE DBPATH:', DBManager.databaseFilePath);
  }

  if (isMAS()) {
    const securityBookmark = (await settings.get(
      'security-scoped-bookmark',
    )) as string;
    if (securityBookmark) {
      app.startAccessingSecurityScopedResource(securityBookmark);
    }
  }

  // if (process.env.EMBEDSERVER || !isUnPackaged) {
  //   console.log('start server');
  //   process.env.DATABASE_URL = `file:${DBManager.databaseFilePath}`;
  //   if (isDebug) {
  //     console.log(
  //       'start server:' + `${DBManager.serverFolderPath}/SwitchV-server-macos`,
  //     );
  //   }
  //   serverProcess = exec(
  //     `${DBManager.serverFolderPath}/SwitchV-server-macos`,
  //     { env: { DATABASE_URL: `file:${DBManager.databaseFilePath}` } },
  //     (error, stdout, stderr) => {
  //       // TODO: figure out it why it does not print out
  //       // NOTE: if it is running smoothly, it will not print any logs. But if it seems that it happens to read db error,
  //       // then it will show some logs
  //       if (isDebug) {
  //         console.log('print server log but seems it is never callbacked');
  //         console.log(error, stderr);
  //         console.log(stdout);
  //       }
  //     },
  //   );
  // } else {
  console.log('create server');
  process.env.DATABASE_URL = `file:${DBManager.databaseFilePath}`;
  // process.env.PRISMA_INTROSPECTION_ENGINE_BINARY =
  //   DBManager.introspectionExePath;
  // process.env.PRISMA_FMT_BINARY = DBManager.fmtExePath;
  process.env.PRISMA_QUERY_ENGINE_LIBRARY = DBManager.queryExePath;
  await bootstrap();
  console.log('create server done');
  // }

  let title = '';
  if (!isDebug) {
    title = ``;
  } else {
    title = `SwitchV(cmd+ctrl+r)`;
    if (DBManager.needUpdate) {
      title = `${title}${'u.'}`;
    }
  }

  tray = new TrayGenerator(mainWindow, title, trayToggleEvtHandler);

  // https://www.electronjs.org/docs/latest/tutorial/keyboard-shortcuts#global-shortcuts
  // globalShortcut.register('Alt+CommandOrControl+N', () => {
  globalShortcut.register('Command+Control+R', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      if (isDebug) {
        console.log('no window, create one');
      }
      mainWindow = createWindow();
      showWindow();
    } else {
      tray.onTrayClick();
    }
  });
})();

// use lsof -i:55688 to check server process
// ref:
// 1. https://stackoverflow.com/questions/36031465/electron-kill-child-process-exec
// 2. https://stackoverflow.com/questions/42141191/electron-and-node-on-windows-kill-a-spawned-process
// Workaround to close all processes / sub-processes after closing the app
// app.once('window-all-closed', app.quit); ? seems not important
// mainWindow.removeAllListeners('close'); ? seems not important
app.once('before-quit', () => {
  if (isDebug) {
    console.log('before quit, kill server process');
  }
  if (serverProcess) {
    serverProcess.kill();
  }
});

app.setLoginItemSettings({
  openAtLogin: true,
});

app.dock.hide();
