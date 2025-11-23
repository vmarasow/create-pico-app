# create-pico-app ⚡

A lightning-fast CLI tool to scaffold C/C++ projects for the Raspberry Pi Pico and Pico W.

It handles the complex CMake configuration, sets up VS Code IntelliSense automatically, and provides build/flash scripts so you can start coding immediately.

![npm version](https://img.shields.io/npm/v/create-pico-app)
![license](https://img.shields.io/npm/l/create-pico-app)

## Features

- 🚀 **Zero Config:** Generates a ready-to-build CMake project.
- 🧠 **IntelliSense:** Pre-configured `.vscode` folder (no more red squiggles!).
- 📶 **Pico W Support:** Handles the specific linking for the wireless board.
- 📦 **Local SDK:** Option to download a local copy of the SDK for maximum portability.
- 🛠 **Build Scripts:** Includes `npm run build` and `npm run flash` for cross-platform ease.

## Quick Start

You don't need to install anything globally. Just use `npx`:

```bash
npx create-pico-app my-robot
```

Follow the prompts to select your board (Pico or Pico W) and project name.

## Prerequisites

While this tool creates the project structure, you need the build tools installed on your system to compile the code.

### 1. CMake & Build Tools

- **Windows:** Install [CMake](https://cmake.org/download/) and [Ninja](https://ninja-build.org/) (or Make).
- **Mac:** `brew install cmake`
- **Linux:** `sudo apt install cmake build-essential`

### 2. ARM GCC Compiler

You need the `arm-none-eabi-gcc` toolchain.

- **Windows:** Install the [Arm GNU Toolchain](https://developer.arm.com/downloads/-/arm-gnu-toolchain-downloads).
- **Mac:** `brew install --cask gcc-arm-embedded`
- **Linux:** `sudo apt install gcc-arm-none-eabi libnewlib-arm-none-eabi`

## Usage

Once you have scaffolded your project:

```Bash
cd my-robot
```

### Build the Project

Compiles the C++ code into a .uf2 file.

```Bash
npm run build
```

### Flash to Pico

Connect your Pico while holding the BOOTSEL button, then run:

```Bash
npm run flash
```

(This script auto-detects the mounted Pico on Windows, macOS, and Linux and copies the firmware).

## License

MIT
