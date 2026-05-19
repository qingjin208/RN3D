# DJI3D Local GLB Viewer

# React项目：Hohenzollern_Castle_optimized

This project is ready to use. It loads a local GLB model and supports rotate, zoom, and pan in the Home tab.

## Model path

- assets/models/model.glb

## Features

- Local GLB loading (bundled asset)
- One-finger rotate
- Two-finger pinch zoom
- Two-finger pan

## Quick start (Windows PowerShell)

If `npm` is blocked by execution policy in PowerShell, use `npm.cmd` and `npx.cmd` directly:

```bash
npm.cmd install
npx.cmd expo start
```

Then open on Android/iOS (Expo Go or emulator), and enter the Home tab.

## Quick start (macOS/Linux or unrestricted shell)

```bash
npm install
npx expo start
```

如果移动设备与PC不在同一局域网使用如下命令运行
```bash
npm install
npx expo start --tunnel -c
```

## Replace model

- Replace assets/models/model.glb with your own file (same filename).
- If size is not ideal, adjust the scale logic in src/app/index.tsx.

运行程序：
```
cmd /c "cd /d C:\Users\Neil.Zhen\Desktop\DJI3D\DJI3D & npx expo start --tunnel -c"
```


