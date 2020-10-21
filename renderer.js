const serialport = require('serialport')
const {ipcRenderer} = require("electron")
const {remote} = require('electron')
const { shell } = require('electron')

var basetuneList = [];
var isMega = false;
var isTeensy = false;

function refreshSerialPorts()
{
    serialport.list((err, ports) => {
        console.log('Serial ports found: ', ports);
        if (err) {
          document.getElementById('serialDetectError').textContent = err.message
          return
        } else {
          document.getElementById('serialDetectError').textContent = ''
        }
      
        if (ports.length === 0) {
          document.getElementById('serialDetectError').textContent = 'No ports discovered'
        }
      
        select = document.getElementById('portsSelect');

        //Clear the current options
        for (i = 0; i <= select.options.length; i++) 
        {
            select.remove(0); //Always 0 index (As each time an item is removed, everything shuffles up 1 place)
        }

        //Load the current serial values
        for(var i = 0; i < ports.length; i++)
        {
            var newOption = document.createElement('option');
            newOption.value = ports[i].comName;
            newOption.innerHTML = ports[i].comName;
            if(ports[i].vendorId == "2341")
            {
              //Arduino device
              if(ports[i].productId == "0010" || ports[i].productId == "0042") 
              { 
                //Mega2560
                newOption.innerHTML = newOption.innerHTML + " (Arduino Mega)"; 
                isMega = true;
              }
            }
            else if(ports[i].vendorId == "16c0")
            {
              //Teensy
              if(ports[i].productId == "0483")
              {
                //Teensy - Unfortunately all Teensy devices use the same device ID :(
                newOption.innerHTML = newOption.innerHTML + " (Teensy)"; 
              } 
            }
            select.add(newOption);
            //console.log(ports[i].serialNumber );
        }
        
        var button = document.getElementById("btnInstall")
        if(ports.length > 0) 
        {
            select.selectedIndex = 0;
            button.disabled = false;
        }
        else { button.disabled = true; }
      
      })
}

function refreshDetails()
{
    var selectElement = document.getElementById('versionsSelect');
    var version = selectElement.options[selectElement.selectedIndex].value;
    var url = "https://api.github.com/repos/noisymime/speeduino/releases/tags/" + version;

    document.getElementById('detailsHeading').innerHTML = version;
    
    var request = require('request');
    const options = {
        url: url,
        headers: {
          'User-Agent': 'request'
        }
      };

    request.get(options, function (error, response, body) {
        if (!error ) {

            console.log(body);
            var result = JSON.parse(body);
            
            // Continue with your processing here.
            textField = document.getElementById('detailsText');

            //Need to convert the Markdown that comes from Github to HTML
            var myMarked = require('marked');
            textField.innerHTML = myMarked(result.body);
        }
    });

    //Finally, make the details section visible
    document.getElementById('details').style.display = "inline";
    //And jump to it
    window.location.href = "#details";
}

function refreshAvailableFirmwares()
{
    //Disable the buttons. These are only re-enabled if the retrieve is successful
    var DetailsButton = document.getElementById("btnDetails");
    var ChoosePortButton = document.getElementById("btnChoosePort");
    var basetuneButton = document.getElementById("btnBasetune");
    DetailsButton.disabled = true;
    ChoosePortButton.disabled = true;
    basetuneButton.disabled = true;

    var request = require('request');
    request.get('http://speeduino.com/fw/versions', {timeout: 10000}, function (error, response, body) 
    {
        select = document.getElementById('versionsSelect');
        if (!error && response.statusCode == 200) {

            var lines = body.split('\n');
            // Continue with your processing here.
            
            for(var i = 0;i < lines.length;i++)
            {
                var newOption = document.createElement('option');
                newOption.value = lines[i];
                newOption.innerHTML = lines[i];
                select.appendChild(newOption);
            }
            select.selectedIndex = 0;
            refreshBasetunes();

            //Re-enable the buttons
            DetailsButton.disabled = false;
            ChoosePortButton.disabled = false;
            basetuneButton.disabled = false;
        }
        else if(error)
        {
            console.log("Error retrieving available firmwares");
            var newOption = document.createElement('option');
            if(error.code === 'ETIMEDOUT')
            {
                newOption.value = "Connection timed out";
                newOption.innerHTML = "Connection timed out";
            }
            else
            {
                newOption.value = "Cannot retrieve firmware list";
                newOption.innerHTML = "Cannot retrieve firmware list. Check internet connection and restart";
            }
            select.appendChild(newOption);
        }
        else if(response.statusCode == 404)
        {

        }
    }
    );
}

