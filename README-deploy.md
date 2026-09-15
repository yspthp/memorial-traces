# 《被紀念的痕跡》部署說明（GitHub Pages）

## 0. Repo 結構
- index.html：主頁（全部互動與渲染，純客戶端）
- sw.js：離線快取
- .nojekyll：空檔案，停用 Pages 的 Jekyll 處理
- assets/vendor/three.module.js：← Three.js r169 核心
- assets/vendor/loaders/GLTFLoader.js：← three.js 官方 repo 同版本下載（缺則自動退回程序化碑）
- assets/models/plaque.glb：← Meshy 空白碑（選配，缺則程序化碑）

## 1. 上傳與啟用 Pages
1. GitHub 新建 repository（例：memorial-traces），上傳本目錄全部檔案。
2. Settings → Pages → Source: Deploy from a branch → Branch: main / (root) → Save。
3. 約一分鐘後開啟 https://<username>.github.io/<repo>/

## 2. 權限與展場無人值守
- 首次開啟彈相機權限，允許一次即記憶。
- 展場機：chrome --kiosk --use-fake-ui-for-media-stream https://<username>.github.io/<repo>/
- 營運者調參視圖：網址加 ?debug=1

## 3. 離線與更新
- 首次成功載入後 sw.js 快取全部資產；其後展場斷網仍可運行。
- 更新檔案後，訪客於「下一次」開啟取得新版（背景更新）；展場機要立即生效請 Ctrl+Shift+R 一次。

## 4. 本地測試（不上 GitHub 也可以）
本目錄起任意靜態伺服器（例：python -m http.server 8000），
開 http://127.0.0.1:8000 —— localhost 屬安全上下文，相機放行。
⚠ 勿以 http://192.168.x.x 開啟：非 localhost 的 http 瀏覽器禁止相機。

## 5. 隱私與舊硬體
- 無後端、無資料庫；畫面僅頁內處理、即用即棄，不上傳任何影像。
- 舊熱像橋（native-bridge.mjs / COM11 / 8787）不再需要。
