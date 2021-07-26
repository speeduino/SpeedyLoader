const serialport = require('serialport')
const usb = require('usb')
const JSON5 = require('json5')
const {ipcRenderer} = require("electron")
const {remote} = require('electron')
const { shell } = require('electron')

var basetuneList = [];

function getTeensyVersion(id)
{
  var idString = ""
  switch(id) {
    case 0x273:
      idString = "LC"
      break;
    case 0x274:
      idString = "3.0"
      break;
    case 0x275:
      idString = "3.2"
      break;
    case 0x276:
      idString = "3.5"
      break;
    case 0x277:
      idString = "3.6"
      break;
    case 0x279:
      idString = "4.0"
      break;
    case 0x280:
      idString = "4.1"
      break;
  }

  return idString;
}

function refreshSerialPorts()
{
  serialport.list().then(ports => {
    console.log('Serial ports found: ', ports);
  
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
        newOption.value = ports[i].path;
        newOption.innerHTML = ports[i].path;
        if(ports[i].vendorId == "2341")
        {
          //Arduino device
          if(ports[i].productId == "0010" || ports[i].productId == "0042") 
          { 
            //Mega2560 with 16u2
            newOption.innerHTML = newOption.innerHTML + " (Arduino Mega)"; 
            newOption.setAttribute("board", "ATMEGA2560");
          }
        }
        else if(ports[i].vendorId == "16c0" || ports[i].vendorId == "16C0")
        {
          //Teensy
          var teensyDevices = usb.getDeviceList().filter( function(d) { return d.deviceDescriptor.idVendor===0x16C0; });
          var teensyVersion = getTeensyVersion(teensyDevices[0].deviceDescriptor.bcdDevice);
          newOption.innerHTML = newOption.innerHTML + " (Teensy " + teensyVersion + ")";

          //Get the short copy of the teensy version
          teensyVersion = teensyVersion.replace(".", "");
          newOption.setAttribute("board", "TEENSY"+teensyVersion);
        }
        else if(ports[i].vendorId == "1a86" || ports[i].vendorId == "1A86")
        {
          //CH340
          newOption.innerHTML = newOption.innerHTML + " (Arduino Mega CH340)"; 
          newOption.setAttribute("board", "ATMEGA2560");
        }
        else
        {
          //Unknown device, assume it's a mega2560
          newOption.setAttribute("board", "ATMEGA2560");
        }
        select.add(newOption);
    }

    //Look for any unintialised Teensy boards (ie boards in HID rather than serial mode)
    var uninitialisedTeensyDevices = usb.getDeviceList().filter( function(d) {
      return d.deviceDescriptor.idVendor===0x16C0 && d.configDescriptor.interfaces[0][0].bInterfaceClass == 3; //Interface class 3 is HID
    });
    uninitialisedTeensyDevices.forEach((device, index) => {
      console.log("Uninit Teensy found: ", getTeensyVersion(device.deviceDescriptor.bcdDevice))
      var newOption = document.createElement('option');
      newOption.value = "TeensyHID";
      var teensyVersion = getTeensyVersion(device.deviceDescriptor.bcdDevice);
      newOption.innerHTML = "Uninitialised Teensy " + teensyVersion;
      teensyVersion = teensyVersion.replace(".", "");
      newOption.setAttribute("board", "TEENSY"+teensyVersion);
      select.add(newOption);
    })
    
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

            //Remove the loading spinner
            loadingSpinner = document.getElementById("fwVersionsSpinner");
            loadingSpinner.style.display = "none";

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
        //var url = "https://speeduino.com/fw/basetunes.json";
        var url = "https://github.com/speeduino/Tunes/raw/main/index.json";
        
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
                basetuneList = JSON5.parse(body);
                refreshBasetunes();
            }
        });
    }
    else
    {
        //JSON list of base tunes has been downloaded
        console.log("Tune list downloaded. Populating filters");

        //Grab the select elements
        authorSelect = document.getElementById('basetunesAuthor');
        makeSelect = document.getElementById('basetunesMake');
        typeSelect = document.getElementById('basetunesType');

        //Clear the current values (There shouldn't be any, but safety first)
        while(authorSelect.options.length) { authorSelect.remove(0); }
        while(makeSelect.options.length) { makeSelect.remove(0); }
        while(typeSelect.options.length) { typeSelect.remove(0); }

        //Manually add the 'All' entries
        var newOption1 = document.createElement('option');
        newOption1.innerHTML = "All";
        var newOption2 = document.createElement('option');
        newOption2.innerHTML = "All";
        var newOption3 = document.createElement('option');
        newOption3.innerHTML = "All";
        authorSelect.appendChild(newOption1);
        makeSelect.appendChild(newOption2);
        typeSelect.appendChild(newOption3);

        //The Types list only has 2 valid values "Stock" or "Modified", so these can be added manually
        var stockOption = document.createElement('option');
        var modifiedOption = document.createElement('option');
        stockOption.innerHTML = "Stock";
        modifiedOption.innerHTML = "Modified";
        typeSelect.appendChild(stockOption);
        typeSelect.appendChild(modifiedOption);

        //Create unique sets with all the options
        var authorsSet = new Set();
        var makesSet = new Set();
        for (var tune in basetuneList)
        {
          authorsSet.add(basetuneList[tune].provider);
          makesSet.add(basetuneList[tune].make);
        }
        //Add the options for authors
        for(let item of authorsSet.values())
        {
          var tempOption = document.createElement('option');
          tempOption.innerHTML = item;
          authorSelect.appendChild(tempOption);
        }
        //Add the options for makes
        for(let item of makesSet.values())
        {
          var tempOption = document.createElement('option');
          tempOption.innerHTML = item;
          makeSelect.appendChild(tempOption);
        }

        authorSelect.selectedIndex = 0;
        makeSelect.selectedIndex = 0;
        typeSelect.selectedIndex = 0;
        
        //Apply the filters to the main list
        refreshBasetunesFilters()
    }
}