function refreshBasetunes()
{
    //Check whether the base tunes list has been populated yet
    if(basetuneList === undefined || basetuneList.length == 0)
    {
        console.log("No tunes loaded. Retrieving from server");
        //Load the json
        var url = "https://speeduino.com/fw/basetunes.json";
        
        var request = require('request');
        const options = {
            url: url,
            headers: {
            'User-Agent': 'request'
            }
        };

        request.get(options, function (error, response, body) {
            if (!error ) 
            {
                basetuneList = JSON.parse(body);
                refreshBasetunes();
            }
        });
    }
    else
    {
        //JSON list of base tunes has been downloaded

        //Get the display list object
        var select = document.getElementById('basetunesSelect');

        //Get the currently selected version
        selectElement = document.getElementById('versionsSelect');
        if(selectElement.selectedIndex == -1) { return; } //Check for no value being selected
        var selectedFW = selectElement.options[selectElement.selectedIndex].value;

        //Clear the current options from the list
        while(select.options.length)
        {
            select.remove(0);
        }

        for (var tune in basetuneList) 
        {
            //Check whether the current tune was available for the selected firmware
            if(parseInt(basetuneList[tune].introduced) <= parseInt(selectedFW))
            {
                var url = basetuneList[tune].baseURL.replace("$VERSION", selectedFW) + basetuneList[tune].filename;
                //console.log("Tune url: " + url);
                //console.log("Found a valid tune: " + basetuneList[tune].displayName);
                var newOption = document.createElement('option');
                newOption.style.background = "#022b3a";
                newOption.value = url;
                newOption.innerHTML = basetuneList[tune].displayName;
                select.appendChild(newOption);
            }
            
        }

        //Finally update the selected firmware label on the basetunes page
        document.getElementById('basetunesSelectedFW').innerHTML = selectedFW;
    }
}

function downloadHex(isTeensy)
{

    var e = document.getElementById('versionsSelect');

    var DLurl;
    if(isTeensy)
    { 
      DLurl = "http://speeduino.com/fw/teensy35/" + e.options[e.selectedIndex].value + ".hex";
      console.log("Downloading Teensy 35 firmware: " + DLurl);
    }
    else
    {
      
      DLurl = "http://speeduino.com/fw/bin/" + e.options[e.selectedIndex].value + ".hex";
      console.log("Downloading AVR firmware: " + DLurl);
    }
    
    //Download the Hex file
    ipcRenderer.send("download", {
        url: DLurl,
        properties: {directory: "downloads"}
    });

}

function downloadIni()
{

    var e = document.getElementById('versionsSelect');
    var DLurl = "https://speeduino.com/fw/" + e.options[e.selectedIndex].value + ".ini";
    console.log("Downloading: " + DLurl);

    //Download the ini file
    ipcRenderer.send("download", {
        url: DLurl,
        properties: {directory: "downloads"}
    });

}

function downloadBasetune()
{
    var basetuneSelect = document.getElementById('basetunesSelect');
    var version = document.getElementById('versionsSelect');
    //var DLurl = "https://github.com/noisymime/speeduino/raw/" + version + "/reference/Base%20Tunes/" + e.options[e.selectedIndex].value;
    var DLurl = basetuneSelect.options[basetuneSelect.selectedIndex].value;
    console.log("Downloading: " + DLurl);

    //Download the ini file
    ipcRenderer.send("download", {
        url: DLurl,
        properties: {directory: "downloads"}
    });
}

//Installing the Windows drivers
function installDrivers()
{
    ipcRenderer.send("installWinDrivers", {
    });

}

