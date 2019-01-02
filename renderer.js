const serialport = require('serialport')
const {ipcRenderer} = require("electron")

function refreshSerialPorts()
{
    serialport.list((err, ports) => {
        console.log('ports', ports);
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
        for (i = 0; i < select.length; i++) 
        {
            select.options[i] = null;
        }

        //Load the current serial values
        for(var i = 0; i < ports.length; i++)
        {
            var newOption = document.createElement('option');
            newOption.value = ports[i].comName;
            newOption.innerHTML = ports[i].comName;
            select.appendChild(newOption);
        }
      
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
    var request = require('request');
    request.get('http://speeduino.com/fw/versions', function (error, response, body) {
        if (!error && response.statusCode == 200) {

            var lines = body.split('\n');
            // Continue with your processing here.
            select = document.getElementById('versionsSelect');
            for(var i = 0;i < lines.length;i++)
            {
                var newOption = document.createElement('option');
                newOption.value = lines[i];
                newOption.innerHTML = lines[i];
                select.appendChild(newOption);
            }
            select.selectedIndex = 0;
        }
    });
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

    var statusText = document.getElementById('statusText');
    statusText.innerHTML = "Downloading INI file"
    downloadIni();


    ipcRenderer.on("download complete", (event, file) => {
        console.log("Saved file: " + file); // Full file path

        var extension = file.substr(file.length - 3);
        if(extension == "ini")
        {
            statusText.innerHTML = "Downloading firmware"
            downloadHex();
        }
        else if(extension == "hex")
        {
            statusText.innerHTML = "Uploading firmware to board"

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
    });

    ipcRenderer.on("upload error", (event, code) => {
        statusText.innerHTML = "Upload to arduino failed";
    });


}

refreshSerialPorts();
refreshAvailableFirmwares();
