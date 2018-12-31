const serialport = require('serialport')
const ipcRenderer = require("electron")

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
        for(var i = 0;i < ports.length;i++)
        {
            var newOption = document.createElement('option');
            newOption.value = ports[i].comName;
            newOption.innerHTML = ports[i].comName;
            select.appendChild(newOption);
        }
      
      })
}

function downloadFW()
{
    var e = document.getElementById('versionsSelect');
    var DLurl = "http://speeduino.com/fw/bin/" + e.options[e.selectedIndex].value + ".hex";
    console.log(DLurl);
    
    //Download the Hex file
    ipcRenderer.send("download", {
        url: DLurl,
        properties: {directory: "downloads"}
    });

    //Download the ini file
    var DLurl = "http://speeduino.com/fw/" + e.options[e.selectedIndex].value + ".ini";
    ipcRenderer.send("download", {
        url: DLurl,
        properties: {directory: "downloads"}
    });
}

function uploadtoBoard()
{
    "avrdude -v -p atmega2560 -C ./bin/avrdude-darwin-x86/avrdude.conf -c wiring -b 115200 -P /dev/cu.usbmodem14201 -D -U flash:w:/Users/josh/Downloads/201810.hex:i"
}

refreshSerialPorts();
