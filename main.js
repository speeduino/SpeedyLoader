const { app, BrowserWindow, ipcMain } = require('electron')
const {download} = require('electron-dl')
const {spawn} = require('child_process');
const {execFile} = require('child_process');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win

var avrdudeErr = "";

function createWindow () {
  // Create the browser window.
  win = new BrowserWindow({ width: 800, height: 600, backgroundColor: '#312450' })

  // and load the index.html of the app.
  win.loadFile('index.html')

  // Open the DevTools.
  win.webContents.openDevTools()

  // Emitted when the window is closed.
  win.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win = null
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (win === null) {
    createWindow()
  }
})

ipcMain.on('download', (e, args) => {
	download(BrowserWindow.getFocusedWindow(), args.url)
    .then(dl => e.sender.send( "download complete", dl.getSavePath() ) );
});

ipcMain.on('uploadFW', (e, args) => {
  var platform;

  if(process.platform == "win32") { platform = "avrdude-windows"; }
  else if(process.platform == "darwin") { platform = "avrdude-darwin-x86"; }
  else if(process.platform == "linux") { platform = "avrdude-linux_i686"; }

  var executableName = __dirname + "/bin/" + platform + "/avrdude";
  executableName = executableName.replace('app.asar',''); //This is important for allowing the binary to be found once the app is packaed into an asar
  var configName = executableName + ".conf";
  if(process.platform == "win32") { executableName = executableName + '.exe'; } //This must come after the configName line above

  var hexFile = 'flash:w:' + args.firmwareFile + ':i';

  var execArgs = ['-v', '-patmega2560', '-C', configName, '-cwiring', '-b 115200', '-P', args.port, '-D', '-U', hexFile];

  console.log(executableName);
  //const child = spawn(executableName, execArgs);
  const child = execFile(executableName, execArgs);

  child.stdout.on('data', (data) => {
    console.log(`child stdout:\n${data}`);
  });

  child.stderr.on('data', (data) => {
    console.log(`avrdude stderr: ${data}`);
    avrdudeErr = avrdudeErr + data;
  });

  child.on('error', (err) => {
    console.log('Failed to start subprocess.');
    console.log(err);
  });

  child.on('close', (code) => {
    if (code !== 0) 
    {
      console.log(`avrdude process exited with code ${code}`);
      e.sender.send( "upload error", avrdudeErr )
      avrdudeErr = "";
    }
    else
    {
      e.sender.send( "upload completed", code )
    }
  });
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.