const serialport = require('serialport')
const {ipcRenderer} = require("electron")
const {remote} = require('electron')
const { shell } = require('electron')

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
            select.add(newOption);
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
    DetailsButton.disabled = true;
    ChoosePortButton.disabled = true;

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

            //Re-enable the buttons
            DetailsButton.disabled = false;
            ChoosePortButton.disabled = false;
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

function downloadHex()
{

    var e = document.getElementById('versionsSelect');
    var DLurl = "http://speeduino.com/fw/bin/" + e.options[e.selectedIndex].value + ".hex";
    console.log("Downloading: " + DLurl);
    
    //Download the Hex file
    ipcRenderer.send("download", {
        url: DLurl,
        properties: {directory: "downloads"}
    });

}

function downloadIni()
{

    var e = document.getElementById('versionsSelect');
    var DLurl = "http://speeduino.com/fw/" + e.options[e.selectedIndex].value + ".ini";
    console.log("Downloading: " + DLurl);

    //Download the ini file
    ipcRenderer.send("download", {
        url: DLurl,
        properties: {directory: "downloads"}
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
            downloadHex();
        }
        else if(extension == "hex")
        {
            statusText.innerHTML = "Beginning upload..."

            //Retrieve the select serial port
            var e = document.getElementById('portsSelect');
            uploadPort = e.options[e.selectedIndex].value;
            console.log("Using port: " + uploadPort);

            //Begin the upload
            ipcRenderer.send("uploadFW", {
                port: uploadPort,
                firmwareFile: file
            });
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
        reinstallButton.disabled = true;
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

        reinstallButton.disabled = true;
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

window.onload = function () {
    refreshSerialPorts();
    refreshAvailableFirmwares();
};

