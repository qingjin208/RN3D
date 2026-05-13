# DJI3D Local GLB Viewer

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

## Replace model

- Replace assets/models/model.glb with your own file (same filename).
- If size is not ideal, adjust the scale logic in src/app/index.tsx.

运行程序：
```
cmd /c "cd /d C:\Users\Neil.Zhen\Desktop\DJI3D\DJI3D & npx expo start --tunnel -c"
```

新增或删除模型文件后，执行 npm run models:sync
重启 Expo（建议清缓存）：npx expo start -c
下拉里就会更新为最新文件列表