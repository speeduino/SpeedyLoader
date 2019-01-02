const { app, BrowserWindow, ipcMain } = require('electron')
const {download} = require('electron-dl')
const {spawn} = require('child_process');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win

function createWindow () {
  // Create the browser window.
  win = new BrowserWindow({ width: 800, height: 600, backgroundColor: '#312450' })

  // and load the index.html of the app.
  win.loadFile('index.html')

  // Open the DevTools.
  //win.webContents.openDevTools()

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

  var executableName = "./bin/" + platform + "/avrdude";
  var configName = executableName + ".conf";
  if(process.platform == "win32") { executableName = executableName + '.exe'; } //This must come after the configName line above

  var hexFile = 'flash:w:' + args.firmwareFile + ':i';

  var execArgs = ['-v', '-patmega2560', '-C', configName, '-cwiring', '-b 115200', '-P', args.port, '-D', '-U', hexFile];

  /*
	exec("./bin/avrdude-darwin-x86/avrdude -v -p atmega2560 -C ./bin/avrdude-darwin-x86/avrdude.conf -c wiring -b 115200 -P /dev/cu.usbmodem14201 -D -U flash:w:/Users/josh/Downloads/201810.hex:i", (err, stdout, stderr) => {
    if (err) {
      console.error(`exec error: ${err}`);
      return;
    }
    console.log(`Upload Output: ${stdout}`);
  });
  */

  const child = spawn(executableName, execArgs);

  child.stdout.on('data', (data) => {
    console.log(`child stdout:\n${data}`);
  });

  child.stderr.on('data', (data) => {
    console.log(`avrdude stderr: ${data}`);
  });

  child.on('error', (err) => {
    console.log('Failed to start subprocess.');
  });

  child.on('close', (code) => {
    if (code !== 0) 
    {
      console.log(`avrdude process exited with code ${code}`);
      e.sender.send( "upload error", code )
    }
    else
    {
      e.sender.send( "upload completed", code )
    }
  });
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.