function uploadFW()
{
    //Jump to the progress section
    window.location.href = "#progress";

    //Start the spinner
    var spinner = document.getElementById('progressSpinner');
    //Disable the Re-burn/re-install button
    var reinstallButton = document.getElementById("btnReinstall")
    reinstallButton.disabled = true;
    //Remove any old icons
    spinner.classList.remove('fa-pause');
    spinner.classList.remove('fa-check');
    spinner.classList.remove('fa-times');
    spinner.classList.add('fa-spinner');

    //Lookup what platform we're using
    var portSelect = document.getElementById('portsSelect');
    var isTeensy = portSelect.innerHTML.includes("Teensy");

    //Hide the terminal section incase it was there from a previous burn attempt
    document.getElementById('terminalSection').style.display = "none";
    //Same for the ini location link
    document.getElementById('iniFileText').style.display = "none";

    var statusText = document.getElementById('statusText');
    var burnPercentText = document.getElementById('burnPercent');
    statusText.innerHTML = "Downloading INI file"
    downloadIni();


    ipcRenderer.on("download complete", (event, file, state) => {
        console.log("Saved file: " + file); // Full file path

        var extension = file.substr(file.length - 3);
        if(extension == "ini")
        {
            statusText.innerHTML = "Downloading firmware"
            document.getElementById('iniFileText').style.display = "block"
            document.getElementById('iniFileLocation').innerHTML = file
            downloadHex(isTeensy);
        }
        else if(extension == "hex")
        {
            statusText.innerHTML = "Beginning upload..."

            //Retrieve the select serial port
            var e = document.getElementById('portsSelect');
            uploadPort = e.options[e.selectedIndex].value;
            console.log("Using port: " + uploadPort);

            //Begin the upload
            if(isTeensy)
            {
              ipcRenderer.send("uploadFW_teensy35", {
                port: uploadPort,
                firmwareFile: file
              });
            }
            else
            {
              ipcRenderer.send("uploadFW", {
                  port: uploadPort,
                  firmwareFile: file
              });
            }
        }
        console.log();
    });

    ipcRenderer.on("upload completed", (event, code) => {
        statusText.innerHTML = "Upload to arduino completed successfully!";
        burnPercentText.innerHTML = "";

        //Turn the spinner off
        spinner.classList.remove('fa-spinner');
        spinner.classList.add('fa-check');

        //Re-enable the re-burn button
        reinstallButton.disabled = false;
    });

    ipcRenderer.on("upload percent", (event, percent) => {
        statusText.innerHTML = "Uploading firmware to board"
        burnPercentText.innerHTML = " (" + percent + "%)";
    });

    ipcRenderer.on("upload error", (event, code) => {
        statusText.innerHTML = "Upload to Speeduino failed";
        //Mke the terminal/error section visible
        document.getElementById('terminalSection').style.display = "block";
        document.getElementById('terminalText').innerHTML = code;
        spinner.classList.remove('fa-spinner');
        spinner.classList.add('fa-times');

        reinstallButton.disabled = false;
    });


}

//Opens a native file manager window at the location of the downloaded ini file
function openFileMgr()
{
    var location = document.getElementById('iniFileLocation').innerHTML
    if (location != "")
    {
        shell.showItemInFolder(location);
    } 
}

function quit()
{
    let w = remote.getCurrentWindow();
    w.close();
}

function checkForUpdates()
{
    var url = "https://api.github.com/repos/speeduino/SpeedyLoader/releases/latest";

    //document.getElementById('detailsHeading').innerHTML = version;
    
    var request = require('request');
    const options = {
        url: url,
        headers: {
          'User-Agent': 'request'
        }
      };

    request.get(options, function (error, response, body) {
        if (!error ) 
        {
            var result = JSON.parse(body);
            latest_version = result.tag_name.substring(1);
            console.log("Latest version: " + latest_version);

            var semver = require('semver');
            if(semver.gt(latest_version, remote.app.getVersion()))
            {
                //New version has been found
                document.getElementById('update_url').setAttribute("href", result.html_url);
                document.getElementById('update_text').style.display = "block";
            }
        }
    });

}

window.onload = function () {
    //Adds the current version number to the Titlebar
    document.getElementById('title').innerHTML = "Speeduino Universal Firmware Loader (v" + remote.app.getVersion() + ")"
    
    refreshAvailableFirmwares();
    refreshBasetunes();
    refreshSerialPorts();
    checkForUpdates();
    
};