function refreshBasetunesFilters()
{
  //Get the display list object
  var select = document.getElementById('basetunesSelect');

  //Get the currently selected Author
  selectElement = document.getElementById('basetunesAuthor');
  if(selectElement.selectedIndex == -1) { return; } //Check for no value being selected
  var selectedAuthor = selectElement.options[selectElement.selectedIndex].value;

  //Get the currently selected Make
  selectElement = document.getElementById('basetunesMake');
  if(selectElement.selectedIndex == -1) { return; } //Check for no value being selected
  var selectedMake = selectElement.options[selectElement.selectedIndex].value;

  //Get the currently selected Type
  selectElement = document.getElementById('basetunesType');
  if(selectElement.selectedIndex == -1) { return; } //Check for no value being selected
  var selectedType = selectElement.options[selectElement.selectedIndex].value;

  //Clear the current options from the list
  while(select.options.length)
  {
      select.remove(0);
  }

  var validTunes = 0;
  for (var tune in basetuneList) 
  {
      //Check whether the current tune meets filters
      var AuthorBool = selectedAuthor == "All" || basetuneList[tune].provider == selectedAuthor;
      var MakeBool = selectedMake == "All" || basetuneList[tune].make == selectedMake;
      var TypeBool = selectedType == "All" || basetuneList[tune].type == selectedType;
      if(AuthorBool && MakeBool && TypeBool)
      {
          //var url = basetuneList[tune].baseURL.replace("$VERSION", selectedFW) + basetuneList[tune].filename;
          //console.log("Tune url: " + url);
          //console.log("Found a valid tune: " + basetuneList[tune].displayName);
          var newOption = document.createElement('option');
          newOption.style.background = "#022b3a";
          newOption.dataset.filename = basetuneList[tune].filename;
          newOption.dataset.make = basetuneList[tune].make;
          newOption.dataset.description = basetuneList[tune].description;
          newOption.innerHTML = basetuneList[tune].displayName + " - " + basetuneList[tune].type;
          select.appendChild(newOption);

          validTunes++;
      }
      
  }
  console.log("Tunes that met filters: " + validTunes);
}

function refreshBasetunesDescription()
{
  descriptionElement = document.getElementById('tuneDetailsText');
  //Get the currently selected Tune
  selectElement = document.getElementById('basetunesSelect');
  if(selectElement.selectedIndex == -1) { return; } //Check for no value being selected
  descriptionElement.innerHTML = selectElement.options[selectElement.selectedIndex].dataset.description;
}

function downloadHex(board)
{

    var e = document.getElementById('versionsSelect');

    var DLurl;
    switch(board) {
      case "TEENSY35":
        if(e.options[e.selectedIndex].value == 'master') { DLurl = "http://speeduino.com/fw/teensy35/" + e.options[e.selectedIndex].value + ".hex"; }
        else { DLurl = "http://speeduino.com/fw/teensy35/" + e.options[e.selectedIndex].value + "-teensy35.hex"; }
        console.log("Downloading Teensy 35 firmware: " + DLurl);
        break;
      case "TEENSY36":
        if(e.options[e.selectedIndex].value == 'master') { DLurl = "http://speeduino.com/fw/teensy36/" + e.options[e.selectedIndex].value + ".hex"; }
        else { DLurl = "http://speeduino.com/fw/teensy36/" + e.options[e.selectedIndex].value + "-teensy36.hex"; }
        console.log("Downloading Teensy 36 firmware: " + DLurl);
        break;
      case "TEENSY41":
        if(e.options[e.selectedIndex].value == 'master') { DLurl = "http://speeduino.com/fw/teensy41/" + e.options[e.selectedIndex].value + ".hex"; }
        else { DLurl = "http://speeduino.com/fw/teensy41/" + e.options[e.selectedIndex].value + "-teensy41.hex"; }
        console.log("Downloading Teensy 41 firmware: " + DLurl);
        break;
      case "ATMEGA2560":
        DLurl = "http://speeduino.com/fw/bin/" + e.options[e.selectedIndex].value + ".hex";
        console.log("Downloading AVR firmware: " + DLurl);
        break;
      default:
        DLurl = "http://speeduino.com/fw/bin/" + e.options[e.selectedIndex].value + ".hex";
        console.log("Downloading AVR firmware: " + DLurl);
        break;
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
    var basetuneOption = basetuneSelect.options[basetuneSelect.selectedIndex];
    //var version = document.getElementById('versionsSelect');
    //var DLurl = "https://github.com/noisymime/speeduino/raw/" + version + "/reference/Base%20Tunes/" + e.options[e.selectedIndex].value;
    var DLurl = "https://github.com/speeduino/Tunes/raw/main/" + basetuneOption.dataset.make + "/" + basetuneOption.dataset.filename;
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
    var uploadBoard = portSelect.options[portSelect.selectedIndex].getAttribute("board");

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
            downloadHex(uploadBoard);
        }
        else if(extension == "hex")
        {
            statusText.innerHTML = "Beginning upload..."

            //Retrieve the select serial port
            var e = document.getElementById('portsSelect');
            uploadPort = e.options[e.selectedIndex].value;
            
            console.log("Using port: " + uploadPort);

            //Show the sponsor banner
            document.getElementById('sponsor').style.height = "7em"

            //Begin the upload
            if(uploadBoard.includes("TEENSY"))
            {
              console.log("Uploading using Teensy_loader")
              ipcRenderer.send("uploadFW_teensy", {
                port: uploadPort,
                firmwareFile: file,
                board: uploadBoard
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

