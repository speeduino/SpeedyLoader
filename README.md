# SpeedyLoader
SpeedyLoader is a universal (Cross platform) firmware loader for Speeduino devices. It avoids the need for any compiling and allows the user to select a firmware version and then automatically downloads a pre-compiled version. 

Currently in early development. Binaries will be made available when ready

## Running from binary

## Linux
The AppImage pack requires the following packages be installed:
* libusb-1.0-0:i386
* libusb-0.1-4:i386

On Ubuntu, you can install these with: ```sudo apt install libusb-1.0-0 libusb-0.1-4:i386```

You also need to make sure you have permission to access the serial port. If you get a permission denied error, run:

```sudo usermod -a -G dialout <username here>```

And then logout and back in

## Install from Source

### Pre-Requisites
* NPM - https://www.npmjs.com/get-npm
* Python 2.x
* Git

### Installation steps
```
$ git clone https://github.com/noisymime/SpeedyLoader.git
$ cd SpeedyLoader
$
$ npm install electron-rebuild -g
$ npm install
$ npm start
```
