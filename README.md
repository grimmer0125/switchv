# SwitchV 

This tool is used to quickly open and switch VSCode projects. 

## Features

- use ~~command line~~ shortcut/tray menu to quickly launch a UI listing recent opened window with different project paths, then select one to open it in VSCode.

## Dev and package Note

- extension
  - `yarn install`
  - either 
    - `F5 debug` for debugging or 
    - built it and install it. Firstly 
      - install [vsce](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
      - `yarn make` ~~`vsce package`~~, 
      - `yarn load` (first time) & `yarn reload` ~~then `code --install-extension SwitchV-0.0.1.vsix`~~ to install. 
- server 
  - `yarn install` 
  - For the first time or every time db scheme changes, execute `yarn db:migrate` to generate SQLite DB file (`./prisma/dev.db`) and generate TypeScript interface. `yarn db:view` can be used to view DB data.
    - ~~To generate TypeScript DB interface via `yarn db:type`~~ (db:migrate will also automatically do this part, `yarn install` will also include generated types in node_modules/.prisma/index.d.ts)
  - F5 debug or `yarn start:debug`
  - build: `yarn make`.
- desktop/electron 
  - `yarn install`
  - `yarn start` (not set VSCode debugging yet)
  - package as mac app: `yarn make`. It (Electron part) is about 196MB. Server vercel/pkg build is 119MB. Total it is 316MB. Try Tauri to reduce electron part? 
  - build mas build: `yarn make_mas`. Then execute `sh ./sign.sh`.


~~pnpm tips:~~

- ~~`pnpm install` vs `npm install`~~
- ~~`pnpm dlx` vs `npx`~~ 

~~ref: https://pnpm.io/pnpm-cli~~

## issues/todos 

1. [fixed] after click one window item, show VSCode, first time "cmd+ctrl+j" trigger does not effect and always need the second time. 

2. [fixed] after using ctrl+w to close SwitchV, the window object will be destroyed and can not be used anymore (will throw exception)

3. [fixed] (packaged app) Frontend usually fails to fetch data from server since the server is starting firstly. Need refresh. Add some waiting time. 

4. ~~[system limitation, wll not fix] handle minimizing electron app case and make it hidden. ref:  https://github.com/electron/electron/issues/29860#issuecomment-870697754~~

5. ~~Sometimes tray menu will not show. It seems to be because too many menu apps? Yes. It is all about macbook notch. We can not solve it~~

6. ~~React App is called twice initially~~ (this is due to <React.StrictMode>). ref: https://github.com/facebook/react/issues/12856#issuecomment-390206425

### debugger issue 

**To debug main process**

Below is a workaround way to debug main process: Its reference is 
https://github.com/electron-userland/electron-forge/issues/1369#issuecomment-1172913835
  

```json
{
  "type": "node",
  "request": "launch",
  "name": "Electron Main",
  "runtimeExecutable": "npm",
  "runtimeArgs": [
      "run",
      "start",
  ],
  "cwd": "${workspaceFolder}"
}
```

electron-forge official site only mention how to debug main process but it has a bug 
https://github.com/electron-userland/electron-forge/issues/1369

```json
{
  "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron-forge-vscode-nix",
}
```

Error: Cannot find module '/Users/liamdawson/w/@electron-forge/cli/dist/electron-forge-start'


**To debug render process (workaround way)**

[electron site](https://www.electronjs.org/docs/latest/tutorial/debugging-vscode) and [ms github site](https://github.com/Microsoft/vscode-recipes/tree/master/Electron) both mention below setting to debug main proces 


```json 
{
  "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron",
}
```

and ms github site has a extra setting for debugging render process. But the above setting to trigger main process has a bug that it does not trigger the webpack server customized by electron forge. To workaround this for mainly debugging render process, the steps are  

1. `yarn start` (to start webpack server part) 
2. launch compound "Electron: All" launch setting (from ms github site) to debug main & **render processes**. 

The drawback is you will see two copy of SwitchV. And attaching render process takes a little time (e.g. only stop at some breakpoints after a while/refresh).

## notes about packaging a macOS app

steps: 
1. bundle server 
  1. in server, execute `yarn build` to generate dist folder
  2. (first time) `yarn global add pkg`
  3. ~~add `"version": "0.0.1"` field in `generated server/node_modules/.prisma/client/package.json`~~
  4. ~~in server, `pkg --debug -t node16-macos-arm64 -o SwitchV-server-macos .`~~
  5. `yarn make`
  6. [optional] `DEBUG_PKG=1 ./SwitchV-server-macos` for debugging
2. in electron, `yarn make` to generate out folder 

two issues 
1. x TODO: how to use vercel/pkg bundle deb.db in nestjs, instead of manual copy???? (use macOS application folder to store db file)
2. x TODO: close the packaged app via cmd+q seems not close SwitchV-server-macos process? check by command: lsof -i:55688. Use ctrl+c to stop development (running via yarn start) is OK. (add close button on tray to help? I guess it is not helping). Solved by electron send kill server process in the before-quick event handler. Another person suggests to add one more step to handle SIGINT signal on server side, ref https://stackoverflow.com/questions/71523442/child-process-doesnt-exit.

### server notes
ref: 
1. https://github.com/prisma/prisma/issues/8449
2. https://github.com/vercel/pkg/issues/1508

